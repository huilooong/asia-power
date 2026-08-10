#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let halfCutTitle;
try {
  halfCutTitle = require('../server/lib/half-cut-title');
} catch {
  // Production installs application libraries at inventory-site/lib/.
  halfCutTitle = require('../lib/half-cut-title');
}

function valueAfter(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? String(process.argv[index + 1] || fallback) : fallback;
}

function readArray(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error(`${file} must contain a JSON array`);
  return parsed;
}

function approvedTimestamp(item) {
  return Date.parse(item.approvedAt || item.listedAt || item.updatedAt || item.createdAt || 0) || 0;
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

function wholeVehicleDescription(item) {
  const identity = [item.year, item.brand, item.model].filter(Boolean).join(' ');
  return `${identity} complete, undismantled used vehicle for whole-vehicle export.`.trim();
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function exportUsedCarSlug(item) {
  const brandSlugAliases = {
    比亚迪: 'byd',
    腾势: 'denza',
    方程豹: 'fangchengbao',
  };
  return [
    item.brandSlug || brandSlugAliases[String(item.brand || '').trim()] || item.brand,
    item.model,
    item.year,
    item.engineCode,
    'export-used-car',
    item.stockId,
  ].map(slugify).filter(Boolean).join('-');
}

function updateRecord(record, supplierDeclared) {
  const next = { ...record };
  next.vehicleCategory = 'passenger';
  next.vehicleListingType = 'used';
  next.isExportUsedCar = true;
  next.vehicleCondition = 'Running Vehicle';
  next.truckPartType = '';
  next.passengerPartType = '';
  next.machineryType = '';
  next.exportVehicleIdentity = 'complete_used_vehicle';
  next.exportSupplierDeclaration = supplierDeclared;
  if (next.exportDocumentationStatus !== 'verified') {
    next.exportDocumentationStatus = 'pending_verification';
  }
  next.title = halfCutTitle.formatExportUsedCarTitle(
    halfCutTitle.buildStructuredTitle(next) || next.title,
  );
  next.shortDescription = wholeVehicleDescription(next);
  next.includedParts = [];
  const previousSlug = String(next.slug || '').trim();
  const cleanSlug = exportUsedCarSlug(next);
  if (cleanSlug && cleanSlug !== previousSlug) {
    if (previousSlug) {
      next.slugAliases = [...new Set([...(Array.isArray(next.slugAliases) ? next.slugAliases : []), previousSlug])];
    }
    next.slug = cleanSlug;
  }
  return next;
}

function changedFields(before, after) {
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

function writeAtomicWithBackup(file, value, stamp) {
  const backup = `${file}.bak-${stamp}`;
  const temp = `${file}.tmp-${process.pid}`;
  fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
  return backup;
}

export function migrateRecentExportUsedCars({ approved, submissions, brand, since }) {
  const brands = brandScope(brand);
  const sinceMs = Date.parse(since);
  if (![...brands].some(Boolean)) throw new Error('brand is required');
  if (!Number.isFinite(sinceMs)) throw new Error(`invalid --since value: ${since}`);

  const submissionsById = new Map(
    submissions.map((row, index) => [String(row.id || row.submissionId || ''), { row, index }]),
  );
  const approvedChanges = [];
  const submissionChanges = [];
  const nextApproved = approved.map((row) => {
    if (!brands.has(normalizedBrandKey(row.brand))) return row;
    if (approvedTimestamp(row) < sinceMs) return row;

    const linked = submissionsById.get(String(row.submissionId || ''));
    const supplierDeclared = row.exportSupplierDeclaration === true
      || halfCutTitle.hasExportReadyRemark(row)
      || halfCutTitle.hasExportReadyRemark(linked?.row);
    const next = updateRecord(row, supplierDeclared);
    approvedChanges.push({
      stockId: row.stockId,
      approvedAt: row.approvedAt || row.listedAt || null,
      fields: changedFields(row, next),
      supplierDeclared,
      documentStatus: next.exportDocumentationStatus,
    });

    if (linked) {
      const nextSubmission = updateRecord(linked.row, supplierDeclared);
      submissions[linked.index] = nextSubmission;
      submissionChanges.push({
        submissionId: String(linked.row.id || linked.row.submissionId || ''),
        stockId: row.stockId,
        fields: changedFields(linked.row, nextSubmission),
      });
    }
    return next;
  });

  return {
    approved: nextApproved,
    submissions,
    report: {
      brand: String(brand || '').trim().toUpperCase(),
      matchedBrands: [...brands],
      since,
      matched: approvedChanges.length,
      approvedChanges,
      submissionChanges,
    },
  };
}

function main() {
  const approvedFile = path.resolve(valueAfter('--file', 'data/half-cut-approved.json'));
  const submissionsFile = path.resolve(valueAfter('--submissions', 'data/half-cut-submissions.json'));
  const brand = valueAfter('--brand', 'BYD');
  const since = valueAfter('--since');
  const apply = process.argv.includes('--apply');
  if (!since) throw new Error('--since is required');

  const approved = readArray(approvedFile);
  const submissions = readArray(submissionsFile);
  const result = migrateRecentExportUsedCars({ approved, submissions, brand, since });
  if (!result.report.matched) throw new Error(`No ${brand} records found since ${since}`);

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const backups = [];
  if (apply) {
    backups.push(writeAtomicWithBackup(approvedFile, result.approved, stamp));
    backups.push(writeAtomicWithBackup(submissionsFile, result.submissions, stamp));
  }

  process.stdout.write(`${JSON.stringify({
    mode: apply ? 'applied' : 'dry-run',
    files: { approvedFile, submissionsFile },
    backups,
    ...result.report,
  }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    console.error(`[migrate-recent-export-used-cars] ${error.message}`);
    process.exitCode = 1;
  }
}
