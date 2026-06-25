'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isProduction } = require('./startup-checks');

let mediaOptimize;
function optimize() {
  if (!mediaOptimize) {
    try {
      mediaOptimize = require('./media-optimize');
    } catch {
      mediaOptimize = null;
    }
  }
  return mediaOptimize;
}

function loadR2() {
  try {
    return require('./r2-storage');
  } catch {
    return null;
  }
}

function publicUrlForKind(kind, filename) {
  return kind === 'photos' ? `${publicPhotoPrefix()}/${filename}` : `${publicVideoPrefix()}/${filename}`;
}

function pendingParts(url) {
  const clean = stripAccessQuery(url);
  const pendingMatch = clean.match(/^\/uploads\/pending\/(photos|videos)\/(.+)$/);
  if (!pendingMatch) return null;
  return { clean, kind: pendingMatch[1], filename: pendingMatch[2] };
}

const ACCESS_TTL_MS = 2 * 60 * 60 * 1000;

function accessSecret() {
  if (isProduction()) {
    const secret = String(process.env.MEDIA_ACCESS_SECRET || '').trim();
    if (!secret) {
      throw new Error('MEDIA_ACCESS_SECRET is required in production');
    }
    return secret;
  }
  return (
    process.env.MEDIA_ACCESS_SECRET
    || process.env.SUPPLIER_UPLOAD_KEY
    || 'dev-media-access'
  );
}

function pendingPhotoPrefix() {
  return '/uploads/pending/photos';
}

function pendingVideoPrefix() {
  return '/uploads/pending/videos';
}

function publicPhotoPrefix() {
  return '/uploads/photos';
}

function publicVideoPrefix() {
  return '/uploads/videos';
}

function ensureMediaDirs(rootDir) {
  const dirs = [
    path.join(rootDir, 'uploads', 'pending', 'photos'),
    path.join(rootDir, 'uploads', 'pending', 'videos'),
    path.join(rootDir, 'uploads', 'photos'),
    path.join(rootDir, 'uploads', 'videos'),
  ];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function signAccess(relativePath, expiresAt) {
  const payload = `${relativePath}:${expiresAt}`;
  return crypto.createHmac('sha256', accessSecret()).update(payload).digest('hex').slice(0, 32);
}

function withAccessQuery(relativePath) {
  const exp = Date.now() + ACCESS_TTL_MS;
  const sig = signAccess(relativePath, exp);
  return `${relativePath}?access=${sig}&exp=${exp}`;
}

function stripAccessQuery(url) {
  return String(url || '').split('?')[0];
}

function verifyAccessQuery(pathname, query) {
  const access = query.access;
  const exp = Number(query.exp);
  if (!access || !exp || Date.now() > exp) return false;
  return signAccess(pathname, exp) === access;
}

function isPendingUploadPath(pathname) {
  const clean = stripAccessQuery(pathname);
  return clean.startsWith('/uploads/pending/');
}

function isPublicUploadPath(pathname) {
  const clean = stripAccessQuery(pathname);
  return clean.startsWith('/uploads/photos/') || clean.startsWith('/uploads/videos/');
}

function isUploadPath(pathname) {
  return isPendingUploadPath(pathname) || isPublicUploadPath(pathname);
}

function resolveUploadFile(rootDir, pathname, uploadsDir) {
  const clean = stripAccessQuery(pathname);
  if (!isUploadPath(clean)) return null;
  const rel = clean.replace(/^\/+/, '');
  const filePath = path.join(rootDir, rel);
  if (!filePath.startsWith(uploadsDir)) return null;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
  return filePath;
}

function canServeUpload(req, pathname, { isAdmin, query }) {
  const clean = stripAccessQuery(pathname);
  if (isPublicUploadPath(clean)) return true;
  if (isPendingUploadPath(clean)) {
    if (isAdmin) return true;
    if (verifyAccessQuery(clean, query || {})) return true;
    return false;
  }
  return false;
}

function pendingUploadDirs(rootDir) {
  return {
    photoDir: path.join(rootDir, 'uploads', 'pending', 'photos'),
    videoDir: path.join(rootDir, 'uploads', 'pending', 'videos'),
    photoPrefix: pendingPhotoPrefix(),
    videoPrefix: pendingVideoPrefix(),
  };
}

function promoteUrl(rootDir, url) {
  const parts = pendingParts(url);
  if (!parts) return url;
  const { kind, filename } = parts;
  const from = path.join(rootDir, 'uploads', 'pending', kind, filename);
  const to = path.join(rootDir, 'uploads', kind, filename);
  const publicUrl = publicUrlForKind(kind, filename);
  if (!from.startsWith(path.join(rootDir, 'uploads')) || !to.startsWith(path.join(rootDir, 'uploads'))) return url;
  if (!fs.existsSync(from)) {
    if (fs.existsSync(to)) return publicUrl;
    return url;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return publicUrl;
}

async function promotePhotoUrlAsync(rootDir, url, existingThumbUrl = '') {
  const parts = pendingParts(url);
  if (!parts) return { url, thumbUrl: existingThumbUrl || '' };
  const { clean } = parts;
  const opt = optimize();
  if (opt?.optimizePendingPhoto) {
    try {
      const optimized = await opt.optimizePendingPhoto(rootDir, clean);
      if (optimized?.url) return optimized;
    } catch (err) {
      console.warn('[media] photo optimize on promote failed:', err.message);
    }
  }
  const promoted = await promoteUrlAsync(rootDir, url);
  return { url: promoted, thumbUrl: '' };
}

async function promoteUrlAsync(rootDir, url) {
  const parts = pendingParts(url);
  if (!parts) return url;
  const { clean, kind, filename } = parts;
  const from = path.join(rootDir, 'uploads', 'pending', kind, filename);
  const to = path.join(rootDir, 'uploads', kind, filename);
  const publicUrl = publicUrlForKind(kind, filename);
  if (!from.startsWith(path.join(rootDir, 'uploads')) || !to.startsWith(path.join(rootDir, 'uploads'))) return url;

  if (fs.existsSync(from)) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    return publicUrl;
  }
  if (fs.existsSync(to)) return publicUrl;

  const r2 = loadR2();
  if (r2?.isEnabled?.()) {
    try {
      const fromKey = r2.objectKeyFromUploadsPath(clean);
      const toKey = kind === 'photos' ? r2.publicPhotoKey(filename) : r2.publicVideoKey(filename);
      await r2.copyObject(fromKey, toKey);
      return publicUrl;
    } catch (err) {
      console.error('[media] R2 promote failed:', err.message);
      return url;
    }
  }

  return url;
}

function promoteRecordMedia(rootDir, record) {
  if (!record || typeof record !== 'object') return record;
  const copy = { ...record };
  if (Array.isArray(copy.photos)) {
    copy.photos = copy.photos.map((photo) => {
      if (typeof photo === 'string') return promoteUrl(rootDir, photo);
      if (photo && typeof photo === 'object') {
        return { ...photo, url: promoteUrl(rootDir, photo.url) };
      }
      return photo;
    });
  }
  if (copy.video && typeof copy.video === 'object' && copy.video.url) {
    copy.video = { ...copy.video, url: promoteUrl(rootDir, copy.video.url) };
  }
  if (copy.videoUrl) copy.videoUrl = promoteUrl(rootDir, copy.videoUrl);
  return copy;
}

function promoteApprovedList(rootDir, approved) {
  return (approved || []).map((item) => promoteRecordMedia(rootDir, item));
}

async function promoteRecordMediaAsync(rootDir, record) {
  if (!record || typeof record !== 'object') return record;
  const copy = { ...record };
  if (Array.isArray(copy.photos)) {
    copy.photos = await Promise.all(copy.photos.map(async (photo) => {
      if (typeof photo === 'string') {
        const promoted = await promotePhotoUrlAsync(rootDir, photo);
        return promoted.thumbUrl ? { url: promoted.url, thumbUrl: promoted.thumbUrl } : promoted.url;
      }
      if (photo && typeof photo === 'object') {
        const promoted = await promotePhotoUrlAsync(rootDir, photo.url, photo.thumbUrl);
        return {
          ...photo,
          url: promoted.url,
          thumbUrl: promoted.thumbUrl || photo.thumbUrl || '',
        };
      }
      return photo;
    }));
  }
  if (copy.video && typeof copy.video === 'object' && copy.video.url) {
    copy.video = { ...copy.video, url: await promoteUrlAsync(rootDir, copy.video.url) };
  }
  if (copy.videoUrl) copy.videoUrl = await promoteUrlAsync(rootDir, copy.videoUrl);
  return copy;
}

async function promoteApprovedListAsync(rootDir, approved) {
  const items = approved || [];
  const out = [];
  for (const item of items) {
    out.push(await promoteRecordMediaAsync(rootDir, item));
  }
  return out;
}

module.exports = {
  ensureMediaDirs,
  withAccessQuery,
  stripAccessQuery,
  verifyAccessQuery,
  isPendingUploadPath,
  isPublicUploadPath,
  isUploadPath,
  resolveUploadFile,
  canServeUpload,
  pendingUploadDirs,
  promoteRecordMedia,
  promoteApprovedList,
  promoteRecordMediaAsync,
  promoteApprovedListAsync,
  promoteUrlAsync,
  pendingPhotoPrefix,
  pendingVideoPrefix,
  publicPhotoPrefix,
  publicVideoPrefix,
};
