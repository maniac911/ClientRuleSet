'use strict';
const priority = 20;
const SENTINEL = '7h15.ru1353t.1s.m4d3.by.5ukk4w.skk.moe';
function release({ repoRoot, outputDir, lib, env }) {
  const source = lib.path.join(outputDir,'Clash');
  const releaseDir = lib.path.join(source,'Release');
  const tempDir = lib.path.join(repoRoot,'.tmp-client-release','clash');
  lib.rm(releaseDir); lib.rm(tempDir);
  for (const c of ['domainset','non_ip','ip']) lib.mkdir(lib.path.join(releaseDir,c));
  lib.mkdir(tempDir);
  const count = { domainMRS:0, domainText:0, nonIpMRS:0, nonIpText:0, ipMRS:0, ipText:0 };

  for (const src of lib.walkFiles(lib.path.join(source,'domainset'), f => f.endsWith('.txt'))) {
    const base=lib.path.basename(src,'.txt'), cleaned=lib.path.join(tempDir,`domainset-${base}.txt`), out=lib.path.join(releaseDir,'domainset',`${base}.mrs`);
    const lines=lib.effectiveLines(src).filter(line => line !== SENTINEL); lib.writeLines(cleaned,lines);
    if (lines.length && lib.compileMihomo(repoRoot,env.MIHOMO_IMAGE,'domain',cleaned,out) && lib.fs.existsSync(out) && lib.fs.statSync(out).size>0) count.domainMRS++;
    else { lib.rm(out); lib.copyFile(src,lib.path.join(releaseDir,'domainset',`${base}.txt`)); count.domainText++; }
  }

  for (const src of lib.walkFiles(lib.path.join(source,'non_ip'), f => f.endsWith('.txt'))) {
    const base=lib.path.basename(src,'.txt'), cleaned=lib.path.join(tempDir,`nonip-${base}.txt`), out=lib.path.join(releaseDir,'non_ip',`${base}.mrs`), payload=[]; let convertible=true;
    for (const line of lib.effectiveLines(src)) {
      if (line===`DOMAIN,${SENTINEL}`) continue;
      if (line.startsWith('DOMAIN,')) payload.push(line.split(',')[1]);
      else if (line.startsWith('DOMAIN-SUFFIX,')) payload.push(`+.${line.split(',')[1].replace(/^\./u,'')}`);
      else { convertible=false; break; }
    }
    lib.writeLines(cleaned,payload);
    if (convertible && payload.length && lib.compileMihomo(repoRoot,env.MIHOMO_IMAGE,'domain',cleaned,out) && lib.fs.existsSync(out) && lib.fs.statSync(out).size>0) count.nonIpMRS++;
    else { lib.rm(out); lib.copyFile(src,lib.path.join(releaseDir,'non_ip',`${base}.txt`)); count.nonIpText++; }
  }

  for (const src of lib.walkFiles(lib.path.join(source,'ip'), f => f.endsWith('.txt'))) {
    const base=lib.path.basename(src,'.txt'), cleaned=lib.path.join(tempDir,`ip-${base}.txt`), out=lib.path.join(releaseDir,'ip',`${base}.mrs`), payload=[]; let convertible=true;
    for (const line of lib.effectiveLines(src)) {
      if (line===`DOMAIN,${SENTINEL}`) continue;
      if (line.startsWith('IP-CIDR,') || line.startsWith('IP-CIDR6,')) payload.push(line.split(',')[1]);
      else if (/^[0-9A-Fa-f:.]+\/\d+$/u.test(line)) payload.push(line);
      else { convertible=false; break; }
    }
    lib.writeLines(cleaned,payload);
    if (convertible && payload.length && lib.compileMihomo(repoRoot,env.MIHOMO_IMAGE,'ipcidr',cleaned,out) && lib.fs.existsSync(out) && lib.fs.statSync(out).size>0) count.ipMRS++;
    else { lib.rm(out); lib.copyFile(src,lib.path.join(releaseDir,'ip',`${base}.txt`)); count.ipText++; }
  }
  lib.rm(tempDir);
  lib.writeReadme(releaseDir,`# Clash / Mihomo Release\n\nPreferred client-facing output.\n\n- domainset/*.mrs: behavior domain, format mrs.\n- non_ip/*.mrs: only when classical source was purely DOMAIN/DOMAIN-SUFFIX.\n- non_ip/*.txt: mixed classical rules preserved.\n- ip/*.mrs: pure CIDR/IP-CIDR/IP-CIDR6, behavior ipcidr.\n- ip/*.txt: mixed rules preserved.\n\nBuild summary: ${JSON.stringify(count)}`);
  console.log('[clients] Clash Release',count);
}
module.exports = { priority, release };
