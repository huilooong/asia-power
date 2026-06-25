/**
 * Upload Layer — supplier submission intake (URL-only media)
 */
(function () {
  'use strict';

  const Vin = () => window.HalfCutVin;

  function isDataUrl(value) {
    return /^data:(image|video)\//i.test(String(value || ''));
  }

  function normalizePhoto(photo, index) {
    const labels = Vin()?.PHOTO_LABELS || [];
    if (!photo) return null;
    const url = typeof photo === 'string' ? photo : (photo.url || '');
    if (!url || isDataUrl(url)) return null;
    return {
      label: (typeof photo === 'object' && photo.label) || labels[index] || `Photo ${index + 1}`,
      url,
      thumbUrl: (typeof photo === 'object' && photo.thumbUrl) || '',
    };
  }

  function normalizePhotos(photos) {
    if (!Array.isArray(photos)) return [];
    return photos
      .map((photo, index) => normalizePhoto(photo, index))
      .filter(Boolean);
  }

  function normalizeVideo(video, legacyUrl) {
    if (video?.url && !isDataUrl(video.url)) {
      return {
        url: video.url,
        fileName: String(video.fileName || 'vehicle-video').trim(),
        mimeType: String(video.mimeType || 'video/mp4').trim(),
        size: Number(video.size) || 0,
      };
    }
    const url = String(legacyUrl || video?.videoUrl || '').trim();
    if (url && !isDataUrl(url) && /^https?:\/\//i.test(url)) {
      return {
        url,
        fileName: 'external-link',
        mimeType: '',
        external: true,
      };
    }
    if (url && url.startsWith('/uploads/')) {
      return {
        url,
        fileName: video?.fileName || 'vehicle-video',
        mimeType: video?.mimeType || 'video/mp4',
        size: Number(video?.size) || 0,
      };
    }
    return null;
  }

  function validateVideoFile(file) {
    const v = Vin();
    if (!file) return { valid: true, video: null };
    if (!v.ALLOWED_VIDEO_MIMES.includes(file.type)) {
      return { valid: false, error: 'Video must be MP4, WebM, or MOV.' };
    }
    if (file.size > v.MAX_VIDEO_BYTES) {
      return { valid: false, error: `Video must be ${Math.round(v.MAX_VIDEO_BYTES / (1024 * 1024))} MB or smaller.` };
    }
    return { valid: true, video: file };
  }

  function resolveListingMeta(data) {
    const record = data && typeof data === 'object' ? data : {};
    const condition = String(record.vehicleCondition || '').trim();
    let vehicleCategory = String(record.vehicleCategory || '').trim();
    let truckPartType = String(record.truckPartType || '').trim();
    const slug = String(record.slug || record.approvedSlug || '');

    if (condition === 'Driver Cab' || truckPartType === 'cab') {
      return {
        vehicleCategory: 'truck',
        truckPartType: 'cab',
        vehicleCondition: 'Driver Cab',
      };
    }
    if (condition === 'Truck Half Cut' || (vehicleCategory === 'truck' && truckPartType === 'vehicle')) {
      return {
        vehicleCategory: 'truck',
        truckPartType: 'vehicle',
        vehicleCondition: 'Truck Half Cut',
      };
    }
    if (vehicleCategory === 'truck') {
      return {
        vehicleCategory: 'truck',
        truckPartType: truckPartType === 'cab' ? 'cab' : 'vehicle',
        vehicleCondition: condition || (truckPartType === 'cab' ? 'Driver Cab' : 'Truck Half Cut'),
      };
    }
    if (vehicleCategory === 'machinery' || String(record.machineryType || '').trim()) {
      const machineryType = String(record.machineryType || 'other').trim() || 'other';
      const typeLabel = window.MachineryBrandCatalog?.typeLabel?.(machineryType) || condition || 'Construction Equipment';
      return {
        vehicleCategory: 'machinery',
        truckPartType: '',
        machineryType,
        vehicleCondition: condition || typeLabel,
      };
    }
    if (slug.includes('-machinery-')) {
      const machineryType = String(record.machineryType || slug.match(/-machinery-([a-z0-9-]+)-hc/i)?.[1] || 'other').replace(/-hc.*$/i, '');
      return {
        vehicleCategory: 'machinery',
        truckPartType: '',
        machineryType,
        vehicleCondition: condition || window.MachineryBrandCatalog?.typeLabel?.(machineryType) || 'Construction Equipment',
      };
    }
    if (slug.includes('-truck-cab-')) {
      return { vehicleCategory: 'truck', truckPartType: 'cab', vehicleCondition: 'Driver Cab' };
    }
    if (slug.includes('-truck-half-cut-')) {
      return { vehicleCategory: 'truck', truckPartType: 'vehicle', vehicleCondition: 'Truck Half Cut' };
    }
    return {
      vehicleCategory: 'passenger',
      truckPartType: '',
      vehicleCondition: condition || 'Half Cut',
    };
  }

  function isTruckCab(data) {
    return resolveListingMeta(data).truckPartType === 'cab';
  }

  function validateSubmission(data) {
    const v = Vin();
    const errors = [];
    const meta = resolveListingMeta(data);
    const cabListing = meta.truckPartType === 'cab';
    const isMachinery = meta.vehicleCategory === 'machinery';
    const vinRaw = String(data.vin || '').trim();

    if (!cabListing && !isMachinery) {
      const vinCheck = v.validateVin(vinRaw);
      if (!vinCheck.valid) errors.push(vinCheck.error);
    } else if (vinRaw) {
      const vinCheck = v.validateVin(vinRaw);
      if (!vinCheck.valid) errors.push('VIN must be 17 characters when provided.');
    }

    if (!String(data.supplierName || '').trim()) errors.push('Supplier Name is required.');
    if (!String(data.supplierPhone || '').trim() && !String(data.supplierWechat || '').trim()) {
      errors.push('Supplier Phone or WeChat is required.');
    }
    if (!cabListing && !String(data.mileage || '').trim() && !isMachinery) errors.push('Mileage is required.');

    const priceUsd = Number(data.priceUsd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      errors.push('FOB price (USD) is required and must be greater than zero.');
    }

    const photos = normalizePhotos(data.photos);
    if (photos.length < v.MIN_PHOTOS) {
      errors.push(`At least ${v.MIN_PHOTOS} photos are required (you have ${photos.length}).`);
    }
    if (isMachinery && photos.length < 4) {
      errors.push(`At least 4 photos are required for machinery (you have ${photos.length}).`);
    }

    if (!data.decodeMethod || data.decodeMethod === 'Manual Entry') {
      if (!data.brand) errors.push('Brand is required.');
      if (!data.model) errors.push('Model is required.');
      if (!data.year) errors.push('Year is required.');
      if (!cabListing && !isMachinery) {
        if (!data.engineCode) errors.push('Engine Code is required.');
        if (!data.transmissionCode) errors.push('Transmission Code is required.');
      }
      if (isMachinery && !data.engineCode) errors.push('Engine Code is required.');
    } else {
      if (!data.brand) errors.push('Confirm brand from VIN decode.');
      if (!data.model) errors.push('Confirm model from VIN decode.');
      if (!data.year) errors.push('Confirm year from VIN decode.');
    }

    if (!data.inventoryStatus) errors.push('Inventory Status is required.');
    if (data.inventoryStatus && !v.SUPPLIER_STATUSES.includes(data.inventoryStatus)) {
      errors.push('Invalid inventory status for supplier submission.');
    }

    const video = normalizeVideo(data.video, data.videoUrl);
    if (data.video && !video) {
      errors.push('Invalid video upload.');
    }

    return { valid: errors.length === 0, errors, photos, video };
  }

  function buildSubmissionRecord(data, generateId) {
    const v = Vin();
    const meta = resolveListingMeta(data);
    const isTruck = meta.vehicleCategory === 'truck';
    const cabListing = meta.truckPartType === 'cab';
    let vinNorm = v.normalizeVin(data.vin);
    if (cabListing && vinNorm.length !== 17) vinNorm = '';
    let brand = String(data.brand || '').trim();
    let model = String(data.model || '').trim();
    let brandSlug = '';
    let norm = null;

    if (isTruck && window.TruckBrandCatalog) {
      brand = window.TruckBrandCatalog.resolveBrand(brand) || brand;
      brandSlug = window.TruckBrandCatalog.brandToSlug(brand);
    } else if (meta.vehicleCategory === 'machinery' && window.MachineryBrandCatalog) {
      brand = window.MachineryBrandCatalog.resolveBrand(brand) || brand;
      brandSlug = window.MachineryBrandCatalog.brandToSlug(brand);
    } else {
      norm = window.VehicleNameNormalize?.normalizeVehicleNames?.(data.brand, data.model);
      brand = norm?.brand || brand;
      model = norm?.model || model;
      brandSlug = norm?.brandSlug || v.brandToSlug(brand);
    }
    const video = normalizeVideo(data.video, data.videoUrl);

    const record = {
      submissionId: generateId(),
      createdAt: new Date().toISOString(),
      reviewStatus: 'pending',

      vin: vinNorm,
      decodeMethod: data.decodeMethod || 'Manual Entry',
      decodeConfidence: data.decodeConfidence || null,
      decodedData: data.decodedData || null,

      supplierName: String(data.supplierName || '').trim(),
      supplierPhone: String(data.supplierPhone || '').trim(),
      supplierWechat: String(data.supplierWechat || '').trim(),
      supplierCity: String(data.supplierCity || '').trim(),

      brand,
      brandSlug,
      model,
      year: Number(data.year) || null,
      mileage: data.mileage,
      priceUsd: Number(Number(data.priceUsd).toFixed(2)),
      engineCode: String(data.engineCode || '').trim(),
      transmissionCode: String(data.transmissionCode || '').trim(),
      drivetrain: String(data.drivetrain || '2WD').trim(),
      originCountry: String(data.originCountry || 'China').trim(),
      vehicleCondition: meta.vehicleCondition,
      vehicleCategory: meta.vehicleCategory,
      truckPartType: meta.truckPartType,
      machineryType: meta.machineryType || '',
      inventoryStatus: data.inventoryStatus,

      photos: data.photos || [],
      video,
      videoUrl: video?.url || '',
      notes: String(data.notes || '').trim(),
    };

    if (norm?.corrected) {
      record.nameCorrections = {
        ...(norm.originalBrand ? { brand: norm.originalBrand } : {}),
        ...(norm.originalModel ? { model: norm.originalModel } : {}),
        correctedAt: new Date().toISOString(),
      };
    }

    return record;
  }

  window.HalfCutUploadLayer = {
    validateSubmission,
    buildSubmissionRecord,
    resolveListingMeta,
    normalizePhoto,
    normalizePhotos,
    normalizeVideo,
    validateVideoFile,
    isDataUrl,
  };
})();
