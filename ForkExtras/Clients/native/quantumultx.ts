import path from 'node:path';

import { PUBLIC_DIR } from '../../../Build/constants/dir';
import { withBannerArray } from '../../../Build/lib/misc';
import { BaseWriteStrategy } from '../../../Build/lib/writing-strategy/base';

export const QUANTUMULTX_UNSUPPORTED_MARKER = '# __QUANTUMULTX_UNSUPPORTED__:';
export const QUANTUMULTX_POLICY_MARKER = '__QUANTUMULTX_POLICY__';
export const OUTPUT_QUANTUMULTX_DIR = path.join(PUBLIC_DIR, 'QuantumultX');

function appendSet(result: string[], prefix: string, values: Set<string>) {
  for (const value of values) result.push(`${prefix},${value},${QUANTUMULTX_POLICY_MARKER}`);
}

function appendUnsupported(result: string[], type: string, values: Iterable<string>) {
  for (const value of values) result.push(`${QUANTUMULTX_UNSUPPORTED_MARKER}${type},${value}`);
}

export class QuantumultXDomainSet extends BaseWriteStrategy {
  public readonly name = 'quantumultx domainset';
  readonly fileExtension = 'txt';
  readonly type = 'domainset';
  protected result: string[] = [];

  constructor(public readonly outputDir = OUTPUT_QUANTUMULTX_DIR) { super(outputDir); }

  withPadding = withBannerArray;
  writeDomain(domain: string): void { this.result.push(`HOST,${domain},${QUANTUMULTX_POLICY_MARKER}`); }
  writeDomainSuffix(domain: string): void { this.result.push(`HOST-SUFFIX,${domain},${QUANTUMULTX_POLICY_MARKER}`); }
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

export class QuantumultXRuleSet extends BaseWriteStrategy {
  public readonly name = 'quantumultx ruleset';
  readonly fileExtension = 'txt';
  protected result: string[] = [];

  constructor(public readonly type: 'non_ip' | 'ip', public readonly outputDir = OUTPUT_QUANTUMULTX_DIR) {
    super(outputDir);
  }

  withPadding = withBannerArray;
  writeDomain(domain: string): void { this.result.push(`HOST,${domain},${QUANTUMULTX_POLICY_MARKER}`); }
  writeDomainSuffix(domain: string): void { this.result.push(`HOST-SUFFIX,${domain},${QUANTUMULTX_POLICY_MARKER}`); }
  writeDomainKeywords(keywords: Set<string>): void { appendSet(this.result, 'HOST-KEYWORD', keywords); }
  writeDomainWildcard(wildcard: string): void { this.result.push(`HOST-WILDCARD,${wildcard},${QUANTUMULTX_POLICY_MARKER}`); }
  writeUserAgents(userAgents: Set<string>): void { appendSet(this.result, 'USER-AGENT', userAgents); }
  writeProcessNames(processNames: Set<string>): void { appendUnsupported(this.result, 'PROCESS-NAME', processNames); }
  writeProcessPaths(processPaths: Set<string>): void { appendUnsupported(this.result, 'PROCESS-PATH', processPaths); }
  writeUrlRegexes(urlRegexes: Set<string>): void { appendUnsupported(this.result, 'URL-REGEX', urlRegexes); }

  writeIpCidrs(ipCidrs: string[]): void {
    for (const cidr of ipCidrs) this.result.push(`IP-CIDR,${cidr},${QUANTUMULTX_POLICY_MARKER}`);
  }

  writeIpCidr6s(ipCidrs: string[]): void {
    for (const cidr of ipCidrs) this.result.push(`IP6-CIDR,${cidr},${QUANTUMULTX_POLICY_MARKER}`);
  }

  writeGeoip(geoip: Set<string>): void { appendSet(this.result, 'GEOIP', geoip); }
  writeIpAsns(asns: Set<string>): void { appendSet(this.result, 'IP-ASN', asns); }
  writeSourceIpCidrs(values: string[]): void { appendUnsupported(this.result, 'SRC-IP', values); }
  writeSourcePorts(values: Set<string>): void { appendUnsupported(this.result, 'SRC-PORT', values); }
  writeDestinationPorts(values: Set<string>): void { appendUnsupported(this.result, 'DST-PORT', values); }
  writeProtocols(values: Set<string>): void { appendUnsupported(this.result, 'PROTOCOL', values); }
  writeOtherRules(rules: string[]): void {
    for (const rule of rules) this.result.push(`${QUANTUMULTX_UNSUPPORTED_MARKER}${rule}`);
  }
}
