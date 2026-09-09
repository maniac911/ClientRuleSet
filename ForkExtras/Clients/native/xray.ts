import path from 'node:path';

import { PUBLIC_DIR } from '../../../Build/constants/dir';
import { BaseWriteStrategy } from '../../../Build/lib/writing-strategy/base';

export const OUTPUT_XRAY_DIR = path.join(PUBLIC_DIR, 'Xray');

const SENTINEL = '7h15.ru1353t.1s.m4d3.by.5ukk4w.skk.moe';
const XRAY_PROTOCOLS = new Set(['http', 'tls', 'quic', 'bittorrent']);
const XRAY_NETWORKS = new Set(['tcp', 'udp']);
const REGEX_META = new Set(['\\', '^', '$', '+', '.', '(', ')', '|', '{', '}', '[', ']']);

type AuditItem = { rule: string, reason: string };

function globToRegexp(glob: string): string {
  let result = '^';
  for (const char of glob) {
    if (char === '*') result += '.*';
    else if (char === '?') result += '.';
    else if (REGEX_META.has(char)) result += `\\${char}`;
    else result += char;
  }
  return `${result}$`;
}

abstract class XrayBaseStrategy extends BaseWriteStrategy {
  public abstract readonly name: string;
  public abstract readonly type: 'domainset' | 'non_ip' | 'ip';
  readonly fileExtension = 'json' as const;
  protected result: string[] = [];
  protected readonly skipCompareOnCI = true;

  private readonly domains = new Set<string>();
  private readonly ips = new Set<string>();
  private readonly processes = new Set<string>();
  private readonly ports = new Set<string>();
  private readonly networks = new Set<string>();
  private readonly protocols = new Set<string>();
  private readonly sourceIps = new Set<string>();
  private readonly sourcePorts = new Set<string>();
  private readonly userAgents = new Set<string>();
  private readonly unsupported: AuditItem[] = [];
  private readonly warnings: AuditItem[] = [];

  private add(set: Set<string>, marker: string, value: string): void {
    const trimmed = value.trim();
    if (!trimmed || trimmed === SENTINEL) return;
    if (!set.has(trimmed)) {
      set.add(trimmed);
      this.result.push(`${marker}:${trimmed}`);
    }
  }

  private addUnsupported(rule: string, reason: string): void {
    const trimmed = rule.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    this.unsupported.push({ rule: trimmed, reason });
    this.result.push(`unsupported:${trimmed}`);
  }

  private addWarning(rule: string, reason: string): void {
    const trimmed = rule.trim();
    if (!trimmed) return;
    this.warnings.push({ rule: trimmed, reason });
    this.result.push(`warning:${trimmed}:${reason}`);
  }

  private addProcess(type: 'PROCESS-NAME' | 'PROCESS-PATH', value: string): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (/[*?]/u.test(trimmed)) {
      this.addUnsupported(
        `${type},${trimmed}`,
        'Xray process routing supports exact process name/path/folder matching, not shell-style globs.'
      );
      return;
    }
    this.add(this.processes, 'process', trimmed);
  }

  private addProtocol(value: string, sourceType = 'PROTOCOL'): void {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    if (XRAY_NETWORKS.has(normalized)) {
      this.add(this.networks, 'network', normalized);
      return;
    }
    if (XRAY_PROTOCOLS.has(normalized)) {
      this.add(this.protocols, 'protocol', normalized);
      return;
    }
    this.addUnsupported(
      `${sourceType},${value}`,
      'No lossless Xray routing mapping is enabled for this protocol value.'
    );
  }

  private addIp(type: 'IP-CIDR' | 'IP-CIDR6' | 'GEOIP', value: string, noResolve: boolean): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    const rendered = type === 'GEOIP' ? `geoip:${trimmed.toLowerCase()}` : trimmed;
    this.add(this.ips, 'ip', rendered);
    if (noResolve) {
      this.addWarning(
        `${type},${trimmed},no-resolve`,
        'Xray has no per-rule no-resolve flag; DNS behavior depends on routing.domainStrategy.'
      );
    }
  }

  private addRawIp(type: 'IP-CIDR' | 'IP-CIDR6' | 'GEOIP', raw: string): void {
    let value = raw.trim();
    const noResolve = /,?\s*no-resolve$/iu.test(value);
    if (noResolve) value = value.replace(/,?\s*no-resolve$/iu, '').trim();
    this.addIp(type, value, noResolve);
  }

  private addOtherRule(rule: string): void {
    const trimmed = rule.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const comma = trimmed.indexOf(',');
    if (comma === -1) {
      this.addUnsupported(trimmed, 'Unknown source rule syntax.');
      return;
    }

    const type = trimmed.slice(0, comma).trim().toUpperCase();
    const value = trimmed.slice(comma + 1).trim();
    switch (type) {
      case 'DOMAIN': this.add(this.domains, 'domain', `full:${value}`); return;
      case 'DOMAIN-SUFFIX': this.add(this.domains, 'domain', `domain:${value}`); return;
      case 'DOMAIN-KEYWORD': this.add(this.domains, 'domain', `keyword:${value}`); return;
      case 'DOMAIN-WILDCARD': this.add(this.domains, 'domain', `regexp:${globToRegexp(value)}`); return;
      case 'DOMAIN-REGEX': this.add(this.domains, 'domain', `regexp:${value}`); return;
      case 'GEOSITE': this.add(this.domains, 'domain', `geosite:${value.toLowerCase()}`); return;
      case 'IP-CIDR':
      case 'IP-CIDR6':
      case 'GEOIP': this.addRawIp(type, value); return;
      case 'PROCESS-NAME': this.addProcess('PROCESS-NAME', value); return;
      case 'PROCESS-PATH': this.addProcess('PROCESS-PATH', value); return;
      case 'DEST-PORT':
      case 'DST-PORT': this.add(this.ports, 'port', value); return;
      case 'SRC-IP': this.add(this.sourceIps, 'sourceIP', value); return;
      case 'SRC-PORT': this.add(this.sourcePorts, 'sourcePort', value); return;
      case 'USER-AGENT': this.add(this.userAgents, 'userAgent', globToRegexp(value)); return;
      case 'PROTOCOL':
      case 'NETWORK': this.addProtocol(value, type); return;
      case 'URL-REGEX':
        this.addUnsupported(trimmed, 'Xray attrs can match HTTP headers/path, but not an arbitrary full URL regex losslessly.');
        return;
      case 'IP-ASN':
        this.addUnsupported(trimmed, 'Xray routing has no native IP-ASN rule field.');
        return;
      case 'AND':
      case 'OR':
      case 'NOT':
        this.addUnsupported(trimmed, 'Compound source expressions are not flattened because that could change matching semantics.');
        return;
      default:
        this.addUnsupported(trimmed, 'No lossless Xray mapping is enabled for this source rule type.');
    }
  }

  writeDomain(domain: string): void { this.add(this.domains, 'domain', `full:${domain}`); }
  writeDomainSuffix(domain: string): void { this.add(this.domains, 'domain', `domain:${domain}`); }
  writeDomainKeywords(values: Set<string>): void {
    for (const value of values) this.add(this.domains, 'domain', `keyword:${value}`);
  }
  writeDomainWildcard(value: string): void {
    this.add(this.domains, 'domain', `regexp:${globToRegexp(value)}`);
  }
  writeUserAgents(values: Set<string>): void {
    for (const value of values) this.add(this.userAgents, 'userAgent', globToRegexp(value));
  }
  writeProcessNames(values: Set<string>): void {
    for (const value of values) this.addProcess('PROCESS-NAME', value);
  }
  writeProcessPaths(values: Set<string>): void {
    for (const value of values) this.addProcess('PROCESS-PATH', value);
  }
  writeUrlRegexes(values: Set<string>): void {
    for (const value of values) {
      this.addUnsupported(
        `URL-REGEX,${value}`,
        'Xray attrs can match HTTP headers/path, but not an arbitrary full URL regex losslessly.'
      );
    }
  }
  writeIpCidrs(values: string[], noResolve: boolean): void {
    for (const value of values) this.addIp('IP-CIDR', value, noResolve);
  }
  writeIpCidr6s(values: string[], noResolve: boolean): void {
    for (const value of values) this.addIp('IP-CIDR6', value, noResolve);
  }
  writeGeoip(values: Set<string>, noResolve: boolean): void {
    for (const value of values) this.addIp('GEOIP', value, noResolve);
  }
  writeIpAsns(values: Set<string>, _noResolve: boolean): void {
    for (const value of values) this.addUnsupported(`IP-ASN,${value}`, 'Xray routing has no native IP-ASN rule field.');
  }
  writeSourceIpCidrs(values: string[]): void {
    for (const value of values) this.add(this.sourceIps, 'sourceIP', value);
  }
  writeSourcePorts(values: Set<string>): void {
    for (const value of values) this.add(this.sourcePorts, 'sourcePort', value);
  }
  writeDestinationPorts(values: Set<string>): void {
    for (const value of values) this.add(this.ports, 'port', value);
  }
  writeProtocols(values: Set<string>): void {
    for (const value of values) this.addProtocol(value);
  }
  writeOtherRules(rules: string[]): void {
    for (const rule of rules) this.addOtherRule(rule);
  }

  protected withPadding(
    _title: string,
    _description: string[] | readonly string[],
    _date: Date,
    _content: string[],
    _contentHash: string | null
  ): string[] {
    return JSON.stringify({
      version: 2,
      category: this.type,
      domains: [...this.domains],
      ips: [...this.ips],
      processes: [...this.processes],
      ports: [...this.ports],
      networks: [...this.networks],
      protocols: [...this.protocols],
      sourceIps: [...this.sourceIps],
      sourcePorts: [...this.sourcePorts],
      userAgents: [...this.userAgents],
      unsupported: this.unsupported,
      warnings: this.warnings
    }, null, 2).split('\n');
  }
}

export class XrayDomainSet extends XrayBaseStrategy {
  public readonly name = 'xray domainset';
  readonly type = 'domainset';

  constructor(public readonly outputDir = OUTPUT_XRAY_DIR) { super(outputDir); }
}

export class XrayRuleSet extends XrayBaseStrategy {
  public readonly name = 'xray ruleset';

  constructor(public readonly type: 'non_ip' | 'ip', public readonly outputDir = OUTPUT_XRAY_DIR) {
    super(outputDir);
  }
}
