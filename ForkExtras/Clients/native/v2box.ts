import path from 'node:path';

import { PUBLIC_DIR } from '../../../Build/constants/dir';
import { BaseWriteStrategy } from '../../../Build/lib/writing-strategy/base';

export const OUTPUT_V2BOX_DIR = path.join(PUBLIC_DIR, 'V2Box');

const SENTINEL = '7h15.ru1353t.1s.m4d3.by.5ukk4w.skk.moe';
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

abstract class V2BoxBaseStrategy extends BaseWriteStrategy {
  public abstract readonly name: string;
  public abstract readonly type: 'domainset' | 'non_ip' | 'ip';
  readonly fileExtension = 'json' as const;
  protected result: string[] = [];
  protected readonly skipCompareOnCI = true;

  private readonly exactDomains = new Set<string>();
  private readonly suffixDomains = new Set<string>();
  private readonly keywords = new Set<string>();
  private readonly regexDomains = new Set<string>();
  private readonly geosites = new Set<string>();
  private readonly ipCidrs = new Set<string>();
  private readonly geoips = new Set<string>();
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

  private addIp(type: 'IP-CIDR' | 'IP-CIDR6' | 'GEOIP', value: string, noResolve: boolean): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (type === 'GEOIP') this.add(this.geoips, 'geoip', trimmed);
    else this.add(this.ipCidrs, 'ip', trimmed);
    if (noResolve) {
      this.addWarning(
        `${type},${trimmed},no-resolve`,
        'V2Box route imports have no per-rule no-resolve flag; DNS behavior is controlled by the active core/config.'
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
      case 'DOMAIN': this.add(this.exactDomains, 'domain', value); return;
      case 'DOMAIN-SUFFIX': this.add(this.suffixDomains, 'suffix', value); return;
      case 'DOMAIN-KEYWORD': this.add(this.keywords, 'keyword', value); return;
      case 'DOMAIN-WILDCARD': this.add(this.regexDomains, 'regex', globToRegexp(value)); return;
      case 'DOMAIN-REGEX': this.add(this.regexDomains, 'regex', value); return;
      case 'GEOSITE': this.add(this.geosites, 'geosite', value); return;
      case 'IP-CIDR':
      case 'IP-CIDR6':
      case 'GEOIP': this.addRawIp(type, value); return;
      case 'USER-AGENT':
      case 'URL-REGEX':
      case 'PROCESS-NAME':
      case 'PROCESS-PATH':
      case 'IP-ASN':
      case 'SRC-IP':
      case 'SRC-PORT':
      case 'DEST-PORT':
      case 'DST-PORT':
      case 'PROTOCOL':
      case 'NETWORK':
      case 'AND':
      case 'OR':
      case 'NOT':
        this.addUnsupported(
          trimmed,
          'No verified lossless mapping is enabled for this field in V2Box route-object/deep-link imports.'
        );
        return;
      default:
        this.addUnsupported(trimmed, 'No verified V2Box route-import mapping is enabled for this source rule type.');
    }
  }

  writeDomain(domain: string): void { this.add(this.exactDomains, 'domain', domain); }
  writeDomainSuffix(domain: string): void { this.add(this.suffixDomains, 'suffix', domain); }
  writeDomainKeywords(values: Set<string>): void {
    for (const value of values) this.add(this.keywords, 'keyword', value);
  }
  writeDomainWildcard(value: string): void {
    this.add(this.regexDomains, 'regex', globToRegexp(value));
  }
  writeUserAgents(values: Set<string>): void {
    for (const value of values) this.addUnsupported(`USER-AGENT,${value}`, 'V2Box route-object import has no verified User-Agent selector.');
  }
  writeProcessNames(values: Set<string>): void {
    for (const value of values) this.addUnsupported(`PROCESS-NAME,${value}`, 'Process routing is not emitted for V2Box iOS route imports.');
  }
  writeProcessPaths(values: Set<string>): void {
    for (const value of values) this.addUnsupported(`PROCESS-PATH,${value}`, 'Process routing is not emitted for V2Box iOS route imports.');
  }
  writeUrlRegexes(values: Set<string>): void {
    for (const value of values) this.addUnsupported(`URL-REGEX,${value}`, 'V2Box domain-regex routing cannot represent an arbitrary full URL regex losslessly.');
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
    for (const value of values) this.addUnsupported(`IP-ASN,${value}`, 'V2Box route-object import has no verified IP-ASN selector.');
  }
  writeSourceIpCidrs(values: string[]): void {
    for (const value of values) this.addUnsupported(`SRC-IP,${value}`, 'Source-IP is not emitted in the verified V2Box route-object subset.');
  }
  writeSourcePorts(values: Set<string>): void {
    for (const value of values) this.addUnsupported(`SRC-PORT,${value}`, 'Source-port is not emitted in the verified V2Box route-object subset.');
  }
  writeDestinationPorts(values: Set<string>): void {
    for (const value of values) this.addUnsupported(`DEST-PORT,${value}`, 'Destination-port is not emitted in the verified V2Box route-object subset.');
  }
  writeProtocols(values: Set<string>): void {
    for (const value of values) this.addUnsupported(`PROTOCOL,${value}`, 'Protocol/network selectors are not emitted in the verified V2Box route-object subset.');
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
      version: 1,
      category: this.type,
      exactDomains: [...this.exactDomains],
      suffixDomains: [...this.suffixDomains],
      keywords: [...this.keywords],
      regexDomains: [...this.regexDomains],
      geosites: [...this.geosites],
      ipCidrs: [...this.ipCidrs],
      geoips: [...this.geoips],
      unsupported: this.unsupported,
      warnings: this.warnings
    }, null, 2).split('\n');
  }
}

export class V2BoxDomainSet extends V2BoxBaseStrategy {
  public readonly name = 'v2box domainset';
  readonly type = 'domainset';

  constructor(public readonly outputDir = OUTPUT_V2BOX_DIR) { super(outputDir); }
}

export class V2BoxRuleSet extends V2BoxBaseStrategy {
  public readonly name = 'v2box ruleset';

  constructor(public readonly type: 'non_ip' | 'ip', public readonly outputDir = OUTPUT_V2BOX_DIR) {
    super(outputDir);
  }
}
