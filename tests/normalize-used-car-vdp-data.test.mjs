import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeUsedCarVdpData } from '../scripts/normalize-used-car-vdp-data.mjs';

function records() {
  const approved = [];
  const submissions = [];
  for (let index = 0; index < 34; index += 1) {
    const stockId = index === 0 ? 'HC250638' : `HC-USED-${index}`;
    const submissionId = `SUB-${index}`;
    const base = {
      brand: index < 25 ? 'BYD' : (index < 29 ? 'Denza' : 'Fangchengbao'),
      vehicleListingType: 'used',
      isExportUsedCar: true,
      approvedAt: '2026-08-08T00:00:00.000Z',
      bodyType: 'Sedan',
      vinSpecs: { bodyStyle: 'Sedan', bodyConfiguration: index === 0 ? '5门5座两厢车' : '4门5座三厢车' },
      photos: index === 0 ? [
        { url: '/photo-1786087025507-0c06dfb6_full.webp', label: 'Vehicle Front' },
        { url: '/photo-1786087033688-934b6b78_full.webp', label: 'Vehicle Rear' },
        { url: '/photo-1786087045937-42b447f4_full.webp', label: 'Engine' },
        { url: '/photo-1786087052971-fd717821_full.webp', label: 'VIN Plate' },
        { url: '/photo-1786087063542-f4f6c0ff_full.webp', label: 'Interior' },
      ] : [],
    };
    approved.push({ ...base, stockId, submissionId });
    submissions.push({ ...base, id: submissionId, approvedStockId: stockId });
  }
  return { approved, submissions };
}

test('normalizes hatchback body style and known exterior-first photo order atomically', () => {
  const input = records();
  const result = normalizeUsedCarVdpData(input);
  assert.equal(result.report.matched, 34);
  assert.equal(result.report.bodyStylesChanged, 1);
  assert.deepEqual(result.report.photosChanged, ['HC250638']);
  const approved = result.approved[0];
  const submission = result.submissions[0];
  assert.equal(approved.bodyType, 'Hatchback');
  assert.equal(approved.vinSpecs.bodyStyle, 'Hatchback');
  assert.match(approved.photos[0].url, /1786087045937/);
  assert.equal(approved.photos[0].label, 'Front-side exterior');
  assert.deepEqual(submission.photos, approved.photos);
});
