'use strict';

const YAML = require('yaml');

const priority = 45;
const SIMPLE_ORDER = [
  'domain_set',
  'domain_suffix_set',
  'domain_keyword_set',
  'domain_regex_set',
  'domain_wildcard_set',
  'url_regex_set',
  'user_agent_set',
  'dest_port_set',
  'protocol_set'
];
const IP_ORDER = ['geoip_set', 'ip_cidr_set', 'ip_cidr6_set', 'asn_set'];

function countEntries(record) {
  let total = 0;
  for (const values of Object.values(record || {})) total += Array.isArray(values) ? values.length : 0;
  return total;
}

function orderedPayload(simple, ip, noResolve) {
  const result = {};
  if (noResolve) result.no_resolve = true;
  for (const key of SIMPLE_ORDER) {
    const values = simple?.[key];
    if (Array.isArray(values) && values.length) result[key] = values;
  }
  for (const key of IP_ORDER) {
    const values = ip?.[key];
    if (Array.isArray(values) && values.length) result[key] = values;
  }
  return result;
}

function validateKeys(record, allowed, label) {
  for (const key of Object.keys(record || {})) {
    if (!allowed.includes(key)) throw new Error(`Egern intermediate contains unknown ${label} key: ${key}`);
  }
}

function writeYaml(lib, file, payload) {
  const text = YAML.stringify(payload, null, { lineWidth: 0 });
  lib.mkdir(lib.path.dirname(file));
  lib.fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
}

function prepare({ outputDir, client, lib }) {
  lib.rm(lib.path.join(outputDir, client.output || 'Egern'));
}

function release({ outputDir, client, lib }) {
  const root = lib.path.join(outputDir, client.output || 'Egern');
  if (!lib.fs.existsSync(root)) throw new Error('Egern native writer produced no output directory');

  const unsupported = [];
  const unsupportedByType = new Map();
  const splits = [];
  let sourceFiles = 0;
  let generatedFiles = 0;
  let emittedRules = 0;

  for (const category of ['domainset', 'non_ip', 'ip']) {
    const categoryDir = lib.path.join(root, category);
    const sources = lib.walkFiles(categoryDir, file => file.endsWith('.json'));

    for (const src of sources) {
      sourceFiles += 1;
      const relJson = lib.path.relative(root, src).split(lib.path.sep).join('/');
      const relYaml = relJson.replace(/\.json$/u, '.yaml');
      const canonical = lib.path.join(root, relYaml);
      const payload = JSON.parse(lib.fs.readFileSync(src, 'utf8'));

      if (payload.version !== 1) throw new Error(`Unsupported Egern intermediate version in ${relJson}`);
      validateKeys(payload.simple, SIMPLE_ORDER, 'simple');
      validateKeys(payload.ip_no_resolve, IP_ORDER, 'no-resolve IP');
      validateKeys(payload.ip_resolve, IP_ORDER, 'resolve IP');

      const simpleCount = countEntries(payload.simple);
      const noResolveCount = countEntries(payload.ip_no_resolve);
      const resolveCount = countEntries(payload.ip_resolve);
      emittedRules += simpleCount + noResolveCount + resolveCount;

      const canonicalPayload = noResolveCount > 0
        ? orderedPayload(payload.simple, payload.ip_no_resolve, true)
        : orderedPayload(payload.simple, payload.ip_resolve, false);

      if (Object.keys(canonicalPayload).some(key => key !== 'no_resolve')) {
        writeYaml(lib, canonical, canonicalPayload);
        generatedFiles += 1;
      }

      if (noResolveCount > 0 && resolveCount > 0) {
        const resolveRel = relYaml.replace(/\.yaml$/u, '-resolve.yaml');
        const resolveFile = lib.path.join(root, resolveRel);
        writeYaml(lib, resolveFile, orderedPayload({}, payload.ip_resolve, false));
        generatedFiles += 1;
        splits.push({ source: relYaml, resolve: resolveRel, resolve_rules: resolveCount });
      }

      for (const rule of payload.unsupported || []) {
        const trimmed = String(rule).trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const type = (trimmed.split(',', 1)[0] || 'UNKNOWN').toUpperCase();
        unsupported.push({ file: relYaml, type, rule: trimmed });
        unsupportedByType.set(type, (unsupportedByType.get(type) || 0) + 1);
      }

      lib.fs.unlinkSync(src);
    }
  }

  unsupported.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));
  splits.sort((a, b) => a.source.localeCompare(b.source));

  const reportDir = lib.path.join(root, '_report');
  lib.mkdir(reportDir);
  const summary = {
    source: 'Sukka FileOutput universal rule model',
    format: 'Egern native YAML rule set',
    source_files: sourceFiles,
    generated_files: generatedFiles,
    emitted_rules: emittedRules,
    unsupported_rules: unsupported.length,
    unsupported_by_type: Object.fromEntries([...unsupportedByType.entries()].sort(([a], [b]) => a.localeCompare(b))),
    mixed_no_resolve_sources: splits.length,
    no_resolve_note: 'Egern rule-set no_resolve is file-wide. Mixed Sukka IP semantics are preserved by keeping no-resolve IP rules in the canonical YAML and emitting DNS-resolving IP rules in a sibling *-resolve.yaml file.'
  };
  lib.fs.writeFileSync(lib.path.join(reportDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  const unsupportedLines = [
    '# Egern unsupported source rules',
    '# These source rules are omitted because no documented lossless Egern rule-set mapping is enabled.',
    ''
  ];
  if (unsupported.length === 0) {
    unsupportedLines.push('# None');
  } else {
    let previousFile = null;
    for (const item of unsupported) {
      if (item.file !== previousFile) {
        if (previousFile !== null) unsupportedLines.push('');
        unsupportedLines.push(`# ${item.file}`);
        previousFile = item.file;
      }
      unsupportedLines.push(item.rule);
    }
  }
  lib.fs.writeFileSync(lib.path.join(reportDir, 'unsupported.txt'), `${unsupportedLines.join('\n')}\n`);

  const splitLines = [
    '# Egern mixed no-resolve rule sets',
    '# When a source appears below, load BOTH the canonical YAML and its -resolve.yaml sibling under the same policy.',
    ''
  ];
  if (splits.length === 0) {
    splitLines.push('# None');
  } else {
    for (const item of splits) splitLines.push(`${item.source} -> ${item.resolve} (${item.resolve_rules} resolve rules)`);
  }
  lib.fs.writeFileSync(lib.path.join(reportDir, 'splits.txt'), `${splitLines.join('\n')}\n`);

  lib.writeReadme(root, `# Egern\n\nNative Egern YAML rule sets generated directly from Sukka's universal FileOutput data.\n\nSupported mappings include exact/suffix/keyword/regex/wildcard domains, URL regex, User-Agent, IPv4/IPv6 CIDR, GEOIP, ASN, destination ports and protocol rules. Unsupported source concepts are audited in \`_report/unsupported.txt\`.\n\nEgern exposes \`no_resolve\` once per rule-set file, while Sukka can mix resolving and no-resolve IP rules in one logical source. To preserve that distinction, the canonical \`*.yaml\` contains non-IP plus no-resolve IP entries and sets \`no_resolve: true\`; any resolving IP entries are emitted as \`*-resolve.yaml\`. If a source is split, load both URLs under the same policy. See \`_report/splits.txt\`.\n\nExample:\n\n\`\`\`yaml\nrules:\n  - rule_set:\n      match: https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Egern/non_ip/ai.yaml\n      policy: Proxy\n      update_interval: 86400\n\`\`\`\n`);

  if (generatedFiles === 0) throw new Error('Egern adapter did not publish any YAML rule sets');
  console.log(`[Egern] sources=${sourceFiles}, files=${generatedFiles}, emitted=${emittedRules}, unsupported=${unsupported.length}, splits=${splits.length}`);
}

module.exports = { priority, prepare, release };
