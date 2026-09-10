# Clash / Mihomo Release

Preferred client-facing output.

- domainset/*.mrs: behavior domain, format mrs.
- non_ip/*.mrs: only when classical source was purely DOMAIN/DOMAIN-SUFFIX.
- non_ip/*.txt: mixed classical rules preserved.
- ip/*.mrs: pure CIDR/IP-CIDR/IP-CIDR6, behavior ipcidr.
- ip/*.txt: mixed rules preserved.

Build summary: {"domainMRS":10,"domainText":1,"nonIpMRS":16,"nonIpText":25,"ipMRS":13,"ipText":9}
