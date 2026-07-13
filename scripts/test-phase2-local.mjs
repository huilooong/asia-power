/**
 * Local Phase 2 smoke test — runs in Node with mocked browser APIs.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const storage = new Map();
const localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, v),
  removeItem: (k) => storage.delete(k),
};

function loadScript(relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: relativePath });
}

const sandbox = {
  window: {},
  document: { addEventListener: () => {} },
  localStorage,
  console,
  Date,
  Math,
  parseInt,
  JSON,
  Array,
  String,
  Number,
  Object,
  Map,
  Set,
};

sandbox.window = sandbox;
sandbox.window.ASIAPOWER = { whatsapp: '8616638801930' };

loadScript('js/half-cut-directory.js');
loadScript('js/half-cut-inventory-store.js');

const store = sandbox.window.HalfCutInventoryStore;
const seedCount = sandbox.window.HALF_CUT_LIST.length;

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const photos = store.PHOTO_LABELS.slice(0, 5).map((label) => ({ label, dataUrl: tinyPng }));

const submission = store.addSubmission({
  supplierName: 'Guangzhou Auto Parts Co.',
  supplierPhone: '+86 138 0000 0000',
  supplierWechat: '',
  supplierCity: 'Guangzhou',
  brand: 'Toyota',
  model: 'Hilux Revo',
  year: 2022,
  mileage: '43000',
  engineCode: '2GD-FTV',
  transmissionCode: '6AT',
  drivetrain: '4WD',
  originCountry: 'China',
  inventoryStatus: 'Available',
  includedParts: 'Engine & gearbox\nFront clip\nRadiator pack',
  notes: 'Complete Hilux Revo front half cut from verified yard.',
  videoUrl: '',
  photos,
});

const pending = store.getSubmissionsByStatus('pending');
if (pending.length !== 1) throw new Error(`Expected 1 pending submission, got ${pending.length}`);

const approved = store.approveSubmission(submission.submissionId);
if (!approved) throw new Error('Approval failed');

store.syncLiveInventory();

const list = sandbox.window.HALF_CUT_LIST;
if (list.length !== seedCount + 1) {
  throw new Error(`Expected ${seedCount + 1} inventory items, got ${list.length}`);
}

const bySlug = sandbox.window.getHalfCutBySlug(approved.slug);
if (!bySlug) throw new Error('Approved item not found by slug');
if (bySlug.brandSlug !== 'toyota') throw new Error(`Expected brandSlug toyota, got ${bySlug.brandSlug}`);
if (!bySlug.supplierVerified) throw new Error('supplierVerified should be true');
if (!bySlug.photos?.length) throw new Error('Photos missing on approved item');
if (!bySlug.mileage.includes('43')) throw new Error(`Mileage format wrong: ${bySlug.mileage}`);

const toyotaItems = sandbox.window.getHalfCutsByBrandSlug('toyota');
const found = toyotaItems.some((i) => i.stockId === approved.stockId);
if (!found) throw new Error('Approved Toyota item not in brand slug query');

const msg = sandbox.window.HalfCutUtils.whatsappMessage(bySlug);
if (!msg.includes(`Stock ID: ${approved.stockId}`)) throw new Error('WhatsApp message missing Stock ID');
if (!msg.includes('Destination country')) throw new Error('WhatsApp message missing destination prompt');

console.log('Phase 2 local smoke test passed');
console.log(`  Submission: ${submission.submissionId}`);
console.log(`  Stock ID: ${approved.stockId}`);
console.log(`  Slug: ${approved.slug}`);
console.log(`  Brand slug: ${approved.brandSlug}`);
console.log(`  Photos: ${approved.photos.length}`);
console.log(`  Total inventory: ${list.length}`);
