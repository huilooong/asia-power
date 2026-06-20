/**
 * AsiaPower — Half-cut media upload + JSON state API (shared by local + production servers)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  diffHalfCutState,
  notifyHalfCutEvents,
  notifyUploadFailure,
} = require('./half-cut-notifications');
const { toPublicList } = require('./half-cut-public');
const { createRateLimiter, clientIp } = require('./rate-limit');
const { isAuthorizedSupplierRequest, assertSubmissionMediaUrls, isProduction } = require('./supplier-gate');
const media = require('./media-storage');
const nameNorm = require('./vehicle-name-normalize');
const { createVehicleModelMemory } = require('./vehicle-model-memory');

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const UPLOAD_TOKEN_TTL_MS = 30 * 60 * 1000;

const ALLOWED_PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']);

const UPLOAD_MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
};

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readBodyBuffer(req, maxBytes = MAX_JSON_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function readJsonBody(req, maxBytes = MAX_JSON_BYTES) {
  return readBodyBuffer(req, maxBytes).then((buf) => {
    if (!buf.length) return {};
    return JSON.parse(buf.toString('utf8'));
  });
}

function assertNoEmbeddedMedia(value, label = 'payload') {
  const text = JSON.stringify(value);
  if (/data:(image|video)\/[a-z0-9.+-]+;base64,/i.test(text)) {
    throw new Error(`${label} must not contain Base64 media`);
  }
}

function parseMultipart(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(delimiter);
  while (start !== -1) {
    let end = buffer.indexOf(delimiter, start + delimiter.length);
    if (end === -1) end = buffer.length;
    const slice = buffer.subarray(start + delimiter.length, end);
    start = end;

    if (slice.length < 4) continue;
    if (slice.subarray(0, 2).equals(Buffer.from('--'))) break;

    const headerEnd = slice.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerText = slice.subarray(0, headerEnd).toString('utf8');
    let body = slice.subarray(headerEnd + 4);
    if (body.subarray(-2).equals(Buffer.from('\r\n'))) body = body.subarray(0, -2);

    const disposition = headerText.match(/content-disposition:[^\r\n]*/i)?.[0] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/i);
    const fileMatch = disposition.match(/filename="([^"]*)"/i);
    const contentType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || '';

    parts.push({
      name: nameMatch ? nameMatch[1] : '',
      filename: fileMatch ? fileMatch[1] : '',
      contentType,
      body,
    });
  }
  return parts;
}

function extForMime(mime, fallback = '') {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
  };
  return map[mime] || fallback;
}

function safeFilename(original, mime, prefix) {
  const ext = path.extname(original || '').toLowerCase();
  const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov', '.avi']);
  const finalExt = allowed.has(ext) ? ext : extForMime(mime, '.bin');
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${finalExt}`;
}

function sniffImageMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
  return null;
}

function sniffVideoMime(buffer) {
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'RIFF') return 'video/webm';
  return null;
}

function createHalfCutApi(rootDir, options = {}) {
  const auth = options.auth || {};
  const requireAdmin = auth.requireAdmin || (() => false);
  const allowUpload = auth.allowUpload || (() => false);

  const DATA_DIR = path.join(rootDir, 'data');
  const UPLOADS_DIR = path.join(rootDir, 'uploads');
  const PHOTOS_DIR = path.join(UPLOADS_DIR, 'photos');
  const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
  const PENDING_PHOTOS_DIR = path.join(UPLOADS_DIR, 'pending', 'photos');
  const PENDING_VIDEOS_DIR = path.join(UPLOADS_DIR, 'pending', 'videos');
  const SUBMISSIONS_FILE = path.join(DATA_DIR, 'half-cut-submissions.json');
  const APPROVED_FILE = path.join(DATA_DIR, 'half-cut-approved.json');
  const modelMemory = createVehicleModelMemory(DATA_DIR, rootDir);

  function bootstrapModelMemory() {
    try {
      const submissions = loadJson(SUBMISSIONS_FILE, []);
      const approved = loadJson(APPROVED_FILE, []);
      submissions.forEach((item) => modelMemory.rememberVehicle(item));
      approved.forEach((item) => modelMemory.rememberVehicle(item));
    } catch (err) {
      console.warn('[half-cut] model memory bootstrap skipped:', err.message);
    }
  }

  bootstrapModelMemory();

  const uploadTokens = new Map();
  const limitSubmission = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 30 });
  const limitUploadToken = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 40 });
  const limitUpload = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 220 });

  function ensureDirs() {
    media.ensureMediaDirs(rootDir);
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  function saveUpload({ dir, publicPrefix, part, allowedMimes, maxBytes, prefix, sniffFn, pending = false }) {
    if (!part.body?.length) throw new Error('Empty upload');
    const declared = part.contentType || 'application/octet-stream';
    const sniffed = sniffFn ? sniffFn(part.body) : null;
    const mime = sniffed || declared;
    if (!allowedMimes.has(mime)) throw new Error(`Unsupported file type: ${mime}`);
    if (sniffed && declared !== 'application/octet-stream' && sniffed !== declared) {
      throw new Error('File content does not match declared type');
    }
    if (part.body.length > maxBytes) throw new Error(`File exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit`);

    const filename = safeFilename(part.filename, mime, prefix);
    const diskPath = path.join(dir, filename);
    fs.writeFileSync(diskPath, part.body);
    const relative = `${publicPrefix}/${filename}`;
    return {
      url: pending ? media.withAccessQuery(relative) : relative,
      fileName: part.filename || filename,
      mimeType: mime,
      size: part.body.length,
    };
  }

  function getState() {
    const raw = {
      submissions: loadJson(SUBMISSIONS_FILE, []),
      approved: loadJson(APPROVED_FILE, []),
    };
    const { state, changed } = nameNorm.normalizeState(raw, rootDir);
    if (changed) {
      saveJson(SUBMISSIONS_FILE, state.submissions);
      saveJson(APPROVED_FILE, state.approved);
      console.log('[half-cut] auto-corrected brand/model spellings in saved state');
    }
    return state;
  }

  function getPublicCatalog() {
    const raw = loadJson(APPROVED_FILE, []);
    const { state, changed } = nameNorm.normalizeState({ submissions: [], approved: raw }, rootDir);
    if (changed) {
      saveJson(APPROVED_FILE, state.approved);
      console.log('[half-cut] auto-corrected brand/model spellings in approved catalog');
    }
    return { approved: toPublicList(state.approved) };
  }

  function putState(body) {
    assertNoEmbeddedMedia(body);
    const previous = getState();
    const submissions = Array.isArray(body.submissions) ? body.submissions : [];
    const approvedInput = Array.isArray(body.approved) ? body.approved : [];
    const { state: normalized } = nameNorm.normalizeState(
      { submissions, approved: approvedInput },
      rootDir
    );
    const approved = media.promoteApprovedList(rootDir, normalized.approved);
    saveJson(SUBMISSIONS_FILE, normalized.submissions);
    saveJson(APPROVED_FILE, approved);
    normalized.submissions.forEach((item) => modelMemory.rememberVehicle(item));
    approved.forEach((item) => modelMemory.rememberVehicle(item));
    const next = { submissions: normalized.submissions, approved };
    const events = diffHalfCutState(previous, next);
    for (const event of events) {
      if (event.type === 'submission_new') {
        console.log('[half-cut] new submission:', event.submission.submissionId);
      }
    }
    notifyHalfCutEvents(events);
    return next;
  }

  function appendSubmission(submission) {
    assertNoEmbeddedMedia(submission, 'submission');
    if (!submission || typeof submission !== 'object') throw new Error('Invalid submission');
    if (!submission.submissionId) throw new Error('submissionId required');
    if (!submission.vin || String(submission.vin).length !== 17) throw new Error('Valid VIN required');
    if (!Array.isArray(submission.photos) || submission.photos.length < 3) {
      throw new Error('At least 3 photos required');
    }
    assertSubmissionMediaUrls(submission);

    const previous = getState();
    if (previous.submissions.some((item) => item.submissionId === submission.submissionId)) {
      throw new Error('Duplicate submission');
    }
    if (previous.submissions.some((item) => item.vin === submission.vin && item.reviewStatus === 'pending')) {
      throw new Error('Pending submission already exists for this VIN');
    }

    submission = nameNorm.normalizeSubmissionRecord(submission, rootDir);
    submission.reviewStatus = submission.reviewStatus || 'pending';
    submission.createdAt = submission.createdAt || new Date().toISOString();
    modelMemory.rememberVehicle(submission);
    const submissions = [submission, ...previous.submissions];
    saveJson(SUBMISSIONS_FILE, submissions);
    const next = { submissions, approved: previous.approved };
    notifyHalfCutEvents(diffHalfCutState(previous, next));
    return submission;
  }

  function issueUploadToken(req) {
    if (!limitUploadToken(req)) return null;
    const token = crypto.randomBytes(24).toString('hex');
    uploadTokens.set(token, { ip: clientIp(req), expiresAt: Date.now() + UPLOAD_TOKEN_TTL_MS });
    return { token, expiresAt: new Date(Date.now() + UPLOAD_TOKEN_TTL_MS).toISOString() };
  }

  function hasValidUploadToken(req) {
    if (allowUpload(req)) return true;
    const header = req.headers['x-upload-token'];
    if (!header || !uploadTokens.has(header)) return false;
    const entry = uploadTokens.get(header);
    if (Date.now() > entry.expiresAt) return false;
    if (entry.ip !== clientIp(req)) return false;
    return true;
  }

  function consumeUploadToken(req) {
    if (allowUpload(req)) return true;
    const header = req.headers['x-upload-token'];
    if (!header || !uploadTokens.has(header)) return false;
    const entry = uploadTokens.get(header);
    if (Date.now() > entry.expiresAt) {
      uploadTokens.delete(header);
      return false;
    }
    if (entry.ip !== clientIp(req)) return false;
    return true;
  }

  function revokeUploadToken(req) {
    const header = req.headers['x-upload-token'];
    if (header) uploadTokens.delete(header);
  }

  function isUploadPath(pathname) {
    return media.isUploadPath(pathname);
  }

  function resolveUploadFile(pathname) {
    return media.resolveUploadFile(rootDir, pathname, UPLOADS_DIR);
  }

  function canServeUpload(req, pathname, isAdmin) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    return media.canServeUpload(req, pathname, { isAdmin, query: Object.fromEntries(url.searchParams) });
  }

  function getUploadMime(filePath) {
    return UPLOAD_MIME_MAP[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Handle /api/half-cuts/* requests. Returns true if handled, false if route not matched.
   */
  async function handleRequest(req, res, pathname, json) {
    if (!pathname.startsWith('/api/half-cuts/')) return false;

    if (req.method === 'GET' && pathname === '/api/half-cuts/health') {
      json(res, 200, { ok: true, uploads: true });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/half-cuts/public') {
      json(res, 200, getPublicCatalog());
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/half-cuts/upload-token') {
      if (!isAuthorizedSupplierRequest(req, allowUpload)) {
        json(res, 403, { error: 'Forbidden' });
        return true;
      }
      const issued = issueUploadToken(req);
      if (!issued) {
        json(res, 429, { error: 'Too many requests' });
        return true;
      }
      json(res, 201, issued);
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/half-cuts/submissions') {
      if (!isAuthorizedSupplierRequest(req, allowUpload)) {
        json(res, 403, { error: 'Forbidden' });
        return true;
      }
      if (isProduction() && !hasValidUploadToken(req)) {
        json(res, 401, { error: 'Upload token required' });
        return true;
      }
      if (!limitSubmission(req)) {
        json(res, 429, { error: 'Too many submissions' });
        return true;
      }
      try {
        const body = await readJsonBody(req);
        const submission = appendSubmission(body);
        revokeUploadToken(req);
        json(res, 201, { ok: true, submissionId: submission.submissionId });
      } catch (err) {
        json(res, 400, { error: err.message || 'Request failed' });
      }
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/half-cuts/state') {
      if (!requireAdmin(req, res)) return true;
      json(res, 200, getState());
      return true;
    }

    if (req.method === 'PUT' && pathname === '/api/half-cuts/state') {
      if (!requireAdmin(req, res)) return true;
      try {
        const body = await readJsonBody(req);
        const state = putState(body);
        json(res, 200, { ok: true, ...state });
      } catch (err) {
        json(res, 400, { error: err.message || 'Request failed' });
      }
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/half-cuts/upload/photo') {
      if (!isAuthorizedSupplierRequest(req, allowUpload)) {
        json(res, 403, { error: 'Forbidden' });
        return true;
      }
      if (!limitUpload(req)) {
        json(res, 429, { error: 'Too many uploads' });
        return true;
      }
      if (!consumeUploadToken(req)) {
        json(res, 401, { error: 'Upload token required' });
        return true;
      }
      try {
        const contentType = req.headers['content-type'] || '';
        const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!match) {
          json(res, 400, { error: 'Expected multipart/form-data' });
          return true;
        }
        const buffer = await readBodyBuffer(req, MAX_PHOTO_BYTES + 512 * 1024);
        const parts = parseMultipart(buffer, match[1] || match[2]);
        const filePart = parts.find((part) => part.name === 'file');
        if (!filePart) {
          json(res, 400, { error: 'Missing file field' });
          return true;
        }
        const saved = saveUpload({
          dir: PENDING_PHOTOS_DIR,
          publicPrefix: media.pendingPhotoPrefix(),
          part: filePart,
          allowedMimes: ALLOWED_PHOTO_MIMES,
          maxBytes: MAX_PHOTO_BYTES,
          prefix: 'photo',
          sniffFn: sniffImageMime,
          pending: true,
        });
        const labelPart = parts.find((part) => part.name === 'label');
        if (labelPart?.body?.length) saved.label = labelPart.body.toString('utf8');
        json(res, 201, saved);
      } catch (err) {
        notifyUploadFailure('photo', err.message || 'Photo upload failed');
        json(res, 400, { error: err.message || 'Photo upload failed' });
      }
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/half-cuts/upload/video') {
      if (!isAuthorizedSupplierRequest(req, allowUpload)) {
        json(res, 403, { error: 'Forbidden' });
        return true;
      }
      if (!limitUpload(req)) {
        json(res, 429, { error: 'Too many uploads' });
        return true;
      }
      if (!consumeUploadToken(req)) {
        json(res, 401, { error: 'Upload token required' });
        return true;
      }
      try {
        const contentType = req.headers['content-type'] || '';
        const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!match) {
          json(res, 400, { error: 'Expected multipart/form-data' });
          return true;
        }
        const buffer = await readBodyBuffer(req, MAX_VIDEO_BYTES + 512 * 1024);
        const parts = parseMultipart(buffer, match[1] || match[2]);
        const filePart = parts.find((part) => part.name === 'file');
        if (!filePart) {
          json(res, 400, { error: 'Missing file field' });
          return true;
        }
        const saved = saveUpload({
          dir: PENDING_VIDEOS_DIR,
          publicPrefix: media.pendingVideoPrefix(),
          part: filePart,
          allowedMimes: ALLOWED_VIDEO_MIMES,
          maxBytes: MAX_VIDEO_BYTES,
          prefix: 'video',
          sniffFn: sniffVideoMime,
          pending: true,
        });
        json(res, 201, saved);
      } catch (err) {
        notifyUploadFailure('video', err.message || 'Video upload failed');
        json(res, 400, { error: err.message || 'Video upload failed' });
      }
      return true;
    }

    json(res, 404, { error: 'API not found' });
    return true;
  }

  return {
    ensureDirs,
    UPLOADS_DIR,
    DATA_DIR,
    isUploadPath,
    resolveUploadFile,
    canServeUpload,
    getUploadMime,
    handleRequest,
    assertNoEmbeddedMedia,
    MAX_PHOTO_BYTES,
    MAX_VIDEO_BYTES,
    getPublicCatalog,
    modelMemory,
  };
}

module.exports = { createHalfCutApi };
