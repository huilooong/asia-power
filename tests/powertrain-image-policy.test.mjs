import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function loadCatalog() {
  const sandbox = {
    window: {
      SitePaths: { base: () => '../' },
    },
  };
  vm.runInNewContext(read('js/powertrain-image-catalog.js'), sandbox, {
    filename: 'powertrain-image-catalog.js',
  });
  return sandbox.window.PowertrainImageCatalog;
}

test('engine images resolve only from exact rights-cleared engine codes', () => {
  const catalog = loadCatalog();
  const image = catalog.resolve({ engineCode: '1zr-fe' }, 'engine');

  assert.equal(image.engineCode, '1ZR-FE');
  assert.equal(image.rightsStatus, 'commercial-reuse-permitted');
  assert.equal(image.watermarkStatus, 'none-visible-manual-review');
  assert.equal(image.source.license, 'CC BY-SA 4.0');
  assert.match(image.url, /assets\/images\/powertrain-models\/1zr-fe\.jpg/);
  assert.equal(catalog.resolve({ engineCode: '1ZR' }, 'engine'), null);
  assert.equal(catalog.resolve({ engineCode: '' }, 'engine'), null);
});

test('gearbox image requires the VIN-derived stock evidence and full cross-check', () => {
  const catalog = loadCatalog();
  const matched = {
    stockId: 'HC250166',
    maskedVin: 'LGBF1AE00B****023',
    engineCode: 'MR20DE',
    brand: 'Nissan',
    model: 'Teana',
    year: 2011,
    drivetrain: '2WD',
    transmissionCode: 'CVT',
  };

  assert.equal(catalog.resolve(matched, 'transmission').modelCode, 'RE0F10A / JF011E');
  assert.equal(catalog.resolve({ ...matched, maskedVin: 'WRONG' }, 'transmission'), null);
  assert.equal(catalog.resolve({ ...matched, engineCode: 'QR25DE' }, 'transmission'), null);
  assert.equal(catalog.resolve({ ...matched, stockId: 'HC250160' }, 'transmission'), null);
});

test('verified gearbox model remains visible when no rights-cleared image exists', () => {
  const catalog = loadCatalog();
  const matched = {
    stockId: 'HC250160',
    maskedVin: 'LVGBE40KX7****252',
    engineCode: '2AZ-FE',
    brand: 'Toyota',
    model: 'Camry',
    year: 2007,
    drivetrain: '2WD',
    transmissionCode: '5AT',
  };

  assert.equal(catalog.resolveTransmissionModel(matched).modelCode, 'U250E / AW95-50LS');
  assert.equal(catalog.resolve(matched, 'transmission'), null);
  assert.equal(catalog.resolveTransmissionModel({ ...matched, maskedVin: 'WRONG' }), null);
});

test('all production image records include visible-attribution data and local files', () => {
  const catalog = loadCatalog();
  const records = catalog.listProductionImages();
  assert.equal(records.length, 6);
  for (const image of records) {
    assert.equal(image.rightsStatus, 'commercial-reuse-permitted');
    assert.equal(image.watermarkStatus, 'none-visible-manual-review');
    assert.match(image.source.pageUrl, /^https:\/\/commons\.wikimedia\.org\//);
    assert.ok(image.source.creator);
    assert.ok(image.source.license);
    assert.equal(fs.existsSync(path.join(ROOT, image.path)), true, image.path);
  }
});

test('catalog renderer forbids vehicle album fallback for engines and gearboxes', () => {
  const directory = read('js/half-cut-directory.js');
  const engines = read('engines/index.html');
  const gearboxes = read('gearboxes/index.html');

  assert.match(directory, /if \(partType === 'engine' \|\| partType === 'transmission'\) return null/);
  assert.match(directory, /PowertrainImageCatalog\?\.resolve/);
  assert.match(directory, /formatTransmissionCatalogPrimaryTitle/);
  assert.match(directory, /Source \/ 来源:/);
  assert.match(directory, /engine: 'assets\/images\/powertrain-photo-placeholder\.svg'/);
  assert.match(directory, /transmission: 'assets\/images\/powertrain-photo-placeholder\.svg'/);
  assert.equal(fs.existsSync(path.join(ROOT, 'assets/images/powertrain-photo-placeholder.svg')), true);
  for (const html of [engines, gearboxes]) {
    assert.match(html, /powertrain-image-catalog\.js\?v=powertrain-model-images-v1/);
    assert.match(html, /half-cut-directory\.js\?v=sitewide-secondary-v1-powertrain-model-images-v1/);
    assert.match(html, /ebay-catalog-hub\.js\?v=sitewide-secondary-v1-powertrain-model-images-v1/);
  }
});
