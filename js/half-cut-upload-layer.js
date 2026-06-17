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

  function validateSubmission(data) {
    const v = Vin();
    const errors = [];

    const vinCheck = v.validateVin(data.vin);
    if (!vinCheck.valid) errors.push(vinCheck.error);

    if (!String(data.supplierName || '').trim()) errors.push('Supplier Name is required.');
    if (!String(data.supplierPhone || '').trim() && !String(data.supplierWechat || '').trim()) {
      errors.push('Supplier Phone or WeChat is required.');
    }
    if (!String(data.mileage || '').trim()) errors.push('Mileage is required.');

    const photos = normalizePhotos(data.photos);
    if (photos.length < v.MIN_PHOTOS) {
      errors.push(`At least ${v.MIN_PHOTOS} photos are required (you have ${photos.length}).`);
    }

    if (!data.decodeMethod || data.decodeMethod === 'Manual Entry') {
      if (!data.brand) errors.push('Brand is required.');
      if (!data.model) errors.push('Model is required.');
      if (!data.year) errors.push('Year is required.');
      if (!data.engineCode) errors.push('Engine Code is required.');
      if (!data.transmissionCode) errors.push('Transmission Code is required.');
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
    const vinNorm = v.normalizeVin(data.vin);
    const brandSlug = v.brandToSlug(data.brand);
    const video = normalizeVideo(data.video, data.videoUrl);

    return {
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

      brand: data.brand,
      brandSlug,
      model: String(data.model || '').trim(),
      year: Number(data.year) || null,
      mileage: data.mileage,
      engineCode: String(data.engineCode || '').trim(),
      transmissionCode: String(data.transmissionCode || '').trim(),
      drivetrain: String(data.drivetrain || '2WD').trim(),
      originCountry: String(data.originCountry || 'China').trim(),
      vehicleCondition: data.vehicleCondition || 'Half Cut',
      inventoryStatus: data.inventoryStatus,

      photos: data.photos || [],
      video,
      videoUrl: video?.url || '',
      notes: String(data.notes || '').trim(),
    };
  }

  window.HalfCutUploadLayer = {
    validateSubmission,
    buildSubmissionRecord,
    normalizePhoto,
    normalizePhotos,
    normalizeVideo,
    validateVideoFile,
    isDataUrl,
  };
})();
