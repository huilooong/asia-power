'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isProduction } = require('./startup-checks');

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
  const clean = stripAccessQuery(url);
  const pendingMatch = clean.match(/^\/uploads\/pending\/(photos|videos)\/(.+)$/);
  if (!pendingMatch) return url;
  const kind = pendingMatch[1];
  const filename = pendingMatch[2];
  const from = path.join(rootDir, 'uploads', 'pending', kind, filename);
  const to = path.join(rootDir, 'uploads', kind, filename);
  if (!from.startsWith(path.join(rootDir, 'uploads')) || !to.startsWith(path.join(rootDir, 'uploads'))) return url;
  if (!fs.existsSync(from)) {
    if (fs.existsSync(to)) return `${publicPhotoPrefix()}/${filename}`.replace('photos', kind);
    return url;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return kind === 'photos' ? `${publicPhotoPrefix()}/${filename}` : `${publicVideoPrefix()}/${filename}`;
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
  pendingPhotoPrefix,
  pendingVideoPrefix,
  publicPhotoPrefix,
  publicVideoPrefix,
};
