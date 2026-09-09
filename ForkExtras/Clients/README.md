# Client adapter framework

This directory keeps fork-only client packaging logic separate from upstream `SukkaW/Surge` build code.

## Configuration

Edit `ForkExtras/clients.yml` to enable or disable outputs. An enabled entry loads `ForkExtras/Clients/adapters/<adapter>.cjs` automatically.

The workflow runs adapters twice:

```text
prepare -> pnpm build -> release
```

Current adapters: Surge, Clash/Mihomo, sing-box, Shadowrocket, Quantumult X, plus passthrough for upstream-native outputs.

To add another client, add one YAML entry and one adapter file exporting `prepare` and/or `release`. The upstream `Build/` tree does not need to be patched.
