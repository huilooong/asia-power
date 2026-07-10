'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let cached = null;

function load(rootDir) {
  if (cached) return cached;
  const candidates = [
    path.join(rootDir, 'public', 'js', 'machinery-brand-catalog.js'),
    path.join(rootDir, 'js', 'machinery-brand-catalog.js'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    cached = sandbox.window.MachineryBrandCatalog || null;
    return cached;
  }
  return null;
}

function resolveBrand(raw, rootDir) {
  const catalog = load(rootDir);
  if (catalog?.resolveBrand) return catalog.resolveBrand(raw);
  return String(raw || '').trim();
}

function brandToSlug(brand, rootDir) {
  const catalog = load(rootDir);
  if (catalog?.brandToSlug) return catalog.brandToSlug(brand);
  return String(brand || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function typeLabel(type, rootDir) {
  const catalog = load(rootDir);
  if (catalog?.typeLabel) return catalog.typeLabel(type);
  return 'Construction Equipment';
}

function normalizeMachineryRecord(record, rootDir) {
  if (!record || record.vehicleCategory !== 'machinery') return record;
  const catalog = load(rootDir);
  if (!catalog) return record;
  const brand = catalog.resolveBrand(record.brand);
  const machineryType = String(record.machineryType || 'other').trim() || 'other';
  const condition = record.vehicleCondition || catalog.typeLabel(machineryType);
  return {
    ...record,
    brand,
    brandSlug: catalog.brandToSlug(brand),
    machineryType,
    vehicleCondition: condition,
    truckPartType: '',
  };
}

module.exports = {
  load,
  resolveBrand,
  brandToSlug,
  typeLabel,
  normalizeMachineryRecord,
};
