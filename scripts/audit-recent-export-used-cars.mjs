#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function valueAfter(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? String(process.argv[index + 1] || fallback) : fallback;
}

function timestamp(item) {
  return Date.parse(item.listedAt || item.approvedAt || item.updatedAt || item.createdAt || 0) || 0;
}

function normalizedBrandKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
}

function brandScope(value) {
  const key = normalizedBrandKey(value);
  if (key === 'BYD' || key === '比亚迪') {
    return new Set(['BYD', '比亚迪', 'DENZA', '腾势', 'FANGCHENGBAO', '方程豹'].map(normalizedBrandKey));
  }
  return new Set([key]);
}

function publicText(item) {
  return [
    item.title,
    item.shortDescription,
    ...(Array.isArray(item.includedParts) ? item.includedParts : []),
  ].filter(Boolean).join(' ');
}

const DISMANTLING_CONTENT = /\bhalf[\s-]*cut\b|\bfront[\s-]*cut\b|engine\s*&\s*gearbox\s*assembly|front\s*clip|wiring\s*harness|radiator\s*pack|半截车|半切车|半切|拆车件/i;

export function auditRecentExportUsedCars(items, { brand, since }) {
  const brands = brandScope(brand);
  const sinceMs = Date.parse(since);
  if (![...brands].some(Boolean)) throw new Error('brand is required');
  if (!Number.isFinite(sinceMs)) throw new Error(`invalid --since value: ${since}`);

  const recent = items
    .filter((item) => brands.has(normalizedBrandKey(item.brand)))
    .filter((item) => timestamp(item) >= sinceMs)
    .sort((a, b) => String(a.stockId || '').localeCompare(String(b.stockId || '')));

  const rows = recent.map((item) => {
    const errors = [];
    if (String(item.vehicleCategory || '').trim().toLowerCase() !== 'passenger') errors.push('vehicle_category_not_passenger');
    if (String(item.truckPartType || '').trim()) errors.push('truck_part_type_present');
    if (String(item.vehicleListingType || '').trim().toLowerCase() !== 'used') errors.push('vehicleListingType_not_used');
    if (item.isExportUsedCar !== true) errors.push('export_flag_missing');
    if (String(item.vehicleCondition || '').trim().toLowerCase() !== 'running vehicle') errors.push('vehicle_condition_not_running');
    if (item.exportVehicleIdentity !== 'complete_used_vehicle') errors.push('complete_vehicle_identity_missing');
    if (!['verified', 'pending_verification'].includes(String(item.exportDocumentationStatus || ''))) errors.push('document_status_missing');
    if (DISMANTLING_CONTENT.test(publicText(item))) errors.push('dismantling_content_exposed');
    if (Array.isArray(item.includedParts) && item.includedParts.length) errors.push('included_parts_not_empty');
    if (!/-export-used-car-/.test(String(item.slug || ''))) errors.push('used_car_slug_missing');
    return {
      stockId: item.stockId,
      listedAt: item.listedAt || item.approvedAt || null,
      supplierDeclared: item.exportSupplierDeclaration === true,
      documentStatus: item.exportDocumentationStatus || null,
      errors,
    };
  });

  return {
    brand: String(brand || '').trim().toUpperCase(),
    matchedBrands: [...brands],
    since,
    matched: rows.length,
    passed: rows.filter((row) => !row.errors.length).length,
    failed: rows.filter((row) => row.errors.length).length,
    rows,
  };
}

async function loadItems() {
  const url = valueAfter('--url');
  if (url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
    const payload = await response.json();
    return payload.approved || payload.items || payload;
  }
  const file = path.resolve(valueAfter('--file', 'data/half-cut-approved.json'));
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  return payload.approved || payload.items || payload;
}

async function main() {
  const brand = valueAfter('--brand', 'BYD');
  const since = valueAfter('--since');
  if (!since) throw new Error('--since is required');
  const items = await loadItems();
  if (!Array.isArray(items)) throw new Error('inventory payload must be an array');
  const report = auditRecentExportUsedCars(items, { brand, since });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.matched || report.failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(`[audit-recent-export-used-cars] ${error.message}`);
    process.exitCode = 1;
  });
}
