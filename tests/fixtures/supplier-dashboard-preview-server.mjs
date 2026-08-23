#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = Number(process.env.PORT || 8793);
let approved = JSON.parse(fs.readFileSync(path.join(root, 'data', 'half-cut-approved.json'), 'utf8'));
if (!approved.length) {
  const response = await fetch('https://asia-power.com/api/half-cuts/public');
  if (!response.ok) throw new Error(`Public inventory unavailable (${response.status})`);
  approved = (await response.json()).approved || [];
}
const selected = approved.find((item) => Array.isArray(item.photos) && item.photos.length >= 3) || approved[0];
if (!selected) throw new Error('No approved inventory fixture available');

function supplierItem(item) {
  const photos = (item.photos || []).map((photo) => typeof photo === 'string' ? { url: photo } : photo);
  return {
    id: item.stockId,
    stockId: item.stockId,
    submissionId: item.submissionId || '',
    slug: item.slug || '',
    title: item.title || [item.brand, item.model, item.year].filter(Boolean).join(' '),
    brand: item.brand || '', model: item.model || '', year: item.year || '', vin: item.vin || '',
    engineCode: item.engineCode || '', transmissionCode: item.transmissionCode || '',
    drivetrain: item.drivetrain || '', mileage: item.mileage || '', priceUsd: item.priceUsd,
    shortDescription: item.shortDescription || '', notes: item.notes || '',
    inventoryStatus: item.status || item.inventoryStatus || 'Available',
    listingVisibility: item.listingVisibility || 'public', reviewStatus: 'approved', source: 'approved',
    vehicleCategory: item.vehicleCategory || '', vehicleListingType: item.vehicleListingType || '',
    photos, photo: photos[0]?.thumbUrl || photos[0]?.url || '',
    video: item.video || (item.videoUrl ? { url: item.videoUrl, fileName: 'video' } : null),
    activeRevision: null, evidenceCount: 0,
  };
}

const item = supplierItem(selected);
const supplier = {
  id: selected.supplierId || 'preview-supplier', role: 'supplier',
  supplierName: selected.supplierName || '供应商预览账户', profileComplete: true,
  phone: '', phoneNormalized: '', missingFields: [],
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function mime(file) {
  return ({ '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.mp4':'video/mp4', '.woff2':'font/woff2' })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/me') return sendJson(res, 200, { user: supplier, needsProfile: false });
  if (url.pathname === '/api/half-cuts/my-uploads') return sendJson(res, 200, {
    ok: true, supplier, counts: { total: 1, approved: 1, pending: 0, rejected: 0, delisted: 0 }, items: [item],
  });
  const detail = url.pathname.match(/^\/api\/half-cuts\/my-uploads\/([^/]+)$/);
  if (detail) return sendJson(res, 200, { ok: true, kind: 'approved', item, publishedItem: item, evidence: [], audit: [] });
  if (url.pathname.startsWith('/api/')) return sendJson(res, 405, { error: 'Preview server is read-only' });
  if (url.pathname.startsWith('/uploads/')) {
    fetch(`https://asia-power.com${url.pathname}${url.search}`).then(async (upstream) => {
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(Buffer.from(await upstream.arrayBuffer()));
    }).catch(() => { res.writeHead(502); res.end('Upstream media unavailable'); });
    return;
  }
  const requested = url.pathname === '/' ? '/supplier-portal/dashboard.html' : url.pathname;
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`Supplier dashboard read-only preview: http://127.0.0.1:${port}/supplier-portal/dashboard.html`);
});
