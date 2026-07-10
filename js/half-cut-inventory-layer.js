/**
 * Inventory Layer — approved public catalog (local demo)
 *
 * Future DB mapping:
 *   localStorage.halfCutApprovedInventory → data/half-cut-inventory.json
 *                                        → Supabase table `half_cut_inventory`
 *   Public API                            → GET /api/half-cuts/public (vin stripped)
 *
 * Security: full VIN never leaves this layer on public views.
 */
(function () {
  'use strict';

  const Vin = () => window.HalfCutVin;
  const Upload = () => window.HalfCutUploadLayer;

  const SUPPLIER_FIELDS = [
    'vin',
    'decodedData',
    'decodeMethod',
    'decodeConfidence',
    'submissionId',
    'supplierName',
    'supplierPhone',
    'supplierWechat',
    'supplierCity',
    'approvedAt',
    'reviewStatus',
    'rejectReason',
    'reviewedAt',
    'approvedStockId',
    'approvedSlug',
    'notes',
  ];

  function stripVin(item) {
    if (!item) return null;
    const copy = { ...item };
    for (const key of SUPPLIER_FIELDS) delete copy[key];
    return copy;
  }

  function toPublicItem(item) {
    if (!item) return null;
    const pub = stripVin(item);
    if (item.vin) pub.maskedVin = Vin().maskVin(item.vin);
    else if (item.maskedVin) pub.maskedVin = item.maskedVin;

    if (window.HalfCutTitle?.isQxbListing?.(item)) {
      if (!pub.originalVehicleName) {
        pub.originalVehicleName = window.HalfCutTitle?.extractOriginalVehicleName?.(item.notes || item.shortDescription || '')
          || String(item.originalVehicleName || '').trim();
      }
    } else {
      delete pub.originalVehicleName;
      const structured = window.HalfCutTitle?.buildStructuredTitle?.(item);
      if (structured) pub.title = structured;
    }

    if (window.ContactRedact?.redactPublicStrings) {
      return window.ContactRedact.redactPublicStrings(pub);
    }
    return pub;
  }

  function toPublicList(items) {
    return (items || []).map(toPublicItem);
  }

  function submissionToInventory(submission, helpers) {
    const meta = Upload()?.resolveListingMeta?.(submission) || {
      vehicleCategory: submission.vehicleCategory === 'truck' ? 'truck' : 'passenger',
      truckPartType: submission.vehicleCategory === 'truck'
        ? (['cab', 'engine', 'axle', 'other', 'vehicle'].includes(submission.truckPartType) ? submission.truckPartType : 'vehicle')
        : '',
      vehicleCondition: submission.vehicleCondition || 'Half Cut',
    };
    const isTruck = meta.vehicleCategory === 'truck';
    const isMachinery = meta.vehicleCategory === 'machinery';
    let brand = submission.brand;
    let model = submission.model;
    let brandSlug = submission.brandSlug;
    let norm = null;
    if (isTruck && window.TruckBrandCatalog) {
      brand = window.TruckBrandCatalog.resolveBrand(brand) || brand;
      brandSlug = window.TruckBrandCatalog.brandToSlug(brand);
      model = String(model || '').trim();
    } else if (isMachinery && window.MachineryBrandCatalog) {
      brand = window.MachineryBrandCatalog.resolveBrand(brand) || brand;
      brandSlug = window.MachineryBrandCatalog.brandToSlug(brand);
      model = String(model || '').trim();
    } else {
      norm = window.VehicleNameNormalize?.normalizeVehicleNames?.(submission.brand, submission.model);
      brand = norm?.brand || submission.brand;
      model = norm?.model || submission.model;
      brandSlug = norm?.brandSlug || submission.brandSlug || Vin().brandToSlug(brand);
    }
    const stockId = helpers.nextStockId();
    const mileage = helpers.formatMileage(submission.mileage);
    const photos = helpers.normalizePhotos(submission.photos);
    const status = submission.inventoryStatus || 'Available';

    const record = {
      stockId,
      vin: submission.vin,
      decodeMethod: submission.decodeMethod,
      vehicleCondition: meta.vehicleCondition,
      vehicleCategory: meta.vehicleCategory,
      truckPartType: meta.truckPartType,
      passengerPartType: meta.passengerPartType || submission.passengerPartType || '',
      vehicleListingType: submission.vehicleListingType || '',
      machineryType: meta.machineryType || submission.machineryType || '',
      brand,
      brandSlug,
      model,
      year: Number(submission.year),
      engineCode: submission.engineCode,
      transmissionCode: submission.transmissionCode,
      drivetrain: submission.drivetrain || '2WD',
      mileage,
      priceUsd: Number(submission.priceUsd) > 0 ? Number(Number(submission.priceUsd).toFixed(2)) : null,
      origin: submission.originCountry || 'China',
      status,
      title: '',
      slug: '',
      photos,
      video: Upload()?.normalizeVideo?.(submission.video, submission.videoUrl) || null,
      videoUrl: submission.video?.url || submission.videoUrl || '',
      includedParts: window.HalfCutTitle?.isQxbListing?.(submission)
        ? helpers.parseIncludedParts(submission.notes)
        : (Array.isArray(submission.includedParts) && submission.includedParts.length
          ? submission.includedParts
          : helpers.parseIncludedParts('')),
      notes: String(submission.notes || '').trim(),
      originalVehicleName: window.HalfCutTitle?.isQxbListing?.(submission)
        ? (window.HalfCutTitle?.extractOriginalVehicleName?.(submission.notes || '') || '')
        : '',
      shortDescription: '',
      supplierVerified: true,
      submissionId: submission.submissionId,
      approvedAt: new Date().toISOString(),
    };

    if (norm?.corrected) {
      record.nameCorrections = {
        ...(submission.nameCorrections || {}),
        ...(norm.originalBrand ? { brand: norm.originalBrand } : {}),
        ...(norm.originalModel ? { model: norm.originalModel } : {}),
        correctedAt: new Date().toISOString(),
      };
    }

    record.title = helpers.buildTitle(record);
    record.slug = helpers.buildSlug(record);
    record.shortDescription = helpers.buildShortDescription({ ...submission, brand, model });
    return record;
  }

  function syncToCatalog(seedList, approvedList) {
    if (!window.HalfCutDirectory?.rebuildHalfCutList) return;
    const publicApproved = toPublicList(approvedList || []);
    window.HalfCutDirectory.rebuildHalfCutList([...(seedList || []), ...publicApproved]);
  }

  function assertNoVinLeak(payload) {
    const text = JSON.stringify(payload);
    if (Vin().containsFullVin(text)) {
      console.warn('[HalfCutInventoryLayer] Public payload may contain full VIN — blocked from export.');
      return false;
    }
    return true;
  }

  window.HalfCutInventoryLayer = {
    stripVin,
    toPublicItem,
    toPublicList,
    submissionToInventory,
    syncToCatalog,
    assertNoVinLeak,
  };
})();
