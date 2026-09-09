'use strict';
const priority = 90;
function prepare({ outputDir, lib }) {
  const surge = lib.path.join(outputDir,'Surge');
  const list = lib.path.join(outputDir,'List');
  const modules = lib.path.join(outputDir,'Modules');
  const nested = lib.path.join(surge,'Modules');
  if (!lib.fs.existsSync(surge)) return;
  if (lib.fs.existsSync(nested)) lib.move(nested, modules);
  lib.move(surge, list);
}
function release({ outputDir, lib }) {
  const list = lib.path.join(outputDir,'List');
  const surge = lib.path.join(outputDir,'Surge');
  const modules = lib.path.join(outputDir,'Modules');
  if (!lib.fs.existsSync(list)) throw new Error('Surge adapter expected output/List after Sukka build');
  lib.move(list, surge);
  if (lib.fs.existsSync(modules)) lib.move(modules, lib.path.join(surge,'Modules'));
}
module.exports = { priority, prepare, release };
