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
