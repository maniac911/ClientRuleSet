'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function rm(target) { fs.rmSync(target, { recursive: true, force: true }); }
function mkdir(target) { fs.mkdirSync(target, { recursive: true }); }
function copyFile(src, dest) { mkdir(path.dirname(dest)); fs.copyFileSync(src, dest); }
function copyDir(src, dest) { rm(dest); mkdir(path.dirname(dest)); fs.cpSync(src, dest, { recursive: true }); }
function move(src, dest) {
  if (!fs.existsSync(src)) return false;
  rm(dest); mkdir(path.dirname(dest)); fs.renameSync(src, dest); return true;
}
function walkFiles(root, predicate = () => true) {
  if (!fs.existsSync(root)) return [];
  const result = []; const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && predicate(full)) result.push(full);
    }
  }
  return result.sort();
}
function effectiveLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
}
function writeLines(file, lines) { mkdir(path.dirname(file)); fs.writeFileSync(file, `${lines.join('\n')}\n`); }
function relativeForDocker(repoRoot, file) { return path.relative(repoRoot, file).split(path.sep).join('/'); }
function tryDocker(repoRoot, image, args) {
  if (!image) throw new Error('Compiler container image is not configured');
  const result = spawnSync('docker', ['run','--rm','-v',`${repoRoot}:/work`,'-w','/work',image,...args], { stdio: 'inherit' });
  return result.status === 0;
}
function compileMihomo(repoRoot, image, behavior, src, dest) {
  mkdir(path.dirname(dest));
  return tryDocker(repoRoot, image, ['convert-ruleset',behavior,'text',`/work/${relativeForDocker(repoRoot, src)}`,`/work/${relativeForDocker(repoRoot, dest)}`]);
}
function compileSingBox(repoRoot, image, src, dest) {
  mkdir(path.dirname(dest));
  return tryDocker(repoRoot, image, ['rule-set','compile','--output',`/work/${relativeForDocker(repoRoot, dest)}`,`/work/${relativeForDocker(repoRoot, src)}`]);
}
function writeReadme(dir, text) { mkdir(dir); fs.writeFileSync(path.join(dir, 'README.md'), `${text.trim()}\n`); }

module.exports = { fs, path, rm, mkdir, copyFile, copyDir, move, walkFiles, effectiveLines, writeLines, compileMihomo, compileSingBox, writeReadme };
