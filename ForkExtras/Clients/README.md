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

## Quantumult X

Quantumult X also uses the native-writer path instead of converting Clash output:

```text
Sukka FileOutput
      -> QuantumultXDomainSet / QuantumultXRuleSet
      -> QuantumultX/*.txt
      -> policy injection + validation/reporting + rename to *.list
```

Strict-mode mappings are HOST, HOST-SUFFIX, HOST-KEYWORD, HOST-WILDCARD, USER-AGENT, IP-CIDR, IP6-CIDR, IP-ASN and GEOIP. Process rules, URL regex routing, source-IP/protocol concepts and unknown rules are reported rather than guessed. DST-PORT/SRC-PORT are kept behind `experimental.port_rules` and are disabled by default.

Quantumult X remote filter lines require a policy field. Generated files use the configured placeholder (default `reject`) and are intended to be loaded with `force-policy=YOUR_POLICY` in `filter_remote`.

## Stash

Stash uses a native writer as well, because its classical rule syntax supports more of Sukka's universal rule model than Clash output preserves.

```text
Sukka FileOutput
      -> StashDomainSet / StashRuleSet
      -> Stash/*.txt
      -> validation/reporting + rename to *.list
```

`domainset/*.list` is generated as Stash `behavior: domain`, `format: text` payloads for efficient matching. `non_ip/*.list` and `ip/*.list` are classical text providers and preserve documented Stash types such as DOMAIN-REGEX, USER-AGENT, URL-REGEX, IP-ASN, GEOIP, DST-PORT, PROTOCOL and AND/OR/NOT in addition to the normal domain/IP rules.

Stash documents PROCESS-NAME and PROCESS-PATH, but also states that iOS/tvOS ignores process rules because of Network Extension limitations. These rules remain in the payload for cross-platform fidelity and are separately listed in `Stash/_report/platform-limited.txt`. Standalone source-IP/source-port rules remain conservative and go to `unsupported.txt` until explicitly documented or verified.

## Loon

Loon also uses a native writer and produces policy-free subscription rule lists directly from Sukka `FileOutput`.

```text
Sukka FileOutput
      -> LoonDomainSet / LoonRuleSet
      -> Loon/*.txt
      -> validation/reporting + rename to *.list
```

The strict mapping follows Loon's public rule manual: DOMAIN, DOMAIN-SUFFIX, DOMAIN-KEYWORD, USER-AGENT, URL-REGEX, IP-CIDR, IP-CIDR6, GEOIP, IP-ASN, SRC-PORT, DEST-PORT, PROTOCOL and AND/OR/NOT are emitted. Literal spaces in USER-AGENT patterns are percent-encoded for Loon rule-list compatibility. DOMAIN-WILDCARD, process rules, standalone source-IP rules and unknown source rules are reported instead of guessed.

Loon applies the policy outside the downloaded subscription list, for example:

```text
https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Loon/non_ip/ai.list, PROXY
```

## Hiddify

Hiddify does not need another text-rule dialect. Hiddify Core is built on sing-box routing and uses remote binary rule sets, so this adapter compiles Sukka's existing sing-box headless rule-set JSON directly to SRS:

```text
Sukka sing-box source JSON
      -> sing-box rule-set compile
      -> Hiddify/*.srs
```

The output preserves the existing `domainset`, `non_ip` and `ip` layout. It is binary-only on purpose: if any source rule set cannot compile to SRS, the adapter records it in `Hiddify/_report/failed.txt` and fails the build instead of silently publishing a different format.

Example Rule Set URL for Hiddify routing settings:

```text
https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Hiddify/non_ip/ai.srs
```

The outbound action is selected in Hiddify's routing rule; it is not embedded in the SRS file.

Current adapters: Surge, Clash/Mihomo, sing-box, Hiddify, Shadowrocket, Quantumult X, Stash, Loon, plus passthrough for upstream-native outputs.
