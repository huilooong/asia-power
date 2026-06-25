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
const {
  isAuthorizedSupplierRequest,
  hasValidSupplierKey,
  assertSubmissionMediaUrls,
  isProduction,
  supplierUploadKey,
} = require('./supplier-gate');
const media = require('./media-storage');
const r2 = require('./r2-storage');
const mediaOptimize = require('./media-optimize');
const nameNorm = require('./vehicle-name-normalize');
const truckBrands = require('./truck-brand-catalog');
const { createVehicleModelMemory } = require('./vehicle-model-memory');
const { createPowertrainCatalogMemory } = require('./powertrain-catalog-memory');
const { loadJson, saveJsonAtomic } = require('./json-store');
const { createDataIntakeLog } = require('./data-intake-log');

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

function saveJson(file, data) {
  saveJsonAtomic(file, data);
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
  const intakeLog = createDataIntakeLog(DATA_DIR);
  const modelMemory = createVehicleModelMemory(DATA_DIR, rootDir);
  const powertrainMemory = createPowertrainCatalogMemory(DATA_DIR, rootDir);

  function bootstrapCatalogMemory() {
    try {
      const submissions = loadJson(SUBMISSIONS_FILE, []);
      const approved = loadJson(APPROVED_FILE, []);
      submissions.forEach((item) => modelMemory.rememberVehicle(item));
      powertrainMemory.rebuildFromApproved(approved);
    } catch (err) {
      console.warn('[half-cut] catalog memory bootstrap skipped:', err.message);
    }
  }

  bootstrapCatalogMemory();

  const uploadTokens = new Map();
  const limitSubmission = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 30 });
  const limitUploadToken = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 80 });
  const limitUpload = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 300 });
  const MAX_CONCURRENT_SERVER_PHOTO_UPLOADS = Number(
    process.env.MAX_CONCURRENT_SERVER_PHOTO_UPLOADS
    || process.env.MAX_CONCURRENT_SERVER_UPLOADS
    || 40
  );
  const MAX_CONCURRENT_SERVER_VIDEO_UPLOADS = Number(process.env.MAX_CONCURRENT_SERVER_VIDEO_UPLOADS || 4);
  const SERVER_UPLOAD_MEMORY_BUDGET_BYTES = Math.max(
    64 * 1024 * 1024,
    Number(process.env.SERVER_UPLOAD_MEMORY_BUDGET_MB || 400) * 1024 * 1024
  );
  const SERVER_UPLOAD_BUFFER_OVERHEAD_BYTES = 512 * 1024;

  let activePhotoUploads = 0;
  let activeVideoUploads = 0;
  let activeServerUploadBytes = 0;

  function estimateUploadBytes(req, maxBytes) {
    const contentLength = Number(req.headers['content-length'] || 0);
    const cap = maxBytes + SERVER_UPLOAD_BUFFER_OVERHEAD_BYTES;
    if (contentLength > 0 && contentLength <= cap) return contentLength;
    return cap;
  }

  function acquireServerUploadSlot(kind, reservedBytes) {
    if (kind === 'video') {
      if (activeVideoUploads >= MAX_CONCURRENT_SERVER_VIDEO_UPLOADS) return { ok: false, reason: 'video_slots' };
    } else if (activePhotoUploads >= MAX_CONCURRENT_SERVER_PHOTO_UPLOADS) {
      return { ok: false, reason: 'photo_slots' };
    }
    if (activeServerUploadBytes + reservedBytes > SERVER_UPLOAD_MEMORY_BUDGET_BYTES) {
      return { ok: false, reason: 'memory' };
    }
    if (kind === 'video') activeVideoUploads += 1;
    else activePhotoUploads += 1;
    activeServerUploadBytes += reservedBytes;
    return { ok: true, reservedBytes };
  }

  function releaseServerUploadSlot(kind, reservedBytes) {
    if (kind === 'video') activeVideoUploads = Math.max(0, activeVideoUploads - 1);
    else activePhotoUploads = Math.max(0, activePhotoUploads - 1);
    activeServerUploadBytes = Math.max(0, activeServerUploadBytes - reservedBytes);
  }

  function serverUploadLimits() {
    return {
      maxConcurrentPhotoUploads: MAX_CONCURRENT_SERVER_PHOTO_UPLOADS,
      maxConcurrentVideoUploads: MAX_CONCURRENT_SERVER_VIDEO_UPLOADS,
      memoryBudgetMb: Math.round(SERVER_UPLOAD_MEMORY_BUDGET_BYTES / (1024 * 1024)),
      activePhotoUploads,
      activeVideoUploads,
      activeUploadMb: Math.round(activeServerUploadBytes / (1024 * 1024)),
    };
  }

  function ensureDirs() {
    media.ensureMediaDirs(rootDir);
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  async function saveOptimizedPhotoUpload({ dir, publicPrefix, part, maxBytes, pending }) {
    const declared = part.contentType || 'application/octet-stream';
    const sniffed = sniffImageMime(part.body);
    const mime = sniffed || declared;
    if (!ALLOWED_PHOTO_MIMES.has(mime)) throw new Error(`Unsupported file type: ${mime}`);
    if (sniffed && declared !== 'application/octet-stream' && sniffed !== declared) {
      throw new Error('File content does not match declared type');
    }
    if (part.body.length > maxBytes) throw new Error(`File exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit`);

    const optimized = await mediaOptimize.optimizeImageBuffer(part.body, mime);
    if (!optimized?.full?.length || !optimized?.thumb?.length) {
      return saveUpload({
        dir,
        publicPrefix,
        part,
        allowedMimes: ALLOWED_PHOTO_MIMES,
        maxBytes,
        prefix: 'photo',
        sniffFn: sniffImageMime,
        pending,
      });
    }

    const filename = safeFilename(part.filename, 'image/webp', 'photo');
    const thumbFilename = mediaOptimize.thumbWebpFilename(filename);
    const fullFilename = mediaOptimize.fullWebpFilename(filename);

    if (pending && r2.isEnabled()) {
      await r2.putObjectBuffer(r2.pendingPhotoKey(fullFilename), optimized.fullMime, optimized.full);
      await r2.putObjectBuffer(r2.pendingPhotoKey(thumbFilename), optimized.thumbMime, optimized.thumb);
      const relative = r2.siteRelativeUrl(r2.pendingPhotoKey(fullFilename));
      const thumbRelative = r2.siteRelativeUrl(r2.pendingPhotoKey(thumbFilename));
      return {
        url: media.withAccessQuery(relative),
        thumbUrl: media.withAccessQuery(thumbRelative),
        fileName: part.filename || fullFilename,
        mimeType: optimized.fullMime,
        size: optimized.full.length,
        thumbSize: optimized.thumb.length,
      };
    }

    const fullDisk = path.join(dir, fullFilename);
    const thumbDisk = path.join(dir, thumbFilename);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullDisk, optimized.full);
    fs.writeFileSync(thumbDisk, optimized.thumb);
    const relative = `${publicPrefix}/${fullFilename}`;
    const thumbRelative = `${publicPrefix}/${thumbFilename}`;
    return {
      url: pending ? media.withAccessQuery(relative) : relative,
      thumbUrl: pending ? media.withAccessQuery(thumbRelative) : thumbRelative,
      fileName: part.filename || fullFilename,
      mimeType: optimized.fullMime,
      size: optimized.full.length,
      thumbSize: optimized.thumb.length,
    };
  }

  async function saveUpload({ dir, publicPrefix, part, allowedMimes, maxBytes, prefix, sniffFn, pending = false }) {
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
    if (pending && r2.isEnabled()) {
      const key = prefix === 'video' ? r2.pendingVideoKey(filename) : r2.pendingPhotoKey(filename);
      await r2.putObjectBuffer(key, mime, part.body);
      const relative = r2.siteRelativeUrl(key);
      return {
        url: media.withAccessQuery(relative),
        fileName: part.filename || filename,
        mimeType: mime,
        size: part.body.length,
      };
    }

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

  function uploadTokenMatchesRequest(entry, req) {
    if (!entry || Date.now() > entry.expiresAt) return false;
    if (entry.supplierAuth && hasValidSupplierKey(req)) return true;
    return entry.ip === clientIp(req);
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

  async function getPublicCatalog() {
    const raw = loadJson(APPROVED_FILE, []);
    const submissions = loadJson(SUBMISSIONS_FILE, []);
    const { state, changed } = nameNorm.normalizeState({ submissions, approved: raw }, rootDir);
    if (changed) {
      saveJson(APPROVED_FILE, state.approved);
      console.log('[half-cut] auto-corrected brand/model spellings in approved catalog');
    }
    return { approved: toPublicList(state.approved) };
  }

  function updateApprovedInventory(stockId, rawEdits) {
    const stockUpper = String(stockId || '').trim().toUpperCase();
    if (!stockUpper) throw new Error('stockId required');

    const previous = getState();
    const index = previous.approved.findIndex(
      (item) => String(item.stockId || '').toUpperCase() === stockUpper
    );
    if (index === -1) throw new Error('Inventory item not found');

    const allowed = new Set([
      'brand',
      'model',
      'year',
      'engineCode',
      'transmissionCode',
      'drivetrain',
      'mileage',
      'priceUsd',
      'status',
      'vehicleCondition',
      'vehicleCategory',
      'origin',
      'shortDescription',
      'notes',
    ]);

    const edits = {};
    Object.entries(rawEdits || {}).forEach(([key, value]) => {
      if (!allowed.has(key)) return;
      if (value === undefined || value === null) return;
      edits[key] = value;
    });
    if (!Object.keys(edits).length) throw new Error('No editable fields provided');

    let item = { ...previous.approved[index] };
    const oldSlug = item.slug || null;

    Object.assign(item, edits);
    if (edits.brand || edits.model) {
      item = nameNorm.normalizeInventoryRecord(item, rootDir);
    }
    if (edits.year !== undefined && edits.year !== '') {
      item.year = Number(edits.year);
    }
    if (edits.priceUsd !== undefined && edits.priceUsd !== '') {
      item.priceUsd = Number(Number(edits.priceUsd).toFixed(2));
    }
    if (edits.engineCode) item.engineCode = String(edits.engineCode).trim();
    if (edits.transmissionCode) item.transmissionCode = String(edits.transmissionCode).trim();

    item = nameNorm.rebuildInventoryDerivedFields(item);
    if (oldSlug && item.slug && oldSlug !== item.slug) {
      const aliases = new Set(Array.isArray(item.slugAliases) ? item.slugAliases : []);
      aliases.add(oldSlug);
      item.slugAliases = [...aliases];
    }
    item.updatedAt = new Date().toISOString();

    const approved = previous.approved.slice();
    approved[index] = item;

    const submissions = previous.submissions.map((submission) => {
      const linked = submission.approvedStockId === item.stockId
        || submission.submissionId === item.submissionId;
      if (!linked) return submission;
      const next = {
        ...submission,
        brand: item.brand,
        brandSlug: item.brandSlug,
        model: item.model,
        year: item.year,
        engineCode: item.engineCode,
        transmissionCode: item.transmissionCode,
        drivetrain: item.drivetrain,
        mileage: item.mileage,
        priceUsd: item.priceUsd,
        vehicleCondition: item.vehicleCondition,
        vehicleCategory: item.vehicleCategory,
      };
      if (submission.approvedSlug && item.slug) next.approvedSlug = item.slug;
      return next;
    });

    saveJson(SUBMISSIONS_FILE, submissions);
    saveJson(APPROVED_FILE, approved);
    powertrainMemory.rebuildFromApproved(approved);
    return item;
  }

  async function putState(body) {
    assertNoEmbeddedMedia(body);
    const previous = getState();
    const submissions = Array.isArray(body.submissions) ? body.submissions : [];
    const approvedInput = Array.isArray(body.approved) ? body.approved : [];
    const { state: normalized } = nameNorm.normalizeState(
      { submissions, approved: approvedInput },
      rootDir
    );
    let approved = normalized.approved;
    try {
      approved = await media.promoteApprovedListAsync(rootDir, normalized.approved);
    } catch (err) {
      console.error('[half-cut] media promote failed on putState:', err.message);
    }
    saveJson(SUBMISSIONS_FILE, normalized.submissions);
    saveJson(APPROVED_FILE, approved);
    normalized.submissions.forEach((item) => modelMemory.rememberVehicle(item));
    approved.forEach((item) => {
      modelMemory.rememberVehicle(item);
      powertrainMemory.rememberFromHalfCut(item);
    });
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
    const meta = nameNorm.normalizeListingMeta(submission);
    const isTruckCab = meta?.vehicleCategory === 'truck' && meta?.truckPartType === 'cab';
    const isMachinery = meta?.vehicleCategory === 'machinery';
    const vin = String(submission.vin || '').trim();
    if (!isTruckCab && !isMachinery && vin.length !== 17) throw new Error('Valid VIN required');
    if (isTruckCab && vin && vin.length !== 17) throw new Error('VIN must be 17 characters when provided');
    if (!Array.isArray(submission.photos) || submission.photos.length < (isMachinery ? 4 : 3)) {
      throw new Error(isMachinery ? 'At least 4 photos required for machinery' : 'At least 3 photos required');
    }
    assertSubmissionMediaUrls(submission);

    const previous = getState();
    if (previous.submissions.some((item) => item.submissionId === submission.submissionId)) {
      throw new Error('Duplicate submission');
    }
    if (vin && previous.submissions.some((item) => item.vin === vin && item.reviewStatus === 'pending')) {
      throw new Error('Pending submission already exists for this VIN');
    }

    submission = nameNorm.normalizeSubmissionRecord(submission, rootDir);
    submission = truckBrands.normalizeTruckRecord(submission, rootDir);
    if (!submission.vin) submission.vin = '';
    submission.reviewStatus = submission.reviewStatus || 'pending';
    submission.createdAt = submission.createdAt || new Date().toISOString();

    // Machinery sanity checks: auto-flag or auto-reject unrealistic submissions.
    if (submission.vehicleCategory === 'machinery') {
      const priceUsd = Number(submission.priceUsd);
      const flags = [];
      if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
        flags.push('price_missing');
      } else {
        if (priceUsd < 2000) flags.push('price_too_low');
        if (priceUsd > 500000) flags.push('price_too_high');
        if (submission.machineryType === 'wheel-loader') {
          if (priceUsd < 5000) flags.push('loader_price_low');
          if (priceUsd > 200000) flags.push('loader_price_high');
        }
      }
      if (!submission.engineCode) flags.push('engine_missing');
      if (!Array.isArray(submission.photos) || submission.photos.length < 4) flags.push('photos_insufficient');
      submission.reviewFlags = Array.from(new Set([...(submission.reviewFlags || []), ...flags]));
      const hardReject = flags.includes('price_too_low') || flags.includes('price_too_high') || flags.includes('price_missing');
      if (hardReject) {
        submission.reviewStatus = 'rejected';
        submission.rejectReason = `Auto-rejected: machinery submission sanity check failed (${submission.reviewFlags.join(', ')}).`;
        submission.reviewedAt = new Date().toISOString();
      }
    }

    modelMemory.rememberVehicle(submission);
    if (submission.reviewStatus === 'approved') {
      powertrainMemory.rememberFromHalfCut(submission);
    }
    try {
      intakeLog.append('supplier-submission', submission);
    } catch (err) {
      console.error('[half-cut] submission intake log failed:', err.message);
      throw new Error('Submission storage temporarily unavailable — please try again in a moment.');
    }
    const submissions = [submission, ...previous.submissions];
    saveJson(SUBMISSIONS_FILE, submissions);
    const next = { submissions, approved: previous.approved };
    notifyHalfCutEvents(diffHalfCutState(previous, next));
    return submission;
  }

  function issueUploadToken(req) {
    if (!limitUploadToken(req)) return null;
    const token = crypto.randomBytes(24).toString('hex');
    uploadTokens.set(token, {
      ip: clientIp(req),
      supplierAuth: hasValidSupplierKey(req),
      expiresAt: Date.now() + UPLOAD_TOKEN_TTL_MS,
    });
    return { token, expiresAt: new Date(Date.now() + UPLOAD_TOKEN_TTL_MS).toISOString() };
  }

  function hasValidUploadToken(req) {
    if (allowUpload(req)) return true;
    const header = req.headers['x-upload-token'];
    if (!header || !uploadTokens.has(header)) return false;
    return uploadTokenMatchesRequest(uploadTokens.get(header), req);
  }

  function consumeUploadToken(req) {
    if (allowUpload(req)) return true;
    const header = req.headers['x-upload-token'];
    if (!header || !uploadTokens.has(header)) return false;
    const entry = uploadTokens.get(header);
    if (!uploadTokenMatchesRequest(entry, req)) {
      if (Date.now() > entry.expiresAt) uploadTokens.delete(header);
      return false;
    }
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

  async function readUploadObject(pathname) {
    const clean = media.stripAccessQuery(pathname);
    if (!media.isUploadPath(clean) || !r2.isEnabled()) return null;
    const key = r2.objectKeyFromUploadsPath(clean);
    const buffer = await r2.getObjectBuffer(key);
    return {
      buffer,
      mime: getUploadMime(clean),
    };
  }

  /**
   * Handle /api/half-cuts/* requests. Returns true if handled, false if route not matched.
   */
  async function handleRequest(req, res, pathname, json) {
    if (!pathname.startsWith('/api/half-cuts/')) return false;

    if (req.method === 'GET' && pathname === '/api/half-cuts/health') {
      json(res, 200, {
        ok: true,
        uploads: true,
        supplierGate: Boolean(supplierUploadKey()),
        r2: r2.isEnabled(),
        uploadVia: r2.isEnabled() ? 'direct' : 'disk',
        serverUpload: serverUploadLimits(),
        dataSafeguard: {
          intake: intakeLog.stats(),
          atomicJson: true,
        },
      });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/half-cuts/public') {
      const catalog = await getPublicCatalog();
      json(res, 200, catalog);
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/half-cuts/upload/config') {
      json(res, 200, {
        ...r2.uploadConfig(),
        serverUpload: serverUploadLimits(),
      });
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

    if (req.method === 'POST' && pathname === '/api/half-cuts/upload/presign') {
      if (!isAuthorizedSupplierRequest(req, allowUpload)) {
        json(res, 403, { error: 'Forbidden' });
        return true;
      }
      if (!r2.isEnabled()) {
        json(res, 503, { error: 'Direct upload not configured' });
        return true;
      }
      if (!consumeUploadToken(req)) {
        json(res, 401, { error: 'Upload token required' });
        return true;
      }
      try {
        const body = await readJsonBody(req);
        const kind = body.kind === 'video' ? 'video' : 'photo';
        const mimeType = String(body.mimeType || body.contentType || '').trim();
        const size = Number(body.size || 0);
        const allowed = kind === 'video' ? ALLOWED_VIDEO_MIMES : ALLOWED_PHOTO_MIMES;
        const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
        if (!allowed.has(mimeType)) throw new Error(`Unsupported file type: ${mimeType || 'unknown'}`);
        if (!size || size > maxBytes) throw new Error(`File exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit`);
        const prefix = kind === 'video' ? 'video' : 'photo';
        const filename = safeFilename(body.filename, mimeType, prefix);
        const key = kind === 'video' ? r2.pendingVideoKey(filename) : r2.pendingPhotoKey(filename);
        const uploadUrl = r2.createPresignedPutUrl(key, mimeType);
        const url = r2.siteRelativeUrl(key);
        const saved = {
          uploadUrl,
          url: media.withAccessQuery(url),
          publicUrl: r2.publicUrlForKey(key),
          fileName: body.filename || filename,
          mimeType,
          size,
          key,
        };
        if (body.label) saved.label = String(body.label);
        json(res, 201, saved);
      } catch (err) {
        notifyUploadFailure('presign', err.message || 'Presign failed');
        json(res, 400, { error: err.message || 'Presign failed' });
      }
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
        const state = await putState(body);
        json(res, 200, { ok: true, ...state });
      } catch (err) {
        json(res, 400, { error: err.message || 'Request failed' });
      }
      return true;
    }

    const inventoryMatch = pathname.match(/^\/api\/half-cuts\/inventory\/([^/]+)$/);
    if (inventoryMatch && req.method === 'PATCH') {
      if (!requireAdmin(req, res)) return true;
      try {
        const body = await readJsonBody(req);
        const item = updateApprovedInventory(decodeURIComponent(inventoryMatch[1]), body);
        json(res, 200, { ok: true, item });
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
      const reservedBytes = estimateUploadBytes(req, MAX_PHOTO_BYTES);
      const slot = acquireServerUploadSlot('photo', reservedBytes);
      if (!slot.ok) {
        json(res, 503, {
          error: 'Upload server busy — please wait a few seconds and try again.',
          retryAfterSec: 3,
          reason: slot.reason,
        });
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
        const saved = await saveOptimizedPhotoUpload({
          dir: PENDING_PHOTOS_DIR,
          publicPrefix: media.pendingPhotoPrefix(),
          part: filePart,
          maxBytes: MAX_PHOTO_BYTES,
          pending: true,
        });
        const labelPart = parts.find((part) => part.name === 'label');
        if (labelPart?.body?.length) saved.label = labelPart.body.toString('utf8');
        json(res, 201, saved);
      } catch (err) {
        notifyUploadFailure('photo', err.message || 'Photo upload failed');
        json(res, 400, { error: err.message || 'Photo upload failed' });
      } finally {
        releaseServerUploadSlot('photo', slot.reservedBytes);
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
      const reservedBytes = estimateUploadBytes(req, MAX_VIDEO_BYTES);
      const slot = acquireServerUploadSlot('video', reservedBytes);
      if (!slot.ok) {
        json(res, 503, {
          error: 'Upload server busy — please wait a few seconds and try again.',
          retryAfterSec: 3,
          reason: slot.reason,
        });
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
        const saved = await saveUpload({
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
      } finally {
        releaseServerUploadSlot('video', slot.reservedBytes);
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
    readUploadObject,
    handleRequest,
    assertNoEmbeddedMedia,
    MAX_PHOTO_BYTES,
    MAX_VIDEO_BYTES,
    getPublicCatalog,
    updateApprovedInventory,
    modelMemory,
    powertrainMemory,
  };
}

module.exports = { createHalfCutApi };
