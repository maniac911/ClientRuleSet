# Clash Release

Ready-to-use output selected from the generated Clash rules.

- `domainset/*.mrs`: Mihomo `behavior: domain`, `format: mrs`.
- `domainset/*.txt`: fallback text domain rules when MRS conversion is not possible.
- `non_ip/*.mrs`: classical source that contained only DOMAIN/DOMAIN-SUFFIX and was losslessly converted; use `behavior: domain`.
- `non_ip/*.txt`: mixed classical rules; use `behavior: classical`, `format: text`.
- `ip/*.mrs`: pure CIDR/IP-CIDR/IP-CIDR6 rules converted to MRS; use `behavior: ipcidr`.
- `ip/*.txt`: mixed/non-convertible IP rules copied unchanged; normally use `behavior: classical`, `format: text`.

Conversion summary: domainset MRS=10, domainset text=1, non_ip MRS=13, non_ip text=25, ip MRS=11, ip text=9.
