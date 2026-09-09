# Shadowrocket

These rule sets are generated directly from Sukka's universal FileOutput data, not converted from Clash or Surge text.

- `domainset/*.list` — typed DOMAIN / DOMAIN-SUFFIX rules.
- `non_ip/*.list` — Shadowrocket-compatible non-IP rules.
- `ip/*.list` — Shadowrocket-compatible IP rules. IPv4 and IPv6 both use `IP-CIDR`.
- `_report/summary.json` — conversion coverage summary.
- `_report/unsupported.txt` — source rules that cannot be represented losslessly as standalone Shadowrocket RULE-SET entries.

Use the files as policy-free remote payloads, for example: `RULE-SET,<raw-url>,PROXY`.
