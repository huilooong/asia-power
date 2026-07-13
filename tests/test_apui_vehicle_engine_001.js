'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const sandbox = { window: {}, console };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/engine-directory.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/engine-card-label.js'), 'utf8'), sandbox);
const L = sandbox.window.EngineCardLabel;

test('structured apps: 2AZ-FE', () => {
  const p = L.parseStructuredApplications('Camry, RAV4, Alphard', 'Toyota');
  assert.equal(p.vehicles.join('|'), 'Camry|RAV4|Alphard');
  assert.equal(p.rejected.length, 0);
});

test('reject ambiguous free-text tokens', () => {
  const p = L.parseStructuredApplications('F0, small car applications', 'BYD');
  assert.ok(p.vehicles.includes('F0'));
  assert.ok(p.rejected.some((x) => /small car/i.test(x)));
});

test('reject series / turbo ambiguous', () => {
  const p = L.parseStructuredApplications('Land Cruiser 100 series turbo', 'Toyota');
  assert.equal(p.vehicles.length, 0);
  assert.ok(p.rejected.length >= 1);
});

test('directory-derived displacement when inventory empty', () => {
  const r = L.resolveDisplacementFuelTraceable({ engineCode: '2AZ-FE', brandSlug: 'toyota' });
  assert.equal(r.displacement, '2.4L');
  assert.equal(r.fuel, 'Petrol');
  assert.equal(r.displacementSource, 'directory-derived');
});

test('inventory displacement wins over directory', () => {
  const r = L.resolveDisplacementFuelTraceable({
    engineCode: '2AZ-FE',
    displacement: '2.5L',
    brandSlug: 'toyota',
  });
  assert.equal(r.displacement, '2.5L');
  assert.equal(r.displacementSource, 'inventory');
});

test('no invent for unknown code', () => {
  const r = L.resolveDisplacementFuelTraceable({ engineCode: 'R20A3' });
  assert.equal(r.displacement, '');
  assert.equal(r.displacementSource, '');
});

test('reject displacement-like engine code', () => {
  const r = L.resolveDisplacementFuelTraceable({ engineCode: '4.0L' });
  assert.equal(r.code, '');
});

test('half-cut vehicle title', () => {
  assert.equal(L.formatHalfCutVehicleTitle({ brand: 'Toyota', model: 'Camry' }), 'Toyota Camry');
});

test('compatible summary truncation', () => {
  const s = L.formatCompatibleVehiclesSummary('Corolla, Fielder, Axio, Yaris', { limit: 3 });
  assert.match(s, /\+2 Models/);
});
