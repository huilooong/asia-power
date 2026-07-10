#!/usr/bin/env node
/**
 * Backfill supplierId / supplierPhoneNormalized on half-cut submissions + approved
 * by matching normalized phone numbers to users.json supplier accounts.
 *
 * Usage:
 *   node scripts/backfill-supplier-phone-ownership.mjs --dry-run
 *   node scripts/backfill-supplier-phone-ownership.mjs --apply
 *   node scripts/backfill-supplier-phone-ownership.mjs --apply --create-missing
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const { normalizePhone, phonesMatch } = require('../server/lib/phone-normalize.js');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const CREATE_MISSING = args.has('--create-missing');
const DRY = !APPLY;

const DATA = path.join(ROOT, 'data');
const USERS = path.join(DATA, 'users.json');
const SUBMISSIONS = path.join(DATA, 'half-cut-submissions.json');
const APPROVED = path.join(DATA, 'half-cut-approved.json');
const REPORT = path.join(ROOT, 'reports', 'supplier-phone-backfill.json');

function load(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function id(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

const users = load(USERS, []);
let suppliers = users.filter((u) => u.role === 'supplier');

function findSupplier(phoneRaw) {
  const norm = normalizePhone(phoneRaw, '');
  if (!norm) return null;
  return suppliers.find((u) => {
    const uNorm = normalizePhone(u.phoneNormalized || u.phone, u.countryCode);
    return uNorm && phonesMatch(uNorm, norm);
  }) || null;
}

function ensureSupplierFromRecord(record) {
  const phone = record.supplierPhone || '';
  const norm = normalizePhone(phone, '');
  if (!norm) return null;
  let user = findSupplier(phone);
  if (user) return user;
  if (!CREATE_MISSING) return null;
  const local = norm.startsWith('86') && norm.length === 13 ? norm.slice(2) : norm;
  user = {
    id: id('sup'),
    username: `p${norm}`,
    role: 'supplier',
    supplierName: record.supplierName || `Supplier ${local}`,
    countryCode: norm.startsWith('86') ? '+86' : '',
    phone: local,
    phoneNormalized: norm,
    salt: crypto.randomBytes(8).toString('hex'),
    hash: crypto.randomBytes(16).toString('hex'),
    createdAt: new Date().toISOString(),
    authMethod: 'phone-backfill',
  };
  users.push(user);
  suppliers = users.filter((u) => u.role === 'supplier');
  return user;
}

function patchRecord(record, stats, bucket) {
  const phone = record.supplierPhone || '';
  const norm = normalizePhone(record.supplierPhoneNormalized || phone, '');
  if (!norm) {
    stats.noPhone += 1;
    return false;
  }
  let user = findSupplier(phone) || findSupplier(norm);
  if (!user) user = ensureSupplierFromRecord(record);
  if (!user) {
    stats.unmatched.push({
      bucket,
      id: record.stockId || record.submissionId,
      supplierName: record.supplierName || '',
      supplierPhone: phone,
      phoneNormalized: norm,
    });
    return false;
  }

  let changed = false;
  if (record.supplierId !== user.id) {
    record.supplierId = user.id;
    changed = true;
  }
  if (record.supplierPhoneNormalized !== (user.phoneNormalized || norm)) {
    record.supplierPhoneNormalized = user.phoneNormalized || norm;
    changed = true;
  }
  if (changed) {
    stats.updated += 1;
    stats.matched.push({
      bucket,
      id: record.stockId || record.submissionId,
      supplierId: user.id,
      supplierName: user.supplierName,
      phoneNormalized: record.supplierPhoneNormalized,
    });
  } else {
    stats.alreadyBound += 1;
  }
  return changed;
}

const stats = {
  dryRun: DRY,
  createMissing: CREATE_MISSING,
  updated: 0,
  alreadyBound: 0,
  noPhone: 0,
  matched: [],
  unmatched: [],
  usersCreated: 0,
};

const beforeUsers = users.length;
const submissions = load(SUBMISSIONS, []);
const approved = load(APPROVED, []);

for (const row of submissions) patchRecord(row, stats, 'submission');
for (const row of approved) patchRecord(row, stats, 'approved');
stats.usersCreated = users.length - beforeUsers;

const conflicts = {};
for (const row of [...submissions, ...approved]) {
  const norm = normalizePhone(row.supplierPhoneNormalized || row.supplierPhone, '');
  if (!norm) continue;
  const name = String(row.supplierName || '').trim() || '(blank)';
  conflicts[norm] = conflicts[norm] || new Set();
  conflicts[norm].add(name);
}
stats.nameConflicts = Object.entries(conflicts)
  .filter(([, names]) => names.size > 1)
  .map(([phone, names]) => ({ phone, names: [...names] }));

console.log(JSON.stringify({
  dryRun: DRY,
  updated: stats.updated,
  alreadyBound: stats.alreadyBound,
  noPhone: stats.noPhone,
  unmatched: stats.unmatched.length,
  usersCreated: stats.usersCreated,
  nameConflicts: stats.nameConflicts.length,
}, null, 2));

fs.mkdirSync(path.dirname(REPORT), { recursive: true });
save(REPORT, stats);
console.log('Report:', REPORT);

if (APPLY) {
  save(SUBMISSIONS, submissions);
  save(APPROVED, approved);
  if (CREATE_MISSING || stats.usersCreated) save(USERS, users);
  console.log('Applied backfill.');
} else {
  console.log('Dry-run only. Re-run with --apply to write.');
}
