#!/usr/bin/env python3
"""Protect fork-owned automation from accidental GitHub "Sync fork" updates.

This check intentionally validates stable invariants instead of file hashes so
Dependabot can still update pinned GitHub Action SHAs without requiring a second
manifest update.
"""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path.cwd()
SUMMARY = Path(os.environ.get("GITHUB_STEP_SUMMARY", "/dev/null"))

# Only these workflow files are allowed in this fork. If GitHub's web UI imports
# a new upstream workflow during a manual "Sync fork", the build is stopped.
ALLOWED_WORKFLOWS = {
    "benchmark-download.yml",
    "check-source-domain.yml",
    "fork-binary-rules.yml",
}

# These are upstream workflows that this fork intentionally does not keep.
FORBIDDEN_PATHS = {
    ".github/workflows/main.yml",
    ".github/workflows/toggle-dist-repo-visibility.yml",
}

# Core fork-only files that must survive every upstream sync.
REQUIRED_PATHS = {
    ".github/dependabot.yml",
    ".github/workflows/benchmark-download.yml",
    ".github/workflows/check-source-domain.yml",
    ".github/workflows/fork-binary-rules.yml",
    "ForkExtras/clients.yml",
    "ForkExtras/Clients/run.cjs",
    "ForkExtras/Scripts/build_plan.py",
    "ForkExtras/Scripts/fork_integrity.py",
}

# Sentinel comments distinguish the fork-owned YAML files from upstream copies.
REQUIRED_MARKERS = {
    ".github/dependabot.yml": "FORK-INTEGRITY: dependabot",
    ".github/workflows/benchmark-download.yml": "FORK-INTEGRITY: benchmark-download",
    ".github/workflows/check-source-domain.yml": "FORK-INTEGRITY: check-source-domain",
    ".github/workflows/fork-binary-rules.yml": "FORK-INTEGRITY: main-sync-build",
}

# Critical semantics that must remain in the main workflow. These checks catch
# accidental replacement even when the file name itself still exists.
MAIN_WORKFLOW_SNIPPETS = (
    "secrets.SYNC_TOKEN",
    "git checkout \"${before_merge}\" -- .github/workflows",
    "git checkout \"${before_merge}\" -- .github/dependabot.yml",
    "ForkExtras/Scripts/fork_integrity.py",
    "CLIENT_RELEASE_STRICT: \"1\"",
    "Publish generated output to rules-dist",
)


def error(message: str, errors: list[str]) -> None:
    errors.append(message)
    print(f"::error::{message}")


def main() -> None:
    errors: list[str] = []
    workflows_dir = ROOT / ".github/workflows"

    if not workflows_dir.is_dir():
        error("Missing .github/workflows directory", errors)
        actual_workflows: set[str] = set()
    else:
        actual_workflows = {
            path.name for path in workflows_dir.iterdir() if path.is_file()
        }

    unexpected = sorted(actual_workflows - ALLOWED_WORKFLOWS)
    missing_allowed = sorted(ALLOWED_WORKFLOWS - actual_workflows)

    if unexpected:
        error(
            "Unexpected workflow file(s) detected; possible manual Sync fork import: "
            + ", ".join(unexpected),
            errors,
        )
    if missing_allowed:
        error(
            "Required fork workflow file(s) missing: " + ", ".join(missing_allowed),
            errors,
        )

    for relative in sorted(FORBIDDEN_PATHS):
        if (ROOT / relative).exists():
            error(
                f"Forbidden upstream workflow restored: {relative}. "
                "Do not use GitHub's web Sync fork without reviewing fork automation.",
                errors,
            )

    for relative in sorted(REQUIRED_PATHS):
        if not (ROOT / relative).exists():
            error(f"Required fork-owned path missing: {relative}", errors)

    for relative, marker in REQUIRED_MARKERS.items():
        path = ROOT / relative
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if marker not in text:
            error(
                f"Fork integrity marker missing from {relative}: {marker}",
                errors,
            )

    main_workflow = ROOT / ".github/workflows/fork-binary-rules.yml"
    if main_workflow.is_file():
        text = main_workflow.read_text(encoding="utf-8")
        for snippet in MAIN_WORKFLOW_SNIPPETS:
            if snippet not in text:
                error(
                    "Critical fork sync/build behavior is missing from "
                    f"fork-binary-rules.yml: {snippet}",
                    errors,
                )

    with SUMMARY.open("a", encoding="utf-8") as handle:
        handle.write("## Fork integrity guard\n\n")
        handle.write(f"- Allowed workflow files: `{len(ALLOWED_WORKFLOWS)}`\n")
        handle.write(f"- Unexpected workflow files: `{len(unexpected)}`\n")
        handle.write(f"- Integrity errors: `{len(errors)}`\n")
        if errors:
            handle.write("- Result: **blocked**\n")
            for message in errors:
                handle.write(f"  - {message}\n")
        else:
            handle.write("- Result: **passed**\n")

    if errors:
        raise SystemExit(
            "Fork integrity check failed. Review recent manual Sync fork or automation changes."
        )

    print("Fork integrity check passed.")


if __name__ == "__main__":
    main()
