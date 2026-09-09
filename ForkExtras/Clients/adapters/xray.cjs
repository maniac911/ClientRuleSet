'use strict';

const priority = 47;

function prepare({ outputDir, client, lib }) {
  lib.rm(lib.path.join(outputDir, client.output || 'Xray'));
}

function toRule(base, field, value) {
  return { ...base, [field]: value };
}

function pushAudit(list, byType, file, rule, reason) {
  const trimmed = String(rule || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const type = (trimmed.split(',', 1)[0] || 'UNKNOWN').toUpperCase();
  list.push({ file, type, rule: trimmed, reason: String(reason || '') });
  byType.set(type, (byType.get(type) || 0) + 1);
}

function writeAudit(lib, dir, title, items) {
  lib.mkdir(dir);
  const lines = [`# ${title}`, ''];
  if (items.length === 0) lines.push('# None');
  else {
    let previous = null;
    for (const item of items) {
      if (item.file !== previous) {
        if (previous !== null) lines.push('');
        lines.push(`# ${item.file}`);
        previous = item.file;
      }
      lines.push(`${item.rule}${item.reason ? `  # ${item.reason}` : ''}`);
    }
  }
  lib.fs.writeFileSync(lib.path.join(dir, 'unsupported.txt'), `${lines.join('\n')}\n`);
}

function writeWarnings(lib, dir, warnings) {
  lib.mkdir(dir);
  const lines = ['# Xray semantic warnings', ''];
  if (warnings.length === 0) lines.push('# None');
  else {
    let previous = null;
    for (const item of warnings) {
      if (item.file !== previous) {
        if (previous !== null) lines.push('');
        lines.push(`# ${item.file}`);
        previous = item.file;
      }
      lines.push(`${item.rule}${item.reason ? `  # ${item.reason}` : ''}`);
    }
  }
  lib.fs.writeFileSync(lib.path.join(dir, 'warnings.txt'), `${lines.join('\n')}\n`);
}

function release({ outputDir, client, lib }) {
  const root = lib.path.join(outputDir, client.output || 'Xray');
  if (!lib.fs.existsSync(root)) throw new Error('Xray native writer produced no output directory');

  const outboundTag = String(client.outbound_tag || 'proxy').trim() || 'proxy';
  const v2raynRoot = lib.path.join(root, 'v2rayN');
  const nativeRoot = lib.path.join(root, 'native');
  const nativeUnsupported = [];
  const nativeUnsupportedByType = new Map();
  const v2raynUnsupported = [];
  const v2raynUnsupportedByType = new Map();
  const warnings = [];
  let sourceFiles = 0;
  let v2raynFiles = 0;
  let v2raynRules = 0;
  let nativeFiles = 0;
  let nativeRules = 0;

  for (const category of ['domainset', 'non_ip', 'ip']) {
    const categoryDir = lib.path.join(root, category);
    const sources = lib.walkFiles(categoryDir, file => file.endsWith('.json'));

    for (const src of sources) {
      sourceFiles += 1;
      const rel = lib.path.relative(root, src).split(lib.path.sep).join('/');
      const payload = JSON.parse(lib.fs.readFileSync(src, 'utf8'));
      if (payload.version !== 2) throw new Error(`Unsupported Xray intermediate version in ${rel}`);

      const relWithinCategory = lib.path.relative(categoryDir, src);
      const v2raynFile = lib.path.join(v2raynRoot, category, relWithinCategory);
      const nativeFile = lib.path.join(nativeRoot, category, relWithinCategory);
      const remarks = `ClientRuleSet ${rel.replace(/\.json$/u, '')}`;
      const v2Base = { type: 'field', outboundTag, enabled: true, remarks };
      const nativeBase = { type: 'field', outboundTag, ruleTag: remarks };
      const v2Rules = [];
      const nRules = [];

      // Keep source alternatives as separate Xray rule objects. Different fields
      // inside one Xray routing rule are ANDed, while Sukka list entries are ORed.
      if (payload.domains?.length) {
        v2Rules.push(toRule(v2Base, 'domain', payload.domains));
        nRules.push(toRule(nativeBase, 'domain', payload.domains));
      }
      if (payload.ips?.length) {
        v2Rules.push(toRule(v2Base, 'ip', payload.ips));
        nRules.push(toRule(nativeBase, 'ip', payload.ips));
      }
      if (payload.processes?.length) {
        v2Rules.push(toRule(v2Base, 'process', payload.processes));
        nRules.push(toRule(nativeBase, 'process', payload.processes));
      }
      if (payload.ports?.length) {
        const value = payload.ports.join(',');
        v2Rules.push(toRule(v2Base, 'port', value));
        nRules.push(toRule(nativeBase, 'port', value));
      }
      if (payload.networks?.length) {
        const value = payload.networks.join(',');
        v2Rules.push(toRule(v2Base, 'network', value));
        nRules.push(toRule(nativeBase, 'network', value));
      }
      if (payload.protocols?.length) {
        v2Rules.push(toRule(v2Base, 'protocol', payload.protocols));
        nRules.push(toRule(nativeBase, 'protocol', payload.protocols));
      }

      if (payload.sourceIps?.length) {
        nRules.push(toRule(nativeBase, 'sourceIP', payload.sourceIps));
        for (const value of payload.sourceIps) {
          pushAudit(
            v2raynUnsupported,
            v2raynUnsupportedByType,
            rel,
            `SRC-IP,${value}`,
            'Xray Core supports sourceIP, but v2rayN RulesItem import does not expose it.'
          );
        }
      }
      if (payload.sourcePorts?.length) {
        nRules.push(toRule(nativeBase, 'sourcePort', payload.sourcePorts.join(',')));
        for (const value of payload.sourcePorts) {
          pushAudit(
            v2raynUnsupported,
            v2raynUnsupportedByType,
            rel,
            `SRC-PORT,${value}`,
            'Xray Core supports sourcePort, but v2rayN RulesItem import does not expose it.'
          );
        }
      }
      if (payload.userAgents?.length) {
        for (const regex of payload.userAgents) {
          nRules.push({ ...nativeBase, attrs: { 'user-agent': regex } });
          pushAudit(
            v2raynUnsupported,
            v2raynUnsupportedByType,
            rel,
            `USER-AGENT,${regex}`,
            'Xray native routing can express this through attrs, but v2rayN RulesItem import has no attrs field.'
          );
        }
      }

      for (const item of payload.unsupported || []) {
        pushAudit(nativeUnsupported, nativeUnsupportedByType, rel, item?.rule, item?.reason);
        pushAudit(v2raynUnsupported, v2raynUnsupportedByType, rel, item?.rule, item?.reason);
      }
      for (const item of payload.warnings || []) {
        const rule = String(item?.rule || '').trim();
        if (rule) warnings.push({ file: rel, rule, reason: String(item?.reason || '') });
      }

      if (v2Rules.length) {
        lib.mkdir(lib.path.dirname(v2raynFile));
        lib.fs.writeFileSync(v2raynFile, `${JSON.stringify(v2Rules, null, 2)}\n`);
        v2raynFiles += 1;
        v2raynRules += v2Rules.length;
      }
      if (nRules.length) {
        lib.mkdir(lib.path.dirname(nativeFile));
        lib.fs.writeFileSync(nativeFile, `${JSON.stringify({ routing: { rules: nRules } }, null, 2)}\n`);
        nativeFiles += 1;
        nativeRules += nRules.length;
      }

      lib.fs.unlinkSync(src);
    }

    if (lib.fs.existsSync(categoryDir)) lib.rm(categoryDir);
  }

  nativeUnsupported.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));
  v2raynUnsupported.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));
  warnings.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));

  const nativeReport = lib.path.join(nativeRoot, '_report');
  const v2Report = lib.path.join(v2raynRoot, '_report');
  writeAudit(lib, nativeReport, 'Xray native unsupported source rules', nativeUnsupported);
  writeAudit(lib, v2Report, 'Xray / v2rayN unsupported source rules', v2raynUnsupported);
  writeWarnings(lib, nativeReport, warnings);
  writeWarnings(lib, v2Report, warnings);

  lib.fs.writeFileSync(lib.path.join(nativeReport, 'summary.json'), `${JSON.stringify({
    source: 'Sukka FileOutput universal rule model',
    target: 'Xray native routing fragment',
    outbound_tag: outboundTag,
    source_files: sourceFiles,
    generated_files: nativeFiles,
    emitted_rules: nativeRules,
    unsupported_rules: nativeUnsupported.length,
    unsupported_by_type: Object.fromEntries([...nativeUnsupportedByType.entries()].sort(([a], [b]) => a.localeCompare(b))),
    warnings: warnings.length,
    notes: [
      'Each file is a routing fragment shaped as { routing: { rules: [...] } }; merge it into a complete Xray config before running it.',
      'sourceIP/sourcePort are preserved natively.',
      'USER-AGENT is mapped to Xray attrs.user-agent using a regular expression and therefore requires HTTP attributes/sniffing as documented by Xray.',
      'Sukka no-resolve has no direct per-rule Xray equivalent; see warnings.txt.'
    ]
  }, null, 2)}\n`);

  lib.fs.writeFileSync(lib.path.join(v2Report, 'summary.json'), `${JSON.stringify({
    source: 'Sukka FileOutput universal rule model',
    target: 'v2rayN RulesItem JSON for Xray Core',
    outbound_tag: outboundTag,
    source_files: sourceFiles,
    generated_files: v2raynFiles,
    emitted_rules: v2raynRules,
    unsupported_rules: v2raynUnsupported.length,
    unsupported_by_type: Object.fromEntries([...v2raynUnsupportedByType.entries()].sort(([a], [b]) => a.localeCompare(b))),
    warnings: warnings.length,
    notes: [
      'Files are top-level List<RulesItem> JSON accepted by current v2rayN routing-rule import.',
      'Xray-native sourceIP/sourcePort/attrs are intentionally omitted here because current v2rayN RulesItem does not expose them.',
      'Different selector families are separate RulesItem objects to avoid accidental Xray AND semantics.',
      'Sukka no-resolve has no direct per-rule Xray/v2rayN equivalent; see warnings.txt.'
    ]
  }, null, 2)}\n`);

  lib.writeReadme(root, `# Xray\n\nThis output is split into two targets because current v2rayN exposes only a subset of Xray routing fields through its RulesItem import model.\n\n## v2rayN\n\n\`Xray/v2rayN/**\` contains top-level \`List<RulesItem>\` JSON for v2rayN's Routing Rule -> Import from File / Clipboard / URL workflow. It preserves domain/IP/destination-port/network/protocol/exact-process fields and audits Xray-only fields in \`v2rayN/_report/unsupported.txt\`.\n\nExample:\n\n\`https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Xray/v2rayN/non_ip/ai.json\`\n\n## native\n\n\`Xray/native/**\` contains native Xray routing fragments shaped as \`{ "routing": { "rules": [...] } }\`. These are not standalone runnable Xray configs: merge the routing section into a complete Xray config with inbounds/outbounds, or use them while building a v2rayN Custom Xray config. Native output additionally preserves \`sourceIP\`, \`sourcePort\`, and maps USER-AGENT patterns to Xray \`attrs["user-agent"]\`.\n\nXray joins different selector fields inside one rule with AND semantics, so this exporter emits separate rule objects for independent Sukka selectors. Truly non-lossless concepts such as arbitrary URL-REGEX, IP-ASN, process globs and unparsed AND/OR/NOT source expressions remain audited.\n`);

  if (v2raynFiles === 0 || nativeFiles === 0) throw new Error('Xray adapter did not publish both v2rayN and native outputs');
  console.log(`[Xray] source=${sourceFiles}, v2rayN=${v2raynFiles}/${v2raynRules}, native=${nativeFiles}/${nativeRules}, v2-unsupported=${v2raynUnsupported.length}, native-unsupported=${nativeUnsupported.length}, warnings=${warnings.length}`);
}

module.exports = { priority, prepare, release };
