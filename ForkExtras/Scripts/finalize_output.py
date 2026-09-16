#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone

OUTPUT = Path(os.environ.get("OUTPUT_DIR", "output"))
SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")
WARN_RATIO = float(os.environ.get("OUTPUT_COUNT_WARN_RATIO", "0.90"))
FAIL_RATIO = float(os.environ.get("OUTPUT_COUNT_FAIL_RATIO", "0.70"))


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def check_drop(label: str, current: int, previous: int | None) -> bool:
    if not previous or previous <= 0:
        return False
    ratio = current / previous
    if ratio < FAIL_RATIO:
        print(f"::error::{label} count dropped from {previous} to {current} ({ratio:.1%} of previous)")
        return True
    if ratio < WARN_RATIO:
        print(f"::warning::{label} count dropped from {previous} to {current} ({ratio:.1%} of previous)")
    return False


def count_mrs(summary: dict) -> int:
    return sum(int(summary.get(key, 0)) for key in ("domainMRS", "nonIpMRS", "ipMRS"))


def main() -> None:
    previous_path = Path(os.environ.get("PREVIOUS_METADATA_PATH", ".previous-build-metadata.json"))
    previous = read_json(previous_path)
    sing_box_summary = read_json(OUTPUT / ".build-sing-box.json")
    mihomo_summary = read_json(OUTPUT / ".build-mihomo.json")
    (OUTPUT / ".build-sing-box.json").unlink(missing_ok=True)
    (OUTPUT / ".build-mihomo.json").unlink(missing_ok=True)

    current_srs = int(sing_box_summary.get("srs", 0))
    current_mrs = count_mrs(mihomo_summary)
    previous_srs = previous.get("sing_box", {}).get("summary", {}).get("srs")
    previous_mrs = count_mrs(previous.get("mihomo", {}).get("summary", {})) if previous else None

    failed = False
    failed |= check_drop("SRS", current_srs, int(previous_srs) if previous_srs is not None else None)
    failed |= check_drop("MRS", current_mrs, previous_mrs)
    if failed:
        sys.exit(1)

    built_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    run_url = f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"

    binary_counts = {
        "srs": len(list(OUTPUT.rglob("*.srs"))),
        "mrs": len(list(OUTPUT.rglob("*.mrs"))),
    }

    metadata = {
        "source_sha": os.environ["SOURCE_SHA"],
        "upstream_sha": os.environ["UPSTREAM_SHA"],
        "build_input_fingerprint": os.environ["BUILD_INPUT_FINGERPRINT"],
        "built_at": built_at,
        "run_url": run_url,
        "strict_binary_compilation": True,
        "output_counts": binary_counts,
        "sing_box": {
            "release": os.environ["SING_BOX_TAG"],
            "image": os.environ["SING_BOX_IMAGE"],
            "digest": os.environ["SING_BOX_IMAGE_DIGEST"],
            "summary": sing_box_summary,
        },
        "mihomo": {
            "release": os.environ["MIHOMO_TAG"],
            "image": os.environ["MIHOMO_IMAGE"],
            "digest": os.environ["MIHOMO_IMAGE_DIGEST"],
            "summary": mihomo_summary,
        },
    }

    readme = f"""# maniac911/ClientRuleSet generated rules

Built from fork source commit: {metadata['source_sha']}
Upstream base commit: {metadata['upstream_sha']}
Build-input fingerprint: {metadata['build_input_fingerprint']}
Build timestamp (UTC): {built_at}
GitHub Actions run: {run_url}

sing-box compiler release: {metadata['sing_box']['release']}
sing-box compiler image: {metadata['sing_box']['image']}
sing-box image digest: {metadata['sing_box']['digest']}

Mihomo compiler release: {metadata['mihomo']['release']}
Mihomo compiler image: {metadata['mihomo']['image']}
Mihomo image digest: {metadata['mihomo']['digest']}

Strict binary compilation: enabled
sing-box summary: {json.dumps(sing_box_summary, separators=(',', ':'))}
Mihomo summary: {json.dumps(mihomo_summary, separators=(',', ':'))}
Binary output counts: {json.dumps(binary_counts, separators=(',', ':'))}

Integrity files: MANIFEST.json and SHA256SUMS

Build flow: SukkaW/Surge -> fork master -> pnpm build -> ForkExtras client adapters -> rules-dist

Client enable/disable settings live in ForkExtras/clients.yml on master.
"""
    (OUTPUT / "FORK-README.md").write_text(readme, encoding="utf-8")
    (OUTPUT / "BUILD-METADATA.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    excluded = {"MANIFEST.json", "FILES.txt", "SHA256SUMS"}
    manifest_entries = []
    for path in sorted(p for p in OUTPUT.rglob("*") if p.is_file()):
        rel = path.relative_to(OUTPUT).as_posix()
        if rel in excluded:
            continue
        manifest_entries.append({"path": rel, "size": path.stat().st_size, "sha256": sha256(path)})

    manifest = {
        "source_sha": metadata["source_sha"],
        "build_input_fingerprint": metadata["build_input_fingerprint"],
        "generated_at": built_at,
        "files": manifest_entries,
    }
    (OUTPUT / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    files_for_index = sorted(
        p.relative_to(OUTPUT).as_posix()
        for p in OUTPUT.rglob("*")
        if p.is_file() and p.relative_to(OUTPUT).as_posix() not in {"FILES.txt", "SHA256SUMS"}
    )
    (OUTPUT / "FILES.txt").write_text("\n".join(files_for_index) + "\n", encoding="utf-8")

    checksum_files = sorted(p for p in OUTPUT.rglob("*") if p.is_file() and p.name != "SHA256SUMS")
    checksum_lines = [f"{sha256(path)}  {path.relative_to(OUTPUT).as_posix()}" for path in checksum_files]
    (OUTPUT / "SHA256SUMS").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")

    if SUMMARY:
        with open(SUMMARY, "a", encoding="utf-8") as handle:
            handle.write("\n## Release integrity\n\n")
            handle.write(f"- SRS files: `{binary_counts['srs']}`\n")
            handle.write(f"- MRS files: `{binary_counts['mrs']}`\n")
            handle.write(f"- Manifest payload files: `{len(manifest_entries)}`\n")
            handle.write("- Generated `MANIFEST.json` and `SHA256SUMS`.\n")


if __name__ == "__main__":
    main()
