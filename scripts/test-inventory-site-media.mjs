/**
 * Production-like media upload tests (inventory-site server on :8080)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_ROOT = path.join(__dirname, '..', 'deploy', 'test-run');
const BASE = process.env.INVENTORY_SITE_BASE || 'http://127.0.0.1:8080';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const tinyMp4 = Buffer.from(
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAA',
  'base64'
);

async function uploadMultipart(endpoint, filename, mime, body, extraFields = []) {
  const boundary = '----AsiaPowerProdTest';
  const chunks = extraFields.map(
    ([name, value]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
  );
  chunks.push(
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`),
    body,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  );
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(chunks),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${endpoint} failed (${res.status})`);
  return data;
}

async function main() {
  const health = await fetch(`${BASE}/api/half-cuts/health`);
  if (!health.ok) throw new Error('Health check failed — run: node scripts/start-inventory-site-local.mjs');
  const healthData = await health.json();
  if (!healthData.ok || !healthData.uploads) throw new Error('Unexpected health payload');

  const photo = await uploadMultipart('/api/half-cuts/upload/photo', 'test.png', 'image/png', tinyPng, [
    ['label', 'Vehicle Front'],
  ]);
  if (!photo.url?.startsWith('/uploads/photos/')) throw new Error('bad photo url');

  const photoDisk = path.join(TEST_ROOT, photo.url.replace(/^\//, ''));
  if (!fs.existsSync(photoDisk)) throw new Error(`photo missing on disk: ${photoDisk}`);

  const photoGet = await fetch(`${BASE}${photo.url}`);
  if (!photoGet.ok) throw new Error('GET /uploads/photos/ failed');

  const video = await uploadMultipart('/api/half-cuts/upload/video', 'test.mp4', 'video/mp4', tinyMp4);
  if (!video.url?.startsWith('/uploads/videos/')) throw new Error('bad video url');

  const videoDisk = path.join(TEST_ROOT, video.url.replace(/^\//, ''));
  if (!fs.existsSync(videoDisk)) throw new Error(`video missing on disk: ${videoDisk}`);

  const videoGet = await fetch(`${BASE}${video.url}`);
  if (!videoGet.ok) throw new Error('GET /uploads/videos/ failed');

  const stateRes = await fetch(`${BASE}/api/half-cuts/state`);
  const state = await stateRes.json();

  const payload = {
    submissions: [{
      submissionId: 'SUB-PROD-TEST',
      reviewStatus: 'pending',
      vin: 'MR0BA3CD500123456',
      brand: 'Toyota',
      brandSlug: 'toyota',
      model: 'Test',
      year: 2022,
      mileage: '1000',
      supplierName: 'Test',
      supplierPhone: '+1',
      photos: [{ label: 'Vehicle Front', url: photo.url }],
      video: { url: video.url, fileName: 'test.mp4', mimeType: 'video/mp4' },
      videoUrl: video.url,
      decodeMethod: 'Manual Entry',
      vehicleCondition: 'Half Cut',
      inventoryStatus: 'Available',
      createdAt: new Date().toISOString(),
    }],
    approved: state.approved || [],
  };

  const put = await fetch(`${BASE}/api/half-cuts/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const putData = await put.json();
  if (!put.ok) throw new Error(putData.error || 'state save failed');
  if (JSON.stringify(putData).includes('base64')) throw new Error('base64 leaked into saved state');

  const badPut = await fetch(`${BASE}/api/half-cuts/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submissions: [{ photos: [{ url: 'data:image/png;base64,abc' }] }],
      approved: [],
    }),
  });
  const badData = await badPut.json();
  if (badPut.ok) throw new Error('Base64 state should be rejected');
  if (!/base64/i.test(badData.error || '')) throw new Error('Expected Base64 rejection error');

  const items = await fetch(`${BASE}/api/items`);
  if (!items.ok) throw new Error('Existing /api/items broken after merge');

  console.log('PASS — GET /api/half-cuts/health');
  console.log('PASS — POST /api/half-cuts/upload/photo');
  console.log('PASS — POST /api/half-cuts/upload/video');
  console.log('PASS — GET /uploads/photos/...');
  console.log('PASS — GET /uploads/videos/...');
  console.log('PASS — PUT /api/half-cuts/state (URL-only)');
  console.log('PASS — Base64 rejected in JSON state');
  console.log('PASS — Existing /api/items still works');
  console.log(`  Photo URL: ${photo.url}`);
  console.log(`  Video URL: ${video.url}`);
  console.log(`  Storage root: ${TEST_ROOT}`);
}

main().catch((err) => {
  console.error('FAIL —', err.message);
  process.exit(1);
});
