'use strict';

const priority = 40;
const UNSUPPORTED_MARKER = '# __SHADOWROCKET_UNSUPPORTED__:';

const ALLOWED_TYPES = new Set([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'DOMAIN-WILDCARD',
  'USER-AGENT',
  'URL-REGEX',
  'IP-CIDR',
  'IP-ASN',
  'GEOIP',
  'DST-PORT'
]);

function prepare({ outputDir, client, lib }) {
  lib.rm(lib.path.join(outputDir, client.output || 'Shadowrocket'));
}

function release({ outputDir, client, lib }) {
  const root = lib.path.join(outputDir, client.output || 'Shadowrocket');
  if (!lib.fs.existsSync(root)) throw new Error('Shadowrocket native writer produced no output directory');

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
          const rule = line.slice(UNSUPPORTED_MARKER.length);
          const type = (rule.split(',', 1)[0] || 'UNKNOWN').toUpperCase();
          unsupported.push({ file: relList, type, rule });
          unsupportedByType.set(type, (unsupportedByType.get(type) || 0) + 1);
          continue;
        }

        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const type = trimmed.split(',', 1)[0].toUpperCase();
          if (!ALLOWED_TYPES.has(type)) {
            throw new Error(`Shadowrocket writer emitted unsupported rule type ${type} in ${relList}: ${trimmed}`);
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
    '# Shadowrocket unsupported source rules',
    '# These rules were present in Sukka universal rule data but have no lossless',
    '# standalone Shadowrocket RULE-SET mapping in this adapter.',
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

  lib.writeReadme(root, `# Shadowrocket\n\nThese rule sets are generated directly from Sukka's universal FileOutput data, not converted from Clash or Surge text.\n\n- \`domainset/*.list\` — typed DOMAIN / DOMAIN-SUFFIX rules.\n- \`non_ip/*.list\` — Shadowrocket-compatible non-IP rules.\n- \`ip/*.list\` — Shadowrocket-compatible IP rules. IPv4 and IPv6 both use \`IP-CIDR\`.\n- \`_report/summary.json\` — conversion coverage summary.\n- \`_report/unsupported.txt\` — source rules that cannot be represented losslessly as standalone Shadowrocket RULE-SET entries.\n\nUse the files as policy-free remote payloads, for example: \`RULE-SET,<raw-url>,PROXY\`.`);

  console.log(`[Shadowrocket] native files=${files}, emitted=${emittedRules}, unsupported=${unsupported.length}`);
}

module.exports = { priority, prepare, release };
