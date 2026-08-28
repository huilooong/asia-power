#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { createSupplierReferralStore } = require('../server/lib/supplier-referrals.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function argValue(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const apply = args.includes('--apply');
const dataDir = path.resolve(argValue('--data-dir', path.join(ROOT, 'data')));
const usersFile = path.resolve(argValue('--users-file', path.join(dataDir, 'users.json')));
const ownerId = argValue('--owner-id');

if (!fs.existsSync(usersFile)) {
  console.error(JSON.stringify({ ok: false, error: `Users file not found: ${usersFile}` }));
  process.exit(1);
}

const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
if (!Array.isArray(users)) {
  console.error(JSON.stringify({ ok: false, error: 'Users file must contain an array' }));
  process.exit(1);
}

const eligible = users.filter((user) => user && user.id && ['supplier', 'admin'].includes(user.role));
const store = createSupplierReferralStore(dataDir);
const existingOwners = new Set(store.loadCodes().filter((row) => row.active !== false).map((row) => row.ownerUserId));
const missingOwnerIds = eligible.filter((user) => !existingOwners.has(user.id)).map((user) => user.id);

if (!apply) {
  console.log(JSON.stringify({
    ok: true,
    mode: 'dry-run',
    dataDir,
    eligible: eligible.length,
    existing: eligible.length - missingOwnerIds.length,
    missing: missingOwnerIds.length,
    missingOwnerIds,
  }, null, 2));
  process.exit(0);
}

const backupDir = path.join(dataDir, 'backups', `supplier-referrals-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
for (const file of [usersFile, store.codesFile, store.eventsFile]) {
  if (fs.existsSync(file)) {
    const target = path.join(backupDir, path.basename(file));
    fs.copyFileSync(file, target);
    fs.chmodSync(target, 0o600);
  }
}

const result = store.backfillUsers(users, { createdBy: 'backfill-script' });
const owner = ownerId ? users.find((user) => user.id === ownerId) : null;
const ownerReferral = owner ? store.publicForOwner(owner) : null;

console.log(JSON.stringify({
  ok: true,
  mode: 'apply',
  backupDir,
  ...result,
  ownerReferral,
}, null, 2));
