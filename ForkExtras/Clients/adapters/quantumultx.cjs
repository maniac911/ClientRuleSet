'use strict';
const priority=40, SENTINEL='7h15.ru1353t.1s.m4d3.by.5ukk4w.skk.moe';
function convertLine(line,policy) {
  if (line===`DOMAIN,${SENTINEL}` || line===SENTINEL) return {skip:true};
  if (/^[0-9A-Fa-f:.]+\/\d+$/u.test(line)) return {rule:`${line.includes(':')?'ip6-cidr':'ip-cidr'}, ${line}, ${policy}, no-resolve`};
  const parts=line.split(',').map(p=>p.trim()), type=parts[0], value=parts[1], noResolve=parts.some(p=>p.toLowerCase()==='no-resolve'), suffix=noResolve?', no-resolve':'';
  const mapping={DOMAIN:'host','DOMAIN-SUFFIX':'host-suffix','DOMAIN-KEYWORD':'host-keyword','IP-CIDR':'ip-cidr','IP-CIDR6':'ip6-cidr',GEOIP:'geoip','DST-PORT':'dst-port','SRC-PORT':'src-port'};
  if (mapping[type] && value) return {rule:`${mapping[type]}, ${value}, ${policy}${suffix}`};
  return {unsupported:line};
}
function writeConverted(lib,src,dest,unsupportedDest,policy,domainset=false) {
  const rules=[], unsupported=[];
  if (domainset) for (const line of lib.effectiveLines(src)) {
    if (line===SENTINEL) continue;
    if (line.startsWith('+.')) rules.push(`host-suffix, ${line.slice(2)}, ${policy}`);
    else if (line.startsWith('.')) rules.push(`host-suffix, ${line.slice(1)}, ${policy}`);
    else rules.push(`host, ${line}, ${policy}`);
  } else for (const line of lib.effectiveLines(src)) {
    const r=convertLine(line,policy); if (r.rule) rules.push(r.rule); else if (r.unsupported) unsupported.push(r.unsupported);
  }
  lib.writeLines(dest,rules); if (unsupported.length) lib.writeLines(unsupportedDest,unsupported);
  return {rules:rules.length,unsupported:unsupported.length};
}
function release({outputDir,client,lib}) {
  const clash=lib.path.join(outputDir,'Clash'), root=lib.path.join(outputDir,client.output||'QuantumultX'), releaseDir=lib.path.join(root,'Release'), policy=client.policy_placeholder||'direct';
  lib.rm(root); for (const c of ['domainset','non_ip','ip']) lib.mkdir(lib.path.join(releaseDir,c));
  let totalRules=0,totalUnsupported=0;
  for (const c of ['domainset','non_ip','ip']) for (const src of lib.walkFiles(lib.path.join(clash,c),f=>f.endsWith('.txt'))) {
    const base=lib.path.basename(src,'.txt'), r=writeConverted(lib,src,lib.path.join(releaseDir,c,`${base}.list`),lib.path.join(releaseDir,c,`${base}.unsupported.txt`),policy,c==='domainset');
    totalRules+=r.rules; totalUnsupported+=r.unsupported;
  }
  lib.writeReadme(releaseDir,`# Quantumult X Release\n\nGenerated remote-filter payloads use Quantumult X rule names. Every rule contains placeholder policy ${policy}; load with filter_remote and force-policy=YOUR_POLICY to override it. Unsupported semantics are emitted as *.unsupported.txt instead of being silently dropped.\n\nBuild summary: translated=${totalRules}, unsupported=${totalUnsupported}.`);
}
module.exports={priority,release};
