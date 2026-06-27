#!/usr/bin/env node
'use strict';

/**
 * One-off batch correction script for the v0.1 VIN sample validation phase.
 * Operates on LOCAL copies pulled from the server (see conversation/handoff
 * doc) — does not touch the server directly. Output gets scp'd back up
 * manually after review.
 *
 * Fields corrected (from confirmed QXB decode, only when number:200):
 *   brand, brandSlug, model, year, engineCode, transmissionCode, drivetrain,
 *   + new fields: displacement, fuelType, gearboxModel
 *   + regenerated `title` (text only, NOT `slug` — slug/URL is preserved
 *     even when brand/model change, per explicit user decision 2026-06-27)
 *
 * NEVER touched: price/priceUsd, supplier*, photos, video, videoUrl,
 * inventoryStatus/status, reviewStatus, notes, stockId, slug, submissionId,
 * createdAt/approvedAt/reviewedAt, mileage, includedParts, shortDescription.
 *
 * Every changed field is logged Before -> After to correction-log.json.
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { loadEnv } = require('../server/lib/load-env');
loadEnv(ROOT);

const { applyMapping } = require('../server/lib/vin/mapping-layer');
const { localizeForDisplay, seedKnowledgeBase } = require('../server/lib/vin/localize');
const { createVehicleKnowledgeBase } = require('../server/lib/vin/knowledge-base');
const { rebuildInventoryDerivedFields } = require('../server/lib/vehicle-name-normalize');

const SUBMISSIONS_PATH = '/tmp/vin-correction/half-cut-submissions.json';
const APPROVED_PATH = '/tmp/vin-correction/half-cut-approved.json';
const LOG_PATH = path.join(ROOT, 'data/knowledge-base/correction-log.json');

const BRAND_SLUG_MAP = {
  Nissan: 'nissan', Toyota: 'toyota', Honda: 'honda', Acura: 'acura', Hyundai: 'hyundai',
  Kia: 'kia', Genesis: 'genesis', BYD: 'byd', Geely: 'geely', Zeekr: 'zeekr',
  'Lynk & Co': 'lynk-co', Geometry: 'geometry', Chery: 'chery', Exeed: 'exeed', Jetour: 'jetour',
  Omoda: 'omoda', Jaecoo: 'jaecoo', 'Great Wall': 'great-wall', Haval: 'haval', Tank: 'tank',
  Ora: 'ora', MG: 'mg', Roewe: 'roewe', GAC: 'gac', Changan: 'changan', JAC: 'jac',
  Dongfeng: 'dongfeng', FAW: 'faw', Foton: 'foton', JMC: 'jmc', Maxus: 'maxus', Ford: 'ford',
  Lincoln: 'lincoln', Chevrolet: 'chevrolet', GMC: 'gmc', Buick: 'buick', Cadillac: 'cadillac',
  Volkswagen: 'volkswagen', Audi: 'audi', Skoda: 'skoda', Seat: 'seat', 'Mercedes-Benz': 'mercedes-benz',
  BMW: 'bmw', MINI: 'mini', Porsche: 'porsche', Ssangyong: 'ssangyong', Isuzu: 'isuzu',
  Lexus: 'lexus', Infiniti: 'infiniti', Mazda: 'mazda', Mitsubishi: 'mitsubishi', Subaru: 'subaru',
  Suzuki: 'suzuki', Daihatsu: 'daihatsu',
  // Brands confirmed by VIN decode but NOT YET in AsiaPower's brand catalog
  // (no js/vehicle-catalog.js BRAND_SLUG entry, no /brands/*.html page).
  // Slugs assigned here so brand+brandSlug stay consistent; creating the
  // actual landing pages is a follow-up task, not blocking this correction.
  Hawtai: 'hawtai', Wuling: 'wuling', Volvo: 'volvo', 'Citroën': 'citroen',
  Peugeot: 'peugeot', Dodge: 'dodge', 'Changan Kuayue': 'changan-kuayue',
};

const kb = createVehicleKnowledgeBase(path.join(ROOT, 'data'));
seedKnowledgeBase(kb);

// VINs with a deliberate manual override that disagrees with the raw QXB
// decode — never let the automatic pass overwrite these back to the API
// value. See correction-log.json entries with type:"manual_override" for
// the rationale behind each.
const MANUAL_OVERRIDE_VINS = new Set(['LRH17A4E490000497']);

function correctRecord(record, log) {
  if (!record.vin) return;
  if (MANUAL_OVERRIDE_VINS.has(record.vin.toUpperCase())) {
    // Still safe to regenerate title/shortDescription from current (already
    // manually-correct) brand/model — that part doesn't touch brand/model.
    const beforeTitle = record.title;
    const beforeDesc = record.shortDescription;
    const rebuilt = rebuildInventoryDerivedFields(record);
    const changes = {};
    if (rebuilt.title !== beforeTitle) { changes.title = { before: beforeTitle, after: rebuilt.title }; record.title = rebuilt.title; }
    if (rebuilt.shortDescription !== beforeDesc) { changes.shortDescription = { before: beforeDesc, after: rebuilt.shortDescription }; record.shortDescription = rebuilt.shortDescription; }
    if (Object.keys(changes).length) {
      log.push({ vin: record.vin, stockId: record.stockId || record.approvedStockId || '', submissionId: record.submissionId || '', correctedAt: new Date().toISOString(), changes, note: 'text-only regen, manual_override VIN excluded from brand/model auto-correction' });
    }
    return;
  }
  const cached = kb.getCachedVin(record.vin.toUpperCase());
  if (!cached || cached.rawResponse?.number !== 200) return; // only correct confirmed-decoded VINs

  const { mapped } = applyMapping(cached.rawResponse);
  if (!mapped) return;
  const display = localizeForDisplay(mapped, kb, { brandSlugMap: BRAND_SLUG_MAP, vin: record.vin });

  const changes = {};
  const setIfChanged = (field, newValue) => {
    if (newValue === undefined || newValue === null || newValue === '') return;
    if (record[field] === newValue) return;
    changes[field] = { before: record[field], after: newValue };
    record[field] = newValue;
  };

  // Brand: only write if the dictionary actually resolved an English name —
  // never overwrite with an untranslated Chinese fallback (a wrong/missing
  // brand is recoverable; a silently-Chinese brand field is not, since
  // nothing else on the site expects Chinese brand text).
  let brandChangedThisRecord = false;
  if (display.brandEnglish && display.brandEnglish !== mapped.brand) {
    const before = record.brand;
    setIfChanged('brand', display.brandEnglish);
    if (record.brand !== before) brandChangedThisRecord = true;
    if (display.brandSlug) setIfChanged('brandSlug', display.brandSlug);
  }
  // Model: once we've confirmed via a brand correction that this record's
  // identity was wrong, an untranslated Chinese series name is still more
  // correct than the CONFIRMED-WRONG English model already on file (user
  // decision 2026-06-27: "错误的内容没有存在的意义") — fall back to Chinese.
  // But if brand did NOT change this pass, the existing English model may
  // already be correct (dictionary gaps are common for series names even
  // when the vehicle identity itself is right) — don't risk overwriting good
  // English data with an untranslated Chinese string in that case.
  if (mapped.series) {
    if (display.seriesEnglish && display.seriesEnglish !== mapped.series) {
      setIfChanged('model', display.seriesEnglish);
    } else if (brandChangedThisRecord && mapped.series !== record.model) {
      setIfChanged('model', mapped.series);
    }
  }
  if (mapped.year) setIfChanged('year', Number(mapped.year));
  if (mapped.engineCode) setIfChanged('engineCode', mapped.engineCode);
  if (mapped.transmissionCode) setIfChanged('transmissionCode', mapped.transmissionCode.toUpperCase());
  if (mapped.gearboxModel) setIfChanged('gearboxModel', mapped.gearboxModel);
  if (display.displacement) setIfChanged('displacement', display.displacement);
  if (display.fuelType && display.fuelType !== mapped.fuelTypeRaw) setIfChanged('fuelType', display.fuelType);
  if (display.drivetrain && display.drivetrain !== mapped.drivetrainRaw) setIfChanged('drivetrain', display.drivetrain);

  // Regenerate title/shortDescription using the SAME canonical generator the
  // rest of the system uses (server/lib/vehicle-name-normalize.js), not an
  // ad-hoc template — this guarantees consistency AND reuses its existing
  // safety check: shortDescription is only overwritten if it's empty or
  // still matches the auto-generated boilerplate pattern. Admin-authored
  // custom descriptions (e.g. "没有三元催化", real condition notes) do NOT
  // match that pattern and are correctly left untouched. Regenerate whenever
  // ANY relevant field changed (not just brand/model) — a stale title from
  // an engineCode/year-only correction is just as wrong as a stale brand.
  // Runs unconditionally (not gated on `changes` from this pass) because a
  // PRIOR pass may have corrected engineCode/year/etc without regenerating
  // these text fields at the time — this sweep catches that backlog too.
  {
    const beforeTitle = record.title;
    const beforeDesc = record.shortDescription;
    const rebuilt = rebuildInventoryDerivedFields(record);
    if (rebuilt.title !== beforeTitle) {
      changes.title = { before: beforeTitle, after: rebuilt.title };
      record.title = rebuilt.title;
    }
    if (rebuilt.shortDescription !== beforeDesc) {
      changes.shortDescription = { before: beforeDesc, after: rebuilt.shortDescription };
      record.shortDescription = rebuilt.shortDescription;
    }
  }

  if (Object.keys(changes).length > 0) {
    log.push({
      vin: record.vin,
      stockId: record.stockId || record.approvedStockId || '',
      submissionId: record.submissionId || '',
      correctedAt: new Date().toISOString(),
      changes,
    });
  }
}

function main() {
  const submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_PATH, 'utf8'));
  const approved = JSON.parse(fs.readFileSync(APPROVED_PATH, 'utf8'));
  const log = [];

  submissions.forEach((r) => correctRecord(r, log));
  approved.forEach((r) => correctRecord(r, log));

  fs.writeFileSync(SUBMISSIONS_PATH, `${JSON.stringify(submissions, null, 2)}\n`);
  fs.writeFileSync(APPROVED_PATH, `${JSON.stringify(approved, null, 2)}\n`);

  const existingLog = fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')) : { entries: [] };
  existingLog.entries.push(...log);
  fs.writeFileSync(LOG_PATH, `${JSON.stringify(existingLog, null, 2)}\n`);

  console.log(`Corrected ${log.length} records. Log written to ${LOG_PATH}`);
  console.log(JSON.stringify(log, null, 2));
}

main();
