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
    if (edits.passengerPartType !== undefined) {
      next.passengerPartType = String(edits.passengerPartType || '').trim();
    }
    if (window.HalfCutUploadLayer?.resolveListingMeta) {
      const meta = window.HalfCutUploadLayer.resolveListingMeta(next);
      next.vehicleCategory = meta.vehicleCategory;
      next.truckPartType = meta.truckPartType;
      next.passengerPartType = meta.passengerPartType || next.passengerPartType || '';
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

  /** Part listings (no full vehicle) — VIN not required at approval, same as upload. */
  function isLoosePartListing(submission, meta) {
    const m = meta || {};
    if (window.HalfCutUploadLayer?.isLooseTruckPartType?.(m.truckPartType)) return true;
    if (window.HalfCutUploadLayer?.isLoosePassengerPartType?.(m.passengerPartType)) return true;
    if (window.HalfCutUploadLayer?.isLooseTruckPartType?.(submission?.truckPartType)) return true;
    if (window.HalfCutUploadLayer?.isLoosePassengerPartType?.(submission?.passengerPartType)) return true;
    const condition = String(m.vehicleCondition || submission?.vehicleCondition || '').trim();
    return [
      'Front Cut',
      'Engine Assembly',
      'Transmission Assembly',
      'Chassis Part',
      'Part',
      'Driver Cab',
      'Axle Assembly',
      'Truck Part',
    ].includes(condition);
  }

  function validateForApproval(submission) {
    const errors = [];
    const meta = window.HalfCutUploadLayer?.resolveListingMeta?.(submission) || {
      vehicleCategory: submission?.vehicleCategory || 'passenger',
      truckPartType: submission?.truckPartType || '',
      passengerPartType: submission?.passengerPartType || '',
      machineryType: submission?.machineryType || '',
      vehicleCondition: submission?.vehicleCondition || '',
    };
    const cabListing = meta.truckPartType === 'cab' || String(meta.vehicleCondition || '').trim() === 'Driver Cab';
    const loosePart = isLoosePartListing(submission, meta);
    const enginePart = meta.truckPartType === 'engine' || meta.passengerPartType === 'engine'
      || String(meta.vehicleCondition || '').trim() === 'Engine Assembly';
    const transmissionPart = meta.passengerPartType === 'transmission'
      || String(meta.vehicleCondition || '').trim() === 'Transmission Assembly';
    const isMachinery = meta.vehicleCategory === 'machinery';

    // Parts / machinery: VIN optional. Whole vehicles still need 17-char VIN.
    if (!loosePart && !isMachinery) {
      if (!submission.vin || submission.vin.length !== 17) {
        errors.push('Valid 17-character VIN required.');
      }
    } else if (submission.vin && String(submission.vin).trim() && String(submission.vin).trim().length !== 17) {
      errors.push('VIN must be 17 characters when provided.');
    }
    if (!submission.brand) errors.push('Brand required.');
    if (!submission.model) errors.push('Model required.');
    if (!submission.year) errors.push('Year required.');
    if (!cabListing && !loosePart && !submission.engineCode) errors.push('Engine Code required.');
    if (enginePart && !submission.engineCode) errors.push('Engine Code required.');
    if (transmissionPart && !submission.transmissionCode) errors.push('Transmission Code required.');
    if (!cabListing && !loosePart && !isMachinery && !submission.transmissionCode) errors.push('Transmission Code required.');
    if (!submission.photos?.length) errors.push('Photos required.');
    if (isMachinery && (submission.photos?.length || 0) < 4) errors.push('At least 4 photos required for machinery.');
    const priceUsd = Number(submission.priceUsd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) errors.push('EXW price (USD) required.');
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
    isLoosePartListing,
    markApproved,
    markRejected,
  };
})();
