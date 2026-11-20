#!/usr/bin/env python3
"""Preview, verify, or install pinned ECC references from an existing local Git repository."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from tempfile import TemporaryDirectory


MANIFEST = Path(__file__).resolve().parent / "skill-adapters/ecc/sources.json"
DESTINATION = MANIFEST.parent / "upstream"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_blobs(repo: Path, revision: str, entries: dict) -> dict:
    git = ["git", "-C", str(repo)]
    environment = dict(os.environ, GIT_NO_LAZY_FETCH="1")
    subprocess.run([*git, "cat-file", "-e", f"{revision}^{{commit}}"], check=True, env=environment)
    blobs = {}
    for filename, entry in entries.items():
        data = subprocess.check_output(
            [*git, "cat-file", "blob", f"{revision}:{entry['source']}"], env=environment
        )
        if sha256(data) != entry["sha256"]:
            raise ValueError(f"Source checksum mismatch: {entry['source']}")
        blobs[filename] = data
    return blobs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--check", action="store_true", help="Verify installed files offline")
    modes.add_argument("--install", action="store_true", help="Install missing files")
    parser.add_argument("--source-repo", type=Path, help="Verify blobs from this local Git repository")
    args = parser.parse_args()

    config = json.loads(MANIFEST.read_text(encoding="utf-8"))
    revision = config["revision"]
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("A full Git commit SHA is required")
    entries = {}
    for entry in config["files"]:
        filename = entry["destination"]
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9.-]*", filename) or filename in entries:
            raise ValueError(f"Invalid or duplicate destination: {filename}")
        entries[filename] = entry

    if DESTINATION.resolve() != DESTINATION or (DESTINATION.exists() and not DESTINATION.is_dir()):
        raise ValueError(f"Refusing destination: {DESTINATION}")
    if DESTINATION.exists():
        unexpected = sorted(path.name for path in DESTINATION.iterdir() if path.name not in entries)
        if unexpected:
            raise ValueError(f"Unexpected entries preserved in {DESTINATION.name}: {', '.join(unexpected)}")

    missing = []
    conflicts = []
    for filename, entry in entries.items():
        target = DESTINATION / filename
        if target.is_symlink() or (
            target.exists() and (not target.is_file() or sha256(target.read_bytes()) != entry["sha256"])
        ):
            conflicts.append(filename)
            status = "CONFLICT"
        elif target.exists():
            status = "VERIFIED"
        else:
            missing.append(filename)
            status = "MISSING" if args.check else "PENDING"
        print(f"{status} {target}")
    if conflicts:
        raise ValueError("Existing files preserved. Compare with the pinned blobs in the source repository.")

    blobs = read_blobs(args.source_repo, revision, entries) if args.source_repo else {}
    if args.check:
        return int(bool(missing))
    if not args.install or not missing:
        return 0
    if not blobs:
        raise ValueError("--source-repo is required to install missing files")

    DESTINATION.mkdir(exist_ok=True)
    with TemporaryDirectory(prefix="ecc-blobs-", dir=DESTINATION.parent) as temporary:
        for filename in missing:
            staged = Path(temporary) / filename
            staged.write_bytes(blobs[filename])
            # Publish the complete file only if its destination does not already exist.
            os.link(staged, DESTINATION / filename)
            print(f"INSTALLED {DESTINATION / filename}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        sys.exit(f"ERROR: {error}")
