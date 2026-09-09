'use strict';

const fs = require('node:fs');
const path = require('node:path');

function injectAfter(source, anchor, addition, label) {
  if (source.includes(addition.trim())) return source;
  const index = source.indexOf(anchor);
  if (index === -1) throw new Error(`Egern native injection failed: cannot find ${label}`);
  const end = index + anchor.length;
  return source.slice(0, end) + addition + source.slice(end);
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

  patch(ruleset, source => {
    source = injectAfter(
      source,
      "import { SurgeRuleSet } from '../writing-strategy/surge';",
      "\nimport { EgernRuleSet } from '../../../ForkExtras/Clients/native/egern';",
      'RulesetOutput import anchor'
    );
    return injectAfter(
      source,
      '      new SurgeRuleSet(type),',
      '\n      new EgernRuleSet(type),',
      'RulesetOutput strategy list'
    );
  });

  patch(domainset, source => {
    source = injectAfter(
      source,
      "import { SurgeDomainSet } from '../writing-strategy/surge';",
      "\nimport { EgernDomainSet } from '../../../ForkExtras/Clients/native/egern';",
      'DomainsetOutput import anchor'
    );
    return injectAfter(
      source,
      '    new SurgeDomainSet(),',
      '\n    new EgernDomainSet(),',
      'DomainsetOutput strategy list'
    );
  });

  patch(strategyWriteData, source => {
    source = injectAfter(
      source,
      "import { SurgeDomainSet, SurgeMitmSgmodule, SurgeRuleSet } from '../writing-strategy/surge';",
      "\nimport { EgernDomainSet, EgernRuleSet } from '../../../ForkExtras/Clients/native/egern';",
      'strategy worker import anchor'
    );
    return injectAfter(
      source,
      "  'surge ruleset': (d) => new SurgeRuleSet(d.type, d.outputDir),",
      "\n  'egern domainset': (d) => new EgernDomainSet(d.outputDir),\n  'egern ruleset': (d) => new EgernRuleSet(d.type as 'non_ip' | 'ip', d.outputDir),",
      'strategy worker registry'
    );
  });
}

module.exports = { prepare };
