# maniac911/Surge full rules mirror

This branch is an automatic full mirror of Sukka's official generated
rule output repository, plus binary formats generated for this fork.

- Upstream output commit: `be7af3aac8c504ff1b934896673c0b1522194c9f`
- sing-box SRS compiler: `ghcr.io/sagernet/sing-box:v1.14.0-rc.4`
- Mihomo MRS compiler: `docker.io/metacubex/mihomo:v1.19.30`

## Mirrored upstream outputs

Everything published by SukkaLab/ruleset.skk.moe is mirrored here,
including current and future output directories. Current examples include:

- `List/` — Surge
- `Clash/` — Mihomo / Clash-compatible clients
- `LegacyClashPremium/` — legacy Clash Premium
- `Surfboard/` — Surfboard for Android
- `sing-box/` — sing-box source-format Headless Rules
- `Modules/` — Surge modules and related generated content

## Extra binary outputs

- `SRS/domainset/*.srs`
- `SRS/non_ip/*.srs`
- `SRS/ip/*.srs`
- `MRS/domainset/*.mrs`
- `MRS/ipcidr/china_ip*.mrs`

Mihomo classical/mixed rules remain available as the mirrored text files
under `Clash/non_ip/` and `Clash/ip/` because MRS does not represent
classical rule behavior.
