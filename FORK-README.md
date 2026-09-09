# maniac911/ClientRuleSet generated rules

This branch is built automatically from this fork's current `master`
after synchronizing `SukkaW/Surge` into the fork.

- Fork source commit: `4fb39c9d137bb09f060448fe670333aab9b3bc37`
- Upstream source: `SukkaW/Surge`
- sing-box SRS compiler: `ghcr.io/sagernet/sing-box:v1.14.0-rc.4`
- Mihomo MRS compiler: `docker.io/metacubex/mihomo:v1.19.30`

## Build flow

`SukkaW/Surge -> sync to fork master -> pnpm build -> client Release selection -> rules-dist`

Fork-only source rules can live under `ForkExtras/Source/`. During the
workflow they are overlaid onto `Source/` only inside the runner, so
the upstream source tree remains easy to synchronize.

## Published layout

- `Surge/` — Surge rules (upstream Build internally calls this `List/`).
- `Surge/Modules/` — Surge modules and their auxiliary rule files.
- `Clash/domainset/`, `Clash/non_ip/`, `Clash/ip/` — full generated Mihomo/Clash text outputs.
- `Clash/Release/` — ready-to-use Clash/Mihomo release rules: convertible rules are MRS, non-convertible rules are copied as text.
- `sing-box/domainset/`, `sing-box/non_ip/`, `sing-box/ip/` — full generated sing-box JSON outputs.
- `sing-box/Release/` — ready-to-use sing-box release rules: JSON is compiled to SRS when possible, otherwise copied as JSON.
- `LegacyClashPremium/`, `Surfboard/` and related generated files — other upstream outputs.
