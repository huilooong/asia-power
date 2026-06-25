#!/usr/bin/env node
/**
 * Fix a half-cut inventory record (approved + submissions) by stock ID.
 * Usage:
 *   node scripts/fix-inventory-record.mjs --stock HC250051 --engine EA211 [--root /path/to/site]
 *   node scripts/fix-inventory-record.mjs --stock HC250055 --brand Changan
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveLib(name) {
  const candidates = [
    path.join(__dirname, '..', 'server', 'lib', name),
    path.join(__dirname, '..', 'lib', name),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  throw new Error(`Missing server lib: ${name}`);
}

const nameNorm = require(resolveLib('vehicle-name-normalize.js'));
const { createPowertrainCatalogMemory } = require(resolveLib('powertrain-catalog-memory.js'));

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
    } else if (key === '--model' && next) {
      args.model = next;
      i += 1;
    } else if (key === '--engine' && next) {
      args.engineCode = next;
      i += 1;
    } else if (key === '--transmission' && next) {
      args.transmissionCode = next;
      i += 1;
    } else if (key === '--year' && next) {
      args.year = next;
      i += 1;
    } else if (key === '--category' && next) {
      args.vehicleCategory = next;
      i += 1;
    } else if (key === '--truck-part' && next) {
      args.truckPartType = next;
      i += 1;
    } else if (key === '--condition' && next) {
      args.vehicleCondition = next;
      i += 1;
    } else if (key === '--description' && next) {
      args.shortDescription = next;
      i += 1;
    } else if (key === '--origin' && next) {
      args.origin = next;
      i += 1;
    } else if (key === '--drivetrain' && next) {
      args.drivetrain = next;
      i += 1;
    } else if (key === '--parts' && next) {
      args.includedParts = next;
      i += 1;
    } else if (key === '--machinery-type' && next) {
      args.machineryType = next;
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

function resolveBrandSlug(brand, category, rootDir) {
  if (category === 'truck') {
    const truckCatalog = require(resolveLib('truck-brand-catalog.js'));
    return truckCatalog.brandToSlug(brand, rootDir);
  }
  if (category === 'machinery') {
    const machineryCatalog = require(resolveLib('machinery-brand-catalog.js'));
    return machineryCatalog.brandToSlug(brand, rootDir);
  }
  const catalog = nameNorm.loadCatalog(rootDir);
  return catalog?.brandToSlug?.(brand);
}

function patchRow(row, { stockUpper, fields, brandSlug, rootDir }) {
  const id = String(row?.stockId || row?.approvedStockId || '').toUpperCase();
  if (id !== stockUpper) return { row, changed: false };

  const oldSlug = row.slug || row.approvedSlug || null;
  const category = fields.vehicleCategory || row.vehicleCategory;
  const patched = (category === 'truck' || category === 'machinery')
    ? nameNorm.normalizeInventoryRecord({ ...row, ...fields, ...(brandSlug ? { brandSlug } : {}) }, rootDir)
    : nameNorm.rebuildInventoryDerivedFields({
      ...row,
      ...fields,
      ...(brandSlug ? { brandSlug } : {}),
    });

  if (oldSlug && patched.slug && oldSlug !== patched.slug) {
    const aliases = new Set(Array.isArray(patched.slugAliases) ? patched.slugAliases : []);
    aliases.add(oldSlug);
    patched.slugAliases = [...aliases];
  }

  patched.updatedAt = new Date().toISOString();
  patched.nameCorrections = {
    ...(row.nameCorrections || {}),
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
      model: patched.model,
      engineCode: patched.engineCode,
      title: patched.title,
    },
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.stockId) {
    console.error('Usage: node scripts/fix-inventory-record.mjs --stock HC250051 [--engine EA211] [--brand Audi] [--root /site]');
    process.exit(1);
  }

  const dataDir = path.join(args.root, 'data');
  const publicDir = path.join(args.root, 'public');
  const approvedFile = path.join(dataDir, 'half-cut-approved.json');
  const submissionsFile = path.join(dataDir, 'half-cut-submissions.json');
  const catalog = nameNorm.loadCatalog(args.root);
  if (!catalog?.brandToSlug) {
    console.error('Vehicle catalog unavailable');
    process.exit(1);
  }

  const fields = {};
  if (args.brand) fields.brand = args.brand;
  if (args.model) fields.model = args.model;
  if (args.engineCode) fields.engineCode = args.engineCode;
  if (args.transmissionCode) fields.transmissionCode = args.transmissionCode;
  if (args.year) fields.year = Number(args.year);
  if (args.vehicleCategory) fields.vehicleCategory = args.vehicleCategory;
  if (args.truckPartType) fields.truckPartType = args.truckPartType;
  if (args.vehicleCategory === 'truck' && !fields.truckPartType) {
    fields.truckPartType = 'vehicle';
  }
  if (args.vehicleCategory === 'machinery') {
    fields.truckPartType = '';
    if (!fields.machineryType && args.machineryType) fields.machineryType = args.machineryType;
    if (!fields.machineryType && args.vehicleCondition) {
      const map = {
        'Wheel Loader': 'wheel-loader',
        Excavator: 'excavator',
        Bulldozer: 'bulldozer',
      };
      fields.machineryType = map[args.vehicleCondition] || 'other';
    }
  }
  if (args.vehicleCondition) fields.vehicleCondition = args.vehicleCondition;
  if (args.shortDescription) fields.shortDescription = args.shortDescription;
  if (args.origin) fields.origin = args.origin;
  if (args.drivetrain) fields.drivetrain = args.drivetrain;
  if (args.includedParts) {
    fields.includedParts = args.includedParts.startsWith('[')
      ? JSON.parse(args.includedParts)
      : args.includedParts.split(',').map((part) => part.trim()).filter(Boolean);
  }
  if (args.machineryType) fields.machineryType = args.machineryType;
  if (!Object.keys(fields).length) {
    console.error('Provide at least one field: --brand, --model, --engine, --transmission, --year, --category, --machinery-type, --condition, --description, --origin, --drivetrain, --parts');
    process.exit(1);
  }

  const category = args.vehicleCategory || 'passenger';
  const brandSlug = args.brand ? resolveBrandSlug(args.brand, category, args.root) : null;
  const stockUpper = String(args.stockId).toUpperCase();
  let touched = 0;
  const report = [];

  for (const [label, file] of [['approved', approvedFile], ['submissions', submissionsFile]]) {
    const rows = loadJson(file, []);
    if (!Array.isArray(rows)) continue;
    let changedFile = false;
    const nextRows = rows.map((row) => {
      const result = patchRow(row, { stockUpper, fields, brandSlug, rootDir: args.root });
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

  const approved = loadJson(approvedFile, []);
  const memory = createPowertrainCatalogMemory(dataDir, publicDir);
  memory.rebuildFromApproved(approved);

  console.log(JSON.stringify({ stockId: args.stockId, fields, updated: report }, null, 2));
}

main();
