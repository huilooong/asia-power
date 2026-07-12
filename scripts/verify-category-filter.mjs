#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('js/half-cut-directory.js', root), 'utf8');
const window = {
  location: { pathname: '/half-cuts/', origin: 'https://asia-power.com', href: 'https://asia-power.com/half-cuts/' },
  __HALF_CUT_LEADS_INIT__: true,
  HalfCutLeads: {},
};
vm.runInNewContext(source, {
  window,
  URLSearchParams,
  Intl,
  console,
}, { filename: 'js/half-cut-directory.js' });

const response = await fetch('https://asia-power.com/api/half-cuts/public', { cache: 'no-store' });
assert.equal(response.ok, true, `public catalog returned HTTP ${response.status}`);
const payload = await response.json();
const live = payload.approved || payload.items || [];
const targetIds = Array.from({ length: 11 }, (_, index) => `HC250${556 + index}`);
const targets = live.filter((item) => targetIds.includes(item.stockId));
assert.equal(targets.length, 11, 'HC250556-HC250566 must all exist in public inventory');

const match = window.HalfCutUtils.matchesInventoryCategory;
const result = {};
for (const item of targets) {
  result[item.stockId] = {
    halfcuts: match(item, 'halfcuts'),
    frontcuts: match(item, 'frontcuts'),
    chassis: match(item, 'chassis'),
    engines: match(item, 'engines'),
    gearboxes: match(item, 'gearboxes'),
  };
}

for (let stockNo = 556; stockNo <= 564; stockNo += 1) {
  const row = result[`HC250${stockNo}`];
  assert.deepEqual(
    row,
    { halfcuts: false, frontcuts: false, chassis: false, engines: true, gearboxes: false },
    `HC250${stockNo} must be engine-only`,
  );
}
assert.deepEqual(
  result.HC250565,
  { halfcuts: false, frontcuts: false, chassis: false, engines: false, gearboxes: true },
  'HC250565 must be gearbox-only',
);
assert.deepEqual(
  result.HC250566,
  { halfcuts: false, frontcuts: false, chassis: false, engines: true, gearboxes: false },
  'HC250566 must be engine-only',
);

const liveCategoryIds = (category) => live
  .filter((item) => match(item, category))
  .map((item) => item.stockId);
const chassisIds = liveCategoryIds('chassis');
const engineIds = liveCategoryIds('engines');
const gearboxIds = liveCategoryIds('gearboxes');
const frontCutIds = liveCategoryIds('frontcuts');
const broadHalfCutCandidates = live.filter((item) => (
  !String(item.passengerPartType || '').trim()
  && String(item.vehicleCondition || '').trim().toLowerCase() === 'half cut'
  && String(item.engineCode || '').trim()
  && String(item.transmissionCode || '').trim()
));
const completeHalfCuts = live.filter((item) => (
  broadHalfCutCandidates.includes(item)
  && String(item.halfCutCompleteness || '').trim().toLowerCase() === 'complete'
));
const excludedExportCars = broadHalfCutCandidates.filter((item) => item.isExportUsedCar === true);

assert.equal(
  broadHalfCutCandidates.length,
  398,
  'the approved broad audit scope must remain 398 records',
);
assert.equal(
  completeHalfCuts.length,
  394,
  '394 verified complete half-cuts must carry the completeness marker',
);
assert.deepEqual(
  excludedExportCars.map((item) => item.stockId).sort(),
  ['HC250129', 'HC250168', 'HC250171', 'HC250553'],
  'four records explicitly classified as export used cars must stay excluded',
);
assert.equal(
  completeHalfCuts.every((item) => chassisIds.includes(item.stockId)),
  true,
  'every complete half-cut must enter the chassis catalog by derived display',
);
assert.equal(
  chassisIds.includes('HC250488'),
  true,
  'the standalone evidence-based RAV4 chassis section must remain visible',
);
assert.equal(
  targetIds.some((stockId) => chassisIds.includes(stockId)),
  false,
  'Ford dedicated engines/transmission must stay out of chassis',
);

const kitMirrors = live
  .filter((item) => item.listingStructure === 'kit_transmission_mirror_sku'
    || item.mirrorSource === 'ford-kit-transmission-mirror-2026-07-12')
  .sort((a, b) => String(a.stockId).localeCompare(String(b.stockId)));
assert.equal(kitMirrors.length, 4, 'four kit transmission mirrors must exist');
for (const item of kitMirrors) {
  assert.deepEqual(
    {
      halfcuts: match(item, 'halfcuts'),
      frontcuts: match(item, 'frontcuts'),
      chassis: match(item, 'chassis'),
      engines: match(item, 'engines'),
      gearboxes: match(item, 'gearboxes'),
    },
    { halfcuts: false, frontcuts: false, chassis: false, engines: false, gearboxes: true },
    `${item.stockId} kit mirror must be gearbox-only`,
  );
  assert.equal(item.passengerPartType, 'transmission');
  assert.equal(Number(item.priceUsd), 441);
}

const fordGearboxIds = live
  .filter((item) => String(item.brand || '').trim().toLowerCase() === 'ford')
  .filter((item) => match(item, 'gearboxes'))
  .map((item) => item.stockId)
  .sort();
const expectedFordGearboxes = [
  'HC250132',
  'HC250524',
  'HC250528',
  'HC250536',
  'HC250565',
  ...kitMirrors.map((item) => item.stockId),
].sort();
assert.deepEqual(
  fordGearboxIds,
  expectedFordGearboxes,
  'Ford gearbox catalog must include historical donor cuts, HC250565, and four kit mirrors',
);

const trueHalfCut = {
  stockId: 'TEST-HALFCUT',
  vehicleCategory: 'passenger',
  vehicleCondition: 'Half Cut',
  engineCode: 'TEST-ENGINE',
  transmissionCode: 'TEST-AT',
  slug: 'test-half-cut',
};
assert.equal(match(trueHalfCut, 'halfcuts'), true, 'real half-cut stays in half-cut catalog');
assert.equal(match(trueHalfCut, 'frontcuts'), true, 'real half-cut stays in front-cut catalog');
assert.equal(match(trueHalfCut, 'engines'), true, 'real half-cut may feed engine catalog by code');
assert.equal(match(trueHalfCut, 'gearboxes'), true, 'real half-cut may feed gearbox catalog by code');
assert.equal(match(trueHalfCut, 'chassis'), false, 'half-cut without verified chassis contents stays out of chassis');

const chassisHalfCut = {
  ...trueHalfCut,
  stockId: 'TEST-CHASSIS-HALFCUT',
  includedParts: ['Remaining rear/chassis portion only'],
};
assert.equal(match(chassisHalfCut, 'chassis'), true, 'real donor cut with explicit chassis evidence stays in chassis');

const completeHalfCut = {
  ...trueHalfCut,
  stockId: 'TEST-COMPLETE-HALFCUT',
  halfCutCompleteness: 'complete',
};
assert.equal(
  match(completeHalfCut, 'chassis'),
  true,
  'verified complete half-cut enters chassis through derived display metadata',
);

const engineWithChassisKeyword = {
  stockId: 'TEST-ENGINE-CHASSIS-WORD',
  vehicleCategory: 'passenger',
  passengerPartType: 'engine',
  vehicleCondition: 'Engine Assembly',
  includedParts: ['Engine for chassis application'],
};
assert.equal(
  match(engineWithChassisKeyword, 'chassis'),
  false,
  'dedicated engine cannot enter chassis through a keyword',
);

console.log(JSON.stringify({
  ok: true,
  source: 'https://asia-power.com/api/half-cuts/public',
  checked: targetIds,
  categories: result,
  liveCounts: {
    chassis: chassisIds.length,
    engines: engineIds.length,
    gearboxes: gearboxIds.length,
    frontcuts: frontCutIds.length,
  },
  completeHalfCuts: completeHalfCuts.length,
  excludedExportCars: excludedExportCars.map((item) => item.stockId),
  chassisIds,
  fordGearboxIds,
}, null, 2));
