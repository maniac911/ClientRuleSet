'use strict';

const priority = 47;

function prepare({ outputDir, client, lib }) {
  lib.rm(lib.path.join(outputDir, client.output || 'Xray'));
}

function toRule(base, field, value) {
  return { ...base, [field]: value };
}

function release({ outputDir, client, lib }) {
  const root = lib.path.join(outputDir, client.output || 'Xray');
  if (!lib.fs.existsSync(root)) throw new Error('Xray native writer produced no output directory');

  const outboundTag = String(client.outbound_tag || 'proxy').trim() || 'proxy';
  const unsupported = [];
  const warnings = [];
  const unsupportedByType = new Map();
  let sourceFiles = 0;
  let generatedFiles = 0;
  let emittedRules = 0;

  for (const category of ['domainset', 'non_ip', 'ip']) {
    const categoryDir = lib.path.join(root, category);
    const sources = lib.walkFiles(categoryDir, file => file.endsWith('.json'));

    for (const src of sources) {
      sourceFiles += 1;
      const rel = lib.path.relative(root, src).split(lib.path.sep).join('/');
      const payload = JSON.parse(lib.fs.readFileSync(src, 'utf8'));
      if (payload.version !== 1) throw new Error(`Unsupported Xray intermediate version in ${rel}`);

      const base = {
        type: 'field',
        outboundTag,
        enabled: true,
        remarks: `ClientRuleSet ${rel.replace(/\.json$/u, '')}`
      };
      const rules = [];

      // Xray ANDs different selector fields inside one routing rule. Sukka's
      // classical source lines are alternatives, so emit one RulesItem per
      // selector family to preserve source OR semantics.
      if (Array.isArray(payload.domains) && payload.domains.length) {
        rules.push(toRule(base, 'domain', payload.domains));
      }
      if (Array.isArray(payload.ips) && payload.ips.length) {
        rules.push(toRule(base, 'ip', payload.ips));
      }
      if (Array.isArray(payload.processes) && payload.processes.length) {
        rules.push(toRule(base, 'process', payload.processes));
      }
      if (Array.isArray(payload.ports) && payload.ports.length) {
        rules.push(toRule(base, 'port', payload.ports.join(',')));
      }
      if (Array.isArray(payload.networks) && payload.networks.length) {
        rules.push(toRule(base, 'network', payload.networks.join(',')));
      }
      if (Array.isArray(payload.protocols) && payload.protocols.length) {
        rules.push(toRule(base, 'protocol', payload.protocols));
      }

      for (const item of payload.unsupported || []) {
        const rule = String(item?.rule || '').trim();
        if (!rule || rule.startsWith('#')) continue;
        const type = (rule.split(',', 1)[0] || 'UNKNOWN').toUpperCase();
        unsupported.push({ file: rel, type, rule, reason: String(item?.reason || '') });
        unsupportedByType.set(type, (unsupportedByType.get(type) || 0) + 1);
      }
      for (const item of payload.warnings || []) {
        const rule = String(item?.rule || '').trim();
        if (!rule) continue;
        warnings.push({ file: rel, rule, reason: String(item?.reason || '') });
      }

      if (rules.length === 0) {
        lib.fs.unlinkSync(src);
        continue;
      }

      // v2rayN's Import Rules feature deserializes a top-level List<RulesItem>.
      // Keep the file exactly in that form so it can be imported from file,
      // clipboard, or URL without another wrapper object.
      lib.fs.writeFileSync(src, `${JSON.stringify(rules, null, 2)}\n`);
      generatedFiles += 1;
      emittedRules += rules.length;
    }
  }

  unsupported.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));
  warnings.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));

  const reportDir = lib.path.join(root, '_report');
  lib.mkdir(reportDir);
  const summary = {
    source: 'Sukka FileOutput universal rule model',
    target: 'v2rayN RulesItem JSON for Xray Core',
    outbound_tag: outboundTag,
    source_files: sourceFiles,
    generated_files: generatedFiles,
    emitted_v2rayn_rules: emittedRules,
    unsupported_rules: unsupported.length,
    unsupported_by_type: Object.fromEntries([...unsupportedByType.entries()].sort(([a], [b]) => a.localeCompare(b))),
    warnings: warnings.length,
    notes: [
      'Different selector families are emitted as separate v2rayN RulesItem objects so Xray does not accidentally AND unrelated Sukka source rules.',
      'Sukka no-resolve cannot be represented per rule by v2rayN/Xray; see warnings.txt and choose an appropriate v2rayN routing domainStrategy.',
      'Xray Core has source/sourcePort/attrs capabilities, but current v2rayN RulesItem import does not expose those fields, so they are not emitted.'
    ]
  };
  lib.fs.writeFileSync(lib.path.join(reportDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  const unsupportedLines = [
    '# Xray / v2rayN unsupported source rules',
    '# These source rules are omitted because the current v2rayN RulesItem import',
    '# cannot preserve them losslessly for Xray Core.',
    ''
  ];
  if (unsupported.length === 0) unsupportedLines.push('# None');
  else {
    let previousFile = null;
    for (const item of unsupported) {
      if (item.file !== previousFile) {
        if (previousFile !== null) unsupportedLines.push('');
        unsupportedLines.push(`# ${item.file}`);
        previousFile = item.file;
      }
      unsupportedLines.push(`${item.rule}${item.reason ? `  # ${item.reason}` : ''}`);
    }
  }
  lib.fs.writeFileSync(lib.path.join(reportDir, 'unsupported.txt'), `${unsupportedLines.join('\n')}\n`);

  const warningLines = [
    '# Xray / v2rayN semantic warnings',
    '# Emitted rules listed here are usable, but a source modifier could not be',
    '# represented exactly in v2rayN RulesItem JSON.',
    ''
  ];
  if (warnings.length === 0) warningLines.push('# None');
  else {
    let previousFile = null;
    for (const item of warnings) {
      if (item.file !== previousFile) {
        if (previousFile !== null) warningLines.push('');
        warningLines.push(`# ${item.file}`);
        previousFile = item.file;
      }
      warningLines.push(`${item.rule}${item.reason ? `  # ${item.reason}` : ''}`);
    }
  }
  lib.fs.writeFileSync(lib.path.join(reportDir, 'warnings.txt'), `${warningLines.join('\n')}\n`);

  lib.writeReadme(root, `# Xray / v2rayN\n\nThese JSON files are generated directly from Sukka's universal FileOutput data and are formatted as the top-level \`List<RulesItem>\` accepted by current v2rayN's routing-rule import.\n\nSupported mappings include exact/suffix/keyword/regex domains, wildcard domains converted to anchored Xray regex, IPv4/IPv6 CIDR, GEOIP, exact process name/path, destination port, TCP/UDP network, and Xray sniffed protocols HTTP/TLS/QUIC/BitTorrent.\n\nNot emitted for the v2rayN target: USER-AGENT/URL-REGEX (v2rayN does not expose Xray attrs), source IP/source port (supported by Xray Core but absent from current v2rayN RulesItem), IP-ASN, process globs, and AND/OR/NOT expressions that cannot be flattened without changing semantics. See \`_report/unsupported.txt\`.\n\nThe generated outbound tag defaults to \`${outboundTag}\`, matching v2rayN's normal proxy routing tag. Change \`xray.outbound_tag\` in \`ForkExtras/clients.yml\` if needed.\n\nIn v2rayN, open the routing-rule editor and use Import Rules from File / Clipboard / URL with one of these files, for example:\n\n\`https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Xray/non_ip/ai.json\`\n\nDo not combine different selector families into one Xray rule object: Xray treats fields in one rule as conditions that must match together. This exporter intentionally emits separate RulesItem objects to preserve Sukka's rule-list OR semantics.`);

  if (generatedFiles === 0) throw new Error('Xray adapter did not publish any v2rayN rule files');
  console.log(`[Xray] sources=${sourceFiles}, files=${generatedFiles}, rules=${emittedRules}, unsupported=${unsupported.length}, warnings=${warnings.length}`);
}

module.exports = { priority, prepare, release };
