'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHalfCutApi } = require('../server/lib/half-cut-api');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapower-supplier-revision-'));
  const data = path.join(root, 'data');
  const publicPhotos = path.join(root, 'uploads', 'photos');
  const pendingPhotos = path.join(root, 'uploads', 'pending', 'photos');
  fs.mkdirSync(publicPhotos, { recursive: true });
  fs.mkdirSync(pendingPhotos, { recursive: true });
  fs.writeFileSync(path.join(publicPhotos, 'old.jpg'), Buffer.from('old-public-photo'));
  fs.writeFileSync(path.join(pendingPhotos, 'new.jpg'), Buffer.from('new-pending-photo'));
  writeJson(path.join(data, 'half-cut-approved.json'), [{
    stockId: 'HC900001',
    slug: '2020-toyota-land-cruiser-hc900001',
    submissionId: 'SUB-900001',
    supplierId: 'sup-owned',
    supplierName: 'Owned Supplier',
    supplierPhone: '16638801930',
    supplierPhoneNormalized: '8616638801930',
    brand: 'Toyota',
    brandSlug: 'toyota',
    model: 'Land Cruiser',
    year: 2020,
    vin: 'JT123456789012345',
    engineCode: '1VD-FTV',
    transmissionCode: 'AB60F',
    drivetrain: '4WD',
    mileage: '20,000 km',
    priceUsd: 10000,
    status: 'Available',
    listingVisibility: 'public',
    photos: [{ url: '/uploads/photos/old.jpg' }],
    approvedAt: '2026-01-01T00:00:00.000Z',
  }]);
  writeJson(path.join(data, 'half-cut-submissions.json'), []);
  const api = createHalfCutApi(root, {
    auth: { authUser: () => null, allowUpload: () => true, requireAdmin: () => true },
  });
  api.ensureDirs();
  return { root, api };
}

test('supplier immediate fields publish now while critical fields wait for review', async (t) => {
  const { root, api } = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const supplier = {
    id: 'sup-owned', role: 'supplier', supplierName: 'Owned Supplier',
    phone: '16638801930', phoneNormalized: '8616638801930',
  };

  const result = api.updateOwnUpload(supplier, 'HC900001', {
    action: 'submit-review',
    immediate: { priceUsd: 11000, inventoryStatus: 'Reserved' },
    proposed: {
      brand: 'HONDA',
      photos: [{ url: '/uploads/pending/photos/new.jpg' }],
    },
  });

  assert.equal(result.publishedItem.priceUsd, 11000);
  assert.equal(result.publishedItem.inventoryStatus, 'Reserved');
  assert.ok(result.revision?.submissionId);
  assert.equal(result.revision.reviewStatus, 'pending');

  const beforeApproval = JSON.parse(fs.readFileSync(path.join(root, 'data', 'half-cut-approved.json')))[0];
  assert.notEqual(beforeApproval.brand, 'HONDA');
  assert.equal(beforeApproval.photos[0].url, '/uploads/photos/old.jpg');
  const revision = JSON.parse(fs.readFileSync(path.join(root, 'data', 'half-cut-submissions.json')))[0];
  assert.equal(revision.submissionKind, 'inventory-revision');
  assert.deepEqual(revision.revisionChanges.map((change) => change.field).sort(), ['brand', 'photos']);

  api.updateOwnUpload(supplier, 'HC900001', {
    action: 'submit-review', immediate: { priceUsd: 11500 }, proposed: {},
  });
  const revisionAfterImmediateEdit = JSON.parse(fs.readFileSync(path.join(root, 'data', 'half-cut-submissions.json')))[0];
  assert.equal(revisionAfterImmediateEdit.brand, 'HONDA', 'later immediate edits must not overwrite the pending revision');
  assert.equal(revisionAfterImmediateEdit.photos[0].url, '/uploads/pending/photos/new.jpg');

  const approved = await api.approveSubmissionById(revision.submissionId, {});
  assert.equal(approved.revision, true);
  assert.equal(approved.inventoryItem.priceUsd, 11500, 'approval must preserve latest immediate price');
  assert.equal(approved.inventoryItem.status, 'Reserved', 'approval must preserve latest immediate status');
  assert.equal(approved.inventoryItem.brand, 'HONDA');
  assert.equal(approved.inventoryItem.photos[0].url, '/uploads/photos/new.jpg');
  assert.equal(fs.existsSync(path.join(root, 'uploads', 'photos', 'old.jpg')), false, 'old public copy is removed after private archive succeeds');

  const evidence = api.evidenceArchive.listForStock('HC900001');
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].kind, 'photo');
  assert.equal(evidence[0].available, true);
  const audit = api.auditLog.listForStock('HC900001');
  assert.ok(audit.some((event) => event.type === 'inventory_revision_approved'));
  assert.ok(audit.some((event) => event.field === 'priceUsd'));
  assert.ok(audit.some((event) => event.field === 'status'));
});

test('ownership is enforced and safe delist removes public catalog/detail without deleting data', async (t) => {
  const { root, api } = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const owner = { id: 'sup-owned', role: 'supplier', supplierName: 'Owned Supplier' };
  const other = { id: 'sup-other', role: 'supplier', supplierName: 'Other Supplier' };

  assert.throws(() => api.updateOwnUpload(other, 'HC900001', {
    immediate: { priceUsd: 1 }, proposed: {},
  }), /not owned/i);

  api.updateOwnUpload(owner, 'HC900001', {
    action: 'submit-review', immediate: { listingVisibility: 'delisted' }, proposed: {},
  });
  const stored = JSON.parse(fs.readFileSync(path.join(root, 'data', 'half-cut-approved.json')))[0];
  assert.equal(stored.listingVisibility, 'delisted');
  assert.equal(fs.existsSync(path.join(root, 'uploads', 'photos', 'old.jpg')), true, 'delist does not delete media');
  assert.equal((await api.getPublicCatalog()).approved.length, 0);
  assert.equal(await api.getPublicItemBySlug(stored.slug), null);
});
