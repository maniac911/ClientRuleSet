# Xray

This output is split into two targets because current v2rayN exposes only a subset of Xray routing fields through its RulesItem import model.

## v2rayN

`Xray/v2rayN/**` contains top-level `List<RulesItem>` JSON for v2rayN's Routing Rule -> Import from File / Clipboard / URL workflow. It preserves domain/IP/destination-port/network/protocol/exact-process fields and audits Xray-only fields in `v2rayN/_report/unsupported.txt`.

Example:

`https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Xray/v2rayN/non_ip/ai.json`

## native

`Xray/native/**` contains native Xray routing fragments shaped as `{ "routing": { "rules": [...] } }`. These are not standalone runnable Xray configs: merge the routing section into a complete Xray config with inbounds/outbounds, or use them while building a v2rayN Custom Xray config. Native output additionally preserves `sourceIP`, `sourcePort`, and maps USER-AGENT patterns to Xray `attrs["user-agent"]`.

Xray joins different selector fields inside one rule with AND semantics, so this exporter emits separate rule objects for independent Sukka selectors. Truly non-lossless concepts such as arbitrary URL-REGEX, IP-ASN, process globs and unparsed AND/OR/NOT source expressions remain audited.
