'use strict';

const crypto = require('node:crypto');

const priority = 48;
const MAX_ITEMS_PER_ROUTE = 400;
const MAX_DEEPLINK_JSON_BYTES = 42 * 1024;
const VALID_TAGS = new Set(['proxy', 'direct', 'block']);

function prepare({ outputDir, client, lib }) {
  lib.rm(lib.path.join(outputDir, client.output || 'V2Box'));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function deterministicRouteName(seed) {
  const hex = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32).toUpperCase();
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  return `route.${uuid}`;
}

function chunk(values, size = MAX_ITEMS_PER_ROUTE) {
  const result = [];
  for (let i = 0; i < values.length; i += size) result.push(values.slice(i, i + size));
  return result;
}

function normalizeList(values) {
  return [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))];
}

function makeRoute({ seed, type, tag, matchMode, list = [], listIP = [], remark }) {
  return {
    name: deterministicRouteName(seed),
    type,
    tag,
    matchMode,
    listIP,
    remark,
    isEnable: true,
    list
  };
}

function appendChunkedRoutes(routes, { rel, tag, kind, type, matchMode, values, ip = false }) {
  const normalized = normalizeList(values);
  for (const [index, valuesChunk] of chunk(normalized).entries()) {
    routes.push(makeRoute({
      seed: `${tag}|${rel}|${kind}|${index}`,
      type,
      tag,
      matchMode,
      list: ip ? [] : valuesChunk,
      listIP: ip ? valuesChunk : [],
      remark: `ClientRuleSet ${rel.replace(/\.json$/u, '')} · ${kind}${normalized.length > MAX_ITEMS_PER_ROUTE ? ` ${index + 1}` : ''} · ${tag}`
    }));
  }
}

function buildRoutes(payload, tag, rel) {
  const routes = [];

  appendChunkedRoutes(routes, {
    rel, tag, kind: 'DOMAIN', type: 'Domain', matchMode: 'full', values: payload.exactDomains
  });

  appendChunkedRoutes(routes, {
    rel,
    tag,
    kind: 'DOMAIN-SUFFIX',
    type: 'Domain',
    matchMode: 'regexp',
    values: normalizeList(payload.suffixDomains).map(domain => `regexp:(^|\\.)${escapeRegex(domain.replace(/^\.+/u, ''))}$`)
  });

  appendChunkedRoutes(routes, {
    rel, tag, kind: 'DOMAIN-KEYWORD', type: 'Domain', matchMode: 'keyword', values: payload.keywords
  });

  appendChunkedRoutes(routes, {
    rel,
    tag,
    kind: 'DOMAIN-REGEX',
    type: 'Domain',
    matchMode: 'regexp',
    values: normalizeList(payload.regexDomains).map(value => value.startsWith('regexp:') ? value : `regexp:${value}`)
  });

  appendChunkedRoutes(routes, {
    rel,
    tag,
    kind: 'GEOSITE',
    type: 'Domain',
    matchMode: 'full',
    values: normalizeList(payload.geosites).map(value => value.startsWith('geosite:') ? value : `geosite:${value.toLowerCase()}`)
  });

  appendChunkedRoutes(routes, {
    rel, tag, kind: 'IP-CIDR', type: 'IP', matchMode: 'full', values: payload.ipCidrs, ip: true
  });

  appendChunkedRoutes(routes, {
    rel,
    tag,
    kind: 'GEOIP',
    type: 'IP',
    matchMode: 'full',
    values: normalizeList(payload.geoips).map(value => {
      const raw = value.replace(/^geoip:/iu, '');
      return raw.toLowerCase() === 'private' ? 'geoip:private' : `geoip:${raw.toUpperCase()}`;
    }),
    ip: true
  });

  return routes;
}

function splitForDeepLinks(routes) {
  const parts = [];
  let current = [];

  for (const route of routes) {
    const candidate = [...current, route];
    const size = Buffer.byteLength(JSON.stringify(candidate), 'utf8');
    if (current.length > 0 && size > MAX_DEEPLINK_JSON_BYTES) {
      parts.push(current);
      current = [route];
    } else {
      current = candidate;
    }
  }
  if (current.length) parts.push(current);
  return parts;
}

function makeDeepLink(routes) {
  const compact = JSON.stringify(routes);
  const b64 = Buffer.from(compact, 'utf8').toString('base64');
  return `v2box://routes?multi=${b64}`;
}

function pushAudit(list, byType, file, item) {
  const rule = String(item?.rule || '').trim();
  if (!rule || rule.startsWith('#')) return;
  const type = (rule.split(',', 1)[0] || 'UNKNOWN').toUpperCase();
  list.push({ file, type, rule, reason: String(item?.reason || '') });
  byType.set(type, (byType.get(type) || 0) + 1);
}

function writeGroupedReport(lib, file, title, items) {
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
  lib.fs.writeFileSync(file, `${lines.join('\n')}\n`);
}

function release({ outputDir, client, lib }) {
  const root = lib.path.join(outputDir, client.output || 'V2Box');
  if (!lib.fs.existsSync(root)) throw new Error('V2Box native writer produced no output directory');

  const configuredTags = Array.isArray(client.tags) ? client.tags : ['proxy', 'direct', 'block'];
  const tags = [...new Set(configuredTags.map(tag => String(tag || '').trim().toLowerCase()).filter(tag => VALID_TAGS.has(tag)))];
  if (tags.length === 0) throw new Error('V2Box requires at least one of proxy/direct/block in clients.yml tags');

  const unsupported = [];
  const unsupportedByType = new Map();
  const warnings = [];
  let sourceFiles = 0;
  let routeJsonFiles = 0;
  let deepLinkFiles = 0;
  let routeObjects = 0;
  let splitRuleSets = 0;

  for (const category of ['domainset', 'non_ip', 'ip']) {
    const categoryDir = lib.path.join(root, category);
    const sources = lib.walkFiles(categoryDir, file => file.endsWith('.json'));

    for (const src of sources) {
      sourceFiles += 1;
      const rel = lib.path.relative(root, src).split(lib.path.sep).join('/');
      const payload = JSON.parse(lib.fs.readFileSync(src, 'utf8'));
      if (payload.version !== 1) throw new Error(`Unsupported V2Box intermediate version in ${rel}`);

      for (const item of payload.unsupported || []) pushAudit(unsupported, unsupportedByType, rel, item);
      for (const item of payload.warnings || []) {
        const rule = String(item?.rule || '').trim();
        if (rule) warnings.push({ file: rel, rule, reason: String(item?.reason || '') });
      }

      const relWithinCategory = lib.path.relative(categoryDir, src);
      for (const tag of tags) {
        const routes = buildRoutes(payload, tag, rel);
        if (routes.length === 0) continue;

        const destJson = lib.path.join(root, tag, category, relWithinCategory);
        lib.mkdir(lib.path.dirname(destJson));
        lib.fs.writeFileSync(destJson, `${JSON.stringify(routes, null, 2)}\n`);
        routeJsonFiles += 1;
        routeObjects += routes.length;

        const deepLinkParts = splitForDeepLinks(routes);
        if (deepLinkParts.length > 1) splitRuleSets += 1;
        const base = destJson.replace(/\.json$/u, '');
        for (const [index, part] of deepLinkParts.entries()) {
          const suffix = deepLinkParts.length === 1 ? '' : `.part${String(index + 1).padStart(2, '0')}`;
          lib.fs.writeFileSync(`${base}${suffix}.txt`, `${makeDeepLink(part)}\n`);
          deepLinkFiles += 1;
        }
      }

      lib.fs.unlinkSync(src);
    }

    if (lib.fs.existsSync(categoryDir)) lib.rm(categoryDir);
  }

  unsupported.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));
  warnings.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule));

  const reportDir = lib.path.join(root, '_report');
  lib.mkdir(reportDir);
  writeGroupedReport(lib, lib.path.join(reportDir, 'unsupported.txt'), 'V2Box unsupported source rules', unsupported);
  writeGroupedReport(lib, lib.path.join(reportDir, 'warnings.txt'), 'V2Box semantic warnings', warnings);

  lib.fs.writeFileSync(lib.path.join(reportDir, 'summary.json'), `${JSON.stringify({
    source: 'Sukka FileOutput universal rule model',
    target: 'V2Box route objects and v2box://routes?multi= deep links',
    policy_variants: tags,
    source_files: sourceFiles,
    route_json_files: routeJsonFiles,
    deeplink_files: deepLinkFiles,
    emitted_route_objects: routeObjects,
    split_rulesets: splitRuleSets,
    unsupported_rules: unsupported.length,
    unsupported_by_type: Object.fromEntries([...unsupportedByType.entries()].sort(([a], [b]) => a.localeCompare(b))),
    warnings: warnings.length,
    notes: [
      'DOMAIN, DOMAIN-SUFFIX, DOMAIN-KEYWORD, DOMAIN-WILDCARD/DOMAIN-REGEX, GEOSITE, IPv4/IPv6 CIDR and GEOIP are emitted.',
      'Suffixes and wildcards are converted to V2Box regexp domain routes.',
      'Deep links are split when needed to keep individual v2box:// URLs at a practical size; import all parts in order.',
      'Process/User-Agent/URL/source/port/protocol/logical selectors remain audited until their V2Box route-object import semantics are verified.'
    ]
  }, null, 2)}\n`);

  lib.writeReadme(root, `# V2Box\n\nThis output targets V2Box's native routing-import objects and \`v2box://routes?multi=...\` deep links. It is generated directly from Sukka FileOutput instead of converting Clash text.\n\nThree policy variants are generated by default: \`proxy/\`, \`direct/\`, and \`block/\`. Pick the folder that matches the action you want the imported V2Box route to use.\n\nEach rule set has a JSON route-object file plus one or more \`.txt\` deep-link files. For example:\n\n\`https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/V2Box/proxy/non_ip/ai.txt\`\n\nOpen the raw text in Safari, copy/open the \`v2box://routes?multi=...\` URL, and V2Box can import the routes. Large rule sets are automatically split into \`.part01.txt\`, \`.part02.txt\`, etc.; import every part in numeric order.\n\nVerified/conservative mappings: exact domain -> Domain/full, suffix -> Domain/regexp, keyword -> Domain/keyword, wildcard/DOMAIN-REGEX -> Domain/regexp, GEOSITE -> Domain/full with \`geosite:\`, IPv4/IPv6 CIDR -> IP/full, and GEOIP -> IP/full with \`geoip:\`.\n\nFields whose V2Box route-object/deep-link behavior is not verified are not guessed. See \`_report/unsupported.txt\` and \`_report/warnings.txt\`.\n`);

  if (routeJsonFiles === 0 || deepLinkFiles === 0) throw new Error('V2Box adapter did not publish any route files');
  console.log(`[V2Box] sources=${sourceFiles}, json=${routeJsonFiles}, links=${deepLinkFiles}, routes=${routeObjects}, unsupported=${unsupported.length}, warnings=${warnings.length}`);
}

module.exports = { priority, prepare, release };
