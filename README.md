# maniac911/Surge binary rule sets

Automatically generated from Sukka's official published rules.

- Upstream generated rules commit: `714ea3df63d45fd37b3db5965c9501a82bfe9342`
- Built at: `2026-09-03T05:41:33Z`
- sing-box compiler: `ghcr.io/sagernet/sing-box:v1.14.0-rc.4`
- Mihomo compiler: `docker.io/metacubex/mihomo:v1.19.30`

## Layout

- `SRS/domainset/*.srs` — sing-box domain-only rules
- `SRS/non_ip/*.srs` — sing-box non-IP rules
- `SRS/ip/*.srs` — sing-box IP rules
- `MRS/domainset/*.mrs` — Mihomo `behavior: domain`
- `MRS/ipcidr/china_ip*.mrs` — Mihomo `behavior: ipcidr`

Mihomo classical rules intentionally remain in Sukka's official text format because MRS does not support classical behavior.
