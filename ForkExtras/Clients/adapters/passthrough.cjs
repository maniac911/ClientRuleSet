'use strict';
const priority = 50;
function release({ outputDir, client, lib, name }) {
  const target = lib.path.join(outputDir, client.output || name);
  if (!lib.fs.existsSync(target)) console.warn(`[clients] passthrough output missing: ${target}`);
}
module.exports = { priority, release };
