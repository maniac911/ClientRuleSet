# Xray / v2rayN

These JSON files are generated directly from Sukka's universal FileOutput data and are formatted as the top-level `List<RulesItem>` accepted by current v2rayN's routing-rule import.

Supported mappings include exact/suffix/keyword/regex domains, wildcard domains converted to anchored Xray regex, IPv4/IPv6 CIDR, GEOIP, exact process name/path, destination port, TCP/UDP network, and Xray sniffed protocols HTTP/TLS/QUIC/BitTorrent.

Not emitted for the v2rayN target: USER-AGENT/URL-REGEX (v2rayN does not expose Xray attrs), source IP/source port (supported by Xray Core but absent from current v2rayN RulesItem), IP-ASN, process globs, and AND/OR/NOT expressions that cannot be flattened without changing semantics. See `_report/unsupported.txt`.

The generated outbound tag defaults to `proxy`, matching v2rayN's normal proxy routing tag. Change `xray.outbound_tag` in `ForkExtras/clients.yml` if needed.

In v2rayN, open the routing-rule editor and use Import Rules from File / Clipboard / URL with one of these files, for example:

`https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Xray/non_ip/ai.json`

Do not combine different selector families into one Xray rule object: Xray treats fields in one rule as conditions that must match together. This exporter intentionally emits separate RulesItem objects to preserve Sukka's rule-list OR semantics.
