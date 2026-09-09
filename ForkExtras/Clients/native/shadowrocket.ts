import path from 'node:path';
import { noop } from 'foxts/noop';

import { PUBLIC_DIR } from '../../../Build/constants/dir';
import { withBannerArray } from '../../../Build/lib/misc';
import { BaseWriteStrategy } from '../../../Build/lib/writing-strategy/base';

export const SHADOWROCKET_UNSUPPORTED_MARKER = '# __SHADOWROCKET_UNSUPPORTED__:';
export const OUTPUT_SHADOWROCKET_DIR = path.join(PUBLIC_DIR, 'Shadowrocket');

function appendSet(result: string[], prefix: string, values: Set<string>) {
  for (const value of values) result.push(`${prefix},${value}`);
}

function appendUnsupported(result: string[], type: string, values: Iterable<string>) {
  for (const value of values) result.push(`${SHADOWROCKET_UNSUPPORTED_MARKER}${type},${value}`);
}

export class ShadowrocketDomainSet extends BaseWriteStrategy {
  public readonly name = 'shadowrocket domainset';
  readonly fileExtension = 'txt';
  readonly type = 'domainset';
  protected result: string[] = [];

  constructor(public readonly outputDir = OUTPUT_SHADOWROCKET_DIR) { super(outputDir); }

  withPadding = withBannerArray;
  writeDomain(domain: string): void { this.result.push(`DOMAIN,${domain}`); }
  writeDomainSuffix(domain: string): void { this.result.push(`DOMAIN-SUFFIX,${domain}`); }
  writeDomainKeywords = noop;
  writeDomainWildcard = noop;
  writeUserAgents = noop;
  writeProcessNames = noop;
  writeProcessPaths = noop;
  writeUrlRegexes = noop;
  writeIpCidrs = noop;
  writeIpCidr6s = noop;
  writeGeoip = noop;
  writeIpAsns = noop;
  writeSourceIpCidrs = noop;
  writeSourcePorts = noop;
  writeDestinationPorts = noop;
  writeProtocols = noop;
  writeOtherRules = noop;
}

export class ShadowrocketRuleSet extends BaseWriteStrategy {
  public readonly name = 'shadowrocket ruleset';
  readonly fileExtension = 'txt';
  protected result: string[] = [];

  constructor(public readonly type: 'non_ip' | 'ip', public readonly outputDir = OUTPUT_SHADOWROCKET_DIR) {
    super(outputDir);
  }

  withPadding = withBannerArray;
  writeDomain(domain: string): void { this.result.push(`DOMAIN,${domain}`); }
  writeDomainSuffix(domain: string): void { this.result.push(`DOMAIN-SUFFIX,${domain}`); }
  writeDomainKeywords(keywords: Set<string>): void { appendSet(this.result, 'DOMAIN-KEYWORD', keywords); }
  writeDomainWildcard(wildcard: string): void { this.result.push(`DOMAIN-WILDCARD,${wildcard}`); }
  writeUserAgents(userAgents: Set<string>): void { appendSet(this.result, 'USER-AGENT', userAgents); }
  writeProcessNames(processNames: Set<string>): void { appendUnsupported(this.result, 'PROCESS-NAME', processNames); }
  writeProcessPaths(processPaths: Set<string>): void { appendUnsupported(this.result, 'PROCESS-PATH', processPaths); }
  writeUrlRegexes(urlRegexes: Set<string>): void { appendSet(this.result, 'URL-REGEX', urlRegexes); }

  writeIpCidrs(ipCidrs: string[], noResolve: boolean): void {
    for (const cidr of ipCidrs) this.result.push(`IP-CIDR,${cidr}${noResolve ? ',no-resolve' : ''}`);
  }

  writeIpCidr6s(ipCidrs: string[], noResolve: boolean): void {
    for (const cidr of ipCidrs) this.result.push(`IP-CIDR,${cidr}${noResolve ? ',no-resolve' : ''}`);
  }

  writeGeoip(geoip: Set<string>, noResolve: boolean): void {
    for (const value of geoip) this.result.push(`GEOIP,${value}${noResolve ? ',no-resolve' : ''}`);
  }

  writeIpAsns(asns: Set<string>, noResolve: boolean): void {
    for (const value of asns) this.result.push(`IP-ASN,${value}${noResolve ? ',no-resolve' : ''}`);
  }

  writeSourceIpCidrs(values: string[]): void { appendUnsupported(this.result, 'SRC-IP', values); }
  writeSourcePorts(values: Set<string>): void { appendUnsupported(this.result, 'SRC-PORT', values); }
  writeDestinationPorts(values: Set<string>): void { appendSet(this.result, 'DST-PORT', values); }
  writeProtocols(values: Set<string>): void { appendUnsupported(this.result, 'PROTOCOL', values); }
  writeOtherRules(rules: string[]): void {
    for (const rule of rules) this.result.push(`${SHADOWROCKET_UNSUPPORTED_MARKER}${rule}`);
  }
}
