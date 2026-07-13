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
  let adminMode = false;
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
    const upload = Upload();
    if (upload?.normalizePhotos && Array.isArray(copy.photos)) {
      copy.photos = upload.normalizePhotos(copy.photos);
    }
    if (upload?.normalizeVideo) {
      copy.video = upload.normalizeVideo(copy.video, copy.videoUrl);
      copy.videoUrl = copy.video?.url || '';
    }
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

  function isAdminContext() {
    return document.body?.dataset?.page === 'admin-review'
      || document.body?.dataset?.page === 'admin-inventory'
      || /\/admin\//i.test(window.location.pathname);
  }

  function isSupplierUploadContext() {
    return document.body?.dataset?.page === 'supplier-upload'
      || /\/supplier-portal\/(?:half-cut|truck)-upload\.html/i.test(window.location.pathname);
  }

  async function probeServerMode() {
    const api = MediaApi();
    if (api?.init) {
      await api.init();
      return !!api.isServerMode?.();
    }
    try {
      const res = await fetch(`${window.location.origin}/api/half-cuts/health`);
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.ok;
    } catch {
      return false;
    }
  }

  async function loadPublicCatalog() {
    const api = MediaApi();
    if (api?.fetchPublic) {
      const data = await api.fetchPublic();
      return Array.isArray(data.approved) ? data.approved : [];
    }
    const res = await fetch(`${window.location.origin}/api/half-cuts/public`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load catalog');
    return Array.isArray(data.approved) ? data.approved : [];
  }

  async function loadAdminState() {
    const api = MediaApi();
    if (!api?.fetchState) throw new Error('Admin review requires server API');
    try {
      return await api.fetchState();
    } catch (err) {
      if (/authentication required|unauthorized/i.test(String(err?.message || ''))) {
        resetReady();
      }
      throw err;
    }
  }
  async function initStore() {
    adminMode = isAdminContext();
    const supplierUpload = isSupplierUploadContext();
    serverMode = await probeServerMode();
    if (serverMode) {
      if (adminMode) {
        const state = await loadAdminState();
        submissionsCache = Array.isArray(state.submissions) ? state.submissions : [];
        approvedCache = Array.isArray(state.approved) ? state.approved : [];
      } else if (supplierUpload) {
        approvedCache = [];
        submissionsCache = [];
      } else {
        approvedCache = await loadPublicCatalog();
        submissionsCache = [];
      }
      stripEmbeddedMediaFromState();
    } else {
      loadLocalFallback();
    }
    if (!supplierUpload) syncLiveInventory();
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
    let cutSegment = 'half-cut';
    if (record.vehicleCategory === 'truck') {
      if (record.truckPartType === 'cab') cutSegment = 'truck-cab';
      else if (record.truckPartType === 'engine') cutSegment = 'truck-engine';
      else if (record.truckPartType === 'axle') cutSegment = 'truck-axle';
      else if (record.truckPartType === 'other') cutSegment = 'truck-part';
      else cutSegment = 'truck-half-cut';
    } else if (record.vehicleCategory === 'machinery') {
      const type = String(record.machineryType || 'equipment').trim() || 'equipment';
      cutSegment = `machinery-${type}`;
    } else if (record.passengerPartType === 'front') {
      cutSegment = 'front-cut';
    } else if (record.passengerPartType === 'engine') {
      cutSegment = 'passenger-engine';
    } else if (record.passengerPartType === 'transmission') {
      cutSegment = 'passenger-transmission';
    } else if (record.passengerPartType === 'chassis') {
      cutSegment = 'passenger-chassis';
    } else if (record.passengerPartType === 'other') {
      cutSegment = 'passenger-part';
    }
    const enginePart = slugifyPart(record.engineCode)
      || (record.truckPartType === 'cab' ? 'cab' : '')
      || (record.passengerPartType === 'transmission' ? slugifyPart(record.transmissionCode) : '');
    const parts = [
      record.brandSlug,
      slugifyPart(record.model),
      record.year,
      enginePart,
      cutSegment,
      String(record.stockId).toLowerCase(),
    ];
    return parts.filter(Boolean).join('-');
  }

  function buildTitle(record) {
    if (record.truckPartType === 'cab') {
      return `${record.brand} ${record.model} Driver Cab`;
    }
    if (record.truckPartType === 'engine') {
      const engine = record.engineCode ? ` ${record.engineCode}` : '';
      return `${record.brand} ${record.model}${engine} Engine Assembly`;
    }
    if (record.truckPartType === 'axle') {
      return `${record.brand} ${record.model} Axle Assembly`;
    }
    if (record.truckPartType === 'other') {
      return `${record.brand} ${record.model} Truck Part`;
    }
    if (record.passengerPartType === 'front') {
      return `${record.brand} ${record.model} Front Cut`;
    }
    if (record.passengerPartType === 'engine') {
      const engine = record.engineCode ? ` ${record.engineCode}` : '';
      return `${record.brand} ${record.model}${engine} Engine Assembly`;
    }
    if (record.passengerPartType === 'transmission') {
      const trans = record.transmissionCode ? ` ${record.transmissionCode}` : '';
      return `${record.brand} ${record.model}${trans} Transmission Assembly`;
    }
    if (record.passengerPartType === 'chassis') {
      return `${record.brand} ${record.model} Chassis Part`;
    }
    if (record.passengerPartType === 'other') {
      return `${record.brand} ${record.model} Part`;
    }
    const fromRemark = window.HalfCutTitle?.buildDisplayTitle?.(record)
      || window.HalfCutUtils?.listingTitle?.(record);
    if (fromRemark) return fromRemark;
    const cutLabel = record.vehicleCategory === 'truck'
      ? 'Truck Half Cut'
      : (record.vehicleCategory === 'machinery'
        ? (record.vehicleCondition || window.MachineryBrandCatalog?.typeLabel?.(record.machineryType) || 'Construction Equipment')
        : (record.vehicleCondition || 'Half Cut'));
    if (record.engineCode) {
      return `${record.brand} ${record.model} ${record.engineCode} ${cutLabel}`;
    }
    return `${record.brand} ${record.model} ${cutLabel}`;
  }

  function buildShortDescription(submission) {
    const notes = String(submission.notes || '').trim();
    const autoDesc = () => {
      if (submission.truckPartType === 'cab') {
        return `${submission.year} ${submission.brand} ${submission.model} driver cab — supplier-verified listing via AsiaPower.`;
      }
      if (submission.truckPartType === 'engine') {
        const engineHint = submission.engineCode ? ` ${submission.engineCode}` : '';
        return `${submission.year} ${submission.brand} ${submission.model}${engineHint} engine assembly — supplier-verified listing via AsiaPower.`;
      }
      if (submission.truckPartType === 'axle') {
        return `${submission.year} ${submission.brand} ${submission.model} axle assembly — supplier-verified listing via AsiaPower.`;
      }
      if (submission.truckPartType === 'other') {
        return `${submission.year} ${submission.brand} ${submission.model} truck part — supplier-verified listing via AsiaPower.`;
      }
      if (submission.passengerPartType === 'front') {
        return `${submission.year} ${submission.brand} ${submission.model} front cut — supplier-verified listing via AsiaPower.`;
      }
      if (submission.passengerPartType === 'engine') {
        const engineHint = submission.engineCode ? ` ${submission.engineCode}` : '';
        return `${submission.year} ${submission.brand} ${submission.model}${engineHint} engine assembly — supplier-verified listing via AsiaPower.`;
      }
      if (submission.passengerPartType === 'transmission') {
        const transHint = submission.transmissionCode ? ` ${submission.transmissionCode}` : '';
        return `${submission.year} ${submission.brand} ${submission.model}${transHint} transmission assembly — supplier-verified listing via AsiaPower.`;
      }
      if (submission.passengerPartType === 'chassis') {
        return `${submission.year} ${submission.brand} ${submission.model} chassis part — supplier-verified listing via AsiaPower.`;
      }
      if (submission.passengerPartType === 'other') {
        return `${submission.year} ${submission.brand} ${submission.model} part — supplier-verified listing via AsiaPower.`;
      }
      const engineHint = submission.engineCode ? ` with ${submission.engineCode}` : '';
      return `${submission.year} ${submission.brand} ${submission.model}${engineHint} — supplier-verified listing via AsiaPower.`;
    };
    const fromNotes = window.HalfCutTitle?.buildShortDescriptionFromNotes?.(notes, autoDesc(), submission);
    if (fromNotes) return fromNotes;
    if (notes && window.HalfCutTitle?.isQxbListing?.(submission)) return notes.split('\n')[0].slice(0, 220);
    return autoDesc();
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
    if (!Inventory()?.syncToCatalog) return;
    const seedList = serverMode ? [] : (window.SEED_HALF_CUT_LIST || []);
    Inventory().syncToCatalog(seedList, approvedCache);
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

    if (serverMode) {
      const api = MediaApi();
      if (api?.postSubmission) {
        await api.postSubmission(submission);
      } else {
        const token = await MediaApi().ensureUploadToken?.();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['X-Upload-Token'] = token;
        if (window.SUPPLIER_UPLOAD_KEY) headers['X-Supplier-Key'] = window.SUPPLIER_UPLOAD_KEY;
        const res = await fetch(`${window.location.origin}/api/half-cuts/submissions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(submission),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Submission failed');
      }
      if (adminMode) submissionsCache.unshift(submission);
      return submission;
    }

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
    const priorSubmission = submission;
    const priorApproved = approvedCache.slice();
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
    syncLiveInventory();

    try {
      if (serverMode) {
        await MediaApi().approveSubmission(submissionId, { submission, inventoryItem });
      } else {
        stripEmbeddedMediaFromState();
        writeJson(SUBMISSIONS_KEY, submissionsCache);
        writeJson(APPROVED_KEY, approvedCache);
      }
    } catch (err) {
      submissionsCache[index] = priorSubmission;
      approvedCache = priorApproved;
      syncLiveInventory();
      throw err;
    }

    void window.PowertrainCatalog?.rememberFromHalfCut?.(inventoryItem);
    return inventoryItem;
  }

  async function rejectSubmission(submissionId, reason) {
    const index = submissionsCache.findIndex(s => s.submissionId === submissionId);
    if (index === -1) return false;

    const priorSubmission = submissionsCache[index];
    submissionsCache[index] = Review().markRejected(submissionsCache[index], reason);

    try {
      if (serverMode) {
        await MediaApi().rejectSubmission(submissionId, { reason: reason || '' });
      } else {
        await persistState();
      }
    } catch (err) {
      submissionsCache[index] = priorSubmission;
      throw err;
    }
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

  function resetReady() {
    readyPromise = null;
    adminMode = isAdminContext();
  }

  async function updateApprovedInventory(stockId, edits) {
    const stockUpper = String(stockId || '').trim().toUpperCase();
    const index = approvedCache.findIndex(
      (item) => String(item.stockId || '').toUpperCase() === stockUpper
    );
    if (index === -1) return null;

    if (serverMode) {
      const res = await fetch(`${window.location.origin}/api/half-cuts/inventory/${encodeURIComponent(stockId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edits || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        resetReady();
        throw new Error(data.error || 'Admin authentication required');
      }
      if (!res.ok) throw new Error(data.error || 'Failed to update inventory');
      approvedCache[index] = data.item;
      if (data.item?.submissionId) {
        const subIndex = submissionsCache.findIndex((s) => s.submissionId === data.item.submissionId);
        if (subIndex !== -1) {
          submissionsCache[subIndex] = Review().applyEdits(submissionsCache[subIndex], {
            brand: data.item.brand,
            brandSlug: data.item.brandSlug,
            model: data.item.model,
            year: data.item.year,
            engineCode: data.item.engineCode,
            transmissionCode: data.item.transmissionCode,
            drivetrain: data.item.drivetrain,
            mileage: data.item.mileage,
            priceUsd: data.item.priceUsd,
            vehicleCondition: data.item.vehicleCondition,
            approvedSlug: data.item.slug,
          });
        }
      }
    } else {
      const oldSlug = approvedCache[index].slug;
      let item = Review().applyEdits(approvedCache[index], edits);
      if (edits?.year !== undefined && edits.year !== '') item.year = Number(edits.year);
      if (edits?.priceUsd !== undefined && edits.priceUsd !== '') {
        item.priceUsd = Number(Number(edits.priceUsd).toFixed(2));
      }
      if (edits?.engineCode) item.engineCode = String(edits.engineCode).trim();
      if (edits?.transmissionCode) item.transmissionCode = String(edits.transmissionCode).trim();
      if (edits?.status) item.status = edits.status;
      item.title = inventoryHelpers.buildTitle(item);
      const newSlug = inventoryHelpers.buildSlug(item);
      if (oldSlug && newSlug && oldSlug !== newSlug) {
        item.slugAliases = [...new Set([...(item.slugAliases || []), oldSlug])];
      }
      item.slug = newSlug;
      item.updatedAt = new Date().toISOString();
      approvedCache[index] = item;
      if (item.submissionId) {
        const subIndex = submissionsCache.findIndex((s) => s.submissionId === item.submissionId);
        if (subIndex !== -1) {
          submissionsCache[subIndex] = Review().applyEdits(submissionsCache[subIndex], {
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
            approvedSlug: item.slug,
          });
        }
      }
      await persistState();
    }

    syncLiveInventory();
    await window.PowertrainCatalog?.loadLearnedPowertrain?.({ force: true });
    return approvedCache[index];
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
    if (!slug) return null;
    let item = approvedCache.find(i => i.slug === slug);
    if (!item) {
      item = approvedCache.find(i => Array.isArray(i.slugAliases) && i.slugAliases.includes(slug));
    }
    if (!item) {
      const stockMatch = String(slug).match(/(hc\d+)/i);
      if (stockMatch) {
        const stockId = stockMatch[0].toUpperCase();
        item = approvedCache.find(i => String(i.stockId || '').toUpperCase() === stockId);
      }
    }
    return item ? Inventory().toPublicItem(item) : null;
  }

  window.HalfCutInventoryStore = {
    SUBMISSIONS_KEY,
    APPROVED_KEY,
    getSupportedBrands() {
      return window.VehicleCatalog?.getBrandNames?.()
        || Object.keys(Vin()?.BRAND_SLUG_MAP || {});
    },
    get SUPPORTED_BRANDS() {
      return window.VehicleCatalog?.getBrandNames?.()
        || Object.keys(Vin()?.BRAND_SLUG_MAP || {});
    },
    PHOTO_LABELS: Vin()?.PHOTO_LABELS || [],
    brandToSlug: (b) => Vin().brandToSlug(b),
    formatMileage,
    whenReady,
    isServerMode: () => serverMode,
    isAdminMode: () => adminMode,
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
    updateApprovedInventory,
    syncLiveInventory,
    resetReady,
    toPublicItem: (item) => Inventory().toPublicItem(item),
  };

  const CATALOG_PAGES = new Set([
    'home', 'halfcuts', 'engines', 'gearboxes', 'chassis', 'frontcuts', 'trucks', 'machinery', 'brands',
  ]);
  if (typeof document !== 'undefined' && CATALOG_PAGES.has(document.body?.dataset?.page || '')) {
    whenReady();
  }
})();
