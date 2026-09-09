import path from 'node:path';

import { PUBLIC_DIR } from '../../../Build/constants/dir';
import { withBannerArray } from '../../../Build/lib/misc';
import { BaseWriteStrategy } from '../../../Build/lib/writing-strategy/base';

export const STASH_UNSUPPORTED_MARKER = '# __STASH_UNSUPPORTED__:';
export const OUTPUT_STASH_DIR = path.join(PUBLIC_DIR, 'Stash');

function appendSet(result: string[], prefix: string, values: Set<string>) {
  for (const value of values) result.push(`${prefix},${value}`);
}

function appendUnsupported(result: string[], type: string, values: Iterable<string>) {
  for (const value of values) result.push(`${STASH_UNSUPPORTED_MARKER}${type},${value}`);
}

const SUPPORTED_OTHER_TYPES = new Set([
  'DOMAIN-REGEX',
  'NETWORK',
  'GEOSITE',
  'AND',
  'OR',
  'NOT'
]);

function normalizeOtherRule(rule: string): string | null {
  const trimmed = rule.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const type = (trimmed.split(',', 1)[0] || '').toUpperCase();
  if (!SUPPORTED_OTHER_TYPES.has(type)) return `${STASH_UNSUPPORTED_MARKER}${trimmed}`;

  // Sukka's source syntax follows Surge for destination ports; Stash documents DST-PORT.
  return trimmed.replaceAll('DEST-PORT,', 'DST-PORT,');
}

/**
 * Stash domain-text provider payload. Exact domains are plain strings and
 * suffixes use +.example.com, which Stash documents as matching both the
 * suffix and the apex domain.
 */
export class StashDomainSet extends BaseWriteStrategy {
  public readonly name = 'stash domainset';
  readonly fileExtension = 'txt';
  readonly type = 'domainset';
  protected result: string[] = [];

  constructor(public readonly outputDir = OUTPUT_STASH_DIR) { super(outputDir); }

  withPadding = withBannerArray;
  writeDomain(domain: string): void { this.result.push(domain); }
  writeDomainSuffix(domain: string): void { this.result.push(`+.${domain}`); }
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

/** Stash classical text provider payload generated from Sukka FileOutput. */
export class StashRuleSet extends BaseWriteStrategy {
  public readonly name = 'stash ruleset';
  readonly fileExtension = 'txt';
  protected result: string[] = [];

  constructor(public readonly type: 'non_ip' | 'ip', public readonly outputDir = OUTPUT_STASH_DIR) {
    super(outputDir);
  }

  withPadding = withBannerArray;
  writeDomain(domain: string): void { this.result.push(`DOMAIN,${domain}`); }
  writeDomainSuffix(domain: string): void { this.result.push(`DOMAIN-SUFFIX,${domain}`); }
  writeDomainKeywords(keywords: Set<string>): void { appendSet(this.result, 'DOMAIN-KEYWORD', keywords); }
  writeDomainWildcard(wildcard: string): void { this.result.push(`DOMAIN-WILDCARD,${wildcard}`); }
  writeUserAgents(userAgents: Set<string>): void { appendSet(this.result, 'USER-AGENT', userAgents); }
  writeProcessNames(processNames: Set<string>): void { appendSet(this.result, 'PROCESS-NAME', processNames); }
  writeProcessPaths(processPaths: Set<string>): void { appendSet(this.result, 'PROCESS-PATH', processPaths); }
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

  // Stash documentation shows SRC-IP inside logical rules, but does not document
  // standalone SRC-IP/SRC-PORT rule-provider entries. Keep standalone forms out
  // of published payloads until they are explicitly documented/verified.
  writeSourceIpCidrs(values: string[]): void { appendUnsupported(this.result, 'SRC-IP', values); }
  writeSourcePorts(values: Set<string>): void { appendUnsupported(this.result, 'SRC-PORT', values); }
  writeDestinationPorts(values: Set<string>): void { appendSet(this.result, 'DST-PORT', values); }
  writeProtocols(values: Set<string>): void { appendSet(this.result, 'PROTOCOL', values); }

  writeOtherRules(rules: string[]): void {
    for (const rule of rules) {
      const normalized = normalizeOtherRule(rule);
      if (normalized !== null) this.result.push(normalized);
    }
  }
}
