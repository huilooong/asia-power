/**
 * Server-side media upload tests (requires local server on :8787)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = process.env.HALF_CUT_BASE || 'http://127.0.0.1:8787';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function uploadPhoto() {
  const boundary = '----AsiaPowerTest';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="label"\r\n\r\nVehicle Front\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`),
    tinyPng,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch(`${BASE}/api/half-cuts/upload/photo`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'photo upload failed');
  return data;
}

async function main() {
  const health = await fetch(`${BASE}/api/half-cuts/health`);
  if (!health.ok) throw new Error('Server health check failed — run node server/half-cut-local-server.js');

  const photo = await uploadPhoto();
  if (!photo.url?.startsWith('/uploads/photos/')) throw new Error('bad photo url');

  const diskPath = path.join(root, photo.url.replace(/^\//, ''));
  if (!fs.existsSync(diskPath)) throw new Error('photo file missing on disk');

  const stateRes = await fetch(`${BASE}/api/half-cuts/state`);
  const state = await stateRes.json();
  const payload = {
    submissions: [{
      submissionId: 'SUB-TEST',
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
      video: null,
      videoUrl: '',
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

  console.log('PASS — photo upload to server');
  console.log('PASS — photo file on disk');
  console.log('PASS — JSON state rejects/stores URL-only media');
  console.log(`  Photo URL: ${photo.url}`);
}

main().catch((err) => {
  console.error('FAIL —', err.message);
  process.exit(1);
});
