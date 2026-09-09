'use strict';

const fs = require('node:fs');
const path = require('node:path');

function injectAfter(source, anchor, addition, label) {
  if (source.includes(addition.trim())) return source;
  const index = source.indexOf(anchor);
  if (index === -1) throw new Error(`Shadowrocket native injection failed: cannot find ${label}`);
  const end = index + anchor.length;
  return source.slice(0, end) + addition + source.slice(end);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  const index = source.indexOf(from);
  if (index === -1) throw new Error(`Shadowrocket native injection failed: cannot find ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

function patch(file, transform) {
  const source = fs.readFileSync(file, 'utf8');
  const next = transform(source);
  if (next !== source) fs.writeFileSync(file, next);
}

function prepare({ repoRoot }) {
  const ruleset = path.join(repoRoot, 'Build', 'lib', 'rules', 'ruleset.ts');
  const domainset = path.join(repoRoot, 'Build', 'lib', 'rules', 'domainset.ts');
  const strategyWriteData = path.join(repoRoot, 'Build', 'lib', 'rules', 'strategy-write-data.ts');

  patch(ruleset, (source) => {
    source = injectAfter(source, "import { SurgeRuleSet } from '../writing-strategy/surge';", "\nimport { ShadowrocketRuleSet } from '../../../ForkExtras/Clients/native/shadowrocket';", 'RulesetOutput import anchor');
    return replaceOnce(source, "      new SurgeRuleSet(type),\n      new ClashClassicRuleSet(type),", "      new SurgeRuleSet(type),\n      new ShadowrocketRuleSet(type),\n      new ClashClassicRuleSet(type),", 'RulesetOutput strategy list');
  });

  patch(domainset, (source) => {
    source = injectAfter(source, "import { SurgeDomainSet } from '../writing-strategy/surge';", "\nimport { ShadowrocketDomainSet } from '../../../ForkExtras/Clients/native/shadowrocket';", 'DomainsetOutput import anchor');
    return replaceOnce(source, "    new SurgeDomainSet(),\n    new ClashDomainSet(),", "    new SurgeDomainSet(),\n    new ShadowrocketDomainSet(),\n    new ClashDomainSet(),", 'DomainsetOutput strategy list');
  });

  patch(strategyWriteData, (source) => {
    source = injectAfter(source, "import { SurgeDomainSet, SurgeMitmSgmodule, SurgeRuleSet } from '../writing-strategy/surge';", "\nimport { ShadowrocketDomainSet, ShadowrocketRuleSet } from '../../../ForkExtras/Clients/native/shadowrocket';", 'strategy worker import anchor');
    return injectAfter(source, "  'surge ruleset': (d) => new SurgeRuleSet(d.type, d.outputDir),", "\n  'shadowrocket domainset': (d) => new ShadowrocketDomainSet(d.outputDir),\n  'shadowrocket ruleset': (d) => new ShadowrocketRuleSet(d.type as 'non_ip' | 'ip', d.outputDir),", 'strategy worker registry');
  });
}

module.exports = { prepare };
