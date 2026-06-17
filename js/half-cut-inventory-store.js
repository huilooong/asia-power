/**
 * AsiaPower — Half-Cut Store Facade (localStorage persistence)
 * Orchestrates Upload / Review / Inventory layers.
 */
(function () {
  'use strict';

  const SUBMISSIONS_KEY = 'halfCutSubmissions';
  const APPROVED_KEY = 'halfCutApprovedInventory';

  const Vin = () => window.HalfCutVin;
  const Upload = () => window.HalfCutUploadLayer;
  const Review = () => window.HalfCutReviewLayer;
  const Inventory = () => window.HalfCutInventoryLayer;

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

  function getSubmissions() {
    return readJson(SUBMISSIONS_KEY, []);
  }

  function saveSubmissions(list) {
    writeJson(SUBMISSIONS_KEY, list);
  }

  function getApprovedInventory() {
    return readJson(APPROVED_KEY, []);
  }

  function saveApprovedInventory(list) {
    writeJson(APPROVED_KEY, list);
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
    const approved = getApprovedInventory();
    const all = [...seed, ...approved];
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
    const labels = Vin()?.PHOTO_LABELS || [];
    if (!Array.isArray(photos)) return [];
    return photos
      .map((photo, index) => {
        if (typeof photo === 'string') {
          return { label: labels[index] || `Photo ${index + 1}`, dataUrl: photo };
        }
        return {
          label: photo.label || labels[index] || `Photo ${index + 1}`,
          dataUrl: photo.dataUrl || photo.url || '',
        };
      })
      .filter(p => p.dataUrl);
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
    Inventory().syncToCatalog(window.SEED_HALF_CUT_LIST || [], getApprovedInventory());
  }

  function addSubmission(data) {
    const validation = Upload().validateSubmission(data);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    const submission = Upload().buildSubmissionRecord(
      { ...data, photos: validation.photos },
      generateSubmissionId
    );

    const list = getSubmissions();
    list.unshift(submission);
    saveSubmissions(list);
    return submission;
  }

  function updateSubmission(submissionId, edits) {
    const list = getSubmissions();
    const index = list.findIndex(s => s.submissionId === submissionId);
    if (index === -1) return null;
    list[index] = Review().applyEdits(list[index], edits);
    saveSubmissions(list);
    return list[index];
  }

  function approveSubmission(submissionId, edits) {
    const list = getSubmissions();
    const index = list.findIndex(s => s.submissionId === submissionId);
    if (index === -1) return null;

    let submission = list[index];
    if (edits) submission = Review().applyEdits(submission, edits);

    if (submission.reviewStatus === 'approved') {
      return getApprovedInventory().find(i => i.submissionId === submissionId) || null;
    }

    const approvalCheck = Review().validateForApproval(submission);
    if (!approvalCheck.valid) {
      throw new Error(approvalCheck.errors.join(' '));
    }

    const inventoryItem = Inventory().submissionToInventory(submission, inventoryHelpers);
    submission = Review().markApproved(submission, inventoryItem);
    list[index] = submission;
    saveSubmissions(list);

    const approved = getApprovedInventory();
    approved.unshift(inventoryItem);
    saveApprovedInventory(approved);
    syncLiveInventory();
    return inventoryItem;
  }

  function rejectSubmission(submissionId, reason) {
    const list = getSubmissions();
    const index = list.findIndex(s => s.submissionId === submissionId);
    if (index === -1) return false;
    list[index] = Review().markRejected(list[index], reason);
    saveSubmissions(list);
    return true;
  }

  function updateInventoryStatus(stockId, status) {
    const allowed = Vin().ADMIN_STATUSES;
    if (!allowed.includes(status)) throw new Error('Invalid status');
    const approved = getApprovedInventory();
    const item = approved.find(i => i.stockId === stockId);
    if (!item) return null;
    item.status = status;
    saveApprovedInventory(approved);
    syncLiveInventory();
    return item;
  }

  function getSubmissionsByStatus(status) {
    return getSubmissions().filter(s => s.reviewStatus === status);
  }

  function getSubmissionById(submissionId) {
    return getSubmissions().find(s => s.submissionId === submissionId) || null;
  }

  function getPublicInventory() {
    return Inventory().toPublicList(getApprovedInventory());
  }

  function getPublicItemBySlug(slug) {
    const item = getApprovedInventory().find(i => i.slug === slug);
    return item ? Inventory().toPublicItem(item) : null;
  }

  window.HalfCutInventoryStore = {
    SUBMISSIONS_KEY,
    APPROVED_KEY,
    SUPPORTED_BRANDS: Object.keys(Vin()?.BRAND_SLUG_MAP || {}),
    PHOTO_LABELS: Vin()?.PHOTO_LABELS || [],
    brandToSlug: (b) => Vin().brandToSlug(b),
    formatMileage,
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

  syncLiveInventory();
})();
