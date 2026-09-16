#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT = Path.cwd()
DIST_BRANCH = os.environ.get("DIST_BRANCH", "rules-dist")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
FORCE_REBUILD = os.environ.get("FORCE_REBUILD", "false").lower() == "true"
OUTPUT_FILE = Path(os.environ["GITHUB_OUTPUT"])
SUMMARY_FILE = Path(os.environ.get("GITHUB_STEP_SUMMARY", "/dev/null"))

FINGERPRINT_PATHS = [
    "Build",
    "Source",
    "ForkExtras",
    ".node-version",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "tsconfig.test.json",
]


def run(*args: str, check: bool = True) -> str:
    proc = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
    if check and proc.returncode != 0:
        sys.stderr.write(proc.stdout)
        sys.stderr.write(proc.stderr)
        raise SystemExit(proc.returncode)
    return proc.stdout.strip()


def latest_stable_release(repo: str) -> str:
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ClientRuleSet-build-plan",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)
    if data.get("draft") or data.get("prerelease"):
        raise RuntimeError(f"GitHub latest release for {repo} is not stable")
    tag = str(data.get("tag_name", ""))
    if not tag.startswith("v") or not tag[1:2].isdigit():
        raise RuntimeError(f"Unexpected release tag for {repo}: {tag!r}")
    return tag


def tracked_fingerprint() -> tuple[str, int]:
    proc = subprocess.run(
        ["git", "ls-files", "-z", "--", *FINGERPRINT_PATHS],
        cwd=ROOT,
        capture_output=True,
        check=True,
    )
    paths = sorted(p.decode("utf-8") for p in proc.stdout.split(b"\0") if p)
    digest = hashlib.sha256()
    count = 0
    for rel in paths:
        path = ROOT / rel
        if not path.is_file():
            continue
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
        count += 1
    return digest.hexdigest(), count


def previous_metadata() -> dict:
    fetch = subprocess.run(
        ["git", "fetch", "--no-tags", "origin", f"{DIST_BRANCH}:refs/remotes/origin/{DIST_BRANCH}"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if fetch.returncode != 0:
        return {}
    show = subprocess.run(
        ["git", "show", f"refs/remotes/origin/{DIST_BRANCH}:BUILD-METADATA.json"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if show.returncode != 0:
        return {}
    try:
        return json.loads(show.stdout)
    except json.JSONDecodeError:
        return {}


def emit(name: str, value: str) -> None:
    with OUTPUT_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"{name}={value}\n")


def main() -> None:
    source_sha = run("git", "rev-parse", "HEAD")
    upstream_sha = run("git", "merge-base", "HEAD", "upstream/master")
    fingerprint, fingerprint_files = tracked_fingerprint()

    sing_box_tag = latest_stable_release("SagerNet/sing-box")
    mihomo_tag = latest_stable_release("MetaCubeX/mihomo")
    sing_box_image = f"ghcr.io/sagernet/sing-box:{sing_box_tag}"
    mihomo_image = f"docker.io/metacubex/mihomo:{mihomo_tag}"

    previous = previous_metadata()
    previous_fingerprint = str(previous.get("build_input_fingerprint", ""))
    previous_sing_box = str(previous.get("sing_box", {}).get("release", ""))
    previous_mihomo = str(previous.get("mihomo", {}).get("release", ""))

    reasons: list[str] = []
    if FORCE_REBUILD:
        reasons.append("manual force_rebuild")
    if previous_fingerprint != fingerprint:
        reasons.append("build inputs changed")
    if previous_sing_box != sing_box_tag:
        reasons.append(f"sing-box compiler changed: {previous_sing_box or 'none'} -> {sing_box_tag}")
    if previous_mihomo != mihomo_tag:
        reasons.append(f"Mihomo compiler changed: {previous_mihomo or 'none'} -> {mihomo_tag}")

    should_build = bool(reasons)
    values = {
        "should_build": str(should_build).lower(),
        "source_sha": source_sha,
        "upstream_sha": upstream_sha,
        "build_input_fingerprint": fingerprint,
        "sing_box_tag": sing_box_tag,
        "sing_box_image": sing_box_image,
        "mihomo_tag": mihomo_tag,
        "mihomo_image": mihomo_image,
    }
    for key, value in values.items():
        emit(key, value)

    with SUMMARY_FILE.open("a", encoding="utf-8") as handle:
        handle.write("## Build plan\n\n")
        handle.write(f"- Source commit: `{source_sha}`\n")
        handle.write(f"- Upstream base: `{upstream_sha}`\n")
        handle.write(f"- Build-input fingerprint: `{fingerprint}` ({fingerprint_files} tracked files)\n")
        handle.write(f"- Latest stable sing-box: `{sing_box_tag}`\n")
        handle.write(f"- Latest stable Mihomo: `{mihomo_tag}`\n")
        handle.write(f"- Build required: `{str(should_build).lower()}`\n")
        if reasons:
            handle.write("- Reasons:\n")
            for reason in reasons:
                handle.write(f"  - {reason}\n")
        else:
            handle.write("- `rules-dist` already matches build inputs and compiler releases.\n")


if __name__ == "__main__":
    main()
