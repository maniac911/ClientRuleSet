# Loon

These subscription rule sets are generated directly from Sukka's universal FileOutput data instead of being converted from Clash.

- `domainset/*.list` — DOMAIN / DOMAIN-SUFFIX subscription rules.
- `non_ip/*.list` — Loon-compatible non-IP subscription rules.
- `ip/*.list` — Loon-compatible IP subscription rules.
- `_report/summary.json` — conversion coverage summary.
- `_report/unsupported.txt` — source rules that are not emitted because no documented lossless Loon mapping is enabled.

The strict native mapping preserves documented Loon DOMAIN, DOMAIN-SUFFIX, DOMAIN-KEYWORD, USER-AGENT, URL-REGEX, IP-CIDR, IP-CIDR6, GEOIP, IP-ASN, SRC-PORT, DEST-PORT, PROTOCOL, AND, OR and NOT rules. DOMAIN-WILDCARD, process rules and standalone source-IP rules remain in the report.

Loon subscription syntax applies policy outside the downloaded list, for example: `https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Loon/non_ip/ai.list, PROXY`.
