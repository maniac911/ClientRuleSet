'use strict';

const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const lib = require('./lib.cjs');

const phase = process.argv[2];
if (!['prepare','release'].includes(phase)) {
  console.error('Usage: node ForkExtras/Clients/run.cjs <prepare|release> [output-dir]');
  process.exit(2);
}

const repoRoot = process.cwd();
const outputDir = path.resolve(repoRoot, process.argv[3] || 'output');
const config = YAML.parse(fs.readFileSync(path.join(repoRoot, 'ForkExtras', 'clients.yml'), 'utf8'));
const clients = config?.clients || {};
const loaded = [];
for (const [name, client] of Object.entries(clients)) {
  if (!client || client.enabled !== true) continue;
  const adapterName = client.adapter || name;
  const adapterPath = path.join(__dirname, 'adapters', `${adapterName}.cjs`);
  if (!fs.existsSync(adapterPath)) throw new Error(`Enabled client ${name} has no adapter: ${adapterPath}`);
  const adapter = require(adapterPath);
  loaded.push({ name, client, adapter, priority: adapter.priority ?? 50 });
}
loaded.sort((a,b) => a.priority - b.priority || a.name.localeCompare(b.name));

const context = { repoRoot, outputDir, config, lib, env: process.env };
if (phase === 'prepare') {
  for (const obsolete of ['MRS','SRS','Clash/MRS','sing-box/SRS','Clash/Release','sing-box/Release','Shadowrocket/Release','QuantumultX/Release']) lib.rm(path.join(outputDir, obsolete));
}
if (phase === 'release') {
  for (const [name, client] of Object.entries(clients)) {
    if (client?.enabled === true || !client?.output) continue;
    console.log(`[clients] disabled: remove ${name} output ${client.output}`);
    lib.rm(path.join(outputDir, client.output));
  }
}
for (const item of loaded) {
  const fn = item.adapter[phase];
  if (typeof fn !== 'function') continue;
  console.log(`[clients] ${phase}: ${item.name} (${item.client.adapter || item.name})`);
  fn({ ...context, name: item.name, client: item.client });
}
