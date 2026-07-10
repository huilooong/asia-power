#!/usr/bin/env node
/**
 * Local checks: bilingual supplier/admin labels + logo srcset config.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const checks = [];

function pass(name) { checks.push({ name, ok: true }); }
function fail(name, detail) { checks.push({ name, ok: false, detail }); }

// Logo assets
for (const file of ['assets/logo.png', 'assets/logo@2x.png', 'assets/logo@3x.png']) {
  existsSync(join(root, file)) ? pass(`asset exists: ${file}`) : fail(`asset exists: ${file}`);
}

const config = read('js/config.js');
if (config.includes('logoSrcSet') && config.includes('logo@2x.png') && config.includes('logo@3x.png')) {
  pass('config logoSrcSet includes 2x and HD');
} else {
  fail('config logoSrcSet includes 2x and HD');
}

const components = read('js/components.js');
if (components.includes('function logoImg') && components.includes('srcset')) {
  pass('components logoImg uses srcset');
} else {
  fail('components logoImg uses srcset');
}

const css = read('css/styles.css');
const logoMatch = css.match(/\.header \.logo__img[\s\S]*?height:\s*(\d+)px/);
if (logoMatch && Number(logoMatch[1]) <= 90) {
  pass(`header logo display height ${logoMatch[1]}px (≤90)`);
} else {
  fail('header logo display height', logoMatch?.[1] || 'not found');
}

// i18n file
const i18n = read('js/half-cut-supplier-i18n.js');
const requiredKeys = [
  'submitListingShort', 'decodeVin', 'uploadPhotos', 'approve', 'reject',
  'adminPending', 'adminApproved', 'adminRejected', 'supplierUploadLead',
];
for (const key of requiredKeys) {
  i18n.includes(`${key}:`) ? pass(`i18n key: ${key}`) : fail(`i18n key: ${key}`);
}

// Script includes
for (const [page, needle] of [
  ['supplier-portal/half-cut-upload.html', 'half-cut-supplier-i18n.js'],
  ['admin/half-cut-review.html', 'half-cut-supplier-i18n.js'],
]) {
  read(page).includes(needle) ? pass(`${page} loads i18n`) : fail(`${page} loads i18n`);
}

// Supplier portal bilingual link
const portal = read('supplier-portal.html');
if (portal.includes('上传乘用车库存') && portal.includes('Submit Half-Cut Inventory')) {
  pass('supplier-portal half-cut link bilingual');
} else {
  fail('supplier-portal half-cut link bilingual');
}

// Admin JS bilingual
const adminJs = read('js/admin-half-cut-review.js');
if (adminJs.includes("tBtn('approve')") && adminJs.includes("tBtn('adminPending')")) {
  pass('admin review JS uses bilingual helpers');
} else {
  fail('admin review JS uses bilingual helpers');
}

// Public catalog should NOT load i18n
const catalogPaths = ['half-cuts/index.html', 'index.html'].filter(p => existsSync(join(root, p)));
for (const p of catalogPaths) {
  const html = read(p);
  if (!html.includes('half-cut-supplier-i18n.js')) {
    pass(`${p} has no supplier i18n script`);
  } else {
    fail(`${p} has no supplier i18n script`);
  }
}

// Hero Chinese on upload page
const uploadHtml = read('supplier-portal/half-cut-upload.html');
if (uploadHtml.includes('请先输入VIN底盘号')) {
  pass('upload page hero has Chinese instruction');
} else {
  fail('upload page hero has Chinese instruction');
}

const failed = checks.filter(c => !c.ok);
console.log('\nSupplier i18n + logo local checks\n');
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
process.exit(failed.length ? 1 : 0);
