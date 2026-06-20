'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = process.env.INVENTORY_SITE_ROOT || path.join(__dirname, '..');

function requireServerLib(name) {
  const candidates = [
    path.join(ROOT, 'lib', `${name}.js`),
    path.join(ROOT, 'server', 'lib', `${name}.js`),
    path.join(__dirname, '..', 'server', 'lib', `${name}.js`),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`Missing server lib module: ${name}`);
  return require(found);
}

function bootstrapEnv() {
  requireServerLib('load-env').loadEnv(ROOT);
  return ROOT;
}

module.exports = {
  ROOT,
  requireServerLib,
  bootstrapEnv,
};
