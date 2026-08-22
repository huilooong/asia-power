'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');

const serverTitle = require('../server/lib/half-cut-title');
const serverSeo = require('../server/lib/half-cut-seo');
const serverPublic = require('../server/lib/half-cut-public');
const vehicleNameNormalize = require('../server/lib/vehicle-name-normalize');

const exportUsedCar = {
  stockId: 'HC-EXPORT-TITLE-1',
  vehicleCategory: 'passenger',
  vehicleListingType: 'used',
  vehicleCondition: 'Running Vehicle',
  year: 2024,
  brand: 'Toyota',
  model: 'Camry',
  engineCode: 'A25A-FKS',
  transmissionCode: '8AT',
  drivetrain: '2WD',
  status: 'Available',
  title: '2024 Toyota Camry 半截车',
  shortDescription: 'Toyota Camry half-cut donor listing',
  notes: '可整车出口',
  includedParts: ['Engine & gearbox assembly', 'Front clip', 'Wiring harness', 'Radiator pack'],
};

test('server export used-car titles omit dismantling terminology', () => {
  assert.equal(serverTitle.isExportUsedCarListing(exportUsedCar), true);
  assert.equal(
    serverTitle.buildDisplayTitle(exportUsedCar, 'en'),
    '2024 Toyota Camry A25A-FKS 8AT 2WD — Export Used Car',
  );
  assert.equal(serverTitle.computeIsExportUsedCar(exportUsedCar), true);
  assert.equal(
    serverTitle.buildDisplayTitle({ ...exportUsedCar, brand: '', model: '', year: null }, 'en'),
    '2024 Toyota Camry — Export Used Car',
  );
  assert.doesNotMatch(serverSeo.seoTitle(exportUsedCar), /half[ -]?cut|front[ -]?cut|半截|半切/i);
  assert.equal(serverSeo.resolveDetailPath(exportUsedCar), '/used-cars/detail.html');
});

test('client display and SEO titles use the export used-car channel', () => {
  const sandbox = { window: {}, console };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'half-cut-title.js'), 'utf8'),
    sandbox,
  );
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '..', 'js', 'engine-card-label.js'), 'utf8'),
    sandbox,
  );

  const clientTitle = sandbox.window.HalfCutTitle.buildDisplayTitle(exportUsedCar, 'en');
  const clientSeo = sandbox.window.EngineCardLabel.formatHalfCutSeoTitle(exportUsedCar);
  const clientH1 = sandbox.window.EngineCardLabel.formatHalfCutDetailH1(exportUsedCar);

  assert.equal(clientTitle, '2024 Toyota Camry A25A-FKS 8AT 2WD — Export Used Car');
  assert.doesNotMatch(clientSeo, /half[ -]?cut|front[ -]?cut|半截|半切/i);
  assert.doesNotMatch(clientH1, /half[ -]?cut|front[ -]?cut|半截|半切/i);
  assert.match(clientSeo, /Export Used Car/);
  assert.match(clientH1, /Export Used Car/);
});

test('public export used-car payload strips dismantling content and exposes evidence-gated status', () => {
  const item = serverPublic.toPublicItem(exportUsedCar);
  assert.equal(item.exportVehicleIdentity, 'complete_used_vehicle');
  assert.equal(item.exportSupplierDeclaration, true);
  assert.equal(item.exportDocumentationStatus, 'pending_verification');
  assert.deepEqual(item.includedParts, []);
  assert.doesNotMatch(
    [item.title, item.shortDescription, ...(item.includedParts || [])].join(' '),
    /half[ -]?cut|front[ -]?cut|engine & gearbox assembly|wiring harness|radiator pack|半截|半切/i,
  );
});

test('server-rendered used-car detail is isolated from half-cut merchandising', () => {
  const html = serverSeo.buildDetailRootHtml(exportUsedCar, 'https://asia-power.com');
  assert.match(html, /Complete vehicle &amp; export status/);
  assert.match(html, /AsiaPower document review pending/);
  assert.match(html, /All Export Used Cars/);
  assert.doesNotMatch(html, /Engine &amp; gearbox assembly|Front clip|Wiring harness|Radiator pack|Included Parts|Half-Cut Listings|All Half Cuts/i);
});

test('recent export used-car migration and audit correct category drift without claiming verified documents', async () => {
  const { migrateRecentExportUsedCars } = await import('../scripts/migrate-recent-export-used-cars.mjs');
  const { auditRecentExportUsedCars } = await import('../scripts/audit-recent-export-used-cars.mjs');
  const submission = {
    id: 'SUB-1',
    brand: 'BYD',
    model: 'Yuan Plus',
    year: 2026,
    vehicleListingType: 'scrap',
    vehicleCondition: 'Running Vehicle',
    notes: '可整车出口',
    includedParts: ['Front clip'],
  };
  const approved = [{
    ...submission,
    id: undefined,
    stockId: 'HC250638',
    submissionId: 'SUB-1',
    approvedAt: '2026-08-07T22:42:23.975Z',
    isExportUsedCar: true,
    slug: '2026-byd-yuan-plus-ev-half-cut',
    title: '2026 BYD Yuan Plus EV Half Cut',
  }];
  const migrated = migrateRecentExportUsedCars({
    approved,
    submissions: [submission],
    brand: 'BYD',
    since: '2026-08-02T00:00:00Z',
  });
  assert.equal(migrated.report.matched, 1);
  assert.equal(migrated.approved[0].vehicleListingType, 'used');
  assert.equal(migrated.approved[0].exportDocumentationStatus, 'pending_verification');
  assert.deepEqual(migrated.approved[0].includedParts, []);
  assert.match(migrated.approved[0].slug, /-export-used-car-/);
  assert.ok(migrated.approved[0].slugAliases.includes('2026-byd-yuan-plus-ev-half-cut'));
  const report = auditRecentExportUsedCars(migrated.approved, {
    brand: 'BYD',
    since: '2026-08-02T00:00:00Z',
  });
  assert.equal(report.failed, 0);
  assert.equal(report.passed, 1);
});

test('BYD sub-brands cannot remain truck cabs when VIN and whole-vehicle export evidence are present', () => {
  for (const brand of ['腾势', '方程豹', 'Denza', 'Fangchengbao']) {
    const normalized = vehicleNameNormalize.normalizeListingMeta({
      brand,
      model: brand === '腾势' ? '腾势D9' : '豹5',
      vin: 'LC0TEST1234567890',
      vehicleCategory: 'truck',
      truckPartType: 'cab',
      vehicleCondition: 'Driver Cab',
      vehicleListingType: 'used',
      remarks: '可整车出口',
      includedParts: ['Engine & gearbox assembly', 'Front clip'],
    });
    assert.equal(normalized.vehicleCategory, 'passenger');
    assert.equal(normalized.truckPartType, '');
    assert.equal(normalized.vehicleCondition, 'Running Vehicle');
    assert.equal(normalized.isExportUsedCar, true);
    assert.equal(normalized.exportVehicleIdentity, 'complete_used_vehicle');
    assert.equal(normalized.exportDocumentationStatus, 'pending_verification');
    assert.deepEqual(normalized.includedParts, []);
  }
});

test('BYD family migration includes Denza and Fangchengbao and clears truck merchandising', async () => {
  const { migrateRecentExportUsedCars } = await import('../scripts/migrate-recent-export-used-cars.mjs');
  const { auditRecentExportUsedCars } = await import('../scripts/audit-recent-export-used-cars.mjs');
  const approved = ['腾势', '方程豹'].map((brand, index) => ({
    stockId: `HC-SUBBRAND-${index + 1}`,
    submissionId: `SUB-SUBBRAND-${index + 1}`,
    approvedAt: '2026-08-09T22:22:00.000Z',
    brand,
    model: index ? '豹5' : '腾势D9',
    year: 2026,
    vin: `LC0SUBBRAND00000${index}`,
    vehicleCategory: 'truck',
    truckPartType: 'cab',
    vehicleCondition: 'Driver Cab',
    vehicleListingType: 'used',
    remarks: '可整车出口',
    includedParts: ['Front clip'],
    slug: `legacy-truck-cab-${index + 1}`,
  }));
  const submissions = approved.map((item) => ({ ...item, id: item.submissionId }));
  const migrated = migrateRecentExportUsedCars({
    approved,
    submissions,
    brand: 'BYD',
    since: '2026-08-09T00:00:00Z',
  });
  assert.equal(migrated.report.matched, 2);
  assert.deepEqual(migrated.approved.map((item) => item.vehicleCategory), ['passenger', 'passenger']);
  assert.deepEqual(migrated.approved.map((item) => item.truckPartType), ['', '']);
  assert.match(migrated.approved[0].slug, /^denza-/);
  assert.match(migrated.approved[1].slug, /^fangchengbao-/);
  const report = auditRecentExportUsedCars(migrated.approved, {
    brand: 'BYD',
    since: '2026-08-09T00:00:00Z',
  });
  assert.equal(report.matched, 2);
  assert.equal(report.failed, 0);
});

test('used-car catalog chrome cannot be overwritten with half-cut or truck inquiry copy', () => {
  const layoutSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'ebay-layout.js'), 'utf8');
  const componentsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'components.js'), 'utf8');
  const detailSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'half-cut-detail.js'), 'utf8');
  const i18nSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'public-i18n.js'), 'utf8');
  const catalogHtml = fs.readFileSync(path.join(__dirname, '..', 'half-cuts', 'index.html'), 'utf8');
  assert.match(layoutSource, /cat === 'used-cars' \? 'Export Used Cars' : 'Half-Cuts'/);
  assert.match(layoutSource, /Export Used Cars from China/);
  assert.match(componentsSource, /Export document review/);
  assert.match(componentsSource, /VIN, mileage and export requirements confirmed before contract and shipment/);
  assert.match(componentsSource, /I am interested in an export used car/);
  assert.match(detailSource, /Export Used Car\\b\/gi/);
  assert.match(detailSource, /hc\.usedCarCompleteListing/);
  assert.match(i18nSource, /meta\.usedCars\.title/);
  assert.match(i18nSource, /params\.get\('cat'\) === 'used-cars'/);
  assert.match(catalogHtml, /path-utils\.js\?v=site-media-brand-identity-v2-20260822/);
  assert.match(catalogHtml, /components\.js\?v=site-media-brand-identity-v2-20260822/);
});
