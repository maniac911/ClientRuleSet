'use strict';

const priority = 20;

function release({ repoRoot, outputDir, lib, env }) {
  const source = lib.path.join(outputDir, 'sing-box');
  const releaseDir = lib.path.join(source, 'Release');
  const summaryFile = lib.path.join(outputDir, '.build-sing-box.json');
  const strict = env.CLIENT_RELEASE_STRICT === '1';

  lib.rm(releaseDir);
  lib.mkdir(releaseDir);

  let binary = 0;
  let fallback = 0;

  for (const src of lib.walkFiles(source, (file) => file.endsWith('.json') && !file.includes(`${lib.path.sep}Release${lib.path.sep}`))) {
    const rel = lib.path.relative(source, src);
    const srs = lib.path.join(releaseDir, rel.replace(/\.json$/u, '.srs'));
    const json = lib.path.join(releaseDir, rel);

    if (lib.compileSingBox(repoRoot, env.SING_BOX_IMAGE, src, srs) && lib.fs.existsSync(srs) && lib.fs.statSync(srs).size > 0) {
      binary++;
    } else {
      lib.rm(srs);
      lib.copyFile(src, json);
      fallback++;
    }
  }

  const summary = { srs: binary, jsonFallback: fallback };
  lib.fs.writeFileSync(summaryFile, `${JSON.stringify(summary)}\n`);

  lib.writeReadme(
    releaseDir,
    `# sing-box Release

- *.srs: successfully compiled binary rule set.
- *.json: source fallback when compilation is not possible.

Build summary: SRS=${binary}, JSON fallback=${fallback}.`
  );

  console.log('[clients] sing-box Release', summary);

  if (binary === 0) {
    throw new Error('sing-box adapter did not compile any SRS files');
  }
  if (strict && fallback > 0) {
    throw new Error(`sing-box strict release rejected ${fallback} JSON fallback file(s)`);
  }
}

module.exports = { priority, release };
