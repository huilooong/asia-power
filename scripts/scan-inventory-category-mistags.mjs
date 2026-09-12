#!/usr/bin/env node
/**
 * Scan a public catalog (live or file) for truck/passenger mistags.
 * Usage:
 *   node scripts/scan-inventory-category-mistags.mjs
 *   node scripts/scan-inventory-category-mistags.mjs --file /tmp/catalog.json
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nameNorm = require(path.join(__dirname, '..', 'server', 'lib', 'vehicle-name-normalize.js'));

const fileFlag = process.argv.indexOf('--file');
const source = fileFlag >= 0
  ? process.argv[fileFlag + 1]
  : 'https://asia-power.com/api/half-cuts/public';

async function loadCatalog() {
  if (source.startsWith('http')) {
    const res = await fetch(source, { headers: { 'User-Agent': 'AsiaPowerCategoryScan/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${source}`);
    return res.json();
  }
  return JSON.parse(fs.readFileSync(path.resolve(source), 'utf8'));
}

const data = await loadCatalog();
const items = Array.isArray(data) ? data : (data.approved || []);
const rows = [];

for (const item of items) {
  const next = nameNorm.normalizeListingMeta(item);
  const before = `${item.vehicleCategory}|${item.vehicleCondition}|${item.truckPartType || ''}|${item.passengerPartType || ''}`;
  const after = `${next.vehicleCategory}|${next.vehicleCondition}|${next.truckPartType || ''}|${next.passengerPartType || ''}`;
  if (before !== after) {
    rows.push({
      stockId: item.stockId,
      title: item.title,
      from: before,
      to: after,
    });
  }
}

console.log(`scanned ${items.length} listings from ${source}`);
console.log(`corrections ${rows.length}`);
for (const row of rows) {
  console.log(`${row.stockId}\t${row.from}\t→\t${row.to}\t${row.title}`);
}
