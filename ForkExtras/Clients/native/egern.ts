import path from 'node:path';

import { PUBLIC_DIR } from '../../../Build/constants/dir';
import { BaseWriteStrategy } from '../../../Build/lib/writing-strategy/base';

export const OUTPUT_EGERN_DIR = path.join(PUBLIC_DIR, 'Egern');

const SENTINEL = '7h15.ru1353t.1s.m4d3.by.5ukk4w.skk.moe';
const SUPPORTED_PROTOCOLS = new Set(['tcp', 'udp', 'http', 'https', 'quic', 'stun']);

type SimpleSetKey =
  | 'domain_set'
  | 'domain_suffix_set'
  | 'domain_keyword_set'
  | 'domain_regex_set'
  | 'domain_wildcard_set'
  | 'url_regex_set'
  | 'user_agent_set'
  | 'dest_port_set'
  | 'protocol_set';

type IpSetKey = 'geoip_set' | 'ip_cidr_set' | 'ip_cidr6_set' | 'asn_set';

type SimpleStore = Record<SimpleSetKey, string[]>;
type IpStore = Record<IpSetKey, string[]>;

function createSimpleStore(): SimpleStore {
  return {
    domain_set: [],
    domain_suffix_set: [],
    domain_keyword_set: [],
    domain_regex_set: [],
    domain_wildcard_set: [],
    url_regex_set: [],
    user_agent_set: [],
    dest_port_set: [],
    protocol_set: []
  };
}

function createIpStore(): IpStore {
  return {
    geoip_set: [],
    ip_cidr_set: [],
    ip_cidr6_set: [],
    asn_set: []
  };
}

abstract class EgernBaseStrategy extends BaseWriteStrategy {
  public abstract readonly name: string;
  public abstract readonly type: 'domainset' | 'non_ip' | 'ip';
  readonly fileExtension = 'json' as const;
  protected result: string[] = [];
  protected readonly skipCompareOnCI = true;

  private readonly simple = createSimpleStore();
  private readonly ipNoResolve = createIpStore();
  private readonly ipResolve = createIpStore();
  private readonly unsupported: string[] = [];

  protected addSimple(key: SimpleSetKey, value: string): void {
    const trimmed = value.trim();
    if (!trimmed || trimmed === SENTINEL) return;
    this.simple[key].push(trimmed);
    this.result.push(`${key}:${trimmed}`);
  }

  protected addIp(key: IpSetKey, value: string, noResolve: boolean): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    const target = noResolve ? this.ipNoResolve : this.ipResolve;
    target[key].push(trimmed);
    this.result.push(`${noResolve ? 'nr' : 'r'}:${key}:${trimmed}`);
  }

  protected addUnsupported(rule: string): void {
    const trimmed = rule.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    this.unsupported.push(trimmed);
    this.result.push(`unsupported:${trimmed}`);
  }

  private addProtocol(value: string): void {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;
    if (!SUPPORTED_PROTOCOLS.has(normalized)) {
      this.addUnsupported(`PROTOCOL,${value}`);
      return;
    }
    this.addSimple('protocol_set', normalized);
  }

  private addRawIp(key: IpSetKey, raw: string): void {
    let value = raw.trim();
    let noResolve = false;
    if (/[,\s]no-resolve$/iu.test(value)) {
      value = value.replace(/,?\s*no-resolve$/iu, '').trim();
      noResolve = true;
    }
    this.addIp(key, value, noResolve);
  }

  private addOtherRule(rule: string): void {
    const trimmed = rule.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const comma = trimmed.indexOf(',');
    if (comma === -1) {
      this.addUnsupported(trimmed);
      return;
    }

    const type = trimmed.slice(0, comma).trim().toUpperCase();
    const value = trimmed.slice(comma + 1).trim();
    switch (type) {
      case 'DOMAIN': this.addSimple('domain_set', value); return;
      case 'DOMAIN-SUFFIX': this.addSimple('domain_suffix_set', value); return;
      case 'DOMAIN-KEYWORD': this.addSimple('domain_keyword_set', value); return;
      case 'DOMAIN-REGEX': this.addSimple('domain_regex_set', value); return;
      case 'DOMAIN-WILDCARD': this.addSimple('domain_wildcard_set', value); return;
      case 'URL-REGEX': this.addSimple('url_regex_set', value); return;
      case 'USER-AGENT': this.addSimple('user_agent_set', value); return;
      case 'DEST-PORT':
      case 'DST-PORT': this.addSimple('dest_port_set', value); return;
      case 'PROTOCOL':
      case 'NETWORK': this.addProtocol(value); return;
      case 'GEOIP': this.addRawIp('geoip_set', value); return;
      case 'IP-CIDR': this.addRawIp('ip_cidr_set', value); return;
      case 'IP-CIDR6': this.addRawIp('ip_cidr6_set', value); return;
      case 'IP-ASN': this.addRawIp('asn_set', value); return;
      default: this.addUnsupported(trimmed);
    }
  }

  writeDomain(domain: string): void { this.addSimple('domain_set', domain); }
  writeDomainSuffix(domain: string): void { this.addSimple('domain_suffix_set', domain); }
  writeDomainKeywords(keywords: Set<string>): void {
    for (const value of keywords) this.addSimple('domain_keyword_set', value);
  }
  writeDomainWildcard(wildcard: string): void { this.addSimple('domain_wildcard_set', wildcard); }
  writeUserAgents(userAgents: Set<string>): void {
    for (const value of userAgents) this.addSimple('user_agent_set', value);
  }
  writeProcessNames(processNames: Set<string>): void {
    for (const value of processNames) this.addUnsupported(`PROCESS-NAME,${value}`);
  }
  writeProcessPaths(processPaths: Set<string>): void {
    for (const value of processPaths) this.addUnsupported(`PROCESS-PATH,${value}`);
  }
  writeUrlRegexes(urlRegexes: Set<string>): void {
    for (const value of urlRegexes) this.addSimple('url_regex_set', value);
  }
  writeIpCidrs(values: string[], noResolve: boolean): void {
    for (const value of values) this.addIp('ip_cidr_set', value, noResolve);
  }
  writeIpCidr6s(values: string[], noResolve: boolean): void {
    for (const value of values) this.addIp('ip_cidr6_set', value, noResolve);
  }
  writeGeoip(values: Set<string>, noResolve: boolean): void {
    for (const value of values) this.addIp('geoip_set', value, noResolve);
  }
  writeIpAsns(values: Set<string>, noResolve: boolean): void {
    for (const value of values) this.addIp('asn_set', value, noResolve);
  }
  writeSourceIpCidrs(values: string[]): void {
    for (const value of values) this.addUnsupported(`SRC-IP,${value}`);
  }
  writeSourcePorts(values: Set<string>): void {
    for (const value of values) this.addUnsupported(`SRC-PORT,${value}`);
  }
  writeDestinationPorts(values: Set<string>): void {
    for (const value of values) this.addSimple('dest_port_set', value);
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
      version: 1,
      category: this.type,
      simple: this.simple,
      ip_no_resolve: this.ipNoResolve,
      ip_resolve: this.ipResolve,
      unsupported: this.unsupported
    }, null, 2).split('\n');
  }
}

export class EgernDomainSet extends EgernBaseStrategy {
  public readonly name = 'egern domainset';
  readonly type = 'domainset';

  constructor(public readonly outputDir = OUTPUT_EGERN_DIR) { super(outputDir); }
}

export class EgernRuleSet extends EgernBaseStrategy {
  public readonly name = 'egern ruleset';

  constructor(public readonly type: 'non_ip' | 'ip', public readonly outputDir = OUTPUT_EGERN_DIR) {
    super(outputDir);
  }
}
