'use strict';

const priority = 45;
const UNSUPPORTED_MARKER = '# __STASH_UNSUPPORTED__:';

const CLASSICAL_TYPES = new Set([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'DOMAIN-WILDCARD',
  'DOMAIN-REGEX',
  'USER-AGENT',
  'URL-REGEX',
  'IP-CIDR',
  'IP-CIDR6',
  'IP-ASN',
  'GEOIP',
  'DST-PORT',
  'PROTOCOL',
  'NETWORK',
  'GEOSITE',
  'PROCESS-NAME',
  'PROCESS-PATH',
  'AND',
  'OR',
  'NOT'
]);

function prepare({ outputDir, client, lib }) {
  lib.rm(lib.path.join(outputDir, client.output || 'Stash'));
}

function release({ outputDir, client, lib }) {
  const root = lib.path.join(outputDir, client.output || 'Stash');
  if (!lib.fs.existsSync(root)) throw new Error('Stash native writer produced no output directory');

  const unsupported = [];
  const unsupportedByType = new Map();
  const platformLimited = [];
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
          if (category === 'domainset') {
            // Stash behavior=domain, format=text accepts raw domains/wildcards.
            emittedRules += 1;
          } else {
            const type = trimmed.split(',', 1)[0].toUpperCase();
            if (!CLASSICAL_TYPES.has(type)) {
              throw new Error(`Stash writer emitted unsupported rule type ${type} in ${relList}: ${trimmed}`);
            }
            emittedRules += 1;

            if (
              type === 'PROCESS-NAME'
              || type === 'PROCESS-PATH'
              || trimmed.includes('(PROCESS-NAME,')
              || trimmed.includes('(PROCESS-PATH,')
            ) {
              platformLimited.push({ file: relList, rule: trimmed });
            }
          }
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
  platformLimited.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));

  const reportDir = lib.path.join(root, '_report');
  lib.mkdir(reportDir);
  const summary = {
    source: 'Sukka FileOutput universal rule model',
    generated_files: files,
    emitted_rules: emittedRules,
    unsupported_rules: unsupported.length,
    unsupported_by_type: Object.fromEntries([...unsupportedByType.entries()].sort(([a], [b]) => a.localeCompare(b))),
    platform_limited_rules: platformLimited.length,
    platform_limited_note: 'PROCESS-NAME/PROCESS-PATH are parsed by Stash but ignored on iOS/tvOS due to Network Extension limitations.'
  };
  lib.fs.writeFileSync(lib.path.join(reportDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  const unsupportedLines = [
    '# Stash unsupported source rules',
    '# These source rules are not published because the current adapter has no',
    '# explicitly documented lossless standalone Stash rule-provider mapping.',
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

  const limitedLines = [
    '# Stash platform-limited rules',
    '# PROCESS-NAME / PROCESS-PATH work only where Stash can inspect local processes.',
    '# Stash documentation says iOS/tvOS (including the iOS build on Apple silicon)',
    '# ignores process rules because of Network Extension limitations.',
    ''
  ];
  if (platformLimited.length === 0) {
    limitedLines.push('# None');
  } else {
    let previousFile = null;
    for (const item of platformLimited) {
      if (item.file !== previousFile) {
        if (previousFile !== null) limitedLines.push('');
        limitedLines.push(`# ${item.file}`);
        previousFile = item.file;
      }
      limitedLines.push(item.rule);
    }
  }
  lib.fs.writeFileSync(lib.path.join(reportDir, 'platform-limited.txt'), `${limitedLines.join('\n')}\n`);

  lib.writeReadme(root, `# Stash\n\nThese rule sets are generated directly from Sukka's universal FileOutput data.\n\n- \`domainset/*.list\` — optimized Stash text payloads; use \`behavior: domain\`, \`format: text\`.\n- \`non_ip/*.list\` — Stash classical text rules; use \`behavior: classical\`, \`format: text\`.\n- \`ip/*.list\` — Stash classical text rules; use \`behavior: classical\`, \`format: text\`.\n- \`_report/summary.json\` — coverage summary.\n- \`_report/unsupported.txt\` — rules not published because no documented lossless mapping is enabled.\n- \`_report/platform-limited.txt\` — process rules that Stash parses but iOS/tvOS ignores.\n\nStash supports DOMAIN/DOMAIN-SUFFIX/DOMAIN-KEYWORD/DOMAIN-WILDCARD/DOMAIN-REGEX, IP-CIDR/IP-CIDR6, GEOIP, IP-ASN, DST-PORT, PROTOCOL, USER-AGENT, URL-REGEX, PROCESS-NAME/PROCESS-PATH, and AND/OR/NOT classical rules.\n\nExample provider:\n\n\`\`\`yaml\nrule-providers:\n  ai:\n    behavior: classical\n    format: text\n    url: https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Stash/non_ip/ai.list\n    interval: 86400\nrules:\n  - RULE-SET,ai,Proxy\n\`\`\``);

  console.log(`[Stash] native files=${files}, emitted=${emittedRules}, unsupported=${unsupported.length}, platform-limited=${platformLimited.length}`);
}

module.exports = { priority, prepare, release };
