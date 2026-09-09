# Hiddify

These rule sets are generated for Hiddify Core as sing-box binary rule sets (`.srs`). Hiddify Core itself uses remote binary SRS rule sets for routing, so no lossy Clash/text conversion is involved.

- `domainset/*.srs` — domain-oriented rule sets.
- `non_ip/*.srs` — non-IP/mixed routing rule sets.
- `ip/*.srs` — IP-oriented rule sets.
- `_report/summary.json` — build summary.
- `_report/failed.txt` — any source rule set that failed binary compilation.

Example Rule Set URL in Hiddify routing settings:

`https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Hiddify/non_ip/ai.srs`

The outbound policy is selected in Hiddify; it is not embedded in the SRS payload.
