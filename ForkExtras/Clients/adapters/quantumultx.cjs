'use strict';

const priority = 45;
const UNSUPPORTED_MARKER = '# __QUANTUMULTX_UNSUPPORTED__:';
const POLICY_MARKER = '__QUANTUMULTX_POLICY__';

const STRICT_ALLOWED_TYPES = new Set([
  'HOST',
  'HOST-SUFFIX',
  'HOST-KEYWORD',
  'HOST-WILDCARD',
  'USER-AGENT',
  'IP-CIDR',
  'IP6-CIDR',
  'IP-ASN',
  'GEOIP'
]);

function prepare({ outputDir, client, lib }) {
  lib.rm(lib.path.join(outputDir, client.output || 'QuantumultX'));
}

function release({ outputDir, client, lib }) {
  const root = lib.path.join(outputDir, client.output || 'QuantumultX');
  if (!lib.fs.existsSync(root)) throw new Error('Quantumult X native writer produced no output directory');

  const policy = String(client.policy_placeholder || 'reject').trim() || 'reject';
  const experimentalPorts = client.experimental?.port_rules === true;
  const allowedTypes = new Set(STRICT_ALLOWED_TYPES);
  if (experimentalPorts) {
    allowedTypes.add('DST-PORT');
    allowedTypes.add('SRC-PORT');
  }

  const unsupported = [];
  const unsupportedByType = new Map();
  const emittedByType = new Map();
  let files = 0;
  let emittedRules = 0;
  let experimentalPortRules = 0;

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
          const parts = rule.split(',');
          const type = (parts[0] || 'UNKNOWN').trim().toUpperCase();
          const value = parts.slice(1).join(',').trim();

          if (experimentalPorts && (type === 'DST-PORT' || type === 'SRC-PORT') && value) {
            output.push(`${type},${value},${policy}`);
            emittedRules += 1;
            experimentalPortRules += 1;
            emittedByType.set(type, (emittedByType.get(type) || 0) + 1);
            continue;
          }

          unsupported.push({ file: relList, type, rule });
          unsupportedByType.set(type, (unsupportedByType.get(type) || 0) + 1);
          continue;
        }

        let rendered = line.replaceAll(POLICY_MARKER, policy);
        const trimmed = rendered.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const type = trimmed.split(',', 1)[0].trim().toUpperCase();
          if (!allowedTypes.has(type)) {
            throw new Error(`Quantumult X writer emitted unsupported rule type ${type} in ${relList}: ${trimmed}`);
          }
          const parts = trimmed.split(',').map((part) => part.trim());
          if (parts.length < 3 || parts.at(-1) !== policy) {
            throw new Error(`Quantumult X rule is missing the configured placeholder policy in ${relList}: ${trimmed}`);
          }
          emittedRules += 1;
          emittedByType.set(type, (emittedByType.get(type) || 0) + 1);
        }

        output.push(rendered);
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
    policy_placeholder: policy,
    generated_files: files,
    emitted_rules: emittedRules,
    emitted_by_type: Object.fromEntries([...emittedByType.entries()].sort(([a], [b]) => a.localeCompare(b))),
    unsupported_rules: unsupported.length,
    unsupported_by_type: Object.fromEntries([...unsupportedByType.entries()].sort(([a], [b]) => a.localeCompare(b))),
    experimental: {
      port_rules_enabled: experimentalPorts,
      port_rules_emitted: experimentalPortRules
    },
    notes: [
      'Sukka no-resolve modifiers are omitted because this Quantumult X payload format does not preserve that modifier.',
      'PROCESS-NAME, PROCESS-PATH, URL-REGEX, SRC-IP and PROTOCOL are not guessed or rewritten into different semantics.'
    ]
  };
  lib.fs.writeFileSync(lib.path.join(reportDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  const reportLines = [
    '# Quantumult X unsupported source rules',
    '# These rules were present in Sukka universal rule data but have no enabled',
    '# lossless standalone Quantumult X filter mapping in this adapter.',
    '# DST-PORT/SRC-PORT remain here unless experimental.port_rules is enabled.',
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

  lib.writeReadme(root, `# Quantumult X\n\nThese filter rule sets are generated directly from Sukka's universal FileOutput data, not converted from Clash text.\n\nSupported in strict mode: HOST, HOST-SUFFIX, HOST-KEYWORD, HOST-WILDCARD, USER-AGENT, IP-CIDR, IP6-CIDR, IP-ASN and GEOIP.\n\nEvery emitted rule contains placeholder policy \`${policy}\`. Load remote files with Quantumult X \`filter_remote\` and \`force-policy=YOUR_POLICY\` so the remote policy is overridden. The default placeholder is intentionally \`reject\` so a missing force-policy fails visibly instead of silently becoming DIRECT.\n\n- \`domainset/*.list\` — typed Quantumult X host filters.\n- \`non_ip/*.list\` — compatible non-IP filters.\n- \`ip/*.list\` — IPv4/IPv6, ASN and GEOIP filters.\n- \`_report/summary.json\` — coverage and rule-type counts.\n- \`_report/unsupported.txt\` — source rules without an enabled lossless mapping.\n\nPort filters are conservative by default. Set \`experimental.port_rules: true\` in \`ForkExtras/clients.yml\` only after validating DST-PORT/SRC-PORT for the intended Quantumult X remote-filter usage.`);

  console.log(`[QuantumultX] native files=${files}, emitted=${emittedRules}, unsupported=${unsupported.length}, policy=${policy}, experimentalPorts=${experimentalPorts}`);
}

module.exports = { priority, prepare, release };
