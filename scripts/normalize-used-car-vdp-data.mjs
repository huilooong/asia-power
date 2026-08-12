#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_APPROVED = '/root/.openclaw/workspace/inventory-site/data/half-cut-approved.json';
const DEFAULT_SUBMISSIONS = '/root/.openclaw/workspace/inventory-site/data/half-cut-submissions.json';
const DEFAULT_SINCE = '2026-08-01';
const FAMILY = new Set(['BYD', 'Denza', 'Fangchengbao']);

const HC250638_PHOTOS = [
  ['photo-1786087045937-42b447f4', 'Front-side exterior'],
  ['photo-1786087052971-fd717821', 'Front exterior detail'],
  ['photo-1786087025507-0c06dfb6', 'Dashboard and front cabin'],
  ['photo-1786087033688-934b6b78', 'Rear seating'],
  ['photo-1786087063542-f4f6c0ff', 'Instrument display'],
];

function valueAfter(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? String(process.argv[index + 1] || fallback) : fallback;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function bodyStyleFromConfiguration(specs = {}) {
  const configuration = String(specs.bodyConfiguration || '');
  if (configuration.includes('两厢车')) return 'Hatchback';
  if (configuration.includes('三厢车')) return 'Sedan';
  return String(specs.bodyStyle || '').trim();
}

function orderKnownPhotos(record) {
  if (record.stockId !== 'HC250638' && record.approvedStockId !== 'HC250638') return record;
  const photos = Array.isArray(record.photos) ? record.photos : [];
  if (photos.length !== HC250638_PHOTOS.length) throw new Error('HC250638 expected exactly five photos');
  const ordered = HC250638_PHOTOS.map(([token, label]) => {
    const match = photos.find((photo) => String(photo?.url || photo || '').includes(token));
    if (!match || typeof match !== 'object') throw new Error(`HC250638 photo ${token} missing`);
    return { ...match, label };
  });
  if (new Set(ordered.map((photo) => photo.url)).size !== photos.length) throw new Error('HC250638 photo order is not one-to-one');
  return { ...record, photos: ordered };
}

function normalizeRecord(record) {
  const style = bodyStyleFromConfiguration(record.vinSpecs);
  let next = record;
  if (style && (record.bodyType !== style || record.vinSpecs?.bodyStyle !== style)) {
    next = {
      ...next,
      bodyType: style,
      vinSpecs: { ...record.vinSpecs, bodyStyle: style },
    };
  }
  return orderKnownPhotos(next);
}

export function normalizeUsedCarVdpData({ approved, submissions, since = DEFAULT_SINCE }) {
  if (!Array.isArray(approved) || !Array.isArray(submissions)) throw new Error('Inventory inputs must be arrays');
  const submissionById = new Map(submissions.map((row, index) => [String(row.submissionId || row.id || ''), { row, index }]));
  const touched = [];
  const nextSubmissions = submissions.slice();
  const nextApproved = approved.map((record) => {
    const listedAt = String(record.approvedAt || record.updatedAt || record.createdAt || '');
    if (!FAMILY.has(record.brand) || record.vehicleListingType !== 'used' || record.isExportUsedCar !== true || listedAt < since) return record;
    const linked = submissionById.get(String(record.submissionId || ''));
    if (!linked) throw new Error(`Linked submission missing for ${record.stockId}`);
    const next = normalizeRecord(record);
    const nextSubmission = normalizeRecord({ ...linked.row, approvedStockId: linked.row.approvedStockId || record.stockId });
    nextSubmissions[linked.index] = nextSubmission;
    touched.push({
      stockId: record.stockId,
      bodyType: next.bodyType || '',
      photosChanged: JSON.stringify(record.photos || []) !== JSON.stringify(next.photos || []),
    });
    return next;
  });
  if (touched.length !== 34) throw new Error(`Expected 34 BYD-family used cars, found ${touched.length}`);
  return {
    approved: nextApproved,
    submissions: nextSubmissions,
    report: {
      matched: touched.length,
      bodyStylesChanged: touched.filter(({ stockId }) => {
        const before = approved.find((row) => row.stockId === stockId);
        const after = nextApproved.find((row) => row.stockId === stockId);
        return before.bodyType !== after.bodyType || before.vinSpecs?.bodyStyle !== after.vinSpecs?.bodyStyle;
      }).length,
      photosChanged: touched.filter((row) => row.photosChanged).map((row) => row.stockId),
    },
  };
}

function writeBundleWithBackups(files, stamp) {
  const prepared = files.map(({ file, value }) => {
    const backup = `${file}.bak-used-car-vdp-${stamp}`;
    const temp = `${file}.tmp-used-car-vdp-${process.pid}`;
    fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: fs.statSync(file).mode & 0o777 });
    return { file, value, backup, temp };
  });
  const replaced = [];
  try {
    for (const item of prepared) {
      fs.renameSync(item.temp, item.file);
      replaced.push(item);
    }
  } catch (error) {
    for (const item of replaced.reverse()) fs.copyFileSync(item.backup, item.file);
    for (const item of prepared) if (fs.existsSync(item.temp)) fs.unlinkSync(item.temp);
    throw error;
  }
  return prepared.map(({ file, backup }) => ({ file, backup }));
}

async function main() {
  const approvedFile = path.resolve(valueAfter('--approved', DEFAULT_APPROVED));
  const submissionsFile = path.resolve(valueAfter('--submissions', DEFAULT_SUBMISSIONS));
  const since = valueAfter('--since', DEFAULT_SINCE);
  const apply = process.argv.includes('--apply');
  const result = normalizeUsedCarVdpData({ approved: readJson(approvedFile), submissions: readJson(submissionsFile), since });
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const backups = apply ? writeBundleWithBackups([
    { file: approvedFile, value: result.approved },
    { file: submissionsFile, value: result.submissions },
  ], stamp) : [];
  process.stdout.write(`${JSON.stringify({ mode: apply ? 'applied' : 'dry-run', backups, ...result.report }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(`[normalize-used-car-vdp-data] ${error.message}`);
    process.exitCode = 1;
  });
}
