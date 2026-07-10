'use strict';

/**
 * AsiaPower inventory photo optimization (sharp).
 * Used by supplier multipart upload + optional promote/batch helpers.
 *
 * Strategy (quality-first, smaller files):
 * - Full: long edge ≤ 1920, WebP quality 82
 * - Thumb: long edge ≤ 640, WebP quality 72
 *
 * If sharp is unavailable, optimizeImageBuffer returns null so callers
 * can fall back to storing the original (upload still succeeds).
 */

const fs = require('fs');
const path = require('path');

const FULL_MAX_EDGE = 1920;
const THUMB_MAX_EDGE = 640;
const FULL_QUALITY = 82;
const THUMB_QUALITY = 72;

let sharpModule = null;
let sharpLoadAttempted = false;

function loadSharp() {
  if (sharpLoadAttempted) return sharpModule;
  sharpLoadAttempted = true;
  try {
    // optionalDependency — may be missing in bare local checkouts
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    sharpModule = require('sharp');
  } catch (err) {
    console.warn('[media-optimize] sharp unavailable:', err.message);
    sharpModule = null;
  }
  return sharpModule;
}

function stripVariantSuffix(filename) {
  return String(filename || '')
    .replace(/_full\.webp$/i, '.webp')
    .replace(/_thumb\.webp$/i, '.webp');
}

function fullWebpFilename(filename) {
  const base = stripVariantSuffix(filename).replace(/\.[^.]+$/, '');
  return `${base}_full.webp`;
}

function thumbWebpFilename(filename) {
  const base = stripVariantSuffix(filename).replace(/\.[^.]+$/, '');
  return `${base}_thumb.webp`;
}

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

async function encodeVariant(sharp, input, maxEdge, quality) {
  const image = sharp(input, { failOn: 'none' }).rotate();
  const meta = await image.metadata();
  const width = meta.width || maxEdge;
  const height = meta.height || maxEdge;
  let pipeline = image;
  if (width > maxEdge || height > maxEdge) {
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  const buffer = await pipeline
    .webp({ quality, effort: 4 })
    .toBuffer();
  return buffer;
}

/**
 * @param {Buffer} buffer
 * @param {string} [_mime]
 * @returns {Promise<{full:Buffer,fullMime:string,thumb:Buffer,thumbMime:string}|null>}
 */
async function optimizeImageBuffer(buffer, _mime) {
  if (!buffer?.length) return null;
  const sharp = loadSharp();
  if (!sharp) return null;

  try {
    const [full, thumb] = await Promise.all([
      encodeVariant(sharp, buffer, FULL_MAX_EDGE, FULL_QUALITY),
      encodeVariant(sharp, buffer, THUMB_MAX_EDGE, THUMB_QUALITY),
    ]);
    // Caller MUST fall back to the original upload when this returns null —
    // never drop the photo because WebP conversion failed.
    if (!full?.length || !thumb?.length) {
      console.warn('[media-optimize] optimizeImageBuffer empty variant — caller must keep original');
      return null;
    }
    return {
      full,
      fullMime: 'image/webp',
      thumb,
      thumbMime: 'image/webp',
    };
  } catch (err) {
    console.warn('[media-optimize] optimizeImageBuffer failed (keep original):', err.message);
    return null;
  }
}

function loadR2() {
  try {
    return require('./r2-storage');
  } catch {
    return null;
  }
}

async function readUploadBuffer(rootDir, uploadsRelativePath) {
  const clean = String(uploadsRelativePath || '').replace(/^\//, '');
  const diskPath = path.join(rootDir, clean);
  if (diskPath.startsWith(path.join(rootDir, 'uploads')) && fs.existsSync(diskPath)) {
    return { buffer: fs.readFileSync(diskPath), diskPath, key: clean };
  }
  const r2 = loadR2();
  if (r2?.isEnabled?.() && r2.getObjectBuffer) {
    const key = r2.objectKeyFromUploadsPath(`/${clean}`);
    const buffer = await r2.getObjectBuffer(key);
    if (buffer?.length) return { buffer, diskPath: null, key };
  }
  return null;
}

async function writeOptimizedPair(rootDir, kind, baseFilename, optimized) {
  const fullName = fullWebpFilename(baseFilename);
  const thumbName = thumbWebpFilename(baseFilename);
  const dir = path.join(rootDir, 'uploads', kind);
  fs.mkdirSync(dir, { recursive: true });
  const fullDisk = path.join(dir, fullName);
  const thumbDisk = path.join(dir, thumbName);
  fs.writeFileSync(fullDisk, optimized.full);
  fs.writeFileSync(thumbDisk, optimized.thumb);

  const r2 = loadR2();
  if (r2?.isEnabled?.()) {
    const pending = kind.includes('pending');
    await r2.putObjectBuffer(
      pending ? r2.pendingPhotoKey(fullName) : r2.publicPhotoKey(fullName),
      optimized.fullMime,
      optimized.full,
    );
    await r2.putObjectBuffer(
      pending ? r2.pendingPhotoKey(thumbName) : r2.publicPhotoKey(thumbName),
      optimized.thumbMime,
      optimized.thumb,
    );
  }

  const prefix = kind.includes('pending') ? '/uploads/pending/photos' : '/uploads/photos';
  return {
    url: `${prefix}/${fullName}`,
    thumbUrl: `${prefix}/${thumbName}`,
    fullName,
    thumbName,
  };
}

/**
 * Optimize a pending photo during approve/promote.
 * New supplier uploads already go through optimizeImageBuffer; this covers
 * any pending originals that still need WebP full+thumb variants.
 */
async function optimizePendingPhoto(rootDir, cleanPath) {
  const clean = String(cleanPath || '').split('?')[0];
  const filename = path.basename(clean);
  if (!filename) return null;

  // Already a full variant with sibling thumb — keep as-is.
  if (/_full\.webp$/i.test(filename)) {
    const base = stripVariantSuffix(filename);
    const thumbName = thumbWebpFilename(base);
    const thumbClean = clean.replace(/[^/]+$/, thumbName);
    const thumbExists = await readUploadBuffer(rootDir, thumbClean);
    if (thumbExists?.buffer?.length) {
      return {
        url: clean.startsWith('/') ? clean : `/${clean}`,
        thumbUrl: thumbClean.startsWith('/') ? thumbClean : `/${thumbClean}`,
      };
    }
  }

  const loaded = await readUploadBuffer(rootDir, clean);
  if (!loaded?.buffer?.length) return null;

  const mime = mimeFromExt(filename);
  const optimized = await optimizeImageBuffer(loaded.buffer, mime);
  if (!optimized) return null;

  const baseName = stripVariantSuffix(filename);
  return writeOptimizedPair(rootDir, 'pending/photos', baseName, optimized);
}

/**
 * Optional offline helper for approved public photos (manual script only).
 */
async function optimizePublicPhoto(rootDir, url) {
  const clean = String(url || '').split('?')[0].replace(/^\//, '');
  if (!clean.startsWith('uploads/photos/')) return null;
  const filename = path.basename(clean);
  if (/_thumb\.webp$/i.test(filename)) return null;

  if (/_full\.webp$/i.test(filename)) {
    const base = stripVariantSuffix(filename);
    const thumbName = thumbWebpFilename(base);
    return {
      url: `/${clean}`,
      thumbUrl: `/uploads/photos/${thumbName}`,
    };
  }

  const loaded = await readUploadBuffer(rootDir, clean);
  if (!loaded?.buffer?.length) return null;
  const optimized = await optimizeImageBuffer(loaded.buffer, mimeFromExt(filename));
  if (!optimized) return null;
  return writeOptimizedPair(rootDir, 'photos', stripVariantSuffix(filename), optimized);
}

module.exports = {
  FULL_MAX_EDGE,
  THUMB_MAX_EDGE,
  FULL_QUALITY,
  THUMB_QUALITY,
  loadSharp,
  optimizeImageBuffer,
  optimizePendingPhoto,
  optimizePublicPhoto,
  fullWebpFilename,
  thumbWebpFilename,
};
