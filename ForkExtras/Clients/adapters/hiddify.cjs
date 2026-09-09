'use strict';

// Hiddify Core builds its routing engine on sing-box and uses remote binary
// rule sets (SRS). Recompile Sukka's generated sing-box source rule sets into
// a dedicated Hiddify tree instead of inventing another text rule dialect.
const priority = 30;

function prepare({ outputDir, client, lib }) {
  lib.rm(lib.path.join(outputDir, client.output || 'Hiddify'));
}

function release({ repoRoot, outputDir, client, lib, env }) {
  const source = lib.path.join(outputDir, 'sing-box');
  const root = lib.path.join(outputDir, client.output || 'Hiddify');

  if (!lib.fs.existsSync(source)) {
    throw new Error('Hiddify adapter expected Sukka sing-box source output');
  }

  lib.rm(root);
  lib.mkdir(root);

  const failures = [];
  let compiled = 0;

  for (const src of lib.walkFiles(
    source,
    (file) => file.endsWith('.json') && !file.includes(`${lib.path.sep}Release${lib.path.sep}`)
  )) {
    const rel = lib.path.relative(source, src);
    const dest = lib.path.join(root, rel.replace(/\.json$/u, '.srs'));
    lib.mkdir(lib.path.dirname(dest));

    if (
      lib.compileSingBox(repoRoot, env.SING_BOX_IMAGE, src, dest)
      && lib.fs.existsSync(dest)
      && lib.fs.statSync(dest).size > 0
    ) {
      compiled += 1;
      continue;
    }

    lib.rm(dest);
    failures.push(rel.split(lib.path.sep).join('/'));
  }

  const reportDir = lib.path.join(root, '_report');
  lib.mkdir(reportDir);
  lib.fs.writeFileSync(
    lib.path.join(reportDir, 'summary.json'),
    `${JSON.stringify({
      source: 'Sukka sing-box headless rule-set JSON',
      format: 'sing-box binary SRS for Hiddify Core',
      compiled_rulesets: compiled,
      failed_rulesets: failures.length
    }, null, 2)}\n`
  );

  const failureLines = [
    '# Hiddify SRS compilation failures',
    '# Hiddify output is intentionally binary-only; failed source rule sets are',
    '# not silently replaced with a different format.',
    ''
  ];
  if (failures.length === 0) failureLines.push('# None');
  else failureLines.push(...failures.sort());
  lib.fs.writeFileSync(lib.path.join(reportDir, 'failed.txt'), `${failureLines.join('\n')}\n`);

  lib.writeReadme(root, `# Hiddify\n\nThese rule sets are generated for Hiddify Core as sing-box binary rule sets (\`.srs\`). Hiddify Core itself uses remote binary SRS rule sets for routing, so no lossy Clash/text conversion is involved.\n\n- \`domainset/*.srs\` — domain-oriented rule sets.\n- \`non_ip/*.srs\` — non-IP/mixed routing rule sets.\n- \`ip/*.srs\` — IP-oriented rule sets.\n- \`_report/summary.json\` — build summary.\n- \`_report/failed.txt\` — any source rule set that failed binary compilation.\n\nExample Rule Set URL in Hiddify routing settings:\n\n\`https://raw.githubusercontent.com/maniac911/ClientRuleSet/rules-dist/Hiddify/non_ip/ai.srs\`\n\nThe outbound policy is selected in Hiddify; it is not embedded in the SRS payload.`);

  if (compiled === 0) throw new Error('Hiddify adapter did not compile any SRS files');
  if (failures.length > 0) {
    throw new Error(`Hiddify adapter failed to compile ${failures.length} rule set(s)`);
  }

  console.log(`[Hiddify] compiled SRS=${compiled}`);
}

module.exports = { priority, prepare, release };
