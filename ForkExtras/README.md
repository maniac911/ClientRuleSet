# ClientRuleSet fork extensions

This fork keeps upstream `SukkaW/Surge` source/build code as clean as possible and puts fork-specific behavior under `ForkExtras/`.

## Build model

```text
SukkaW/Surge upstream
       ↓ daily safe sync
this fork master
       ↓ pnpm build
standard upstream outputs
       ↓ ForkExtras client adapters
client-facing Release outputs
       ↓
rules-dist
```

Fork-only source rules can live under `ForkExtras/Source/domainset/`, `ForkExtras/Source/non_ip/`, and `ForkExtras/Source/ip/`; they are overlaid only inside the Actions runner.

## Dynamic clients

`ForkExtras/clients.yml` controls enabled outputs. Adapter implementations live under `ForkExtras/Clients/adapters/`.

Current configuration supports Surge, Clash/Mihomo, sing-box, Shadowrocket, Quantumult X, Surfboard, and Legacy Clash Premium. New clients require a config entry plus an adapter, not edits to upstream `Build/`.

Published client-facing directories include `Surge/`, `Clash/Release/`, `sing-box/Release/`, `Shadowrocket/Release/`, and `QuantumultX/Release/`.

Clash Release prefers MRS only when conversion is lossless. sing-box Release prefers SRS and keeps JSON fallback. Quantumult X writes unsupported rule semantics to adjacent `*.unsupported.txt` files instead of silently discarding them.

## Mobile configuration guardrails

When generating configuration files for mobile clients (especially iOS/tvOS Network Extension clients and Android clients), **do not automatically enable every ruleset merely because it exists in `rules-dist`**.

The upstream SukkaW README states that the large advertising / privacy / malware / phishing blocking rules are only recommended for Surge on macOS, and recommends dedicated blocking tools on mobile for better performance. Therefore the following rulesets are **mobile opt-in only** and must not be added to generated mobile configurations unless the user explicitly asks for them:

- `reject_domainset` (`domainset/reject`): large base blocking domain set.
- `reject_extra_domainset` (`domainset/reject_extra`): large supplementary blocking domain set; upstream also warns that enabling it together with the base set increases memory usage and matching cost on Clash/Mihomo.
- `reject_phishing` (`domainset/reject_phishing`): very large phishing-domain set.
- `reject-url-regex` (`non_ip/reject-url-regex`): requires MITM/URL-REGEX semantics and has high runtime overhead.

For mobile configuration generation, the normal smaller reject rules such as `reject_non_ip_drop`, `reject_non_ip`, `reject_non_ip_no_drop`, and `reject_ip` are **not covered by the exclusion above** and may remain enabled when appropriate.

**Generation rule:** future mobile config updates must preserve this opt-in policy. Do not re-add the four heavy rules above during ruleset synchronization, regeneration, or "use all latest rules" operations unless the user explicitly overrides this guardrail.
