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
    return pub;
  }

  function toPublicList(items) {
    return (items || []).map(toPublicItem);
  }

  function submissionToInventory(submission, helpers) {
    const norm = window.VehicleNameNormalize?.normalizeVehicleNames?.(submission.brand, submission.model);
    const brand = norm?.brand || submission.brand;
    const model = norm?.model || submission.model;
    const brandSlug = norm?.brandSlug || submission.brandSlug || Vin().brandToSlug(brand);
    const stockId = helpers.nextStockId();
    const mileage = helpers.formatMileage(submission.mileage);
    const photos = helpers.normalizePhotos(submission.photos);
    const status = submission.inventoryStatus || 'Available';

    const record = {
      stockId,
      vin: submission.vin,
      decodeMethod: submission.decodeMethod,
      vehicleCondition: submission.vehicleCondition || 'Half Cut',
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
      includedParts: helpers.parseIncludedParts(submission.notes),
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
