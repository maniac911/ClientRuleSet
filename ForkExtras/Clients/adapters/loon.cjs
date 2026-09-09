'use strict';

const priority = 46;
const UNSUPPORTED_MARKER = '# __LOON_UNSUPPORTED__:';

const ALLOWED_TYPES = new Set([
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

function prepare({ outputDir, client, lib }) {
  lib.rm(lib.path.join(outputDir, client.output || 'Loon'));
}

function release({ outputDir, client, lib }) {
  const root = lib.path.join(outputDir, client.output || 'Loon');
  if (!lib.fs.existsSync(root)) throw new Error('Loon native writer produced no output directory');

  const unsupported = [];
  const unsupportedByType = new Map();
  let files = 0;
  let emittedRules = 0;

  for (const category of ['domainset', 'non_ip', 'ip']) {
    const categoryDir = lib.path.join(root, category);
    const sources = lib.walkFiles(categoryDir, (file) => file.endsWith('.txt'));

    for (const src of sources) {
      const relTxt = lib.path.relative(root, src).split(lib.path.sep).join('/');
      const relList = relTxt.replace(/\.txt$/u, '.list');
      const dest = lib.path.join(root, relList);
      const lines = lib.fs.readFileSync(src, 'utf8').split(/\r?\n/u);
      const output = [];

      for (const line of lines) {
        if (line.startsWith(UNSUPPORTED_MARKER)) {
          const rule = line.slice(UNSUPPORTED_MARKER.length).trim();
          if (!rule || rule.startsWith('#')) continue;
          const type = (rule.split(',', 1)[0] || 'UNKNOWN').toUpperCase();
          unsupported.push({ file: relList, type, rule });
          unsupportedByType.set(type, (unsupportedByType.get(type) || 0) + 1);
          continue;
        }

        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const type = trimmed.split(',', 1)[0].toUpperCase();
          if (!ALLOWED_TYPES.has(type)) {
            throw new Error(`Loon writer emitted unsupported rule type ${type} in ${relList}: ${trimmed}`);
          }
          emittedRules += 1;
        }
        output.push(line);
      }

      while (output.length && output[output.length - 1] === '') output.pop();
      lib.mkdir(lib.path.dirname(dest));
      lib.fs.writeFileSync(dest, `${output.join('\n')}\n`);
      lib.fs.unlinkSync(src);
      files += 1;
    }
  }

  unsupported.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));

  const reportDir = lib.path.join(root, '_report');
  lib.mkdir(reportDir);
  const summary = {
    source: 'Sukka FileOutput universal rule model',
    generated_files: files,
    emitted_rules: emittedRules,
    unsupported_rules: unsupported.length,
    unsupported_by_type: Object.fromEntries([...unsupportedByType.entries()].sort(([a], [b]) => a.localeCompare(b)))
  };
  lib.fs.writeFileSync(lib.path.join(reportDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  const reportLines = [
    '# Loon unsupported source rules',
    '# These source rules were not published because Loon\'s public rule manual',
    '# does not document a lossless equivalent for the current adapter.',
    ''
  ];
  if (unsupported.length === 0) {
    reportLines.push('# None');
  } else {
    let previousFile = null;
    for (const item of unsupported) {
      if (item.file !== previousFile) {
        if (previousFile !== null) reportLines.push('');
        reportLines.push(`# ${item.file}`);
        previousFile = item.file;
      }
      reportLines.push(item.rule);
    }
  }
  lib.fs.writeFileSync(lib.path.join(reportDir, 'unsupported.txt'), `${reportLines.join('\n')}\n`);

  lib.writeReadme(root, `# Loon\n\nThese subscription rule sets are generated directly from Sukka's universal FileOutput data instead of being converted from Clash.\n\n- \`domainset/*.list\` — DOMAIN / DOMAIN-SUFFIX subscription rules.\n- \`non_ip/*.list\` — Loon-compatible non-IP subscription rules.\n- \`ip/*.list\` — Loon-compatible IP subscription rules.\n- \`_report/summary.json\` — conversion coverage summary.\n- \`_report/unsupported.txt\` — source rules that are not emitted because no documented lossless Loon mapping is enabled.\n\nThe strict native mapping preserves documented Loon DOMAIN, DOMAIN-SUFFIX, DOMAIN-KEYWORD, USER-AGENT, URL-REGEX, IP-CIDR, IP-CIDR6, GEOIP, IP-ASN, SRC-PORT, DEST-PORT, PROTOCOL, AND, OR and NOT rules. DOMAIN-WILDCARD, process rules and standalone source-IP rules remain in the report.\n\nLoon subscription syntax applies policy outside the downloaded list, for example: \`https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Loon/non_ip/ai.list, PROXY\`.`);

  console.log(`[Loon] native files=${files}, emitted=${emittedRules}, unsupported=${unsupported.length}`);
}

module.exports = { priority, prepare, release };
