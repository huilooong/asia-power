/**
 * Upload Layer — supplier submission intake (local demo)
 *
 * Future DB mapping:
 *   localStorage.halfCutSubmissions → data/half-cut-submissions.json
 *                                  → Supabase table `half_cut_submissions`
 *   photo blobs                   → uploads/half-cuts/{id}/
 *                                  → Supabase Storage `half-cut-photos`
 */
(function () {
  'use strict';

  const Vin = () => window.HalfCutVin;

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

    const photos = Array.isArray(data.photos) ? data.photos.filter(p => p?.dataUrl || p?.url) : [];
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

    return { valid: errors.length === 0, errors, photos };
  }

  function buildSubmissionRecord(data, generateId) {
    const v = Vin();
    const vinNorm = v.normalizeVin(data.vin);
    const brandSlug = v.brandToSlug(data.brand);

    return {
      submissionId: generateId(),
      createdAt: new Date().toISOString(),
      reviewStatus: 'pending',

      vin: vinNorm,
      decodeMethod: data.decodeMethod || 'Manual Entry',
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
      videoUrl: String(data.videoUrl || '').trim(),
      notes: String(data.notes || '').trim(),
    };
  }

  window.HalfCutUploadLayer = {
    validateSubmission,
    buildSubmissionRecord,
  };
})();
