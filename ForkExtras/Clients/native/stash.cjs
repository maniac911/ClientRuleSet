'use strict';

const fs = require('node:fs');
const path = require('node:path');

function injectAfter(source, anchor, addition, label) {
  if (source.includes(addition.trim())) return source;
  const index = source.indexOf(anchor);
  if (index === -1) throw new Error(`Stash native injection failed: cannot find ${label}`);
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

  patch(ruleset, (source) => {
    source = injectAfter(
      source,
      "import { SurgeRuleSet } from '../writing-strategy/surge';",
      "\nimport { StashRuleSet } from '../../../ForkExtras/Clients/native/stash';",
      'RulesetOutput import anchor'
    );
    return injectAfter(
      source,
      '      new SurgeRuleSet(type),',
      '\n      new StashRuleSet(type),',
      'RulesetOutput strategy list'
    );
  });

  patch(domainset, (source) => {
    source = injectAfter(
      source,
      "import { SurgeDomainSet } from '../writing-strategy/surge';",
      "\nimport { StashDomainSet } from '../../../ForkExtras/Clients/native/stash';",
      'DomainsetOutput import anchor'
    );
    return injectAfter(
      source,
      '    new SurgeDomainSet(),',
      '\n    new StashDomainSet(),',
      'DomainsetOutput strategy list'
    );
  });

  patch(strategyWriteData, (source) => {
    source = injectAfter(
      source,
      "import { SurgeDomainSet, SurgeMitmSgmodule, SurgeRuleSet } from '../writing-strategy/surge';",
      "\nimport { StashDomainSet, StashRuleSet } from '../../../ForkExtras/Clients/native/stash';",
      'strategy worker import anchor'
    );
    source = injectAfter(
      source,
      "  'surge ruleset': (d) => new SurgeRuleSet(d.type, d.outputDir),",
      "\n  'stash domainset': (d) => new StashDomainSet(d.outputDir),\n  'stash ruleset': (d) => new StashRuleSet(d.type as 'non_ip' | 'ip', d.outputDir),",
      'strategy worker registry'
    );
    return source;
  });
}

module.exports = { prepare };
