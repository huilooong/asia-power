/**
 * Review Layer — admin approval queue (local demo)
 *
 * Future DB mapping:
 *   reviewStatus transitions → Supabase `half_cut_submissions.review_status`
 *   approve/reject audit     → Supabase `audit_log`
 */
(function () {
  'use strict';

  const Vin = () => window.HalfCutVin;

  function applyEdits(submission, edits) {
    if (!submission || !edits) return submission;
    const next = { ...submission, ...edits };
    if (edits.brand || edits.model) {
      const isTruck = (edits.vehicleCategory || next.vehicleCategory) === 'truck';
      if (isTruck && window.TruckBrandCatalog) {
        if (edits.brand || next.brand) {
          next.brand = window.TruckBrandCatalog.resolveBrand(edits.brand || next.brand);
          next.brandSlug = window.TruckBrandCatalog.brandToSlug(next.brand);
        }
      } else {
        const norm = window.VehicleNameNormalize?.normalizeVehicleNames?.(
          edits.brand || next.brand,
          edits.model || next.model
        );
        if (norm) {
          next.brand = norm.brand;
          next.model = norm.model;
          next.brandSlug = norm.brandSlug;
          if (norm.corrected) {
            next.nameCorrections = {
              ...(next.nameCorrections || {}),
              ...(norm.originalBrand ? { brand: norm.originalBrand } : {}),
              ...(norm.originalModel ? { model: norm.originalModel } : {}),
              correctedAt: new Date().toISOString(),
            };
          }
        } else if (edits.brand) {
          next.brandSlug = Vin().brandToSlug(edits.brand);
        }
      }
    } else if (edits.brand) {
      next.brandSlug = Vin().brandToSlug(edits.brand);
    }
    if (edits.vin) next.vin = Vin().normalizeVin(edits.vin);
    if (window.HalfCutUploadLayer?.resolveListingMeta) {
      const meta = window.HalfCutUploadLayer.resolveListingMeta(next);
      next.vehicleCategory = meta.vehicleCategory;
      next.truckPartType = meta.truckPartType;
      next.vehicleCondition = meta.vehicleCondition;
    }
    return next;
  }

  function isTruckCab(submission) {
    if (window.HalfCutUploadLayer?.resolveListingMeta) {
      return window.HalfCutUploadLayer.resolveListingMeta(submission).truckPartType === 'cab';
    }
    if (submission?.vehicleCategory === 'truck' && submission?.truckPartType === 'cab') return true;
    if (String(submission?.vehicleCondition || '').trim() === 'Driver Cab') return true;
    return false;
  }

  function validateForApproval(submission) {
    const errors = [];
    const meta = window.HalfCutUploadLayer?.resolveListingMeta?.(submission) || {
      vehicleCategory: submission?.vehicleCategory || 'passenger',
      truckPartType: submission?.truckPartType || '',
      machineryType: submission?.machineryType || '',
    };
    const cabListing = meta.truckPartType === 'cab';
    const isMachinery = meta.vehicleCategory === 'machinery';

    if (!cabListing && !isMachinery && (!submission.vin || submission.vin.length !== 17)) {
      errors.push('Valid 17-character VIN required.');
    }
    if (!submission.brand) errors.push('Brand required.');
    if (!submission.model) errors.push('Model required.');
    if (!submission.year) errors.push('Year required.');
    if (!cabListing && !submission.engineCode) errors.push('Engine Code required.');
    if (!cabListing && !isMachinery && !submission.transmissionCode) errors.push('Transmission Code required.');
    if (!submission.photos?.length) errors.push('Photos required.');
    if (isMachinery && (submission.photos?.length || 0) < 4) errors.push('At least 4 photos required for machinery.');
    const priceUsd = Number(submission.priceUsd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) errors.push('FOB price (USD) required.');
    if (isMachinery && (priceUsd < 2000 || priceUsd > 500000)) errors.push('Machinery price looks unrealistic — reject or re-check.');
    return { valid: errors.length === 0, errors };
  }

  function markApproved(submission, inventoryItem) {
    return {
      ...submission,
      reviewStatus: 'approved',
      approvedStockId: inventoryItem.stockId,
      approvedSlug: inventoryItem.slug,
      reviewedAt: new Date().toISOString(),
    };
  }

  function markRejected(submission, reason) {
    return {
      ...submission,
      reviewStatus: 'rejected',
      rejectReason: reason || '',
      reviewedAt: new Date().toISOString(),
    };
  }

  window.HalfCutReviewLayer = {
    applyEdits,
    validateForApproval,
    markApproved,
    markRejected,
  };
})();
