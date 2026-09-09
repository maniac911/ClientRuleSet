'use strict';
const priority = 20;
function release({ repoRoot, outputDir, lib, env }) {
  const source=lib.path.join(outputDir,'sing-box'), releaseDir=lib.path.join(source,'Release');
  lib.rm(releaseDir); lib.mkdir(releaseDir); let binary=0, fallback=0;
  for (const src of lib.walkFiles(source, f => f.endsWith('.json') && !f.includes(`${lib.path.sep}Release${lib.path.sep}`))) {
    const rel=lib.path.relative(source,src), srs=lib.path.join(releaseDir,rel.replace(/\.json$/u,'.srs')), json=lib.path.join(releaseDir,rel);
    if (lib.compileSingBox(repoRoot,env.SING_BOX_IMAGE,src,srs) && lib.fs.existsSync(srs) && lib.fs.statSync(srs).size>0) binary++;
    else { lib.rm(srs); lib.copyFile(src,json); fallback++; }
  }
  lib.writeReadme(releaseDir,`# sing-box Release\n\n- *.srs: successfully compiled binary rule set.\n- *.json: source fallback when compilation is not possible.\n\nBuild summary: SRS=${binary}, JSON fallback=${fallback}.`);
  if (binary===0) throw new Error('sing-box adapter did not compile any SRS files');
}
module.exports = { priority, release };
