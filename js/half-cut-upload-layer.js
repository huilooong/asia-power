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

  const VIDEO_EXT_MIMES = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
  };

  function resolveVideoMime(file) {
    const type = String(file?.type || '').toLowerCase();
    const allowed = Vin()?.ALLOWED_VIDEO_MIMES || [];
    if (type && allowed.includes(type)) return type;
    const ext = String(file?.name || '').match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    if (ext && VIDEO_EXT_MIMES[ext]) return VIDEO_EXT_MIMES[ext];
    // WeChat / iOS gallery picks often omit type and extension — default MP4 for upload presign.
    return 'video/mp4';
  }

  function isAllowedVideoMimeOrName(file) {
    const type = String(file?.type || '').toLowerCase();
    if (Vin().ALLOWED_VIDEO_MIMES.includes(type)) return true;
    if (/\.(mp4|webm|mov|avi)$/i.test(String(file?.name || ''))) return true;
    // WeChat / iOS gallery videos often have empty file.type even from the video picker.
    if (!type && Number(file?.size) > 0) return true;
    return false;
  }

  function validateVideoFile(file) {
    const v = Vin();
    if (!file) return { valid: true, video: null };
    if (!isAllowedVideoMimeOrName(file)) {
      return { valid: false, error: 'Video must be MP4, WebM, or MOV.' };
    }
    if (file.size > v.MAX_VIDEO_BYTES) {
      return { valid: false, error: `Video must be ${Math.round(v.MAX_VIDEO_BYTES / (1024 * 1024))} MB or smaller.` };
    }
    return { valid: true, video: file };
  }

  function isLooseTruckPartType(truckPartType) {
    return ['cab', 'engine', 'axle', 'other'].includes(String(truckPartType || '').trim());
  }

  function isLoosePassengerPartType(passengerPartType) {
    return ['front', 'engine', 'transmission', 'chassis', 'tire', 'other'].includes(String(passengerPartType || '').trim());
  }

  const PASSENGER_PART_CONDITIONS = {
    front: 'Front Cut',
    engine: 'Engine Assembly',
    transmission: 'Transmission Assembly',
    chassis: 'Chassis Part',
    tire: 'Used Tire',
    other: 'Part',
  };

  function resolveListingMeta(data) {
    const record = data && typeof data === 'object' ? data : {};
    const condition = String(record.vehicleCondition || '').trim();
    let vehicleCategory = String(record.vehicleCategory || '').trim();
    let truckPartType = String(record.truckPartType || '').trim();
    let passengerPartType = String(record.passengerPartType || '').trim();
    const slug = String(record.slug || record.approvedSlug || '');

    const brand = String(record.brand || '');
    const model = String(record.model || '');
    const blob = `${brand} ${model}`.toLowerCase();
    const passengerOem = ['吉利', '雪佛兰', '别克', '福特', '大众', '马自达', '哈弗', '长安', '猎豹', '宝马', '奥迪', '丰田', '本田', '日产', '现代', '起亚', '荣威', '名爵', '比亚迪', '奇瑞', '长城', '传祺', '五菱', '宝骏', '路虎', '捷豹', 'toyota', 'honda', 'ford', 'chevrolet', 'buick', 'geely', 'haval', 'mazda', 'volkswagen', 'bmw', 'audi', 'lexus', 'jeep', 'porsche', 'jaguar', 'land rover', 'landrover', 'liebao', 'byd', 'mg', 'roewe'];
    const looksPassenger = passengerOem.some((b) => brand.includes(b) || blob.includes(b.toLowerCase()))
      && !/\b(truck|giga|elf|nqr|npr|howo|t7|f3000|m3000)\b/i.test(blob);
    if (looksPassenger && (condition === 'Driver Cab' || truckPartType === 'cab' || vehicleCategory === 'truck' || slug.includes('-truck-cab-'))) {
      return {
        vehicleCategory: 'passenger',
        truckPartType: '',
        passengerPartType: passengerPartType || '',
        vehicleCondition: (condition && condition !== 'Driver Cab') ? condition : 'Half Cut',
      };
    }

    if (vehicleCategory === 'truck' && truckPartType === 'engine') {
      return {
        vehicleCategory: 'truck',
        truckPartType: 'engine',
        vehicleCondition: condition || 'Engine Assembly',
      };
    }
    if (vehicleCategory === 'truck' && truckPartType === 'axle') {
      return {
        vehicleCategory: 'truck',
        truckPartType: 'axle',
        vehicleCondition: condition || 'Axle Assembly',
      };
    }
    if (vehicleCategory === 'truck' && truckPartType === 'other') {
      return {
        vehicleCategory: 'truck',
        truckPartType: 'other',
        vehicleCondition: condition || 'Truck Part',
      };
    }
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
        truckPartType: ['cab', 'engine', 'axle', 'other'].includes(truckPartType) ? truckPartType : 'vehicle',
        vehicleCondition: condition || (
          truckPartType === 'cab'
            ? 'Driver Cab'
            : (truckPartType === 'engine'
              ? 'Engine Assembly'
              : (truckPartType === 'axle'
                ? 'Axle Assembly'
                : (truckPartType === 'other' ? 'Truck Part' : 'Truck Half Cut')))
        ),
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
    if (slug.includes('-truck-engine-')) {
      return { vehicleCategory: 'truck', truckPartType: 'engine', vehicleCondition: condition || 'Engine Assembly' };
    }
    if (slug.includes('-truck-axle-')) {
      return { vehicleCategory: 'truck', truckPartType: 'axle', vehicleCondition: condition || 'Axle Assembly' };
    }
    if (slug.includes('-truck-part-')) {
      return { vehicleCategory: 'truck', truckPartType: 'other', vehicleCondition: condition || 'Truck Part' };
    }
    if (slug.includes('-truck-half-cut-')) {
      return { vehicleCategory: 'truck', truckPartType: 'vehicle', vehicleCondition: 'Truck Half Cut' };
    }
    if (slug.includes('-front-cut-') || passengerPartType === 'front' || condition === 'Front Cut') {
      return {
        vehicleCategory: 'passenger',
        truckPartType: '',
        passengerPartType: 'front',
        vehicleCondition: 'Front Cut',
      };
    }
    if (slug.includes('-passenger-engine-') || passengerPartType === 'engine' || condition === 'Engine Assembly') {
      // Prefer passenger when not explicitly truck
      if (vehicleCategory !== 'truck') {
        return {
          vehicleCategory: 'passenger',
          truckPartType: '',
          passengerPartType: 'engine',
          vehicleCondition: condition || 'Engine Assembly',
        };
      }
    }
    if (slug.includes('-passenger-transmission-') || passengerPartType === 'transmission' || condition === 'Transmission Assembly') {
      return {
        vehicleCategory: 'passenger',
        truckPartType: '',
        passengerPartType: 'transmission',
        vehicleCondition: condition || 'Transmission Assembly',
      };
    }
    if (slug.includes('-passenger-chassis-') || passengerPartType === 'chassis' || condition === 'Chassis Part') {
      return {
        vehicleCategory: 'passenger',
        truckPartType: '',
        passengerPartType: 'chassis',
        vehicleCondition: condition || 'Chassis Part',
      };
    }
    if (slug.includes('-passenger-tire-') || passengerPartType === 'tire' || condition === 'Used Tire' || condition === 'Scrap Tire') {
      return {
        vehicleCategory: 'passenger',
        truckPartType: '',
        passengerPartType: 'tire',
        vehicleCondition: condition === 'Scrap Tire' ? 'Scrap Tire' : 'Used Tire',
      };
    }
    if (slug.includes('-passenger-part-') || passengerPartType === 'other' || condition === 'Part') {
      return {
        vehicleCategory: 'passenger',
        truckPartType: '',
        passengerPartType: passengerPartType || 'other',
        vehicleCondition: condition || 'Part',
      };
    }
    if (isLoosePassengerPartType(passengerPartType)) {
      return {
        vehicleCategory: 'passenger',
        truckPartType: '',
        passengerPartType,
        vehicleCondition: condition || PASSENGER_PART_CONDITIONS[passengerPartType] || 'Part',
      };
    }
    return {
      vehicleCategory: 'passenger',
      truckPartType: '',
      passengerPartType: '',
      vehicleCondition: condition || 'Half Cut',
    };
  }

  function isTruckCab(data) {
    return resolveListingMeta(data).truckPartType === 'cab';
  }

  function isLooseTruckPart(data) {
    return isLooseTruckPartType(resolveListingMeta(data).truckPartType);
  }

  function isLoosePassengerPart(data) {
    return isLoosePassengerPartType(resolveListingMeta(data).passengerPartType);
  }

  function validateSubmission(data) {
    const v = Vin();
    const errors = [];
    const meta = resolveListingMeta(data);
    const cabListing = meta.truckPartType === 'cab';
    const looseTruckPart = isLooseTruckPartType(meta.truckPartType);
    const loosePassengerPart = isLoosePassengerPartType(meta.passengerPartType);
    const loosePart = looseTruckPart || loosePassengerPart;
    const enginePart = meta.truckPartType === 'engine' || meta.passengerPartType === 'engine';
    const transmissionPart = meta.passengerPartType === 'transmission';
    const isMachinery = meta.vehicleCategory === 'machinery';
    const vinRaw = String(data.vin || '').trim();

    if (!loosePart && !isMachinery) {
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
    if (!cabListing && !loosePart && !String(data.mileage || '').trim() && !isMachinery) errors.push('Mileage is required.');

    const priceUsd = Number(data.priceUsd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      errors.push('EXW price (USD) is required and must be greater than zero.');
    }

    const photos = normalizePhotos(data.photos);
    if (photos.length < v.MIN_PHOTOS) {
      errors.push(`At least ${v.MIN_PHOTOS} photos are required (you have ${photos.length}).`);
    }
    const maxPhotos = v.MAX_PHOTOS || 15;
    if (photos.length > maxPhotos) {
      errors.push(`At most ${maxPhotos} photos allowed (you have ${photos.length}).`);
    }
    if (isMachinery && photos.length < 4) {
      errors.push(`At least 4 photos are required for machinery (you have ${photos.length}).`);
    }

    if (!data.decodeMethod || data.decodeMethod === 'Manual Entry') {
      if (!data.brand) errors.push('Brand is required.');
      if (!data.model) errors.push('Model is required.');
      if (!data.year) errors.push('Year is required.');
      if (!cabListing && !loosePart && !isMachinery) {
        if (!data.engineCode) errors.push('Engine Code is required.');
        if (!data.transmissionCode) errors.push('Transmission Code is required.');
      }
      if (enginePart && !data.engineCode) errors.push('Engine Code is required.');
      if (transmissionPart && !data.transmissionCode) errors.push('Transmission Code is required.');
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
    const looseTruckPart = isLooseTruckPartType(meta.truckPartType);
    const loosePassengerPart = isLoosePassengerPartType(meta.passengerPartType);
    let vinNorm = v.normalizeVin(data.vin);
    if (cabListing && vinNorm.length !== 17) vinNorm = '';
    if ((looseTruckPart || loosePassengerPart) && !cabListing && vinNorm.length !== 17) vinNorm = '';
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
      passengerPartType: meta.passengerPartType || '',
      vehicleListingType: String(data.vehicleListingType || '').trim(),
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
    isTruckCab,
    isLooseTruckPart,
    isLooseTruckPartType,
    isLoosePassengerPart,
    isLoosePassengerPartType,
    normalizePhoto,
    normalizePhotos,
    normalizeVideo,
    resolveVideoMime,
    validateVideoFile,
    isDataUrl,
  };
})();
