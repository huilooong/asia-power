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
const { toPublicItem, toPublicCatalogList } = require('./half-cut-public');
const { createRateLimiter, clientIp } = require('./rate-limit');
const {
  isAuthorizedSupplierRequest,
  hasValidSupplierKey,
  isTrustedBatchUploader,
  assertSubmissionMediaUrls,
  isProduction,
  supplierUploadKey,
} = require('./supplier-gate');
const media = require('./media-storage');
const r2 = require('./r2-storage');
const mediaOptimize = require('./media-optimize');
const chassisBlur = require('./chassis-blur');
const nameNorm = require('./vehicle-name-normalize');
const truckBrands = require('./truck-brand-catalog');
const { createVehicleModelMemory } = require('./vehicle-model-memory');
const { createPowertrainCatalogMemory } = require('./powertrain-catalog-memory');
const { loadJson, saveJsonAtomic } = require('./json-store');
const { createDataIntakeLog } = require('./data-intake-log');
const { normalizePhone, phonesMatch } = require('./phone-normalize');

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS_PER_SUBMISSION = 15;
/** Trusted batch / QXB uploaders may attach full albums (review page shows all). */
const MAX_PHOTOS_TRUSTED_BATCH = 40;
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

function inferVideoMime(mimeType, filename) {
  const mime = String(mimeType || '').toLowerCase();
  if (ALLOWED_VIDEO_MIMES.has(mime)) return mime;
  const ext = path.extname(String(filename || '')).toLowerCase();
  const byExt = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
  };
  if (byExt[ext]) return byExt[ext];
  if (!mime || mime === 'application/octet-stream') return 'video/mp4';
  return mime;
}

function videoMimeCompatible(declared, sniffed) {
  if (!sniffed || !declared || declared === 'application/octet-stream') return true;
  const compatible = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']);
  return compatible.has(declared) && compatible.has(sniffed);
}

function createHalfCutApi(rootDir, options = {}) {
  const auth = options.auth || {};
  const requireAdmin = auth.requireAdmin || (() => false);
  const allowUpload = auth.allowUpload || (() => false);
  const authUser = auth.authUser || (() => null);

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

  async function saveOptimizedPhotoUpload({ dir, publicPrefix, part, maxBytes, pending, label = '' }) {
    const declared = part.contentType || 'application/octet-stream';
    const sniffed = sniffImageMime(part.body);
    const mime = sniffed || declared;
    if (!ALLOWED_PHOTO_MIMES.has(mime)) throw new Error(`Unsupported file type: ${mime}`);
    if (sniffed && declared !== 'application/octet-stream' && sniffed !== declared) {
      throw new Error('File content does not match declared type');
    }
    if (part.body.length > maxBytes) throw new Error(`File exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit`);

    let uploadBody = part.body;
    if (chassisBlur.isVinPlateLabel(label)) {
      uploadBody = await chassisBlur.blurVinSuffixBuffer(uploadBody, mime);
    }

    const optimized = await mediaOptimize.optimizeImageBuffer(uploadBody, mime);
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
    const strictMime = prefix !== 'video';
    if (strictMime && sniffed && declared !== 'application/octet-stream' && sniffed !== declared) {
      throw new Error('File content does not match declared type');
    }
    if (!strictMime && sniffed && declared !== 'application/octet-stream' && sniffed !== declared && !videoMimeCompatible(declared, sniffed)) {
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

  let publicCatalogCache = null;
  let publicCatalogMtime = 0;

  function findApprovedRaw(slug) {
    const needle = String(slug || '').trim();
    if (!needle) return null;
    const raw = loadJson(APPROVED_FILE, []);
    let item = raw.find((entry) => entry?.slug === needle
      || (Array.isArray(entry?.slugAliases) && entry.slugAliases.includes(needle)));
    if (!item) {
      const stockMatch = needle.match(/(hc\d+)/i);
      if (stockMatch) {
        const stockId = stockMatch[0].toUpperCase();
        item = raw.find((entry) => String(entry.stockId || '').toUpperCase() === stockId) || null;
      }
    }
    return item || null;
  }

  async function getPublicCatalog() {
    let mtime = 0;
    try {
      mtime = fs.statSync(APPROVED_FILE).mtimeMs;
    } catch {
      return { approved: [] };
    }
    if (publicCatalogCache && mtime === publicCatalogMtime) {
      return publicCatalogCache;
    }
    const raw = loadJson(APPROVED_FILE, []);
    publicCatalogCache = { approved: toPublicCatalogList(raw, 4) };
    publicCatalogMtime = mtime;
    return publicCatalogCache;
  }

  async function getPublicItemBySlug(slug) {
    const item = findApprovedRaw(slug);
    if (!item) return null;
    const photos = Array.isArray(item.photos)
      ? item.photos.map((photo) => {
        const url = String(photo?.url || '').trim();
        if (!url) return null;
        const thumbUrl = String(photo?.thumbUrl || '').trim();
        const label = String(photo?.label || '').trim();
        const next = { url };
        if (thumbUrl && thumbUrl !== url) next.thumbUrl = thumbUrl;
        if (label) next.label = label;
        return next;
      }).filter(Boolean)
      : [];
    const pub = toPublicItem({ ...item, photos });
    return pub;
  }

  function sendPublicJson(req, res, code, payload) {
    const body = JSON.stringify(payload);
    const etag = `"${crypto.createHash('sha1').update(body).digest('hex')}"`;
    const cacheControl = 'public, max-age=120, stale-while-revalidate=300';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': cacheControl });
      res.end();
      return;
    }
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      ETag: etag,
    });
    res.end(body);
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
      'passengerPartType',
      'truckPartType',
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
    if (edits.brand || edits.model || edits.passengerPartType !== undefined || edits.vehicleCondition) {
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

  const promoteQueue = new Set();
  let promoteRunning = false;

  async function drainPromoteQueue() {
    if (promoteRunning) return;
    promoteRunning = true;
    try {
      while (promoteQueue.size) {
        const stockId = promoteQueue.values().next().value;
        promoteQueue.delete(stockId);
        try {
          const approved = loadJson(APPROVED_FILE, []);
          const index = approved.findIndex((item) => item.stockId === stockId);
          if (index === -1) continue;
          const item = approved[index];
          if (!media.recordNeedsMediaPromote(item)) continue;
          const promoted = await media.promoteRecordMediaAsync(rootDir, item);
          approved[index] = promoted;
          saveJson(APPROVED_FILE, approved);
          console.log('[half-cut] background media promote complete:', stockId);
        } catch (err) {
          console.error('[half-cut] background media promote failed:', stockId, err.message);
        }
      }
    } finally {
      promoteRunning = false;
      if (promoteQueue.size) void drainPromoteQueue();
    }
  }

  function queueBackgroundPromote(stockId) {
    if (!stockId) return;
    promoteQueue.add(stockId);
    void drainPromoteQueue();
  }

  function queuePromoteForApprovedList(approved) {
    for (const item of approved || []) {
      if (media.recordNeedsMediaPromote(item)) queueBackgroundPromote(item.stockId);
    }
  }

  async function approveSubmissionById(submissionId, body) {
    assertNoEmbeddedMedia(body);
    const previous = getState();
    const index = previous.submissions.findIndex((item) => item.submissionId === submissionId);
    if (index === -1) throw new Error('Submission not found');

    const was = previous.submissions[index];
    if (was.reviewStatus === 'approved') {
      const existing = previous.approved.find((item) => item.submissionId === submissionId);
      if (existing) {
        return { ok: true, submission: was, inventoryItem: existing, promoteQueued: false };
      }
    }
    if (was.reviewStatus !== 'pending') throw new Error('Submission is not pending');

    let submission = body.submission;
    let inventoryItem = body.inventoryItem;
    if (!submission || !inventoryItem) throw new Error('submission and inventoryItem required');
    if (submission.submissionId !== submissionId) throw new Error('submissionId mismatch');
    if (inventoryItem.submissionId !== submissionId) throw new Error('inventory submissionId mismatch');
    if (previous.approved.some((item) => item.stockId === inventoryItem.stockId)) {
      throw new Error('Duplicate stockId');
    }

    submission = nameNorm.normalizeSubmissionRecord(submission, rootDir);
    inventoryItem = nameNorm.normalizeInventoryRecord(inventoryItem, rootDir);
    // Preserve dedicated part type from submission when approve payload omitted it.
    if (!String(inventoryItem.passengerPartType || '').trim()
      && String(submission.passengerPartType || '').trim()) {
      inventoryItem.passengerPartType = String(submission.passengerPartType).trim();
      inventoryItem = nameNorm.normalizeInventoryRecord(inventoryItem, rootDir);
    }
    inventoryItem = nameNorm.rebuildInventoryDerivedFields(inventoryItem);

    const submissions = previous.submissions.slice();
    submissions[index] = submission;
    const approved = [
      inventoryItem,
      ...previous.approved.filter((item) => item.stockId !== inventoryItem.stockId),
    ];

    saveJson(SUBMISSIONS_FILE, submissions);
    saveJson(APPROVED_FILE, approved);

    modelMemory.rememberVehicle(submission);
    modelMemory.rememberVehicle(inventoryItem);
    powertrainMemory.rememberFromHalfCut(inventoryItem);

    const next = { submissions, approved };
    const events = diffHalfCutState(previous, next);
    notifyHalfCutEvents(events);

    const promoteQueued = media.recordNeedsMediaPromote(inventoryItem);
    if (promoteQueued) queueBackgroundPromote(inventoryItem.stockId);

    return { ok: true, submission, inventoryItem, promoteQueued };
  }

  function rejectSubmissionById(submissionId, body) {
    const previous = getState();
    const index = previous.submissions.findIndex((item) => item.submissionId === submissionId);
    if (index === -1) throw new Error('Submission not found');

    const was = previous.submissions[index];
    if (was.reviewStatus === 'rejected') {
      return { ok: true, submission: was };
    }
    if (was.reviewStatus !== 'pending') throw new Error('Submission is not pending');

    const reason = String(body?.reason || '').trim();
    const submissions = previous.submissions.slice();
    submissions[index] = {
      ...was,
      reviewStatus: 'rejected',
      rejectReason: reason,
      reviewedAt: new Date().toISOString(),
    };

    saveJson(SUBMISSIONS_FILE, submissions);
    const next = { submissions, approved: previous.approved };
    const events = diffHalfCutState(previous, next);
    notifyHalfCutEvents(events);
    return { ok: true, submission: submissions[index] };
  }

  async function putState(body) {
    assertNoEmbeddedMedia(body);
    const previous = getState();
    const submissions = Array.isArray(body.submissions) ? body.submissions : [];
    const approvedInput = Array.isArray(body.approved) ? body.approved : [];

    // Guard: bulk price rewrites require explicit CEO/admin confirmation.
    // Meaning: 一次改很多条价格会被拦住，除非带 allowBulkPriceUpdate=true。
    const prevPrice = new Map(
      (previous.approved || []).map((item) => [String(item.stockId || ''), item.priceUsd])
    );
    const priceChanged = approvedInput.filter((item) => {
      const sid = String(item?.stockId || '');
      if (!sid || !prevPrice.has(sid)) return false;
      const before = Number(prevPrice.get(sid));
      const after = Number(item.priceUsd);
      if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
      return before !== after;
    });
    const allowBulkPrice = body?.allowBulkPriceUpdate === true
      || String(process.env.ALLOW_BULK_PRICE_UPDATE || '') === '1';
    if (priceChanged.length >= 3 && !allowBulkPrice) {
      throw new Error(
        `Blocked bulk price update (${priceChanged.length} items). `
        + 'Pass allowBulkPriceUpdate:true only with CEO authorization.'
      );
    }

    const { state: normalized } = nameNorm.normalizeState(
      { submissions, approved: approvedInput },
      rootDir
    );
    const approved = normalized.approved;
    saveJson(SUBMISSIONS_FILE, normalized.submissions);
    saveJson(APPROVED_FILE, approved);
    normalized.submissions.forEach((item) => modelMemory.rememberVehicle(item));
    approved.forEach((item) => {
      modelMemory.rememberVehicle(item);
      powertrainMemory.rememberFromHalfCut(item);
    });
    queuePromoteForApprovedList(approved);
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

  function supplierOwnsRecord(user, record) {
    if (!user || !record) return false;
    if (user.role === 'admin') return true;
    if (user.id && record.supplierId && record.supplierId === user.id) return true;
    const userPhone = normalizePhone(user.phoneNormalized || user.phone, user.countryCode);
    const recordPhone = normalizePhone(record.supplierPhoneNormalized || record.supplierPhone, '');
    return Boolean(userPhone && recordPhone && phonesMatch(userPhone, recordPhone));
  }

  function summarizeUpload(record, source) {
    return {
      id: record.stockId || record.approvedStockId || record.submissionId,
      submissionId: record.submissionId || '',
      stockId: record.stockId || record.approvedStockId || '',
      slug: record.slug || record.approvedSlug || '',
      title: record.title || [record.brand, record.model, record.year].filter(Boolean).join(' '),
      brand: record.brand || '',
      model: record.model || '',
      year: record.year || null,
      engineCode: record.engineCode || '',
      transmissionCode: record.transmissionCode || '',
      drivetrain: record.drivetrain || '',
      mileage: record.mileage ?? '',
      priceUsd: record.priceUsd,
      shortDescription: record.shortDescription || '',
      notes: record.notes || '',
      inventoryStatus: record.inventoryStatus || 'Available',
      reviewStatus: record.reviewStatus || (source === 'approved' ? 'approved' : 'pending'),
      source,
      editable: true,
      supplierId: record.supplierId || '',
      supplierName: record.supplierName || '',
      supplierPhone: record.supplierPhone || '',
      createdAt: record.createdAt || record.approvedAt || null,
      updatedAt: record.updatedAt || null,
      photo: Array.isArray(record.photos) && record.photos[0]
        ? (typeof record.photos[0] === 'string' ? record.photos[0] : record.photos[0].url)
        : '',
    };
  }

  const SUPPLIER_EDITABLE_FIELDS = new Set([
    'brand',
    'model',
    'year',
    'engineCode',
    'transmissionCode',
    'drivetrain',
    'mileage',
    'priceUsd',
    'shortDescription',
    'notes',
    'inventoryStatus',
  ]);

  function findOwnedRecord(user, id) {
    const key = String(id || '').trim();
    if (!key) return null;
    const state = getState();
    const approved = state.approved.find((item) => (
      supplierOwnsRecord(user, item)
      && (item.stockId === key || item.approvedStockId === key || item.slug === key || item.submissionId === key)
    ));
    if (approved) return { kind: 'approved', record: approved };
    const submission = state.submissions.find((item) => (
      supplierOwnsRecord(user, item)
      && (item.submissionId === key || item.approvedStockId === key)
    ));
    if (submission) return { kind: 'submission', record: submission };
    return null;
  }

  function getUploadDetailForSupplier(user, id) {
    const found = findOwnedRecord(user, id);
    if (!found) {
      throw Object.assign(new Error('Listing not found or not owned by you'), { statusCode: 404 });
    }
    return {
      ok: true,
      item: summarizeUpload(found.record, found.kind === 'approved' ? 'approved' : 'submission'),
      kind: found.kind,
    };
  }

  function updateOwnUpload(user, id, rawEdits) {
    if (!user || (user.role !== 'supplier' && user.role !== 'admin')) {
      throw Object.assign(new Error('Supplier authentication required'), { statusCode: 401 });
    }
    const found = findOwnedRecord(user, id);
    if (!found) {
      throw Object.assign(new Error('Listing not found or not owned by you'), { statusCode: 404 });
    }

    const edits = {};
    Object.entries(rawEdits || {}).forEach(([key, value]) => {
      if (!SUPPLIER_EDITABLE_FIELDS.has(key)) return;
      if (value === undefined || value === null) return;
      edits[key] = value;
    });
    if (!Object.keys(edits).length) throw new Error('No editable fields provided');

    if (edits.inventoryStatus) {
      const allowedStatus = new Set(['Available', 'Reserved', 'In Transit', 'Sold']);
      if (!allowedStatus.has(String(edits.inventoryStatus))) {
        throw new Error('Invalid inventoryStatus');
      }
    }

    if (found.kind === 'approved') {
      // Reuse admin inventory patch, but only after ownership check above.
      const item = updateApprovedInventory(found.record.stockId, edits);
      return { ok: true, item: summarizeUpload(item, 'approved'), kind: 'approved' };
    }

    const previous = getState();
    const index = previous.submissions.findIndex((item) => item.submissionId === found.record.submissionId);
    if (index < 0) throw new Error('Submission not found');
    let submission = { ...previous.submissions[index], ...edits };
    if (edits.year !== undefined && edits.year !== '') submission.year = Number(edits.year);
    if (edits.priceUsd !== undefined && edits.priceUsd !== '') {
      submission.priceUsd = Number(Number(edits.priceUsd).toFixed(2));
    }
    if (edits.brand || edits.model) {
      submission = nameNorm.normalizeSubmissionRecord(submission, rootDir);
    }
    submission.updatedAt = new Date().toISOString();
    submission.updatedBySupplierId = user.id;
    const submissions = previous.submissions.slice();
    submissions[index] = submission;
    saveJson(SUBMISSIONS_FILE, submissions);
    return { ok: true, item: summarizeUpload(submission, 'submission'), kind: 'submission' };
  }

  function listUploadsForSupplier(user) {
    if (!user || (user.role !== 'supplier' && user.role !== 'admin')) {
      throw Object.assign(new Error('Supplier authentication required'), { statusCode: 401 });
    }
    const state = getState();
    const submissions = state.submissions
      .filter((item) => supplierOwnsRecord(user, item))
      .map((item) => summarizeUpload(item, 'submission'));
    const approved = state.approved
      .filter((item) => supplierOwnsRecord(user, item))
      .map((item) => summarizeUpload(item, 'approved'));

    // Prefer approved row when the same submission was promoted
    const approvedSubmissionIds = new Set(
      state.approved.map((item) => item.submissionId).filter(Boolean),
    );
    const pendingOrRejected = submissions.filter((item) => !approvedSubmissionIds.has(item.submissionId));
    const items = [...pendingOrRejected, ...approved]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    return {
      ok: true,
      supplier: {
        id: user.id,
        supplierName: user.supplierName,
        phone: user.phone,
        phoneNormalized: normalizePhone(user.phoneNormalized || user.phone, user.countryCode),
      },
      counts: {
        pending: items.filter((i) => i.reviewStatus === 'pending').length,
        approved: items.filter((i) => i.reviewStatus === 'approved' || i.source === 'approved').length,
        rejected: items.filter((i) => i.reviewStatus === 'rejected').length,
        total: items.length,
      },
      items,
    };
  }

  function bindSupplierIdentity(submission, user) {
    if (!user || (user.role !== 'supplier' && user.role !== 'admin')) return submission;
    const phoneNorm = normalizePhone(user.phoneNormalized || user.phone, user.countryCode);
    submission.supplierId = user.id;
    if (user.supplierName) submission.supplierName = user.supplierName;
    if (user.phone && !submission.supplierPhone) submission.supplierPhone = user.phone;
    if (phoneNorm) {
      submission.supplierPhoneNormalized = phoneNorm;
      if (!submission.supplierPhone) {
        submission.supplierPhone = phoneNorm.startsWith('86') ? phoneNorm.slice(2) : phoneNorm;
      }
    }
    return submission;
  }

  function reserveApprovedStock(stockId, { orderId, reason } = {}) {
    const id = String(stockId || '').trim();
    if (!id) throw new Error('stockId required');
    const previous = getState();
    const index = previous.approved.findIndex(
      (item) => item.stockId === id || item.approvedStockId === id || item.slug === id,
    );
    if (index < 0) throw new Error(`Approved stock not found: ${id}`);
    const item = { ...previous.approved[index] };
    item.inventoryStatus = 'Reserved';
    item.reservedAt = new Date().toISOString();
    if (orderId) item.reservedOrderId = orderId;
    if (reason) item.reserveReason = reason;
    const approved = previous.approved.slice();
    approved[index] = item;
    saveJson(APPROVED_FILE, approved);
    return item;
  }

  function appendSubmission(submission, actor = null, options = {}) {
    assertNoEmbeddedMedia(submission, 'submission');
    if (!submission || typeof submission !== 'object') throw new Error('Invalid submission');
    if (!submission.submissionId) throw new Error('submissionId required');
    if (actor) submission = bindSupplierIdentity(submission, actor);
    const meta = nameNorm.normalizeListingMeta(submission);
    const isLooseTruckPart = meta?.vehicleCategory === 'truck'
      && ['cab', 'engine', 'axle', 'other'].includes(meta?.truckPartType);
    const isLoosePassengerPart = meta?.vehicleCategory === 'passenger'
      && ['front', 'engine', 'transmission', 'chassis', 'other'].includes(meta?.passengerPartType);
    const isLoosePart = isLooseTruckPart || isLoosePassengerPart;
    const isMachinery = meta?.vehicleCategory === 'machinery';
    const vin = String(submission.vin || '').trim();
    if (!isLoosePart && !isMachinery && vin.length !== 17) throw new Error('Valid VIN required');
    if (isLoosePart && vin && vin.length !== 17) throw new Error('VIN must be 17 characters when provided');
    if (!Array.isArray(submission.photos) || submission.photos.length < (isMachinery ? 4 : 3)) {
      throw new Error(isMachinery ? 'At least 4 photos required for machinery' : 'At least 3 photos required');
    }
    const photoCap = options.maxPhotos || MAX_PHOTOS_PER_SUBMISSION;
    if (submission.photos.length > photoCap) {
      throw new Error(`At most ${photoCap} photos allowed`);
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
    // 仅白名单 IP + 有效 supplier key 的批量工作站跳过 upload-token 配额
    if (!isTrustedBatchUploader(req) && !limitUploadToken(req)) return null;
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
        uploadVia: r2.uploadConfig().directUpload ? 'direct' : (r2.isEnabled() ? 'r2-server' : 'disk'),
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
      sendPublicJson(req, res, 200, catalog);
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/half-cuts/public/item') {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const slug = url.searchParams.get('slug') || url.searchParams.get('stockId') || '';
      const item = await getPublicItemBySlug(slug);
      if (!item) {
        json(res, 404, { error: 'Listing not found' });
        return true;
      }
      sendPublicJson(req, res, 200, { item });
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
      if (!r2.isEnabled() || !r2.uploadConfig().directUpload) {
        json(res, 503, { error: 'Direct upload not configured — use server upload endpoint' });
        return true;
      }
      if (!consumeUploadToken(req)) {
        json(res, 401, { error: 'Upload token required' });
        return true;
      }
      try {
        const body = await readJsonBody(req);
        const kind = body.kind === 'video' ? 'video' : 'photo';
        let mimeType = String(body.mimeType || body.contentType || '').trim();
        if (kind === 'video') mimeType = inferVideoMime(mimeType, body.filename);
        const size = Number(body.size || 0);
        const allowed = kind === 'video' ? ALLOWED_VIDEO_MIMES : ALLOWED_PHOTO_MIMES;
        const maxBytes = kind === 'video' ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
        if (!allowed.has(mimeType)) throw new Error(`Unsupported file type: ${mimeType || 'unknown'}`);
        if (!size || size > maxBytes) throw new Error(`File exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit`);
        const prefix = kind === 'video' ? 'video' : 'photo';
        const filename = safeFilename(body.filename, mimeType, prefix);
        const key = kind === 'video' ? r2.pendingVideoKey(filename) : r2.pendingPhotoKey(filename);
        const uploadUrl = r2.createPresignedPutUrl(key, mimeType);
        if (!uploadUrl) {
          json(res, 503, { error: 'Direct upload not configured — use server upload endpoint' });
          return true;
        }
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
      if (!isTrustedBatchUploader(req) && !limitSubmission(req)) {
        json(res, 429, { error: 'Too many submissions' });
        return true;
      }
      try {
        const body = await readJsonBody(req);
        const actor = authUser(req);
        const maxPhotos = isTrustedBatchUploader(req)
          ? MAX_PHOTOS_TRUSTED_BATCH
          : MAX_PHOTOS_PER_SUBMISSION;
        const submission = appendSubmission(body, actor, { maxPhotos });
        revokeUploadToken(req);
        json(res, 201, { ok: true, submissionId: submission.submissionId, supplierId: submission.supplierId || null });
      } catch (err) {
        json(res, 400, { error: err.message || 'Request failed' });
      }
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/half-cuts/my-uploads') {
      const user = authUser(req);
      if (!user || (user.role !== 'supplier' && user.role !== 'admin')) {
        json(res, 401, { error: 'Supplier authentication required' });
        return true;
      }
      try {
        json(res, 200, listUploadsForSupplier(user));
      } catch (err) {
        json(res, err.statusCode || 400, { error: err.message || 'Request failed' });
      }
      return true;
    }

    const myUploadMatch = pathname.match(/^\/api\/half-cuts\/my-uploads\/([^/]+)$/);
    if (myUploadMatch && req.method === 'GET') {
      const user = authUser(req);
      if (!user || (user.role !== 'supplier' && user.role !== 'admin')) {
        json(res, 401, { error: 'Supplier authentication required' });
        return true;
      }
      try {
        json(res, 200, getUploadDetailForSupplier(user, decodeURIComponent(myUploadMatch[1])));
      } catch (err) {
        json(res, err.statusCode || 400, { error: err.message || 'Request failed' });
      }
      return true;
    }

    if (myUploadMatch && req.method === 'PATCH') {
      const user = authUser(req);
      if (!user || (user.role !== 'supplier' && user.role !== 'admin')) {
        json(res, 401, { error: 'Supplier authentication required' });
        return true;
      }
      try {
        const body = await readJsonBody(req);
        const result = updateOwnUpload(user, decodeURIComponent(myUploadMatch[1]), body);
        json(res, 200, result);
      } catch (err) {
        json(res, err.statusCode || 400, { error: err.message || 'Request failed' });
      }
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/half-cuts/my-submissions') {
      const user = authUser(req);
      if (!user || (user.role !== 'supplier' && user.role !== 'admin')) {
        json(res, 401, { error: 'Supplier authentication required' });
        return true;
      }
      try {
        json(res, 200, listUploadsForSupplier(user));
      } catch (err) {
        json(res, err.statusCode || 400, { error: err.message || 'Request failed' });
      }
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/half-cuts/state') {
      if (!requireAdmin(req, res)) return true;
      json(res, 200, getState());
      return true;
    }

    const approveMatch = pathname.match(/^\/api\/half-cuts\/submissions\/([^/]+)\/approve$/);
    if (approveMatch && req.method === 'POST') {
      if (!requireAdmin(req, res)) return true;
      try {
        const body = await readJsonBody(req);
        const result = await approveSubmissionById(decodeURIComponent(approveMatch[1]), body);
        json(res, 200, result);
      } catch (err) {
        json(res, 400, { error: err.message || 'Request failed' });
      }
      return true;
    }

    const rejectMatch = pathname.match(/^\/api\/half-cuts\/submissions\/([^/]+)\/reject$/);
    if (rejectMatch && req.method === 'POST') {
      if (!requireAdmin(req, res)) return true;
      try {
        const body = await readJsonBody(req, 64 * 1024);
        const result = rejectSubmissionById(decodeURIComponent(rejectMatch[1]), body);
        json(res, 200, result);
      } catch (err) {
        json(res, 400, { error: err.message || 'Request failed' });
      }
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
      if (!isTrustedBatchUploader(req) && !limitUpload(req)) {
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
        const labelPart = parts.find((part) => part.name === 'label');
        const uploadLabel = labelPart?.body?.length ? labelPart.body.toString('utf8') : '';
        const saved = await saveOptimizedPhotoUpload({
          dir: PENDING_PHOTOS_DIR,
          publicPrefix: media.pendingPhotoPrefix(),
          part: filePart,
          maxBytes: MAX_PHOTO_BYTES,
          pending: true,
          label: uploadLabel,
        });
        if (uploadLabel) saved.label = uploadLabel;
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
      if (!isTrustedBatchUploader(req) && !limitUpload(req)) {
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
    getPublicItemBySlug,
    updateApprovedInventory,
    reserveApprovedStock,
    listUploadsForSupplier,
    getUploadDetailForSupplier,
    updateOwnUpload,
    modelMemory,
    powertrainMemory,
  };
}

module.exports = { createHalfCutApi };
