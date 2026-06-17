/**
 * Phase 2.1 local tests — VIN decode, masking, approval, public leak checks.
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

const sandbox = {
  window: {},
  document: { addEventListener: () => {} },
  localStorage,
  console,
  Date, Math, parseInt, JSON, Array, String, Number, Object, Map, Set,
};
sandbox.window = sandbox;

function load(relativePath) {
  vm.runInNewContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

[
  'js/half-cut-vin.js',
  'js/half-cut-upload-layer.js',
  'js/half-cut-review-layer.js',
  'js/half-cut-inventory-layer.js',
  'js/half-cut-directory.js',
  'js/half-cut-inventory-store.js',
].forEach(load);

sandbox.window.ASIAPOWER = { whatsapp: '8618603773077' };

const Vin = sandbox.window.HalfCutVin;
const Store = sandbox.window.HalfCutInventoryStore;
const Inventory = sandbox.window.HalfCutInventoryLayer;
const Utils = sandbox.window.HalfCutUtils;
const seedCount = sandbox.window.SEED_HALF_CUT_LIST.length;

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const mkPhotos = (n) => Vin.PHOTO_LABELS.slice(0, n).map((label) => ({ label, dataUrl: tinyPng }));

const tests = [];
function test(name, fn) {
  try {
    fn();
    tests.push({ name, ok: true });
  } catch (e) {
    tests.push({ name, ok: false, error: e.message });
  }
}

// 1. VIN decode success
test('VIN decode success flow', () => {
  const r = Vin.decodeVin('MR0BA3CD500123456');
  if (!r.success) throw new Error('decode should succeed');
  if (r.data.brand !== 'Toyota') throw new Error('brand mismatch');
  if (r.decodeMethod !== 'Auto Decoded') throw new Error('method mismatch');
});

// 2. VIN decode failure
test('VIN decode failure flow', () => {
  const r = Vin.decodeVin('ZZZZZZZZZZZZZZZZZ');
  if (r.success) throw new Error('decode should fail');
  if (!r.error.includes('unavailable')) throw new Error('expected unavailable message');
});

// 3. Manual entry submission
test('Manual entry flow', () => {
  localStorage.removeItem('halfCutSubmissions');
  localStorage.removeItem('halfCutApprovedInventory');
  const sub = Store.addSubmission({
    vin: 'ZZZZZZZZZZZZZZZZZ',
    supplierName: 'Test Supplier',
    supplierPhone: '+86 100',
    brand: 'Toyota',
    model: 'Custom Model',
    year: 2019,
    mileage: '55000',
    engineCode: '1GD',
    transmissionCode: '6AT',
    inventoryStatus: 'Available',
    decodeMethod: 'Manual Entry',
    vehicleCondition: 'Half Cut',
    photos: mkPhotos(3),
  });
  if (sub.decodeMethod !== 'Manual Entry') throw new Error('manual method');
});

// 4. Upload with 3 photos
test('Upload with 3 photos', () => {
  const v = Vin.validateVin('MR0BA3CD500123456');
  const sub = Store.addSubmission({
    vin: v.vin,
    supplierName: 'Guangzhou Yard',
    supplierPhone: '+86 138',
    brand: 'Toyota',
    model: 'Hilux Revo',
    year: 2022,
    mileage: '43000',
    engineCode: '2GD-FTV',
    transmissionCode: '6AT',
    inventoryStatus: 'Available',
    decodeMethod: 'Auto Decoded',
    decodedData: Vin.decodeVin(v.vin).data,
    vehicleCondition: 'Half Cut',
    photos: mkPhotos(3),
  });
  if (sub.photos.length !== 3) throw new Error('expected 3 photos');
});

// 5–6. Approval + brand classification
let approvedItem;
test('Approval flow + brand auto classification', () => {
  const pending = Store.getSubmissionsByStatus('pending');
  const last = pending[0];
  approvedItem = Store.approveSubmission(last.submissionId);
  if (!approvedItem) throw new Error('approval failed');
  if (approvedItem.brandSlug !== 'toyota') throw new Error('brandSlug not toyota');
  const toyota = sandbox.window.getHalfCutsByBrandSlug('toyota');
  if (!toyota.some((i) => i.stockId === approvedItem.stockId)) throw new Error('not on toyota brand list');
});

// 7. VIN masking
test('VIN masking on public pages', () => {
  const masked = Vin.maskVin('MR0BA3CD500123456');
  if (masked.includes('0123456') && !masked.includes('*')) throw new Error('middle not masked');
  if (!masked.startsWith('MR0BA3CD50')) throw new Error('first 10 wrong');
  if (!masked.endsWith('456')) throw new Error('last 3 wrong');
  const pub = Inventory.toPublicItem(approvedItem);
  if (pub.vin) throw new Error('full vin leaked on public item');
  if (!pub.maskedVin) throw new Error('maskedVin missing');
});

// 8. Full VIN in admin/submission store
test('Full VIN visible in admin submission data', () => {
  const sub = Store.getSubmissions().find((s) => s.submissionId === approvedItem.submissionId);
  if (!sub?.vin || sub.vin.length !== 17) throw new Error('full vin missing in submission');
});

// 9. Full VIN hidden from public HTML payload
test('Full VIN hidden from public HTML/JSON payloads', () => {
  const pub = sandbox.window.getHalfCutBySlug(approvedItem.slug);
  const json = JSON.stringify(pub);
  if (json.includes(approvedItem.vin)) throw new Error('full vin in public slug lookup');
  if (!Inventory.assertNoVinLeak(pub)) throw new Error('leak detector failed');
  const ld = Utils.productJsonLd(pub, 'https://example.com/detail');
  if (JSON.stringify(ld).includes(approvedItem.vin)) throw new Error('vin in JSON-LD');
});

// 10. WhatsApp excludes VIN
test('WhatsApp excludes VIN', () => {
  const internal = sandbox.window.getHalfCutBySlugInternal(approvedItem.slug);
  const msg = Utils.whatsappMessage(sandbox.window.getHalfCutBySlug(approvedItem.slug));
  if (Vin.containsFullVin(msg)) throw new Error('whatsapp contains full vin');
  if (!msg.includes(`Stock ID: ${internal.stockId}`)) throw new Error('stock id missing');
});

const failed = tests.filter((t) => !t.ok);
tests.forEach((t) => console.log(`${t.ok ? 'PASS' : 'FAIL'} — ${t.name}${t.error ? ': ' + t.error : ''}`));

if (failed.length) {
  process.exit(1);
}

console.log(`\nAll ${tests.length} Phase 2.1 tests passed.`);
console.log(`  Approved Stock ID: ${approvedItem.stockId}`);
console.log(`  Masked VIN: ${Vin.maskVin(approvedItem.vin)}`);
console.log(`  Total inventory: ${sandbox.window.HALF_CUT_LIST.length} (seed ${seedCount} + approved)`);
