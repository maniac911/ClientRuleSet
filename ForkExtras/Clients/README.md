# Client adapter framework

This directory keeps fork-only client packaging logic separate from upstream `SukkaW/Surge` build code.

## Configuration

Edit `ForkExtras/clients.yml` to enable or disable outputs. An enabled entry loads `ForkExtras/Clients/adapters/<adapter>.cjs` automatically.

The workflow runs adapters twice:

```text
prepare -> pnpm build -> release
```

A client can also set `native_writer`. During `prepare`, `run.cjs` loads `ForkExtras/Clients/native/<native_writer>.cjs`. That hook may inject a fork-only writer into the ephemeral Actions checkout so it receives Sukka's universal `FileOutput` data directly. Those edits are never committed to the upstream `Build/` tree.

## Shadowrocket

Shadowrocket uses the native-writer path:

```text
Sukka FileOutput
      -> ShadowrocketDomainSet / ShadowrocketRuleSet
      -> Shadowrocket/*.txt
      -> adapter validation/reporting + rename to *.list
```

The native writer is stored in `ForkExtras/Clients/native/shadowrocket.ts`. Its prepare hook injects it into the normal ruleset/domainset strategy fanout and the worker strategy registry only for the current build.

Unsupported source-only concepts such as process rules are not silently discarded. They are removed from the client payload and written to `Shadowrocket/_report/unsupported.txt`, with aggregate counts in `summary.json`.

Current adapters: Surge, Clash/Mihomo, sing-box, Shadowrocket, Quantumult X, plus passthrough for upstream-native outputs.
