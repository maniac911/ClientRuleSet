# Egern

Native Egern YAML rule sets generated directly from Sukka's universal FileOutput data.

Supported mappings include exact/suffix/keyword/regex/wildcard domains, URL regex, User-Agent, IPv4/IPv6 CIDR, GEOIP, ASN, destination ports and protocol rules. Unsupported source concepts are audited in `_report/unsupported.txt`.

Egern exposes `no_resolve` once per rule-set file, while Sukka can mix resolving and no-resolve IP rules in one logical source. To preserve that distinction, the canonical `*.yaml` contains non-IP plus no-resolve IP entries and sets `no_resolve: true`; any resolving IP entries are emitted as `*-resolve.yaml`. If a source is split, load both URLs under the same policy. See `_report/splits.txt`.

Example:

```yaml
rules:
  - rule_set:
      match: https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Egern/non_ip/ai.yaml
      policy: Proxy
      update_interval: 86400
```
