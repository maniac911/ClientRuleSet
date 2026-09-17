#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

LOCKFILE = Path("pnpm-lock.yaml")
STATE_FILE = Path(".dependency-lock-state.json")
GITHUB_ENV = os.environ.get("GITHUB_ENV")
ERROR_MARKER = "ERR_PNPM_OUTDATED_LOCKFILE"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if proc.stdout:
        print(proc.stdout, end="" if proc.stdout.endswith("\n") else "\n")
    return proc


def write_state(*, upstream_valid: bool, auto_repaired: bool, source_hash: str, resolved_hash: str) -> None:
    state = {
        "upstream_lockfile_was_valid": upstream_valid,
        "auto_repaired": auto_repaired,
        "source_sha256": source_hash,
        "resolved_sha256": resolved_hash,
    }
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")

    if GITHUB_ENV:
        with open(GITHUB_ENV, "a", encoding="utf-8") as handle:
            handle.write(f"DEPENDENCY_LOCK_AUTO_REPAIRED={'true' if auto_repaired else 'false'}\n")
            handle.write(f"DEPENDENCY_LOCK_SOURCE_SHA256={source_hash}\n")
            handle.write(f"DEPENDENCY_LOCK_RESOLVED_SHA256={resolved_hash}\n")


def main() -> None:
    if not LOCKFILE.is_file():
        print("::error::pnpm-lock.yaml is missing")
        raise SystemExit(1)

    source_hash = sha256(LOCKFILE)

    print("[deps] Trying strict pnpm install with the upstream lockfile...")
    strict = run(["pnpm", "install", "--frozen-lockfile"])
    if strict.returncode == 0:
        write_state(
            upstream_valid=True,
            auto_repaired=False,
            source_hash=source_hash,
            resolved_hash=source_hash,
        )
        print(f"[deps] Upstream lockfile is valid: {source_hash}")
        return

    output = strict.stdout or ""
    if ERROR_MARKER not in output:
        print(f"::error::Dependency install failed for a reason other than {ERROR_MARKER}; refusing automatic repair")
        raise SystemExit(strict.returncode or 1)

    print(f"::warning::{ERROR_MARKER} detected; regenerating only pnpm-lock.yaml in the CI workspace")
    repair = run(["pnpm", "install", "--lockfile-only", "--no-frozen-lockfile"])
    if repair.returncode != 0:
        print("::error::Lockfile-only repair failed")
        raise SystemExit(repair.returncode or 1)

    resolved_hash = sha256(LOCKFILE)
    if resolved_hash == source_hash:
        print("::error::Lockfile repair reported success but pnpm-lock.yaml did not change")
        raise SystemExit(1)

    print("[deps] Re-validating the repaired lockfile with frozen-lockfile enabled...")
    verify = run(["pnpm", "install", "--frozen-lockfile"])
    if verify.returncode != 0:
        print("::error::Repaired lockfile still fails strict installation; refusing to build")
        raise SystemExit(verify.returncode or 1)

    write_state(
        upstream_valid=False,
        auto_repaired=True,
        source_hash=source_hash,
        resolved_hash=resolved_hash,
    )
    print(f"[deps] Auto-repair verified successfully: {source_hash} -> {resolved_hash}")


if __name__ == "__main__":
    main()
