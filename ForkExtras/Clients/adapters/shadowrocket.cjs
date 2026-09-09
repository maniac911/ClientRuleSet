'use strict';
const priority=40, SENTINEL='7h15.ru1353t.1s.m4d3.by.5ukk4w.skk.moe';
function release({ outputDir, client, lib }) {
  const clash=lib.path.join(outputDir,'Clash'), root=lib.path.join(outputDir,client.output||'Shadowrocket'), releaseDir=lib.path.join(root,'Release');
  lib.rm(root); for (const c of ['domainset','non_ip','ip']) lib.mkdir(lib.path.join(releaseDir,c));
  for (const src of lib.walkFiles(lib.path.join(clash,'domainset'), f=>f.endsWith('.txt'))) {
    const base=lib.path.basename(src,'.txt'), out=[];
    for (const line of lib.effectiveLines(src)) {
      if (line===SENTINEL) continue;
      if (line.startsWith('+.')) out.push(`DOMAIN-SUFFIX,${line.slice(2)}`);
      else if (line.startsWith('.')) out.push(`DOMAIN-SUFFIX,${line.slice(1)}`);
      else out.push(`DOMAIN,${line}`);
    }
    lib.writeLines(lib.path.join(releaseDir,'domainset',`${base}.list`),out);
  }
  for (const c of ['non_ip','ip']) for (const src of lib.walkFiles(lib.path.join(clash,c), f=>f.endsWith('.txt'))) {
    const base=lib.path.basename(src,'.txt'), lines=lib.effectiveLines(src).filter(line=>line!==`DOMAIN,${SENTINEL}`);
    lib.writeLines(lib.path.join(releaseDir,c,`${base}.list`),lines);
  }
  lib.writeReadme(releaseDir,'# Shadowrocket Release\n\nPolicy-free remote rule payloads. domainset is converted to DOMAIN/DOMAIN-SUFFIX; non_ip and ip preserve supported typed rules.\n\nExample: RULE-SET,<raw-url>,PROXY');
}
module.exports={priority,release};
