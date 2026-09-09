# Quantumult X

These filter rule sets are generated directly from Sukka's universal FileOutput data, not converted from Clash text.

Supported in strict mode: HOST, HOST-SUFFIX, HOST-KEYWORD, HOST-WILDCARD, USER-AGENT, IP-CIDR, IP6-CIDR, IP-ASN and GEOIP.

Every emitted rule contains placeholder policy `reject`. Load remote files with Quantumult X `filter_remote` and `force-policy=YOUR_POLICY` so the remote policy is overridden. The default placeholder is intentionally `reject` so a missing force-policy fails visibly instead of silently becoming DIRECT.

- `domainset/*.list` — typed Quantumult X host filters.
- `non_ip/*.list` — compatible non-IP filters.
- `ip/*.list` — IPv4/IPv6, ASN and GEOIP filters.
- `_report/summary.json` — coverage and rule-type counts.
- `_report/unsupported.txt` — source rules without an enabled lossless mapping.

Port filters are conservative by default. Set `experimental.port_rules: true` in `ForkExtras/clients.yml` only after validating DST-PORT/SRC-PORT for the intended Quantumult X remote-filter usage.
