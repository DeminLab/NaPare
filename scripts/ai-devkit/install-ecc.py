#!/usr/bin/env python3
"""Prepare the pinned ECC source and its NaPare Codex entry points without running upstream code."""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
import zipfile


ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache/ai-devkit/ecc"
SKILLS = ROOT / ".agents/skills"
AGENTS = ROOT / ".codex/agents"
SOURCE = ROOT / "scripts/ai-devkit/skill-adapters/ecc/sources.json"
CATALOG = CACHE / "catalog.json"
ARCHIVE = CACHE / "upstream.zip"
REFERENCE = CACHE / "references"
PROJECT_MCP = {
    "chrome-devtools": "chrome_devtools",
    "context7": "context7",
    "github": "github",
    "playwright": "playwright",
}
LOCAL_EQUIVALENTS = {
    "filesystem": "Codex project-scoped file and shell tools",
    "memory": "docs/ai-devkit/project-memory.md",
    "sequential-thinking": "Codex planning and reasoning",
}
REFERENCE_SKILLS = {
    "security-bounty-hunter",
    "osint-investigation",
    "web-perimeter-owasp-2025-audit",
    "defi-amm-security",
}
NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
GUARD = (
    "Read NaPare AGENTS.md and AI_CONTEXT.md first. Use the upstream material as reference. "
    "Apply only steps that fit the requested task, the project stack and current permissions. "
    "Review scripts before running them. Use synthetic data. External writes, remote accounts, "
    "paid services, production and publication follow NaPare's authorization rules. "
    "Use the project's actual tools and commands. Report any required unavailable runtime."
)


def digest_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def encode_json(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def git(repo, *arguments):
    return subprocess.check_output(
        ["git", "-C", str(repo), *arguments],
        env={**os.environ, "GIT_NO_LAZY_FETCH": "1"},
    )


def git_paths(repo, revision):
    rows = git(repo, "ls-tree", "-r", "-z", revision).decode("utf-8").split("\0")
    paths = {}
    for row in filter(None, rows):
        metadata, name = row.split("\t", 1)
        mode, kind, blob = metadata.split()
        path = PurePosixPath(name)
        if kind != "blob" or mode not in {"100644", "100755"} or path.is_absolute() or ".." in path.parts:
            raise ValueError(f"Unsupported upstream entry: {name}")
        paths[name] = blob
    return paths


def git_blob(data):
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


def description(source, fallback):
    front = re.match(r"^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)", source)
    if not front:
        return fallback
    entry = re.search(r"^description:[ \t]*(.*(?:\r?\n[ \t]+[^\r\n]*)*)", front[1], re.M)
    if not entry:
        return fallback
    summary = re.sub(r"^\s*[>|][-+]?\s*", "", entry[1])
    summary = " ".join(summary.split()).strip("'\"")
    return summary[:200] or fallback


def write_skill(name, summary, source):
    body = (
        f"---\nname: {name}\ndescription: {json.dumps(summary, ensure_ascii=False)}\n---\n\n"
        f"# {name}\n\n{GUARD}\n\n"
        f"Read the pinned reference at `{source}` from the project root.\n"
    )
    return body.encode("utf-8")


def write_agent(name, summary, source):
    instructions = (
        f"You are the {name} Codex agent for NaPare. Work within the parent's assigned scope. "
        f"{GUARD}\n"
        f"Read the pinned reference at {source} from the repo root and apply the relevant reasoning. "
        "Return findings with paths and checked evidence."
    )
    fields = {"name": name, "description": summary, "developer_instructions": instructions}
    return "".join(f"{key} = {json.dumps(value, ensure_ascii=False)}\n" for key, value in fields.items()).encode("utf-8")


def classify(archive, paths):
    entries = []
    outputs = {}
    patterns = {
        "skill": r"skills/([^/]+)/SKILL\.md",
        "agent": r"agents/([^/]+)\.md",
        "codex-agent": r"\.codex/agents/([^/]+)\.toml",
        "command": r"commands/([^/]+)\.md",
    }
    for source in sorted(paths):
        for kind, pattern in patterns.items():
            match = re.fullmatch(pattern, source)
            if match:
                name = match[1]
                if not NAME.fullmatch(name):
                    raise ValueError(f"Unsupported component name: {name}")
                entry = {"kind": kind, "name": name, "source": source, "blob": paths[source]}
                entries.append(entry)
                if kind == "codex-agent":
                    alias = {"explorer": "explorer", "reviewer": "code-reviewer", "docs-researcher": "technical-writer"}
                    entry.update(status="project-equivalent", codex=alias[name])
                    break
                if kind == "skill" and name in REFERENCE_SKILLS:
                    entry.update(status="reference-only", reason="Use the NaPare security skill for bounded defensive review")
                    break
                component = f"ecc-{name}" if kind != "command" else f"ecc-command-{name}"
                reference = add_reference(archive, source, entry, outputs)
                summary = description(outputs[ROOT / reference].decode("utf-8"), f"ECC {kind} for {name}")
                if kind == "agent":
                    target = AGENTS / f"{component}.toml"
                    contents = write_agent(component, summary, reference)
                else:
                    target = SKILLS / component / "SKILL.md"
                    contents = write_skill(component, summary, reference)
                if target in outputs:
                    raise ValueError(f"Duplicate Codex component: {component}")
                outputs[target] = contents
                if kind != "agent":
                    outputs[target.parent / "agents/openai.yaml"] = (
                        b"policy:\n  allow_implicit_invocation: false\n"
                    )
                entry.update(status="codex-entry", codex=component)
                break
        else:
            match = re.match(r"^(rules|contexts|workflows|ecc2|hooks)/", source)
            if match:
                entry = {
                    "kind": match[1], "name": source, "source": source, "blob": paths[source],
                    "status": "reference-only",
                    "reason": "Use on-demand project guidance; upstream runtime or other client required for automation",
                }
                if match[1] in {"rules", "contexts"} and source.endswith(".md"):
                    entry.update(status="codex-guidance", codex="ecc-catalog")
                    add_reference(archive, source, entry, outputs)
                    del entry["reason"]
                equivalents = {
                    "hooks/codex-hooks.json": "docs/ecc/.codex/hooks.json (SessionStart)",
                    "workflows/orch-review.workflow.js": "napare-code-review + ecc-command-orch-review",
                    "hooks/memory-persistence/hooks.json": "docs/ai-devkit/project-memory.md",
                }
                if source in equivalents:
                    entry.update(status="project-equivalent", codex=equivalents[source])
                    del entry["reason"]
                entries.append(entry)
    for source in (".mcp.json", "mcp-configs/mcp-servers.json"):
        for name, server in json.loads(archive.read(source))["mcpServers"].items():
            entry = {
                "kind": "mcp", "name": name, "source": source, "blob": paths[source],
                "transport": "http" if server.get("url") else "stdio",
            }
            if name in PROJECT_MCP:
                entry.update(status="project-equivalent", codex=PROJECT_MCP[name])
            elif name in LOCAL_EQUIVALENTS:
                entry.update(status="project-equivalent", codex=LOCAL_EQUIVALENTS[name])
            else:
                if entry["transport"] == "http":
                    reason = "Remote service; review access, data disclosure and costs before connection"
                elif server.get("env"):
                    reason = "Requires an external account or environment-provided configuration"
                else:
                    reason = "Requires a separate executable or package and runtime review"
                entry.update(status="reference-only", reason=reason)
            entries.append(entry)
    return entries, outputs


def reference_path(name):
    path = PurePosixPath(name)
    if (not path.parts or path.as_posix() != name or path.is_absolute() or ".." in path.parts or
        path.parts[0] not in {"skills", "agents", "commands", "rules", "contexts"} or
        path.suffix != ".md" or not re.fullmatch(r"[a-zA-Z0-9_./-]+", name)):
        raise ValueError(f"Invalid reference path: {name}")
    return REFERENCE / name


def add_reference(archive, source, entry, outputs):
    target = reference_path(source)
    outputs[target] = archive.read(source)
    relative = target.relative_to(ROOT).as_posix()
    entry["reference"] = relative
    return relative


def validate_archive(path, source, paths):
    with zipfile.ZipFile(path) as archive:
        actual = {item.filename for item in archive.infolist() if not item.is_dir()}
        if actual != set(paths):
            raise ValueError("ECC archive and pinned Git tree contain different file paths")
        for name, blob in paths.items():
            if git_blob(archive.read(name)) != blob:
                raise ValueError(f"ECC archive differs from pinned Git blob: {name}")
        for entry in source["files"]:
            if hashlib.sha256(archive.read(entry["source"])).hexdigest() != entry["sha256"]:
                raise ValueError(f"Reference checksum mismatch: {entry['source']}")
        return classify(archive, paths)


def validate_target(path):
    if path.resolve() != path:
        raise ValueError(f"Refusing linked destination: {path}")


def publish(outputs, staging):
    for target, contents in outputs.items():
        validate_target(target)
        if target.exists():
            matching = target.is_file() and target.read_bytes() == contents
            if not matching:
                raise ValueError(f"Existing file preserved: {target}")
    published = []
    try:
        for index, (target, contents) in enumerate(outputs.items()):
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            staged = staging / f"output-{index}"
            staged.write_bytes(contents)
            os.link(staged, target)
            published.append(target)
    except OSError:
        for target in reversed(published):
            target.unlink()
        raise
    return len(published)


def verified_installation(source):
    validate_target(CATALOG)
    validate_target(ARCHIVE)
    catalog = json.loads(CATALOG.read_bytes())
    if catalog["revision"] != source["revision"] or catalog["archive_sha256"] != digest_file(ARCHIVE):
        raise ValueError("ECC cache revision or archive hash mismatch")
    for name, expected in catalog["derived_sha256"].items():
        reference_prefix = REFERENCE.relative_to(ROOT).as_posix() + "/"
        if name.startswith(reference_prefix):
            reference_path(name.removeprefix(reference_prefix))
        elif not re.fullmatch(
            r"(?:\.agents/skills/ecc-[a-z0-9-]+/(?:SKILL\.md|agents/openai\.yaml)|"
            r"\.codex/agents/ecc-[a-z0-9-]+\.toml)", name
        ):
            raise ValueError(f"Unexpected generated path: {name}")
        target = ROOT / name
        validate_target(target)
        if digest_file(target) != expected:
            raise ValueError(f"Generated file differs: {name}")
    return catalog


def check(source):
    catalog = verified_installation(source)
    native_count = sum(entry["status"] == "codex-entry" for entry in catalog["entries"])
    print(f"ECC {source['version']}: {catalog['source_files']} source files, "
          f"{len(catalog['entries'])} catalog entries, {native_count} Codex entry points")


def install(source, repo):
    revision = source["revision"]
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("ECC source must be pinned to a full commit SHA")
    validate_target(CACHE)
    CACHE.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="build-", dir=CACHE) as location:
        staging = Path(location)
        archive = staging / "source.zip"
        paths = git_paths(repo, revision)
        git(repo, "archive", "--format=zip", f"--output={archive}", revision)
        entries, outputs = validate_archive(archive, source, paths)
        catalog = {
            "repository": source["repository"], "version": source["version"], "revision": revision,
            "archive_sha256": digest_file(archive), "source_files": len(paths), "entries": entries,
            "derived_sha256": {
                target.relative_to(ROOT).as_posix(): hashlib.sha256(contents).hexdigest()
                for target, contents in outputs.items()
            },
        }
        outputs[ARCHIVE] = archive.read_bytes()
        outputs[CATALOG] = encode_json(catalog)
        print(f"Published {publish(outputs, staging)} files")
    check(source)


def read_reference(name, source):
    validate_target(CATALOG)
    validate_target(ARCHIVE)
    catalog = json.loads(CATALOG.read_bytes())
    if catalog["revision"] != source["revision"]:
        raise ValueError("ECC reference catalog is stale")
    entry = next((entry for entry in catalog["entries"] if entry["source"] == name), None)
    if not entry or entry["kind"] not in {"skill", "agent", "command", "rules", "contexts"}:
        raise ValueError("Path is outside the documented ECC reference surface")
    if entry["kind"] == "skill" and entry["name"] in REFERENCE_SKILLS:
        raise ValueError("Use the corresponding project guidance for defensive review")
    if PurePosixPath(name).suffix != ".md":
        raise ValueError("Only Markdown reference material can be read")
    with zipfile.ZipFile(ARCHIVE) as archive:
        data = archive.read(name)
    if git_blob(data) != entry["blob"]:
        raise ValueError("ECC reference hash mismatch")
    sys.stdout.buffer.write(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--source-repo", type=Path, help="Build from a local Git repository containing the pinned ECC commit")
    modes.add_argument("--check", action="store_true", help="Verify the built cache and entry points offline")
    modes.add_argument("--read", metavar="PATH", help="Read a Markdown reference without running it")
    modes.add_argument("--remove", action="store_true", help="Remove only verified generated entry points and cache")
    args = parser.parse_args()
    source = json.loads(SOURCE.read_bytes())
    if args.source_repo:
        install(source, args.source_repo.resolve())
    elif args.check:
        check(source)
    elif args.remove:
        catalog = verified_installation(source)
        for name in catalog["derived_sha256"]:
            (ROOT / name).unlink()
        ARCHIVE.unlink()
        CATALOG.unlink()
        print("Removed verified ECC-generated files.")
    else:
        read_reference(args.read, source)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, zipfile.BadZipFile) as error:
        sys.exit(f"ECC: {error}")
