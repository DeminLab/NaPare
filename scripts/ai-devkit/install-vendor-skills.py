#!/usr/bin/env python3
"""Install reviewed, commit-pinned project skills without running upstream code.

Python 3.11+ standard library only. Existing directories are never overwritten.
Downloads public GitHub archives without reading or forwarding credentials.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "docs/ai-devkit/vendor-skills.json"


def contained(base: Path, relative: str) -> Path:
    parts = PurePosixPath(relative)
    if parts.is_absolute() or ".." in parts.parts or "\\" in relative or ":" in relative:
        raise ValueError(f"Unsafe relative path: {relative}")
    target = base.joinpath(*parts.parts)
    if not target.resolve().is_relative_to(base.resolve()):
        raise ValueError(f"Path escapes root: {relative}")
    current = target
    while current != base:
        if current.is_symlink() or (hasattr(current, "is_junction") and current.is_junction()):
            raise ValueError(f"Refusing linked path: {relative}")
        current = current.parent
    return target


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def archive(package: dict) -> zipfile.ZipFile:
    repo, revision = package["repo"], package["revision"]
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
        raise ValueError("Invalid GitHub repository")
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("A full immutable Git commit is required")
    request = urllib.request.Request(
        f"https://codeload.github.com/{repo}/zip/{revision}",
        headers={"User-Agent": "NaPare-AI-DevKit"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read(160 * 1024 * 1024 + 1)
    if len(data) > 160 * 1024 * 1024:
        raise ValueError("Archive exceeds download size limit")
    return zipfile.ZipFile(io.BytesIO(data))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Offline integrity/discovery check")
    parser.add_argument("--source-cache", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    config = json.loads(MANIFEST.read_text(encoding="utf-8"))
    errors = 0
    skills_root = contained(ROOT, ".agents/skills")
    if not args.check:
        skills_root.mkdir(parents=True, exist_ok=True)
    for package in config["packages"]:
        downloaded = None
        for skill in package["skills"]:
            target = contained(skills_root, skill["name"])
            if target.exists():
                if skill.get("preserve_existing"):
                    if not (target / "SKILL.md").is_file():
                        errors += 1
                        print(f"ERROR {skill['name']}: existing directory has no SKILL.md")
                    else:
                        print(f"PRESERVED {skill['name']} (existing installation; not upstream integrity proof)")
                    continue
                drift = [entry["destination"] for entry in skill["files"]
                         if not contained(target, entry["destination"]).is_file()
                         or digest(contained(target, entry["destination"]).read_bytes()) != entry["sha256"]]
                if drift:
                    errors += 1
                    print(f"CONFLICT {skill['name']}: preserved; {len(drift)} missing/modified files")
                else:
                    print(f"VERIFIED {skill['name']}")
                continue
            if args.check:
                errors += 1
                print(f"MISSING {skill['name']}")
                continue
            with tempfile.TemporaryDirectory(prefix="napare-skill-") as temporary:
                staged = Path(temporary) / skill["name"]
                staged.mkdir()
                for entry in skill["files"]:
                    if "local" in entry:
                        data = contained(ROOT, entry["local"]).read_bytes()
                    elif args.source_cache:
                        cached = contained(args.source_cache.resolve(), package["repo"].replace("/", "--"))
                        candidates = list(cached.glob("*-" + package["revision"]))
                        if len(candidates) != 1:
                            raise ValueError(f"Missing pinned source cache for {package['repo']}")
                        data = contained(candidates[0], entry["source"]).read_bytes()
                    else:
                        if downloaded is None:
                            downloaded = archive(package)
                        prefixes = {p.split("/")[0] for p in downloaded.namelist() if p}
                        if len(prefixes) != 1:
                            raise ValueError("Unexpected archive root")
                        source = entry["source"]
                        contained(staged, source)  # Validate before archive lookup.
                        member = downloaded.getinfo(next(iter(prefixes)) + "/" + source)
                        if stat.S_ISLNK(member.external_attr >> 16):
                            raise ValueError("Refusing archive symlink")
                        if member.file_size > 20 * 1024 * 1024:
                            raise ValueError("Skill file exceeds size limit")
                        data = downloaded.read(member)
                    if digest(data) != entry["sha256"]:
                        raise ValueError(f"Checksum mismatch: {skill['name']}/{entry['destination']}")
                    destination = contained(staged, entry["destination"])
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(data)
                if not (staged / "SKILL.md").is_file():
                    raise ValueError("Skill has no SKILL.md")
                # copytree refuses a destination created concurrently; no force/overwrite path.
                shutil.copytree(staged, target)
                print(f"INSTALLED {skill['name']}")
        if downloaded:
            downloaded.close()
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
