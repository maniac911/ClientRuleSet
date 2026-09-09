import path from 'node:path';

import { PUBLIC_DIR } from '../../../Build/constants/dir';
import { withBannerArray } from '../../../Build/lib/misc';
import { BaseWriteStrategy } from '../../../Build/lib/writing-strategy/base';

export const LOON_UNSUPPORTED_MARKER = '# __LOON_UNSUPPORTED__:';
export const OUTPUT_LOON_DIR = path.join(PUBLIC_DIR, 'Loon');

function appendSet(result: string[], prefix: string, values: Set<string>) {
  for (const value of values) result.push(`${prefix},${value}`);
}

function appendUnsupported(result: string[], type: string, values: Iterable<string>) {
  for (const value of values) result.push(`${LOON_UNSUPPORTED_MARKER}${type},${value}`);
}

function encodeUserAgent(value: string): string {
  // Mature Loon rule sets percent-encode literal spaces in UA patterns.
  // Preserve existing percent escapes and only encode actual spaces.
  return value.replaceAll(' ', '%20');
}

const LOGIC_TYPES = new Set(['AND', 'OR', 'NOT']);
const LOGIC_CHILD_TYPES = new Set([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'USER-AGENT',
  'URL-REGEX',
  'IP-CIDR',
  'IP-CIDR6',
  'GEOIP',
  'IP-ASN',
  'SRC-PORT',
  'DEST-PORT',
  'PROTOCOL',
  'AND',
  'OR',
  'NOT'
]);

function collectLogicTypes(rule: string): Set<string> {
  const result = new Set<string>();
  const regex = /(?:^|\(+)[\t ]*([A-Za-z][A-Za-z0-9-]*),/gu;
  for (const match of rule.matchAll(regex)) result.add(match[1].toUpperCase());
  return result;
}

function normalizeOtherRule(rule: string): string | null {
  const trimmed = rule.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const topType = (trimmed.split(',', 1)[0] || '').toUpperCase();
  if (!LOGIC_TYPES.has(topType)) return `${LOON_UNSUPPORTED_MARKER}${trimmed}`;

  let normalized = trimmed.replaceAll('DST-PORT,', 'DEST-PORT,');
  const types = collectLogicTypes(normalized);
  if (types.size === 0 || [...types].some(type => !LOGIC_CHILD_TYPES.has(type))) {
    return `${LOON_UNSUPPORTED_MARKER}${trimmed}`;
  }

  // Loon ecosystem rule sets encode spaces inside USER-AGENT patterns.
  normalized = normalized.replace(/USER-AGENT,([^,)]+)/gu, (_match, value: string) => `USER-AGENT,${encodeUserAgent(value)}`);
  return normalized;
}

/** Typed Loon subscription-rule payload generated from Sukka domainset data. */
export class LoonDomainSet extends BaseWriteStrategy {
  public readonly name = 'loon domainset';
  readonly fileExtension = 'txt';
  readonly type = 'domainset';
  protected result: string[] = [];

  constructor(public readonly outputDir = OUTPUT_LOON_DIR) { super(outputDir); }

  withPadding = withBannerArray;
  writeDomain(domain: string): void { this.result.push(`DOMAIN,${domain}`); }
  writeDomainSuffix(domain: string): void { this.result.push(`DOMAIN-SUFFIX,${domain}`); }
  writeDomainKeywords(): void {}
  writeDomainWildcard(): void {}
  writeUserAgents(): void {}
  writeProcessNames(): void {}
  writeProcessPaths(): void {}
  writeUrlRegexes(): void {}
  writeIpCidrs(): void {}
  writeIpCidr6s(): void {}
  writeGeoip(): void {}
  writeIpAsns(): void {}
  writeSourceIpCidrs(): void {}
  writeSourcePorts(): void {}
  writeDestinationPorts(): void {}
  writeProtocols(): void {}
  writeOtherRules(): void {}
}

/** Loon subscription rules generated directly from Sukka FileOutput. */
export class LoonRuleSet extends BaseWriteStrategy {
  public readonly name = 'loon ruleset';
  readonly fileExtension = 'txt';
  protected result: string[] = [];

  constructor(public readonly type: 'non_ip' | 'ip', public readonly outputDir = OUTPUT_LOON_DIR) {
    super(outputDir);
  }

  withPadding = withBannerArray;
  writeDomain(domain: string): void { this.result.push(`DOMAIN,${domain}`); }
  writeDomainSuffix(domain: string): void { this.result.push(`DOMAIN-SUFFIX,${domain}`); }
  writeDomainKeywords(keywords: Set<string>): void { appendSet(this.result, 'DOMAIN-KEYWORD', keywords); }
  writeDomainWildcard(wildcard: string): void { appendUnsupported(this.result, 'DOMAIN-WILDCARD', [wildcard]); }
  writeUserAgents(userAgents: Set<string>): void {
    for (const value of userAgents) this.result.push(`USER-AGENT,${encodeUserAgent(value)}`);
  }
  writeProcessNames(processNames: Set<string>): void { appendUnsupported(this.result, 'PROCESS-NAME', processNames); }
  writeProcessPaths(processPaths: Set<string>): void { appendUnsupported(this.result, 'PROCESS-PATH', processPaths); }
  writeUrlRegexes(urlRegexes: Set<string>): void { appendSet(this.result, 'URL-REGEX', urlRegexes); }

  writeIpCidrs(ipCidrs: string[], noResolve: boolean): void {
    for (const cidr of ipCidrs) this.result.push(`IP-CIDR,${cidr}${noResolve ? ',no-resolve' : ''}`);
  }

  writeIpCidr6s(ipCidrs: string[], noResolve: boolean): void {
    for (const cidr of ipCidrs) this.result.push(`IP-CIDR6,${cidr}${noResolve ? ',no-resolve' : ''}`);
  }

  writeGeoip(geoip: Set<string>, noResolve: boolean): void {
    for (const value of geoip) this.result.push(`GEOIP,${value}${noResolve ? ',no-resolve' : ''}`);
  }

  writeIpAsns(asns: Set<string>, noResolve: boolean): void {
    for (const value of asns) this.result.push(`IP-ASN,${value}${noResolve ? ',no-resolve' : ''}`);
  }

  // Loon's current public manual documents source/destination ports, but not a
  // standalone source-IP rule type. Keep SRC-IP out rather than guessing.
  writeSourceIpCidrs(values: string[]): void { appendUnsupported(this.result, 'SRC-IP', values); }
  writeSourcePorts(values: Set<string>): void { appendSet(this.result, 'SRC-PORT', values); }
  writeDestinationPorts(values: Set<string>): void { appendSet(this.result, 'DEST-PORT', values); }
  writeProtocols(values: Set<string>): void { appendSet(this.result, 'PROTOCOL', values); }

  writeOtherRules(rules: string[]): void {
    for (const rule of rules) {
      const normalized = normalizeOtherRule(rule);
      if (normalized !== null) this.result.push(normalized);
    }
  }
}
