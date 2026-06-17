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

  function stripVin(item) {
    if (!item) return null;
    const copy = { ...item };
    delete copy.vin;
    delete copy.decodedData;
    return copy;
  }

  function toPublicItem(item) {
    if (!item) return null;
    const pub = stripVin(item);
    if (item.vin) pub.maskedVin = Vin().maskVin(item.vin);
    return pub;
  }

  function toPublicList(items) {
    return (items || []).map(toPublicItem);
  }

  function submissionToInventory(submission, helpers) {
    const stockId = helpers.nextStockId();
    const brandSlug = submission.brandSlug || Vin().brandToSlug(submission.brand);
    const mileage = helpers.formatMileage(submission.mileage);
    const photos = helpers.normalizePhotos(submission.photos);
    const status = submission.inventoryStatus || 'Available';

    const record = {
      stockId,
      vin: submission.vin,
      decodeMethod: submission.decodeMethod,
      vehicleCondition: submission.vehicleCondition || 'Half Cut',
      brand: submission.brand,
      brandSlug,
      model: submission.model,
      year: Number(submission.year),
      engineCode: submission.engineCode,
      transmissionCode: submission.transmissionCode,
      drivetrain: submission.drivetrain || '2WD',
      mileage,
      origin: submission.originCountry || 'China',
      status,
      title: '',
      slug: '',
      photos,
      video: Upload()?.normalizeVideo?.(submission.video, submission.videoUrl) || null,
      videoUrl: submission.video?.url || submission.videoUrl || '',
      includedParts: helpers.parseIncludedParts(submission.notes),
      shortDescription: helpers.buildShortDescription(submission),
      supplierVerified: true,
      submissionId: submission.submissionId,
      approvedAt: new Date().toISOString(),
    };

    record.title = helpers.buildTitle(record);
    record.slug = helpers.buildSlug(record);
    return record;
  }

  function syncToCatalog(seedList, approvedList) {
    if (!window.HalfCutDirectory?.rebuildHalfCutList) return;
    window.HalfCutDirectory.rebuildHalfCutList([...(seedList || []), ...(approvedList || [])]);
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
