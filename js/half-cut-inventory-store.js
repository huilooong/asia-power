/**
 * AsiaPower — Half-Cut Store Facade (server JSON or URL-only local fallback)
 */
(function () {
  'use strict';

  const SUBMISSIONS_KEY = 'halfCutSubmissions';
  const APPROVED_KEY = 'halfCutApprovedInventory';

  const Vin = () => window.HalfCutVin;
  const Upload = () => window.HalfCutUploadLayer;
  const Review = () => window.HalfCutReviewLayer;
  const Inventory = () => window.HalfCutInventoryLayer;
  const MediaApi = () => window.HalfCutMediaApi;

  let serverMode = false;
  let readyPromise = null;
  let submissionsCache = [];
  let approvedCache = [];

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function stripEmbeddedMediaFromState() {
    submissionsCache = submissionsCache.map((item) => sanitizeRecord(item));
    approvedCache = approvedCache.map((item) => sanitizeRecord(item));
  }

  function sanitizeRecord(record) {
    if (!record || typeof record !== 'object') return record;
    const copy = { ...record };
    if (Array.isArray(copy.photos)) {
      copy.photos = Upload().normalizePhotos(copy.photos);
    }
    copy.video = Upload().normalizeVideo(copy.video, copy.videoUrl);
    copy.videoUrl = copy.video?.url || '';
    return copy;
  }

  async function persistState() {
    stripEmbeddedMediaFromState();
    if (serverMode) {
      await MediaApi().saveState({ submissions: submissionsCache, approved: approvedCache });
      return;
    }
    writeJson(SUBMISSIONS_KEY, submissionsCache);
    writeJson(APPROVED_KEY, approvedCache);
  }

  function loadLocalFallback() {
    submissionsCache = readJson(SUBMISSIONS_KEY, []);
    approvedCache = readJson(APPROVED_KEY, []);
    stripEmbeddedMediaFromState();
  }

  async function initStore() {
    if (MediaApi()?.init) await MediaApi().init();
    serverMode = !!MediaApi()?.isServerMode?.();
    if (serverMode) {
      const state = await MediaApi().fetchState();
      submissionsCache = Array.isArray(state.submissions) ? state.submissions : [];
      approvedCache = Array.isArray(state.approved) ? state.approved : [];
      stripEmbeddedMediaFromState();
    } else {
      loadLocalFallback();
    }
    syncLiveInventory();
    return serverMode;
  }

  function whenReady() {
    if (!readyPromise) readyPromise = initStore();
    return readyPromise;
  }

  function getSubmissions() {
    return submissionsCache.slice();
  }

  function saveSubmissions(list) {
    submissionsCache = list.slice();
    return persistState();
  }

  function getApprovedInventory() {
    return approvedCache.slice();
  }

  function saveApprovedInventory(list) {
    approvedCache = list.slice();
    return persistState();
  }

  function generateSubmissionId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SUB-${ts}-${rand}`;
  }

  function slugifyPart(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function formatMileage(value) {
    const raw = String(value || '').replace(/[^\d]/g, '');
    if (!raw) return String(value || '').trim();
    const num = parseInt(raw, 10);
    if (Number.isNaN(num)) return String(value).trim();
    return `${num.toLocaleString('en-US')} km`;
  }

  function parseIncludedParts(text) {
    const lines = String(text || '')
      .split(/\n|,/)
      .map(s => s.trim())
      .filter(Boolean);
    if (lines.length) return lines;
    return ['Engine & gearbox assembly', 'Front clip', 'Wiring harness', 'Radiator pack'];
  }

  function nextStockId() {
    const seed = window.SEED_HALF_CUT_LIST || window.HALF_CUT_LIST || [];
    const all = [...seed, ...approvedCache];
    let max = 250000;
    all.forEach(item => {
      const m = String(item.stockId || '').match(/HC(\d+)/i);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `HC${max + 1}`;
  }

  function buildSlug(record) {
    const parts = [
      record.brandSlug,
      slugifyPart(record.model),
      record.year,
      slugifyPart(record.engineCode),
      'half-cut',
      String(record.stockId).toLowerCase(),
    ];
    return parts.filter(Boolean).join('-');
  }

  function buildTitle(record) {
    return `${record.brand} ${record.model} ${record.engineCode} Half Cut`;
  }

  function buildShortDescription(submission) {
    const notes = String(submission.notes || '').trim();
    if (notes) return notes.split('\n')[0].slice(0, 220);
    return `${submission.year} ${submission.brand} ${submission.model} with ${submission.engineCode} — supplier-verified listing via AsiaPower.`;
  }

  function normalizePhotos(photos) {
    return Upload().normalizePhotos(photos);
  }

  const inventoryHelpers = {
    nextStockId,
    formatMileage,
    normalizePhotos,
    parseIncludedParts,
    buildSlug,
    buildTitle,
    buildShortDescription,
  };

  function syncLiveInventory() {
    Inventory().syncToCatalog(window.SEED_HALF_CUT_LIST || [], approvedCache);
  }

  async function addSubmission(data) {
    const validation = Upload().validateSubmission(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    if (!serverMode) {
      const hasOnlyUrls = validation.photos.every((p) => p.url && !Upload().isDataUrl(p.url));
      const videoOk = !validation.video || (validation.video.url && !Upload().isDataUrl(validation.video.url));
      if (!hasOnlyUrls || !videoOk) {
        throw new Error('Media uploads require the local half-cut server. Run: node server/half-cut-local-server.js');
      }
    }

    const submission = Upload().buildSubmissionRecord(
      { ...data, photos: validation.photos, video: validation.video },
      generateSubmissionId
    );

    submissionsCache.unshift(submission);
    await persistState();
    return submission;
  }

  async function updateSubmission(submissionId, edits) {
    const index = submissionsCache.findIndex(s => s.submissionId === submissionId);
    if (index === -1) return null;
    submissionsCache[index] = Review().applyEdits(submissionsCache[index], edits);
    await persistState();
    return submissionsCache[index];
  }

  async function approveSubmission(submissionId, edits) {
    const index = submissionsCache.findIndex(s => s.submissionId === submissionId);
    if (index === -1) return null;

    let submission = submissionsCache[index];
    if (edits) submission = Review().applyEdits(submission, edits);

    if (submission.reviewStatus === 'approved') {
      return approvedCache.find(i => i.submissionId === submissionId) || null;
    }

    const approvalCheck = Review().validateForApproval(submission);
    if (!approvalCheck.valid) {
      throw new Error(approvalCheck.errors.join(' '));
    }

    const inventoryItem = Inventory().submissionToInventory(submission, inventoryHelpers);
    submission = Review().markApproved(submission, inventoryItem);
    submissionsCache[index] = submission;
    approvedCache.unshift(inventoryItem);
    await persistState();
    syncLiveInventory();
    return inventoryItem;
  }

  async function rejectSubmission(submissionId, reason) {
    const index = submissionsCache.findIndex(s => s.submissionId === submissionId);
    if (index === -1) return false;
    submissionsCache[index] = Review().markRejected(submissionsCache[index], reason);
    await persistState();
    return true;
  }

  async function updateInventoryStatus(stockId, status) {
    const allowed = Vin().ADMIN_STATUSES;
    if (!allowed.includes(status)) throw new Error('Invalid status');
    const item = approvedCache.find(i => i.stockId === stockId);
    if (!item) return null;
    item.status = status;
    await persistState();
    syncLiveInventory();
    return item;
  }

  function getSubmissionsByStatus(status) {
    return submissionsCache.filter(s => s.reviewStatus === status);
  }

  function getSubmissionById(submissionId) {
    return submissionsCache.find(s => s.submissionId === submissionId) || null;
  }

  function getPublicInventory() {
    return Inventory().toPublicList(approvedCache);
  }

  function getPublicItemBySlug(slug) {
    const item = approvedCache.find(i => i.slug === slug);
    return item ? Inventory().toPublicItem(item) : null;
  }

  window.HalfCutInventoryStore = {
    SUBMISSIONS_KEY,
    APPROVED_KEY,
    SUPPORTED_BRANDS: Object.keys(Vin()?.BRAND_SLUG_MAP || {}),
    PHOTO_LABELS: Vin()?.PHOTO_LABELS || [],
    brandToSlug: (b) => Vin().brandToSlug(b),
    formatMileage,
    whenReady,
    isServerMode: () => serverMode,
    getSubmissions,
    getSubmissionById,
    getSubmissionsByStatus,
    getApprovedInventory,
    getPublicInventory,
    getPublicItemBySlug,
    addSubmission,
    updateSubmission,
    approveSubmission,
    rejectSubmission,
    updateInventoryStatus,
    syncLiveInventory,
    toPublicItem: (item) => Inventory().toPublicItem(item),
  };
})();
