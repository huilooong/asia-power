'use strict';

/**
 * Customer photo retention (Phase 1c).
 * Keep VIN-bearing photos; max APSALES_CUSTOMER_PHOTO_MAX (default 3).
 * Prefer evicting oldest non-VIN; if all have VIN, evict oldest.
 * Compress via media-optimize; on failure keep original — never drop for compress fail.
 */

const fs = require('fs/promises');
const fssync = require('fs');
const path = require('path');

function maxKeptPhotos() {
  const n = Number.parseInt(process.env.APSALES_CUSTOMER_PHOTO_MAX || '3', 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

function archiveDir(workspace, customerId) {
  const id = String(customerId || 'wa:unknown').replace(/[^\w:.-]/g, '_');
  return path.join(workspace, 'memory', 'customer_gateway', 'customer_photos', id);
}

async function loadManifest(dir) {
  try {
    const data = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
    if (!data || !Array.isArray(data.photos)) return { photos: [] };
    return data;
  } catch {
    return { photos: [] };
  }
}

async function saveManifest(dir, manifest) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function unlinkQuiet(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
    /* ignore */
  }
}

async function defaultOptimize(buffer, mime) {
  try {
    const { optimizeImageBuffer } = require('./media-optimize');
    return await optimizeImageBuffer(buffer, mime);
  } catch {
    return null;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.workspace
 * @param {string} opts.customerId wa:<digits>
 * @param {string} opts.tmpPath
 * @param {boolean} opts.hasVin
 * @param {string|null} [opts.vin]
 * @param {string} [opts.sourceLine]
 * @param {string} [opts.ext]
 * @param {function} [opts.optimizeImageBuffer] injectable for tests
 */
async function retainOrDiscardPhoto(opts = {}) {
  const workspace = opts.workspace;
  const tmpPath = opts.tmpPath;
  const hasVin = Boolean(opts.hasVin);
  const maxKeep = maxKeptPhotos();
  const optimize = opts.optimizeImageBuffer || defaultOptimize;
  const ext = String(opts.ext || 'jpg').replace(/^\./, '') || 'jpg';

  if (!workspace || !tmpPath || !fssync.existsSync(tmpPath)) {
    return { kept: false, reason: 'missing_tmp' };
  }

  const dir = archiveDir(workspace, opts.customerId);
  const manifest = await loadManifest(dir);

  // VIN always eligible; non-VIN only while under cap.
  const shouldKeep = hasVin || manifest.photos.length < maxKeep;
  if (!shouldKeep) {
    await unlinkQuiet(tmpPath);
    return { kept: false, reason: 'over_cap_no_vin' };
  }

  let evicted = null;
  if (manifest.photos.length >= maxKeep) {
    // Prefer oldest non-VIN (first match in chronological append order); else oldest overall.
    const idx = manifest.photos.findIndex((p) => !p.has_vin);
    const evictIdx = idx >= 0 ? idx : 0;
    const [removed] = manifest.photos.splice(evictIdx, 1);
    evicted = removed || null;
    if (removed) {
      await unlinkQuiet(path.join(dir, removed.filename));
      if (removed.thumb_filename) {
        await unlinkQuiet(path.join(dir, removed.thumb_filename));
      }
    }
  }

  await fs.mkdir(dir, { recursive: true });
  const stamp = Date.now();
  const baseName = `${stamp}-${hasVin ? 'vin' : 'photo'}`;

  const rawBuffer = await fs.readFile(tmpPath);
  const mime = ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
  const optimized = await optimize(rawBuffer, mime);

  let filename;
  let thumbFilename = null;
  if (optimized?.full?.length && optimized?.thumb?.length) {
    filename = `${baseName}_full.webp`;
    thumbFilename = `${baseName}_thumb.webp`;
    await fs.writeFile(path.join(dir, filename), optimized.full);
    await fs.writeFile(path.join(dir, thumbFilename), optimized.thumb);
    await unlinkQuiet(tmpPath);
  } else {
    filename = `${baseName}.${ext}`;
    const dest = path.join(dir, filename);
    try {
      await fs.rename(tmpPath, dest);
    } catch {
      await fs.copyFile(tmpPath, dest);
      await unlinkQuiet(tmpPath);
    }
  }

  const entry = {
    filename,
    thumb_filename: thumbFilename,
    has_vin: hasVin,
    vin: hasVin ? (opts.vin || null) : null,
    source_line: opts.sourceLine || null,
    kept_at: new Date().toISOString(),
  };
  manifest.photos.push(entry);
  await saveManifest(dir, manifest);

  return {
    kept: true,
    archivedPath: path.join(dir, filename),
    entry,
    evicted,
  };
}

module.exports = {
  retainOrDiscardPhoto,
  archiveDir,
  loadManifest,
  maxKeptPhotos,
};
