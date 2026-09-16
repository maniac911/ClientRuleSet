#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
import sys


def run_candidate(image: str, candidates: list[list[str]]) -> str:
    errors: list[str] = []
    for args in candidates:
        proc = subprocess.run(["docker", "run", "--rm", image, *args], text=True, capture_output=True)
        output = (proc.stdout + "\n" + proc.stderr).strip()
        if proc.returncode == 0 and output:
            return output
        errors.append(f"{' '.join(args)} => exit {proc.returncode}: {output}")
    raise RuntimeError("; ".join(errors))


def verify(name: str, image: str, tag: str, candidates: list[list[str]]) -> None:
    expected = tag.removeprefix("v")
    output = run_candidate(image, candidates)
    print(f"[{name}] {output}")
    if expected not in output:
        raise RuntimeError(f"{name} image {image} did not report expected version {expected}")


def main() -> None:
    try:
        verify(
            "sing-box",
            os.environ["SING_BOX_IMAGE"],
            os.environ["SING_BOX_TAG"],
            [["version"], ["--version"]],
        )
        verify(
            "Mihomo",
            os.environ["MIHOMO_IMAGE"],
            os.environ["MIHOMO_TAG"],
            [["-v"], ["version"], ["--version"]],
        )
    except Exception as exc:
        print(f"::error::{exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
