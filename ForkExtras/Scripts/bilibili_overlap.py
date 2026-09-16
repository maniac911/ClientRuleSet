#!/usr/bin/env python3
from __future__ import annotations

from ipaddress import ip_network
import os
from pathlib import Path

BILIBILI_IP = Path("ForkExtras/Source/ip/bilibili.conf")
REJECT_NON_IP = Path("Source/non_ip/reject.conf")
SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")


def parsed_cidrs(path: Path):
    result = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [part.strip() for part in line.split(",")]
        if len(parts) >= 2 and parts[0] in {"IP-CIDR", "IP-CIDR6"}:
            try:
                result.append((raw, parts[1], ip_network(parts[1], strict=False)))
            except ValueError:
                print(f"::warning file={path}::Invalid CIDR ignored: {parts[1]}")
    return result


def main() -> None:
    bilibili = parsed_cidrs(BILIBILI_IP)
    bilibili_text = {cidr for _, cidr, _ in bilibili}

    original = REJECT_NON_IP.read_text(encoding="utf-8").splitlines()
    kept: list[str] = []
    removed: list[str] = []

    for raw in original:
        parts = [part.strip() for part in raw.split(",")]
        if len(parts) >= 2 and parts[0] in {"IP-CIDR", "IP-CIDR6"} and parts[1] in bilibili_text:
            removed.append(raw)
        else:
            kept.append(raw)

    REJECT_NON_IP.write_text("\n".join(kept) + "\n", encoding="utf-8")

    overlaps: list[tuple[str, str]] = []
    for _, reject_cidr, reject_net in parsed_cidrs(REJECT_NON_IP):
        for _, bilibili_cidr, bilibili_net in bilibili:
            if reject_net.version == bilibili_net.version and reject_net.overlaps(bilibili_net):
                overlaps.append((reject_cidr, bilibili_cidr))
                print(f"::warning::CIDR overlap remains: reject {reject_cidr} overlaps Bilibili {bilibili_cidr}")

    print(f"Removed {len(removed)} exact Bilibili HTTPDNS CIDR rule(s) from Source/non_ip/reject.conf")
    if SUMMARY:
        with open(SUMMARY, "a", encoding="utf-8") as handle:
            handle.write("\n## Bilibili HTTPDNS overlap check\n\n")
            handle.write(f"- Exact CIDRs removed from reject: `{len(removed)}`\n")
            handle.write(f"- Broader/narrower overlaps left for review: `{len(overlaps)}`\n")


if __name__ == "__main__":
    main()
