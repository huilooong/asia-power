'use strict';

const assert = require('node:assert/strict');
const { toPublicItem, translateBrand } = require('../server/lib/half-cut-public');

const raw = {
  stockId: 'HC-PRIVACY-TEST',
  brand: 'Toyota',
  model: 'Corolla',
  title: 'Toyota Corolla Half Cut',
  vin: 'LFMAP22C0A0123456',
  supplierName: 'Private Supplier',
  supplierPhone: '+8613800000000',
  supplierCity: 'Private City',
  submissionId: 'SUB-PRIVATE',
  notes: 'Internal note only',
  decodeMethod: 'internal',
  includedParts: ['Engine assembly'],
};

const publicItem = toPublicItem(raw);

for (const field of [
  'vin',
  'supplierName',
  'supplierPhone',
  'supplierCity',
  'submissionId',
  'notes',
  'decodeMethod',
]) {
  assert.equal(Object.hasOwn(publicItem, field), false, `${field} must not exist in public output`);
}

assert.equal(publicItem.stockId, raw.stockId);
assert.equal(publicItem.maskedVin, 'LFMAP22C0A****456');

assert.equal(translateBrand('方程豹'), 'Fangchengbao');
assert.equal(translateBrand('腾势'), 'Denza');
assert.equal(translateBrand('Fangchengbao'), 'Fangchengbao');
assert.notEqual(translateBrand('方程豹'), '方城堡');

const sourceBrandRecord = { brand: '方程豹', model: '豹5', title: '方程豹 豹5' };
const sourceBrandSnapshot = structuredClone(sourceBrandRecord);
const publicBrandRecord = toPublicItem(sourceBrandRecord);
assert.equal(publicBrandRecord.brand, 'Fangchengbao');
assert.deepEqual(sourceBrandRecord, sourceBrandSnapshot, 'public localization must not mutate source inventory');

console.log('HALF_CUT_PUBLIC_PRIVACY_PASS');
