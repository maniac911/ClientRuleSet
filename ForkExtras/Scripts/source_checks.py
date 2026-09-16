#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")


def annotate(level: str, message: str, file: Path | None = None, line: int | None = None) -> None:
    location = ""
    if file is not None:
        location = f" file={file}"
        if line is not None:
            location += f",line={line}"
    print(f"::{level}{location}::{message}")


def files_under(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return sorted(path for path in root.rglob("*") if path.is_file())


def duplicates(root: Path) -> list[tuple[Path, int, int, str]]:
    found: list[tuple[Path, int, int, str]] = []
    for file in files_under(root):
        seen: dict[str, int] = {}
        try:
            lines = file.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        for number, raw in enumerate(lines, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line in seen:
                found.append((file, number, seen[line], line))
            else:
                seen[line] = number
    return found


def append_summary(title: str, rows: list[str]) -> None:
    if not SUMMARY:
        return
    with open(SUMMARY, "a", encoding="utf-8") as handle:
        handle.write(f"\n## {title}\n\n")
        for row in rows:
            handle.write(f"- {row}\n")


def pre_overlay() -> int:
    fork = Path("ForkExtras/Source")
    upstream = Path("Source")
    collisions: list[tuple[Path, Path]] = []
    for source in files_under(fork):
        rel = source.relative_to(fork)
        target = upstream / rel
        if target.exists():
            collisions.append((source, target))

    own_duplicates = duplicates(fork)
    for source, target in collisions:
        annotate("error", f"Fork overlay would overwrite upstream file {target}", source)
    for file, line, first, value in own_duplicates:
        annotate("error", f"Fork-only duplicate of line {first}: {value}", file, line)

    append_summary(
        "Pre-overlay source checks",
        [
            f"Path collisions with upstream Source: `{len(collisions)}`",
            f"ForkExtras duplicate rules: `{len(own_duplicates)}`",
        ],
    )
    return 1 if collisions or own_duplicates else 0


def post_overlay() -> int:
    merged_duplicates = duplicates(Path("Source"))
    for file, line, first, value in merged_duplicates:
        annotate("warning", f"Duplicate of line {first}: {value}", file, line)
    append_summary(
        "Post-overlay duplicate check",
        [f"Merged Source duplicate rules: `{len(merged_duplicates)}`"],
    )
    return 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["pre-overlay", "post-overlay"])
    args = parser.parse_args()
    raise SystemExit(pre_overlay() if args.mode == "pre-overlay" else post_overlay())


if __name__ == "__main__":
    main()
