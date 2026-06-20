#!/usr/bin/env node
/**
 * Fix a half-cut inventory record (approved + submissions) by stock ID.
 * Usage:
 *   node scripts/fix-inventory-record.mjs --stock HC250055 --brand Changan [--root /path/to/site]
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nameNorm = require('../server/lib/vehicle-name-normalize.js');

function parseArgs(argv) {
  const args = { root: path.join(__dirname, '..') };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--stock' && next) {
      args.stockId = next;
      i += 1;
    } else if (key === '--brand' && next) {
      args.brand = next;
      i += 1;
    } else if (key === '--root' && next) {
      args.root = next;
      i += 1;
    }
  }
  return args;
}

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function patchRow(row, { stockUpper, brand, brandSlug }) {
  const id = String(row?.stockId || row?.approvedStockId || '').toUpperCase();
  if (id !== stockUpper) return { row, changed: false };

  const oldSlug = row.slug || row.approvedSlug || null;
  const patched = nameNorm.rebuildInventoryDerivedFields({
    ...row,
    brand,
    brandSlug,
  });

  if (oldSlug && patched.slug && oldSlug !== patched.slug) {
    const aliases = new Set(Array.isArray(patched.slugAliases) ? patched.slugAliases : []);
    aliases.add(oldSlug);
    patched.slugAliases = [...aliases];
  }

  patched.nameCorrections = {
    ...(row.nameCorrections || {}),
    ...(row.brand && row.brand !== brand ? { brand: row.brand } : {}),
    correctedAt: new Date().toISOString(),
    correctedBy: 'fix-inventory-record.mjs',
  };
  if (row.approvedSlug) patched.approvedSlug = patched.slug;

  return {
    row: patched,
    changed: true,
    report: {
      stockId: id,
      oldSlug,
      newSlug: patched.slug,
      brand: patched.brand,
      title: patched.title,
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.stockId || !args.brand) {
    console.error('Usage: node scripts/fix-inventory-record.mjs --stock HC250055 --brand Changan [--root /site]');
    process.exit(1);
  }

  const dataDir = path.join(args.root, 'data');
  const approvedFile = path.join(dataDir, 'half-cut-approved.json');
  const submissionsFile = path.join(dataDir, 'half-cut-submissions.json');
  const catalog = nameNorm.loadCatalog(args.root);
  if (!catalog?.brandToSlug) {
    console.error('Vehicle catalog unavailable');
    process.exit(1);
  }

  const stockUpper = String(args.stockId).toUpperCase();
  const brandSlug = catalog.brandToSlug(args.brand);
  let touched = 0;
  const report = [];

  for (const [label, file] of [['approved', approvedFile], ['submissions', submissionsFile]]) {
    const rows = loadJson(file, []);
    if (!Array.isArray(rows)) continue;
    let changedFile = false;
    const nextRows = rows.map((row) => {
      const result = patchRow(row, { stockUpper, brand: args.brand, brandSlug });
      if (!result.changed) return row;
      changedFile = true;
      touched += 1;
      report.push({ file: label, ...result.report });
      return result.row;
    });
    if (changedFile) saveJson(file, nextRows);
  }

  if (!touched) {
    console.error(`No record found for stock ${args.stockId}`);
    process.exit(1);
  }

  console.log(JSON.stringify({ stockId: args.stockId, brand: args.brand, updated: report }, null, 2));
}

main();
