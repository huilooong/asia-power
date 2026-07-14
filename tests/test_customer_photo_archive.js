'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  retainOrDiscardPhoto,
  archiveDir,
  loadManifest,
} = require('../server/lib/customer-photo-archive.js');

async function writeTmpJpeg(dir, name, label) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, Buffer.from(`fake-jpeg-${label}`));
  return p;
}

test('VIN photo is retained and recorded in manifest', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-arch-'));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-tmp-'));
  const tmpPath = await writeTmpJpeg(tmpDir, 'a.jpg', 'vin1');

  const result = await retainOrDiscardPhoto({
    workspace,
    customerId: 'wa:8613800138000',
    tmpPath,
    hasVin: true,
    vin: 'JTDBT923X01234567',
    sourceLine: '+86',
    ext: 'jpg',
    optimizeImageBuffer: async () => null,
  });

  assert.equal(result.kept, true);
  assert.ok(!fs.existsSync(tmpPath), 'tmp should be consumed');
  const dir = archiveDir(workspace, 'wa:8613800138000');
  const manifest = await loadManifest(dir);
  assert.equal(manifest.photos.length, 1);
  assert.equal(manifest.photos[0].has_vin, true);
  assert.equal(manifest.photos[0].vin, 'JTDBT923X01234567');
  assert.ok(fs.existsSync(path.join(dir, manifest.photos[0].filename)));
});

test('over cap prefers evicting oldest non-VIN', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-arch-'));
  const customerId = 'wa:233591196641';
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-tmp-'));
  process.env.APSALES_CUSTOMER_PHOTO_MAX = '3';

  const noopOpt = async () => null;
  const seed = [false, true, false];
  for (let i = 0; i < seed.length; i += 1) {
    const hasVin = seed[i];
    const tmpPath = await writeTmpJpeg(tmpRoot, `p${i}.jpg`, `n${i}`);
    await retainOrDiscardPhoto({
      workspace,
      customerId,
      tmpPath,
      hasVin,
      vin: hasVin ? `VIN${i}XXXXXXXXXXXX` : null,
      sourceLine: '+233',
      ext: 'jpg',
      optimizeImageBuffer: noopOpt,
    });
    await new Promise((r) => setTimeout(r, 5));
  }

  const dir = archiveDir(workspace, customerId);
  let manifest = await loadManifest(dir);
  assert.equal(manifest.photos.length, 3);

  const fourth = await writeTmpJpeg(tmpRoot, 'p4.jpg', 'vin-new');
  const res = await retainOrDiscardPhoto({
    workspace,
    customerId,
    tmpPath: fourth,
    hasVin: true,
    vin: 'NEWINCOMINGVINXXXX',
    sourceLine: '+233',
    ext: 'jpg',
    optimizeImageBuffer: noopOpt,
  });
  assert.equal(res.kept, true);
  assert.ok(res.evicted);
  assert.equal(res.evicted.has_vin, false, 'should evict a non-VIN photo first');

  manifest = await loadManifest(dir);
  assert.equal(manifest.photos.length, 3);
  assert.ok(manifest.photos.some((p) => p.vin === 'NEWINCOMINGVINXXXX'));
  assert.ok(manifest.photos.some((p) => p.has_vin === true && p.vin?.startsWith('VIN')));
  const nonVinCount = manifest.photos.filter((p) => !p.has_vin).length;
  assert.equal(nonVinCount, 1, 'one of the two non-VIN should remain');
});

test('all-VIN over cap evicts oldest VIN', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-arch-'));
  const customerId = 'wa:19402375223';
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-tmp-'));
  process.env.APSALES_CUSTOMER_PHOTO_MAX = '3';
  const noopOpt = async () => null;

  for (let i = 0; i < 3; i += 1) {
    const tmpPath = await writeTmpJpeg(tmpRoot, `v${i}.jpg`, `vin${i}`);
    await retainOrDiscardPhoto({
      workspace,
      customerId,
      tmpPath,
      hasVin: true,
      vin: `ALLVIN${i}XXXXXXXXXXX`,
      sourceLine: '+86',
      ext: 'jpg',
      optimizeImageBuffer: noopOpt,
    });
    await new Promise((r) => setTimeout(r, 5));
  }

  const fourth = await writeTmpJpeg(tmpRoot, 'v3.jpg', 'vin3');
  const res = await retainOrDiscardPhoto({
    workspace,
    customerId,
    tmpPath: fourth,
    hasVin: true,
    vin: 'ALLVIN3XXXXXXXXXXX',
    sourceLine: '+86',
    ext: 'jpg',
    optimizeImageBuffer: noopOpt,
  });
  assert.equal(res.kept, true);
  assert.equal(res.evicted?.vin, 'ALLVIN0XXXXXXXXXXX');

  const manifest = await loadManifest(archiveDir(workspace, customerId));
  assert.equal(manifest.photos.length, 3);
  assert.ok(!manifest.photos.some((p) => p.vin === 'ALLVIN0XXXXXXXXXXX'));
  assert.ok(manifest.photos.some((p) => p.vin === 'ALLVIN3XXXXXXXXXXX'));
});

test('non-VIN discarded when already at cap with VIN photos', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-arch-'));
  const customerId = 'wa:8610000000000';
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-tmp-'));
  process.env.APSALES_CUSTOMER_PHOTO_MAX = '2';
  const noopOpt = async () => null;

  for (let i = 0; i < 2; i += 1) {
    await retainOrDiscardPhoto({
      workspace,
      customerId,
      tmpPath: await writeTmpJpeg(tmpRoot, `k${i}.jpg`, `k${i}`),
      hasVin: true,
      vin: `KEEP${i}XXXXXXXXXXXX`,
      sourceLine: '+86',
      ext: 'jpg',
      optimizeImageBuffer: noopOpt,
    });
  }

  const junk = await writeTmpJpeg(tmpRoot, 'junk.jpg', 'junk');
  const res = await retainOrDiscardPhoto({
    workspace,
    customerId,
    tmpPath: junk,
    hasVin: false,
    vin: null,
    sourceLine: '+86',
    ext: 'jpg',
    optimizeImageBuffer: noopOpt,
  });
  assert.equal(res.kept, false);
  assert.ok(!fs.existsSync(junk));
  const manifest = await loadManifest(archiveDir(workspace, customerId));
  assert.equal(manifest.photos.length, 2);
  assert.ok(manifest.photos.every((p) => p.has_vin));
});

test('optimize null falls back to original image (never drops)', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-arch-'));
  const tmpPath = await writeTmpJpeg(fs.mkdtempSync(path.join(os.tmpdir(), 'photo-tmp-')), 'raw.jpg', 'raw');
  const res = await retainOrDiscardPhoto({
    workspace,
    customerId: 'wa:1',
    tmpPath,
    hasVin: true,
    vin: 'FALLBACKVINXXXXXXXX',
    sourceLine: '+86',
    ext: 'jpg',
    optimizeImageBuffer: async () => null,
  });
  assert.equal(res.kept, true);
  assert.match(res.entry.filename, /\.jpg$/);
  assert.equal(res.entry.thumb_filename, null);
  assert.ok(fs.existsSync(res.archivedPath));
});

test('optimize success writes _full.webp + _thumb.webp and manifest thumb_filename', async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-arch-'));
  const tmpPath = await writeTmpJpeg(fs.mkdtempSync(path.join(os.tmpdir(), 'photo-tmp-')), 'raw.jpg', 'raw');
  const res = await retainOrDiscardPhoto({
    workspace,
    customerId: 'wa:2',
    tmpPath,
    hasVin: true,
    vin: 'WEBPVINXXXXXXXXXXXX',
    sourceLine: '+233',
    ext: 'jpg',
    optimizeImageBuffer: async () => ({
      full: Buffer.from('full-webp'),
      thumb: Buffer.from('thumb-webp'),
      fullMime: 'image/webp',
      thumbMime: 'image/webp',
    }),
  });
  assert.equal(res.kept, true);
  assert.match(res.entry.filename, /_full\.webp$/);
  assert.match(res.entry.thumb_filename, /_thumb\.webp$/);
  const dir = archiveDir(workspace, 'wa:2');
  assert.ok(fs.existsSync(path.join(dir, res.entry.filename)));
  assert.ok(fs.existsSync(path.join(dir, res.entry.thumb_filename)));
  const manifest = await loadManifest(dir);
  assert.equal(manifest.photos[0].thumb_filename, res.entry.thumb_filename);
});
