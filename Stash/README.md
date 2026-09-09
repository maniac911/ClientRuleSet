# Stash

These rule sets are generated directly from Sukka's universal FileOutput data.

- `domainset/*.list` — optimized Stash text payloads; use `behavior: domain`, `format: text`.
- `non_ip/*.list` — Stash classical text rules; use `behavior: classical`, `format: text`.
- `ip/*.list` — Stash classical text rules; use `behavior: classical`, `format: text`.
- `_report/summary.json` — coverage summary.
- `_report/unsupported.txt` — rules not published because no documented lossless mapping is enabled.
- `_report/platform-limited.txt` — process rules that Stash parses but iOS/tvOS ignores.

Stash supports DOMAIN/DOMAIN-SUFFIX/DOMAIN-KEYWORD/DOMAIN-WILDCARD/DOMAIN-REGEX, IP-CIDR/IP-CIDR6, GEOIP, IP-ASN, DST-PORT, PROTOCOL, USER-AGENT, URL-REGEX, PROCESS-NAME/PROCESS-PATH, and AND/OR/NOT classical rules.

Example provider:

```yaml
rule-providers:
  ai:
    behavior: classical
    format: text
    url: https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Stash/non_ip/ai.list
    interval: 86400
rules:
  - RULE-SET,ai,Proxy
```
