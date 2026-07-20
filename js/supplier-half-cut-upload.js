/**
 * AsiaPower — Supplier Half-Cut Upload (VIN-first, step wizard)
 */
(function () {
  'use strict';

  const TOTAL_STEPS = 4;

  const store = () => window.HalfCutInventoryStore;
  const Vin = () => window.HalfCutVin;
  const Catalog = () => window.VehicleCatalog;
  const I18n = () => window.HalfCutSupplierI18n;
  const MediaApi = () => window.HalfCutMediaApi;
  const t = (key) => I18n()?.labelHtml(key) || key;
  const tBtn = (key) => I18n()?.labelInline(key) || key;
  const th = (key) => escapeHtml(I18n()?.labelText(key) || key);
  const tf = (key) => I18n()?.labelText(key) || key;
  const pubT = (key, fallback) => window.PublicI18n?.t(key, fallback) ?? fallback;
  const tBi = (key) => I18n()?.labelText(key) || key;

  function base() {
    return window.SitePaths?.base?.() || '../';
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
  /** Client pre-compress; server sharp still re-encodes as the source of truth. */
  const PHOTO_COMPRESS_MIN_BYTES = 500 * 1024;
  const PHOTO_MAX_DIM = 1920;
  const PHOTO_JPEG_QUALITY = 0.85;
  const PHOTO_WEBP_QUALITY = 0.82;
  const HEIC_RE = /\.(heic|heif)$/i;

  function isHeicPhoto(file) {
    const type = String(file?.type || '').toLowerCase();
    const name = String(file?.name || '');
    return type.includes('heic') || type.includes('heif') || HEIC_RE.test(name);
  }

  async function preparePhotoForUpload(file) {
    if (isHeicPhoto(file)) {
      throw new Error(tBi('heicNotSupported'));
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new Error(tBi('photoTooLarge'));
    }

    const type = String(file.type || '').toLowerCase();
    if (!/^image\/(jpeg|png|webp)$/.test(type) || typeof createImageBitmap !== 'function') return file;

    try {
      const bitmap = await createImageBitmap(file);
      const needsResize = bitmap.width > PHOTO_MAX_DIM || bitmap.height > PHOTO_MAX_DIM;
      const needsCompress = file.size > PHOTO_COMPRESS_MIN_BYTES || needsResize;
      if (!needsCompress) {
        bitmap.close?.();
        return file;
      }
      const maxDim = PHOTO_MAX_DIM;
      let { width, height } = bitmap;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
      const outputType = 'image/webp';
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else {
            canvas.toBlob((jpeg) => {
              if (jpeg) resolve(jpeg);
              else reject(new Error('Could not compress photo'));
            }, 'image/jpeg', PHOTO_JPEG_QUALITY);
          }
        }, outputType, PHOTO_WEBP_QUALITY);
      });
      // Never discard a photo because client compress failed or grew oddly —
      // fall back to the original file (server sharp still re-encodes).
      if (!blob?.size || blob.size > MAX_PHOTO_BYTES) {
        return file;
      }
      const baseName = String(file.name || 'photo.jpg').replace(/\.[^.]+$/, '') || 'photo';
      const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
      return new File([blob], `${baseName}${ext}`, { type: blob.type });
    } catch (err) {
      // HEIC / hard validation errors use bilingual messages with newlines — rethrow.
      if (String(err.message || '').includes('\n')) throw err;
      return file;
    }
  }

  const MODEL_OTHER = '__OTHER__';

  async function loadLearnedModels(cat) {
    if (!cat?.mergeLearnedModels) return;
    try {
      const res = await fetch('/api/vehicle-catalog/learned-models');
      if (!res.ok) return;
      const data = await res.json();
      cat.mergeLearnedModels(data.models || {});
    } catch (err) {
      console.warn('[supplier-upload] learned models unavailable', err);
    }
  }

  function renderBrandSelectOptions(cat, options = {}) {
    const label = (brand) => escapeHtml(cat.getBrandLabel?.(brand) || brand);
    const option = (brand) => `<option value="${escapeHtml(brand)}">${label(brand)}</option>`;
    const groups = cat.getBrandOptionGroups?.();
    if (groups && options.truckGroups && window.TruckBrandCatalog?.GROUP_LABELS) {
      const labels = window.TruckBrandCatalog.GROUP_LABELS;
      return Object.keys(labels)
        .filter((key) => Array.isArray(groups[key]) && groups[key].length)
        .map((key) => `
        <optgroup label="${escapeHtml(labels[key])}">
          ${groups[key].map(option).join('')}
        </optgroup>`)
        .join('');
    }
    if (groups) {
      return `
        <optgroup label="Chinese brands · 中国品牌">
          ${groups.chinese.map(option).join('')}
        </optgroup>
        <optgroup label="Japanese · Korean · Western · 其他品牌">
          ${groups.other.map(option).join('')}
        </optgroup>`;
    }
    return cat.getBrandNames().map(option).join('');
  }

  function initSupplierHalfCutUpload() {
    const root = document.getElementById('supplier-half-cut-upload-root');
    const s = store();
    const v = Vin();
    const cat = Catalog();
    if (!root || !s || !v || !I18n() || !cat) return;

    let rememberTimer = null;

    function uploadMode() {
      const fromBody = document.body?.dataset?.uploadMode;
      if (fromBody === 'parts' || fromBody === 'vehicle') return fromBody;
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'parts' ? 'parts' : 'vehicle';
    }

    function vehicleListingDefault() {
      const fromBody = document.body?.dataset?.vehicleListing;
      if (fromBody === 'scrap' || fromBody === 'used') return fromBody;
      const params = new URLSearchParams(window.location.search);
      return params.get('type') === 'used' ? 'used' : 'scrap';
    }

    function uploadPassengerPartType() {
      const fromBody = document.body?.dataset?.uploadPart;
      if (fromBody && ['front', 'engine', 'transmission', 'chassis', 'tire', 'other'].includes(fromBody)) return fromBody;
      const params = new URLSearchParams(window.location.search);
      const part = params.get('part');
      if (['front', 'engine', 'transmission', 'chassis', 'tire', 'other'].includes(part)) return part;
      return 'front';
    }

    function uploadCategory() {
      const fromBody = document.body?.dataset?.uploadCategory;
      if (fromBody) return fromBody;
      const params = new URLSearchParams(window.location.search);
      return params.get('category') === 'truck' ? 'truck' : 'passenger';
    }

    function uploadPartType() {
      const fromBody = document.body?.dataset?.uploadPart;
      if (fromBody) return fromBody;
      const params = new URLSearchParams(window.location.search);
      const part = params.get('part');
      if (['cab', 'engine', 'axle', 'other'].includes(part)) return part;
      return 'cab';
    }

    const defaultCategory = uploadCategory();
    const isTruckUpload = defaultCategory === 'truck';
    const isPartsUpload = uploadMode() === 'parts';
    const isVehicleUpload = !isPartsUpload;
    const isTruckPartsUpload = isTruckUpload && isPartsUpload;
    const isTruckVehicleUpload = isTruckUpload && isVehicleUpload;
    const isPassengerPartsUpload = !isTruckUpload && isPartsUpload;
    const isPassengerVehicleUpload = !isTruckUpload && isVehicleUpload;
    const defaultVehicleListing = vehicleListingDefault();
    const defaultPartType = isTruckPartsUpload ? uploadPartType() : 'vehicle';
    const defaultPassengerPartType = isPassengerPartsUpload ? uploadPassengerPartType() : 'front';
    const TRUCK_PART_HINTS = {
      cab: 'truckPartCabHint',
      engine: 'truckPartEngineHint',
      axle: 'truckPartAxleHint',
      other: 'truckPartOtherHint',
    };
    const PASSENGER_PART_HINTS = {
      front: 'passengerPartFrontHint',
      engine: 'passengerPartEngineHint',
      transmission: 'passengerPartTransmissionHint',
      chassis: 'passengerPartChassisHint',
      tire: 'passengerPartTireHint',
      other: 'passengerPartOtherHint',
    };
    const TRUCK_PART_CONDITIONS = {
      cab: 'Driver Cab',
      engine: 'Engine Assembly',
      axle: 'Axle Assembly',
      other: 'Truck Part',
    };
    const PASSENGER_PART_CONDITIONS = {
      front: 'Front Cut',
      engine: 'Engine Assembly',
      transmission: 'Transmission Assembly',
      chassis: 'Chassis Part',
      tire: 'Used Tire',
      other: 'Part',
    };
    let truckPartType = isTruckPartsUpload ? defaultPartType : (isTruckVehicleUpload ? 'vehicle' : '');
    let passengerPartType = isPassengerPartsUpload ? defaultPassengerPartType : '';
    let isCabUpload = truckPartType === 'cab';
    let isLooseTruckPart = isTruckPartsUpload && ['cab', 'engine', 'axle', 'other'].includes(truckPartType);
    let isLoosePassengerPart = isPassengerPartsUpload;
    let isLoosePartUpload = isLooseTruckPart || isLoosePassengerPart;

    function uploadIntroKeys() {
      if (isTruckPartsUpload) return { title: 'truckUploadTitle', lead: 'truckUploadLead', eyebrowKey: 'supplier.uploadTruckParts', eyebrowFallback: 'Commercial Parts' };
      if (isTruckVehicleUpload) return { title: 'truckVehicleUploadTitle', lead: 'truckVehicleUploadLead', eyebrowKey: 'supplier.uploadTruckVehicle', eyebrowFallback: 'Commercial Vehicles' };
      if (isPassengerPartsUpload) return { title: 'passengerPartsUploadTitle', lead: 'passengerPartsUploadLead', eyebrowKey: 'supplier.uploadPassengerParts', eyebrowFallback: 'Passenger Parts' };
      return { title: 'passengerVehicleUploadTitle', lead: 'passengerVehicleUploadLead', eyebrowKey: 'supplier.uploadPassengerVehicle', eyebrowFallback: 'Passenger Vehicles' };
    }
    const introKeys = uploadIntroKeys();

    const brandCatalog = isTruckUpload && window.TruckBrandCatalog ? window.TruckBrandCatalog : cat;
    if (isTruckUpload && !window.TruckBrandCatalog) return;
    const brandOptions = renderBrandSelectOptions(brandCatalog, { truckGroups: isTruckUpload });

    const conditionOptions = [
      ['Running Vehicle', 'conditionRunning'],
      ['Half Cut', 'conditionHalfCut'],
      ...(isTruckUpload ? [
        ['Truck Half Cut', 'conditionTruckHalfCut'],
        ['Driver Cab', 'conditionDriverCab'],
      ] : [
        ['Front Cut', 'conditionFrontCut'],
      ]),
      ['Dismantled', 'conditionDismantled'],
      ['Engine Removed', 'conditionEngineRemoved'],
      ['Transmission Assembly', 'conditionTransmissionAssembly'],
      ['Chassis Part', 'conditionChassisPart'],
      ['Used Tire', 'conditionUsedTire'],
      ['Part', 'conditionPart'],
    ].map(([val, key]) => `<option value="${val}">${I18n().labelInline(key)}</option>`).join('');

    function buildStep1StartHtml() {
      if (isTruckPartsUpload) {
        return `
              <div class="form-row supplier-truck-part-step" id="truck-part-type-row">
                <label for="truckPartType">${t('truckPartType')} <span class="req">*</span></label>
                <select id="truckPartType" name="truckPartType" class="supplier-input-lg">
                  <option value="cab"${defaultPartType === 'cab' ? ' selected' : ''}>${I18n().labelInline('truckPartCab')}</option>
                  <option value="engine"${defaultPartType === 'engine' ? ' selected' : ''}>${I18n().labelInline('truckPartEngine')}</option>
                  <option value="axle"${defaultPartType === 'axle' ? ' selected' : ''}>${I18n().labelInline('truckPartAxle')}</option>
                  <option value="other"${defaultPartType === 'other' ? ' selected' : ''}>${I18n().labelInline('truckPartOther')}</option>
                </select>
                <p class="form-hint" id="truck-part-hint">${th(TRUCK_PART_HINTS[defaultPartType] || 'truckPartCabHint')}</p>
              </div>
              <p class="supplier-cab-skip-hint${isLooseTruckPart ? '' : ' hidden'}" id="vin-cab-skip-hint">${th('vinCabSkipHint')}</p>`;
      }
      if (isPassengerPartsUpload) {
        return `
              <div class="form-row supplier-truck-part-step" id="passenger-part-type-row">
                <label for="passengerPartType">${t('passengerPartType')} <span class="req">*</span></label>
                <select id="passengerPartType" name="passengerPartType" class="supplier-input-lg">
                  <option value="front"${defaultPassengerPartType === 'front' ? ' selected' : ''}>${I18n().labelInline('passengerPartFront')}</option>
                  <option value="engine"${defaultPassengerPartType === 'engine' ? ' selected' : ''}>${I18n().labelInline('passengerPartEngine')}</option>
                  <option value="transmission"${defaultPassengerPartType === 'transmission' ? ' selected' : ''}>${I18n().labelInline('passengerPartTransmission')}</option>
                  <option value="chassis"${defaultPassengerPartType === 'chassis' ? ' selected' : ''}>${I18n().labelInline('passengerPartChassis')}</option>
                  <option value="tire"${defaultPassengerPartType === 'tire' ? ' selected' : ''}>${I18n().labelInline('passengerPartTire')}</option>
                  <option value="other"${defaultPassengerPartType === 'other' ? ' selected' : ''}>${I18n().labelInline('passengerPartOther')}</option>
                </select>
                <p class="form-hint" id="passenger-part-hint">${th(PASSENGER_PART_HINTS[defaultPassengerPartType] || 'passengerPartFrontHint')}</p>
              </div>
              <p class="supplier-cab-skip-hint" id="vin-parts-skip-hint">${th('vinPartsSkipHint')}</p>`;
      }
      if (isVehicleUpload) {
        return `
              <div class="form-row" id="vehicle-listing-type-row">
                <label for="vehicleListingType">${t('vehicleListingType')} <span class="req">*</span></label>
                <select id="vehicleListingType" name="vehicleListingType" class="supplier-input-lg">
                  <option value="scrap"${defaultVehicleListing === 'scrap' ? ' selected' : ''}>${I18n().labelInline('listingTypeScrap')}</option>
                  <option value="used"${defaultVehicleListing === 'used' ? ' selected' : ''}>${I18n().labelInline('listingTypeUsed')}</option>
                </select>
                <p class="form-hint" id="vehicle-listing-hint">${th(defaultVehicleListing === 'used' ? 'listingTypeUsedHint' : 'listingTypeScrapHint')}</p>
              </div>
              <p class="form-hint supplier-vin-lead" id="vin-step-lead">${th(introKeys.lead)}</p>`;
      }
      return `
              <p class="form-hint supplier-vin-lead" id="vin-step-lead">${th(introKeys.lead)}</p>`;
    }

    const fuelTypeOptions = [
      ['Petrol', 'fuelPetrol'],
      ['Diesel', 'fuelDiesel'],
      ['Hybrid', 'fuelHybrid'],
      ['Plug-in Hybrid', 'fuelPlugInHybrid'],
      ['Electric', 'fuelElectric'],
    ].map(([val, key]) => `<option value="${val}">${I18n().labelInline(key)}</option>`).join('');

    function getActivePhotoLabels() {
      const max = isCabUpload
        ? (v.MAX_PHOTOS_CAB || v.MAX_PHOTOS || 15)
        : (v.MAX_PHOTOS || 15);
      const base = (isCabUpload && Array.isArray(v.CAB_PHOTO_LABELS))
        ? v.CAB_PHOTO_LABELS
        : v.PHOTO_LABELS;
      return typeof v.expandPhotoLabels === 'function'
        ? v.expandPhotoLabels(base, max)
        : base;
    }

    function photosStepLegend() {
      const maxCount = isCabUpload
        ? (v.MAX_PHOTOS_CAB || v.MAX_PHOTOS || 15)
        : (v.MAX_PHOTOS || 15);
      return `${t('stepPhotos')} <span class="req">*</span> (min ${v.MIN_PHOTOS}, max ${maxCount})`;
    }

    function photosStepHint() {
      const base = isCabUpload ? th('photosCabHint') : th('photosMin');
      return `${base} ${th('photoCompressHint')}`;
    }

    // Do NOT add capture= on photo inputs — mobile browsers then skip the gallery and open the camera only.
    function buildPhotoSlotsHtml(labels) {
      const cabMode = labels.length > (v.PHOTO_LABELS?.length || 0);
      const photoLabelBi = cabMode ? (I18n().L.cabPhotoLabels || []) : (I18n().L.photoLabels || []);
      return labels.map((label, index) => {
        const bi = photoLabelBi[index];
        const labelDisplay = bi
          ? I18n().labelFromBi(bi)
          : `${tf('extraPhoto')} ${index + 1}`;
        const reqTag = index < v.MIN_PHOTOS
          ? `<span class="supplier-photo-slot__req">${I18n().labelInline('required')}</span>`
          : `<span class="supplier-photo-slot__opt">${I18n().labelInline('recommended')}</span>`;
        return `
      <div class="supplier-photo-slot" data-slot="${index}">
        <label class="supplier-photo-slot__label" for="photo-${index}">
          <span class="supplier-photo-slot__num">${index + 1}</span>
          ${escapeHtml(labelDisplay)}
          ${reqTag}
        </label>
        <input type="file" id="photo-${index}" class="supplier-photo-slot__input" accept="image/jpeg,image/png,image/webp,image/gif" data-label="${escapeHtml(label)}">
        <div class="supplier-photo-slot__preview" id="photo-preview-${index}" hidden>
          <img alt="">
          <button type="button" class="supplier-photo-slot__remove btn-bilingual" data-remove="${index}">${tBtn('remove')}</button>
        </div>
      </div>`;
      }).join('');
    }

    const stepLabels = [
      { key: 'stepVin', num: 1 },
      { key: 'stepVehicle', num: 2 },
      { key: 'stepListing', num: 3 },
      { key: 'stepPhotos', num: 4 },
    ];

    const progressSteps = stepLabels.map(({ key, num }) => `
      <li class="supplier-step-progress__item" data-progress-step="${num}">
        <span class="supplier-step-progress__dot" aria-hidden="true">${num}</span>
        <span class="supplier-step-progress__label">${tBtn(key)}</span>
      </li>`).join('');

    const photoSlots = buildPhotoSlotsHtml(getActivePhotoLabels());

    root.innerHTML = `
      <div class="supplier-upload-layout supplier-bilingual supplier-upload-wizard">
        <div class="supplier-upload-intro">
          <span class="section-eyebrow">${pubT(introKeys.eyebrowKey, introKeys.eyebrowFallback)}</span>
          <h2>${t(introKeys.title)}</h2>
          <p class="section-lead">${th(introKeys.lead)}</p>
          <div class="supplier-upload-warning">
            <strong>${pubT('supplier.form.important', 'Important')}:</strong> ${th('supplierWarning')}
          </div>
        </div>

        <form id="supplier-half-cut-form" class="supplier-upload-form" novalidate>
          <nav class="supplier-step-progress" aria-label="${escapeHtml(tf('stepProgressLabel'))}">
            <ol class="supplier-step-progress__list">${progressSteps}</ol>
          </nav>

          <div class="supplier-step-panels">
            <fieldset class="supplier-form-section supplier-step-panel supplier-vin-step is-active" data-step="1">
              <legend id="vin-step-legend">${isPartsUpload ? t('stepTruckStart') : `${t('stepVin')} <span class="req" id="vin-step-required">*</span>`}</legend>
              ${buildStep1StartHtml()}
              <div id="vin-step-block"${isLoosePartUpload ? ' class="hidden"' : ''}>
              <div class="supplier-vin-block">
                <label for="vin">${t('vin')} <span class="req hidden" id="vin-label-required">*</span><span class="supplier-optional-tag hidden" id="vin-optional-tag">${I18n().labelInline('optional')}</span></label>
                <input type="text" id="vin" name="vin" maxlength="17" placeholder="17-character VIN" autocomplete="off" class="supplier-input-lg supplier-vin-input" inputmode="text" autocapitalize="characters" spellcheck="false">
                <div class="supplier-vin-meta">
                  <span id="vin-char-count" class="supplier-vin-counter" aria-live="polite">0/17 ${escapeHtml(tf('vinCounter'))}</span>
                  <span id="vin-confidence-badge" class="supplier-vin-confidence hidden" aria-live="polite"></span>
                </div>
                <button type="button" class="btn btn-navy btn-lg btn-bilingual supplier-decode-btn" id="decode-vin-btn">${tBtn('decodeVin')}</button>
              </div>
              <p id="vin-decode-status" class="form-hint supplier-vin-status" aria-live="polite"></p>
              <p class="form-hint supplier-vin-display">${t('vinFullSupplier')}: <strong id="vin-full-display">—</strong></p>
              <div id="vin-decode-preview" class="supplier-decode-preview hidden" aria-live="polite"></div>
              </div>
              <input type="hidden" id="decodeConfidence" name="decodeConfidence" value="manual">
            </fieldset>

            <fieldset class="supplier-form-section supplier-step-panel" data-step="2" id="vehicle-fields">
              <legend>${t('stepVehicle')}</legend>
              <div id="decode-confidence-notice" class="supplier-decode-notice hidden" role="status"></div>
              <div id="manual-entry-notice" class="supplier-upload-warning hidden" role="alert">
                ${th('decodeUnavailable')}
              </div>
              <div id="decode-success-notice" class="supplier-decode-success hidden" role="status">
                ${th('decodeConfirm')}
              </div>
              <p id="vehicle-missing-hint" class="form-hint supplier-missing-hint hidden"></p>
              ${isTruckUpload ? `
              <input type="hidden" id="vehicleCategory" name="vehicleCategory" value="truck">` : `
              <input type="hidden" id="vehicleCategory" name="vehicleCategory" value="passenger">`}
              <div class="form-row supplier-field-row" data-field="brand">
                <div class="supplier-field-row__head">
                  <label for="brand">${t('brand')} <span class="req">*</span></label>
                  <span class="supplier-field-tag hidden" data-tag="brand"></span>
                  <button type="button" class="supplier-field-unlock hidden" data-unlock="brand">${tBtn('editField')}</button>
                </div>
                <input type="search" id="brand-filter" class="supplier-brand-filter" placeholder="Search brand · 搜索品牌（Changan / 长安）" aria-label="Search brand" autocomplete="off">
                <select id="brand" name="brand" class="supplier-input-lg">
                  <option value="">${I18n().labelInline('selectBrand')}</option>
                  ${brandOptions}
                </select>
              </div>
              <div class="form-row supplier-field-row" data-field="model">
                <div class="supplier-field-row__head">
                  <label for="model">${t('model')} <span class="req">*</span></label>
                  <span class="supplier-field-tag hidden" data-tag="model"></span>
                  <button type="button" class="supplier-field-unlock hidden" data-unlock="model">${tBtn('editField')}</button>
                </div>
                <select id="model" name="model" class="supplier-input-lg">
                  <option value="">${I18n().labelInline('selectModel')}</option>
                </select>
                <input type="text" id="model-other" name="modelOther" class="supplier-input-lg supplier-model-other hidden" placeholder="${escapeHtml(tf('modelOtherPlaceholder'))}">
              </div>
              <div class="form-row form-row--2">
                <div class="supplier-field-row" data-field="year">
                  <div class="supplier-field-row__head">
                    <label for="year">${t('year')} <span class="req">*</span></label>
                    <span class="supplier-field-tag hidden" data-tag="year"></span>
                    <button type="button" class="supplier-field-unlock hidden" data-unlock="year">${tBtn('editField')}</button>
                  </div>
                  <input type="number" id="year" name="year" class="supplier-input-lg" min="1990" max="2030" placeholder="2022">
                </div>
                <div class="supplier-field-row" data-field="engineCode" id="engine-code-row">
                  <div class="supplier-field-row__head">
                    <label for="engineCode" id="engine-code-label">${t('engineCode')} <span class="req" id="engine-code-required">*</span></label>
                    <span class="supplier-field-tag hidden" data-tag="engineCode"></span>
                    <button type="button" class="supplier-field-unlock hidden" data-unlock="engineCode">${tBtn('editField')}</button>
                  </div>
                  <input type="text" id="engineCode" name="engineCode" class="supplier-input-lg" placeholder="2GD-FTV">
                </div>
              </div>
              <div class="form-row supplier-field-row" data-field="transmissionCode" id="transmission-code-row">
                <div class="supplier-field-row__head">
                  <label for="transmissionCode" id="transmission-code-label">${t('transmission')} <span class="req" id="transmission-code-required">*</span></label>
                  <span class="supplier-field-tag hidden" data-tag="transmissionCode"></span>
                  <button type="button" class="supplier-field-unlock hidden" data-unlock="transmissionCode">${tBtn('editField')}</button>
                </div>
                <input type="text" id="transmissionCode" name="transmissionCode" class="supplier-input-lg" placeholder="6AT">
              </div>
              <div class="form-row supplier-field-row" data-field="fuelType" id="fuel-type-row">
                <div class="supplier-field-row__head">
                  <label for="fuelType" id="fuel-type-label">${t('fuelType')}</label>
                  <span class="supplier-field-tag hidden" data-tag="fuelType"></span>
                  <button type="button" class="supplier-field-unlock hidden" data-unlock="fuelType">${tBtn('editField')}</button>
                </div>
                <select id="fuelType" name="fuelType" class="supplier-input-lg">
                  <option value="">${I18n().labelInline('selectFuelType')}</option>
                  ${fuelTypeOptions}
                </select>
              </div>
              <input type="hidden" id="decodeMethod" name="decodeMethod" value="Manual Entry">
            </fieldset>

            <fieldset class="supplier-form-section supplier-step-panel" data-step="3">
              <legend>${t('stepListing')}</legend>
              <div class="form-row">
                <label for="supplierName">${t('supplierName')} <span class="req">*</span></label>
                <input type="text" id="supplierName" name="supplierName" required autocomplete="organization" class="supplier-input-lg">
              </div>
              <div class="form-row">
                <label for="mileage">${t('mileage')} <span class="req" id="mileage-required">*</span></label>
                <input type="text" id="mileage" name="mileage" required class="supplier-input-lg" placeholder="43000 or 43,000 km">
              </div>
              <div class="form-row">
                <label for="priceUsd">${t('fobPriceUsd')} <span class="req">*</span></label>
                <input type="number" id="priceUsd" name="priceUsd" required min="1" step="0.01" class="supplier-input-lg" placeholder="8500">
                <p class="form-hint">${th('fobPriceHint')}</p>
              </div>
              <div class="form-row form-row--2">
                <div>
                  <label for="supplierPhone">${t('supplierPhone')}</label>
                  <input type="tel" id="supplierPhone" name="supplierPhone" class="supplier-input-lg" placeholder="+86 …">
                </div>
                <div>
                  <label for="supplierWechat">${t('supplierWechat')}</label>
                  <input type="text" id="supplierWechat" name="supplierWechat" class="supplier-input-lg" placeholder="WeChat ID">
                </div>
              </div>
              <p class="form-hint">${th('phoneOrWechat')}</p>
              <div class="form-row">
                <label for="vehicleCondition">${t('vehicleCondition')}</label>
                <select id="vehicleCondition" name="vehicleCondition" class="supplier-input-lg">${conditionOptions}</select>
              </div>
              <div class="form-row form-row--2">
                <div>
                  <label for="inventoryStatus">${t('inventoryStatus')} <span class="req">*</span></label>
                  <select id="inventoryStatus" name="inventoryStatus" required class="supplier-input-lg">
                    <option value="">${I18n().labelInline('selectStatus')}</option>
                    <option value="Available">${I18n().labelInline('available')}</option>
                    <option value="Reserved">${I18n().labelInline('reserved')}</option>
                  </select>
                </div>
                <div>
                  <label for="supplierCity">${t('supplierCity')}</label>
                  <input type="text" id="supplierCity" name="supplierCity" class="supplier-input-lg" placeholder="Guangzhou…">
                </div>
              </div>
              <div class="form-row">
                <label for="notes">${t('notes')}</label>
                <textarea id="notes" name="notes" rows="3" class="supplier-input-lg"></textarea>
              </div>
              <div class="form-row supplier-video-row">
                <label for="video-file">${t('videoUpload')}</label>
                <p class="form-hint">${th('videoOptional')}</p>
                <div class="supplier-video-slot" id="supplier-video-slot">
                  <input type="file" id="video-file" class="supplier-video-slot__input" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov">
                  <div class="supplier-video-slot__preview" id="video-preview" hidden>
                    <video id="video-preview-player" class="supplier-video-slot__player" controls playsinline preload="metadata"></video>
                    <p class="supplier-video-slot__meta" id="video-file-meta"></p>
                    <button type="button" class="supplier-video-slot__remove btn-bilingual" id="video-remove-btn">${tBtn('removeVideo')}</button>
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset class="supplier-form-section supplier-step-panel" data-step="4">
              <legend id="supplier-photos-legend">${photosStepLegend()}</legend>
              <p class="form-hint" id="supplier-photos-hint">${photosStepHint()}</p>
              <div class="supplier-photo-grid" id="supplier-photo-grid">${photoSlots}</div>
            </fieldset>
          </div>

          <div class="supplier-step-nav" aria-live="polite">
            <button type="button" class="btn btn-outline-navy btn-lg btn-bilingual supplier-step-back hidden" id="supplier-step-back">${tBtn('prevStep')}</button>
            <button type="button" class="btn btn-navy btn-lg btn-bilingual supplier-step-next" id="supplier-step-next">${tBtn('nextStep')}</button>
            <button type="submit" class="btn btn-accent btn-lg btn-bilingual supplier-step-submit hidden" id="supplier-step-submit">${tBtn('submitListingShort')}</button>
          </div>

          <div class="supplier-step-secondary">
            <a href="${base()}supplier-portal.html" class="btn btn-outline-navy btn-lg btn-bilingual supplier-back-portal">${tBtn('backToPortal')}</a>
          </div>

          <div id="supplier-upload-feedback" class="supplier-upload-feedback" role="status" aria-live="polite"></div>
        </form>
      </div>`;

    const form = document.getElementById('supplier-half-cut-form');
    const feedback = document.getElementById('supplier-upload-feedback');
    const photoData = new Map();
    let refreshPhotoGrid = null;
    let videoData = null;
    let decodedSnapshot = null;
    let decodeMethod = 'Manual Entry';
    let decodeConfidence = 'manual';
    let currentStep = 1;
    let lastDecodedVin = '';
    const autoFilledFields = new Set();
    let decodeTimer = null;

    const FIELD_ELS = {
      brand: 'brand',
      model: 'model',
      year: 'year',
      engineCode: 'engineCode',
      transmissionCode: 'transmissionCode',
      fuelType: 'fuelType',
    };

    const els = {
      vin: document.getElementById('vin'),
      vinStatus: document.getElementById('vin-decode-status'),
      vinDisplay: document.getElementById('vin-full-display'),
      vinCounter: document.getElementById('vin-char-count'),
      confidenceBadge: document.getElementById('vin-confidence-badge'),
      decodePreview: document.getElementById('vin-decode-preview'),
      confidenceNotice: document.getElementById('decode-confidence-notice'),
      missingHint: document.getElementById('vehicle-missing-hint'),
      manualNotice: document.getElementById('manual-entry-notice'),
      decodeNotice: document.getElementById('decode-success-notice'),
      decodeMethod: document.getElementById('decodeMethod'),
      decodeConfidence: document.getElementById('decodeConfidence'),
      brandFilter: document.getElementById('brand-filter'),
      brand: document.getElementById('brand'),
      model: document.getElementById('model'),
      modelOther: document.getElementById('model-other'),
      year: document.getElementById('year'),
      engineCode: document.getElementById('engineCode'),
      transmissionCode: document.getElementById('transmissionCode'),
      fuelType: document.getElementById('fuelType'),
      vehicleCondition: document.getElementById('vehicleCondition'),
      vehicleCategory: document.getElementById('vehicleCategory'),
      truckPartType: document.getElementById('truckPartType'),
      truckPartHint: document.getElementById('truck-part-hint'),
      passengerPartType: document.getElementById('passengerPartType'),
      passengerPartHint: document.getElementById('passenger-part-hint'),
      vehicleListingType: document.getElementById('vehicleListingType'),
      vehicleListingHint: document.getElementById('vehicle-listing-hint'),
      vinStepBlock: document.getElementById('vin-step-block'),
      vinCabSkipHint: document.getElementById('vin-cab-skip-hint'),
      vinStepLegend: document.getElementById('vin-step-legend'),
      vinStepRequired: document.getElementById('vin-step-required'),
      vinOptionalTag: document.getElementById('vin-optional-tag'),
      vinLabelRequired: document.getElementById('vin-label-required'),
      engineCodeRow: document.getElementById('engine-code-row'),
      transmissionCodeRow: document.getElementById('transmission-code-row'),
      engineCodeRequired: document.getElementById('engine-code-required'),
      transmissionCodeRequired: document.getElementById('transmission-code-required'),
      mileage: document.getElementById('mileage'),
      mileageRequired: document.getElementById('mileage-required'),
    };

    function activeBrandCatalog() {
      return isTruckUpload && window.TruckBrandCatalog ? window.TruckBrandCatalog : cat;
    }

    function syncVehicleListingType() {
      if (!isVehicleUpload || !els.vehicleCondition) return;
      const listingType = els.vehicleListingType?.value || defaultVehicleListing || 'scrap';
      if (isTruckVehicleUpload) {
        els.vehicleCondition.value = listingType === 'used' ? 'Running Vehicle' : 'Truck Half Cut';
      } else {
        els.vehicleCondition.value = listingType === 'used' ? 'Running Vehicle' : 'Half Cut';
      }
      if (els.vehicleListingHint) {
        const hintKey = listingType === 'used' ? 'listingTypeUsedHint' : 'listingTypeScrapHint';
        els.vehicleListingHint.innerHTML = th(hintKey);
      }
    }

    function syncTruckPartMode() {
      if (isTruckPartsUpload) {
        truckPartType = els.truckPartType?.value || 'cab';
        isCabUpload = truckPartType === 'cab';
        isLooseTruckPart = ['cab', 'engine', 'axle', 'other'].includes(truckPartType);
      } else {
        truckPartType = isTruckVehicleUpload ? 'vehicle' : '';
        isCabUpload = false;
        isLooseTruckPart = false;
      }
      if (isPassengerPartsUpload) {
        passengerPartType = els.passengerPartType?.value || 'front';
        isLoosePassengerPart = true;
      } else {
        passengerPartType = '';
        isLoosePassengerPart = false;
      }
      isLoosePartUpload = isLooseTruckPart || isLoosePassengerPart;
      const optionalVin = isLoosePartUpload;
      const showEngineRequired = (isTruckPartsUpload && truckPartType === 'engine')
        || (isPassengerPartsUpload && passengerPartType === 'engine');
      const showTransmissionRequired = isPassengerPartsUpload && passengerPartType === 'transmission';
      const hidePowertrain = isLoosePartUpload
        && !showEngineRequired
        && !showTransmissionRequired
        && passengerPartType !== 'front';

      els.vinStepBlock?.classList.toggle('hidden', optionalVin);
      els.vinCabSkipHint?.classList.toggle('hidden', !isLooseTruckPart);
      els.vin?.toggleAttribute('required', !optionalVin);
      els.vinStepRequired?.classList.toggle('hidden', optionalVin || isPartsUpload);
      els.vinLabelRequired?.classList.toggle('hidden', optionalVin);
      els.vinOptionalTag?.classList.toggle('hidden', !optionalVin);
      if (els.vinStepLegend) {
        if (isPartsUpload) {
          els.vinStepLegend.textContent = tf('stepTruckStart');
        } else {
          els.vinStepLegend.innerHTML = `${t('stepVin')} <span class="req" id="vin-step-required">*</span>`;
        }
      }
      els.engineCodeRequired?.classList.toggle('hidden', !showEngineRequired);
      els.transmissionCodeRequired?.classList.toggle('hidden', !showTransmissionRequired && (isTruckUpload || isPassengerPartsUpload));
      els.engineCodeRow?.classList.toggle('supplier-field-row--optional', !showEngineRequired);
      els.transmissionCodeRow?.classList.toggle('supplier-field-row--optional', !showTransmissionRequired && (isTruckUpload || isPassengerPartsUpload || isPassengerVehicleUpload));
      els.mileage?.toggleAttribute('required', !optionalVin);
      els.mileageRequired?.classList.toggle('hidden', optionalVin);

      if (els.truckPartHint && isTruckPartsUpload) {
        const hintKey = TRUCK_PART_HINTS[truckPartType] || 'truckPartCabHint';
        els.truckPartHint.innerHTML = th(hintKey);
      }
      if (els.passengerPartHint && isPassengerPartsUpload) {
        const hintKey = PASSENGER_PART_HINTS[passengerPartType] || 'passengerPartFrontHint';
        els.passengerPartHint.innerHTML = th(hintKey);
      }

      if (els.vehicleCondition && isTruckPartsUpload) {
        els.vehicleCondition.value = TRUCK_PART_CONDITIONS[truckPartType] || 'Truck Part';
      } else if (els.vehicleCondition && isPassengerPartsUpload) {
        els.vehicleCondition.value = PASSENGER_PART_CONDITIONS[passengerPartType] || 'Part';
      } else if (isVehicleUpload) {
        syncVehicleListingType();
      }

      if (optionalVin) {
        const vinNorm = v.normalizeVin(els.vin?.value || '');
        if (vinNorm.length !== 17) {
          els.vin.value = '';
          lastDecodedVin = '';
          els.decodePreview?.classList.add('hidden');
          els.confidenceBadge?.classList.add('hidden');
          if (els.vinStatus) els.vinStatus.textContent = '';
        }
      }

      refreshPhotoGrid?.();
    }

    if (els.vehicleCondition) {
      if (isTruckPartsUpload) {
        els.vehicleCondition.value = TRUCK_PART_CONDITIONS[defaultPartType] || 'Driver Cab';
      } else if (isPassengerPartsUpload) {
        els.vehicleCondition.value = PASSENGER_PART_CONDITIONS[defaultPassengerPartType] || 'Front Cut';
      } else if (isTruckVehicleUpload) {
        els.vehicleCondition.value = defaultVehicleListing === 'used' ? 'Running Vehicle' : 'Truck Half Cut';
      } else {
        els.vehicleCondition.value = defaultVehicleListing === 'used' ? 'Running Vehicle' : 'Half Cut';
      }
    }

    function syncTruckCondition() {
      if (isTruckVehicleUpload && els.vehicleCondition?.value === 'Half Cut') {
        els.vehicleCondition.value = 'Truck Half Cut';
      }
    }

    els.vehicleListingType?.addEventListener('change', syncVehicleListingType);
    els.truckPartType?.addEventListener('change', syncTruckPartMode);
    els.passengerPartType?.addEventListener('change', syncTruckPartMode);
    syncTruckCondition();
    syncTruckPartMode();

    function filterBrandOptions(query) {
      if (!els.brand) return;
      const q = String(query || '').trim().toLowerCase();
      Array.from(els.brand.options).forEach((opt) => {
        if (!opt.value) {
          opt.hidden = false;
          return;
        }
        const haystack = `${opt.value} ${opt.textContent}`.toLowerCase();
        opt.hidden = Boolean(q) && !haystack.includes(q);
      });
    }

    function hideModelOther() {
      els.modelOther?.classList.add('hidden');
      if (els.modelOther) els.modelOther.value = '';
    }

    function showModelOther(value) {
      if (!els.modelOther) return;
      els.modelOther.classList.remove('hidden');
      if (value) els.modelOther.value = value;
    }

    function populateModelSelect(brand, selectedModel) {
      if (!els.model) return;
      const catalog = activeBrandCatalog();
      let models = brand ? catalog.getModels(brand) : [];
      if (brand && selectedModel) {
        catalog.ensureModelOption(brand, selectedModel);
        models = catalog.getModels(brand);
      }
      const selectLabel = I18n().labelInline('selectModel');
      const otherLabel = I18n().labelInline('modelOther');
      let options = `<option value="">${escapeHtml(selectLabel)}</option>`;
      models.forEach((m) => {
        options += `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`;
      });
      options += `<option value="${MODEL_OTHER}">${escapeHtml(otherLabel)}</option>`;
      els.model.innerHTML = options;

      if (!selectedModel) {
        hideModelOther();
        return;
      }

      const normalized = String(selectedModel).trim();
      const match = models.find((m) => m.toLowerCase() === normalized.toLowerCase());
      if (match) {
        els.model.value = match;
        hideModelOther();
      } else {
        els.model.value = MODEL_OTHER;
        showModelOther(normalized);
      }
    }

    function getModelValue() {
      if (!els.model) return '';
      if (els.model.value === MODEL_OTHER) {
        return String(els.modelOther?.value || '').trim();
      }
      return String(els.model.value || '').trim();
    }

    async function rememberCustomModel(options = {}) {
      const brand = String(els.brand?.value || '').trim();
      const model = getModelValue();
      if (!brand || !model || model.length < 2) return;

      const known = activeBrandCatalog().getModels(brand).some((entry) => entry.toLowerCase() === model.toLowerCase());
      activeBrandCatalog().ensureModelOption(brand, model);

      const editingModelOther = els.modelOther && document.activeElement === els.modelOther;
      if (editingModelOther) return;

      if (isTruckUpload) {
        populateModelSelect(brand, model);
        return;
      }

      try {
        const res = await fetch('/api/vehicle-catalog/remember-model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand, model }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.added || !known) {
          populateModelSelect(brand, model);
        }
        if (data.added && options.toast) {
          showFeedback('Model saved for next time · 车型已记住，下次可直接选择', 'success');
        }
      } catch (err) {
        console.warn('[supplier-upload] remember model failed', err);
      }
    }

    function scheduleRememberCustomModel() {
      clearTimeout(rememberTimer);
      rememberTimer = setTimeout(() => {
        rememberCustomModel();
      }, 500);
    }

    function getFieldValue(key) {
      if (key === 'model') return getModelValue();
      return String(els[key]?.value || '').trim();
    }

    populateModelSelect('', '');

    const panels = root.querySelectorAll('.supplier-step-panel');
    const progressItems = root.querySelectorAll('.supplier-step-progress__item');
    const backBtn = document.getElementById('supplier-step-back');
    const nextBtn = document.getElementById('supplier-step-next');
    const submitBtn = document.getElementById('supplier-step-submit');

    function showFeedback(message, type) {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.className = `supplier-upload-feedback supplier-upload-feedback--${type || 'info'}`;
    }

    function showUploadModal(options) {
      if (window.SiteFeedback?.modal) {
        return window.SiteFeedback.modal(options);
      }
      window.alert(`${options?.title || ''}\n\n${options?.message || ''}${options?.details ? `\n\n${options.details}` : ''}`);
      return { close: () => {} };
    }

    function showUploadToast(message, type) {
      if (window.SiteFeedback?.toast) {
        window.SiteFeedback.toast(message, type);
        return;
      }
      showFeedback(message, type);
    }

    function confidenceLabel(confidence) {
      const map = {
        full: 'confidenceFull',
        partial: 'confidencePartial',
        manual: 'confidenceManual',
      };
      return tBtn(map[confidence] || 'confidenceManual');
    }

    function confidenceHint(confidence) {
      const map = {
        full: 'confidenceFullHint',
        partial: 'confidencePartialHint',
        manual: 'confidenceManualHint',
      };
      return th(map[confidence] || 'confidenceManualHint');
    }

    function updateVinCounter() {
      const len = v.normalizeVin(els.vin.value).length;
      if (!els.vinCounter) return;
      const suffix = tf('vinCounter');
      els.vinCounter.textContent = `${len}/17 ${suffix}`;
      els.vinCounter.classList.toggle('is-ready', len === 17);
    }

    function setFieldLocked(fieldKey, locked) {
      const input = els[fieldKey];
      const row = root.querySelector(`.supplier-field-row[data-field="${fieldKey}"]`);
      const tag = root.querySelector(`[data-tag="${fieldKey}"]`);
      const unlock = root.querySelector(`[data-unlock="${fieldKey}"]`);
      if (!input || !row) return;

      if (locked) {
        autoFilledFields.add(fieldKey);
        if (input.tagName === 'SELECT') {
          input.dataset.locked = 'true';
          input.tabIndex = -1;
        } else {
          input.readOnly = true;
        }
        if (fieldKey === 'model' && els.modelOther && els.model.value === MODEL_OTHER) {
          els.modelOther.readOnly = true;
        }
        row.classList.add('is-autofilled');
        row.classList.remove('needs-input');
        if (tag) {
          tag.textContent = tBtn('autoFilled');
          tag.className = 'supplier-field-tag supplier-field-tag--auto';
          tag.classList.remove('hidden');
        }
        if (unlock) unlock.classList.remove('hidden');
      } else {
        autoFilledFields.delete(fieldKey);
        input.readOnly = false;
        delete input.dataset.locked;
        input.tabIndex = 0;
        if (fieldKey === 'model' && els.modelOther) {
          els.modelOther.readOnly = false;
        }
        row.classList.remove('is-autofilled');
        if (tag) tag.classList.add('hidden');
        if (unlock) unlock.classList.add('hidden');
      }
    }

    function markMissingFields(missingFields) {
      const requiredMissing = (missingFields || []).filter((key) => ['brand', 'model', 'year'].includes(key));
      Object.keys(FIELD_ELS).forEach((key) => {
        const row = root.querySelector(`.supplier-field-row[data-field="${key}"]`);
        if (!row || autoFilledFields.has(key)) return;
        const needs = requiredMissing.includes(key)
          || (!getFieldValue(key) && ['brand', 'model', 'year'].includes(key));
        row.classList.toggle('needs-input', needs);
        const tag = root.querySelector(`[data-tag="${key}"]`);
        if (tag && needs && !autoFilledFields.has(key)) {
          tag.textContent = tBtn('needsInput');
          tag.className = 'supplier-field-tag supplier-field-tag--needs';
          tag.classList.remove('hidden');
        }
      });

      if (els.missingHint) {
        const count = autoFilledFields.size;
        if (count > 0 && decodeConfidence !== 'manual') {
          els.missingHint.innerHTML = `<strong>${count}</strong> ${escapeHtml(tf('fieldsAutoFilled'))}. ${escapeHtml(tf('onlyFillMissing'))}`;
          els.missingHint.classList.remove('hidden');
        } else {
          els.missingHint.classList.add('hidden');
        }
      }
    }

    function applyFieldLocking(result) {
      Object.keys(FIELD_ELS).forEach((key) => setFieldLocked(key, false));
      (result?.filledFields || []).forEach((key) => {
        if (getFieldValue(key)) setFieldLocked(key, true);
      });
      markMissingFields(result?.missingFields || []);
    }

    function renderDecodePreview(result) {
      if (!els.decodePreview) return;
      const data = result?.data || {};
      const items = [
        ['brand', data.brand],
        ['model', data.model],
        ['year', data.year],
        ['engineCode', data.engineCode],
        ['transmissionCode', data.transmissionCode],
        ['drivetrain', data.drivetrain],
        ['fuelType', data.fuelType],
      ].filter(([, val]) => val !== '' && val != null);

      if (!result?.success || !items.length) {
        els.decodePreview.classList.add('hidden');
        els.decodePreview.innerHTML = '';
        return;
      }

      const rows = items.map(([key, val]) => {
        const label = I18n().labelInline(key) || key;
        return `<div class="supplier-decode-preview__row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(val))}</strong></div>`;
      }).join('');

      els.decodePreview.innerHTML = `
        <h3 class="supplier-decode-preview__title">${tBtn('decodePreviewTitle')}</h3>
        <div class="supplier-decode-preview__grid">${rows}</div>`;
      els.decodePreview.classList.remove('hidden');
    }

    function updateConfidenceUI(result) {
      const confidence = result?.confidence || v.DECODE_CONFIDENCE.MANUAL;
      decodeConfidence = confidence;
      if (els.decodeConfidence) els.decodeConfidence.value = confidence;

      if (els.confidenceBadge) {
        els.confidenceBadge.textContent = confidenceLabel(confidence);
        els.confidenceBadge.className = `supplier-vin-confidence supplier-vin-confidence--${confidence}`;
        els.confidenceBadge.classList.remove('hidden');
      }

      if (els.confidenceNotice) {
        if (result?.success || confidence === v.DECODE_CONFIDENCE.MANUAL) {
          els.confidenceNotice.innerHTML = confidenceHint(confidence);
          els.confidenceNotice.className = `supplier-decode-notice supplier-decode-notice--${confidence}`;
          els.confidenceNotice.classList.remove('hidden');
        } else {
          els.confidenceNotice.classList.add('hidden');
        }
      }
    }

    function setVehicleFields(data, method) {
      if (data.brand) {
        const catalog = activeBrandCatalog();
        const ensuredBrand = catalog.ensureBrandOption?.(data.brand, {
          slug: data.brandSlug,
          zhLabel: data.qxbBrand && /[\u4e00-\u9fff]/.test(data.qxbBrand) ? data.qxbBrand : undefined,
        }) || data.brand;
        // Inject into <select> if missing (QXB brand not in static catalog)
        if (els.brand && ensuredBrand) {
          const exists = Array.from(els.brand.options).some(
            (opt) => opt.value.toLowerCase() === ensuredBrand.toLowerCase()
          );
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = ensuredBrand;
            opt.textContent = catalog.getBrandLabel?.(ensuredBrand) || ensuredBrand;
            els.brand.appendChild(opt);
          }
          els.brand.value = ensuredBrand;
        }
        populateModelSelect(ensuredBrand, data.model || '');
      } else if (data.model) {
        populateModelSelect('', data.model);
      }
      if (data.year) els.year.value = data.year;
      if (data.engineCode) els.engineCode.value = data.engineCode;
      if (data.transmissionCode) els.transmissionCode.value = data.transmissionCode;
      if (data.fuelType && els.fuelType) els.fuelType.value = data.fuelType;
      decodeMethod = method;
      els.decodeMethod.value = method;
    }

    function clearVehicleFields() {
      Object.keys(FIELD_ELS).forEach((key) => setFieldLocked(key, false));
      els.brand.value = '';
      populateModelSelect('', '');
      els.year.value = '';
      els.engineCode.value = '';
      els.transmissionCode.value = '';
      if (els.fuelType) els.fuelType.value = '';
      autoFilledFields.clear();
    }

    function applyDecodeResult(result) {
      const vinNorm = result.vin || v.normalizeVin(els.vin.value);
      els.vinDisplay.textContent = vinNorm || '—';
      updateConfidenceUI(result);
      renderDecodePreview(result);

      if (!result.success) {
        decodedSnapshot = result.data ? { ...result.data } : null;
        decodeMethod = result.decodeMethod || 'Manual Entry';
        els.decodeMethod.value = decodeMethod;
        if (result.data) setVehicleFields(result.data, decodeMethod);
        applyFieldLocking(result);
        els.manualNotice.classList.remove('hidden');
        els.decodeNotice.classList.add('hidden');
        els.vinStatus.innerHTML = confidenceHint(v.DECODE_CONFIDENCE.MANUAL);
        els.vinStatus.className = 'form-hint supplier-vin-status supplier-vin-status--manual';
        return;
      }

      decodedSnapshot = { ...result.data };
      setVehicleFields(result.data, result.decodeMethod);
      applyFieldLocking(result);
      els.manualNotice.classList.add('hidden');
      els.decodeNotice.classList.remove('hidden');
      els.vinStatus.innerHTML = confidenceHint(result.confidence);
      els.vinStatus.className = `form-hint supplier-vin-status supplier-vin-status--${result.confidence}`;
    }

    async function decodeViaQxbOrFallback(raw, vinNorm) {
      try {
        const res = await fetch('/api/vin/decode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vin: vinNorm }),
        });
        const body = await res.json();
        if (body?.ok) {
          return v.buildResultFromData({
            brand: body.brand || '',
            brandSlug: body.brandSlug || '',
            model: body.model || '',
            year: body.year || '',
            engineCode: body.engineCode || '',
            transmissionCode: body.transmissionCode || '',
            drivetrain: body.drivetrain || '',
            fuelType: body.fuelType || '',
            qxbBrand: body.qxbBrand || '',
            qxbSeries: body.qxbSeries || '',
            vin: vinNorm,
          });
        }
      } catch (err) {
        console.warn('[vin-decode] /api/vin/decode unavailable, falling back to local data', err);
      }
      // Covers: network error, QXB not configured, VIN not found in QXB's
      // database, rate limited — any non-ok response falls back to the
      // existing local demo/WMI-guess decoder so the form stays usable.
      return v.decodeVin(raw);
    }

    async function runVinDecode() {
      const raw = els.vin.value;
      const vinNorm = v.normalizeVin(raw);
      els.vin.value = vinNorm;
      updateVinCounter();

      if (vinNorm.length !== 17) {
        showFeedback(`${tf('vin')} — 17 ${tf('vinCounter')}`, 'error');
        return;
      }

      if (vinNorm === lastDecodedVin) return;
      lastDecodedVin = vinNorm;

      showFeedback(tf('decodeVin') || 'Decoding VIN…', 'info');
      const result = await decodeViaQxbOrFallback(raw, vinNorm);
      applyDecodeResult(result);
      showFeedback('', 'info');
    }

    function focusFirstMissingField() {
      const order = ['brand', 'model', 'year', 'engineCode', 'transmissionCode'];
      const target = order.find((key) => {
        if (autoFilledFields.has(key)) return false;
        if (['brand', 'model', 'year'].includes(key)) return !getFieldValue(key);
        return false;
      });
      if (target && els[target]) {
        if (els[target].dataset?.locked === 'true') root.querySelector(`[data-unlock="${target}"]`)?.click();
        if (target === 'model' && els.model.value === MODEL_OTHER && els.modelOther) {
          els.modelOther.focus();
        } else {
          els[target].focus();
        }
      }
    }

    function getSubmissionTruckPartType() {
      if (isTruckPartsUpload) return String(els.truckPartType?.value || 'cab').trim();
      if (isTruckVehicleUpload) return 'vehicle';
      return '';
    }

    function getSubmissionPassengerPartType() {
      if (isPassengerPartsUpload) return String(els.passengerPartType?.value || 'front').trim();
      return '';
    }

    function getSubmissionVehicleListingType() {
      if (!isVehicleUpload) return '';
      return String(els.vehicleListingType?.value || defaultVehicleListing || 'scrap').trim();
    }

    function buildSubmissionNotes(baseNotes) {
      let notes = String(baseNotes || '').trim();
      if (isVehicleUpload && getSubmissionVehicleListingType() === 'used') {
        const exportTag = '可整车出口';
        if (!notes.includes(exportTag)) {
          notes = notes ? `${notes}\n${exportTag}` : exportTag;
        }
      }
      return notes;
    }

    function getSubmissionVehicleCategory() {
      if (isTruckUpload) return 'truck';
      return els.vehicleCategory?.value === 'truck' ? 'truck' : 'passenger';
    }

    function getSubmissionVin() {
      const raw = String(els.vin?.value || '').trim();
      if (!raw) return '';
      const check = v.validateVin(raw);
      if (isLoosePartUpload) return check.valid ? check.vin : '';
      return check.valid ? check.vin : v.normalizeVin(raw);
    }

    async function validateAllSteps() {
      syncTruckPartMode();
      for (let step = 1; step <= TOTAL_STEPS; step++) {
        if (!(await validateStep(step))) {
          goToStep(step);
          return false;
        }
      }
      return true;
    }

    async function validateStep(step) {
      if (step === 1) {
        syncTruckPartMode();
        if (isTruckPartsUpload || isPassengerPartsUpload) {
          syncTruckPartMode();
        }
        let rawVin = String(els.vin.value || '').trim();
        if (isLoosePartUpload && rawVin) {
          const looseVinCheck = v.validateVin(rawVin);
          if (!looseVinCheck.valid) {
            els.vin.value = '';
            lastDecodedVin = '';
            rawVin = '';
          }
        }
        if (!rawVin) {
          if (isLoosePartUpload) return true;
          showFeedback(`${tf('vin')} — ${tf('required')}`, 'error');
          els.vin.focus();
          return false;
        }
        const check = v.validateVin(rawVin);
        if (!check.valid) {
          showFeedback(check.error || tBi('decodeUnavailable'), 'error');
          els.vin.focus();
          return false;
        }
        if (v.normalizeVin(rawVin) !== lastDecodedVin) await runVinDecode();
        return true;
      }
      if (step === 2) {
        if (!els.brand.value.trim()) {
          showFeedback(`${tf('brand')} — ${tf('required')}`, 'error');
          els.brand.focus();
          return false;
        }
        if (!getModelValue()) {
          showFeedback(`${tf('model')} — ${tf('required')}`, 'error');
          if (els.model.value === MODEL_OTHER && els.modelOther) els.modelOther.focus();
          else els.model.focus();
          return false;
        }
        if (!els.year.value) {
          showFeedback(`${tf('year')} — ${tf('required')}`, 'error');
          els.year.focus();
          return false;
        }
        if (isTruckUpload && truckPartType === 'engine' && !els.engineCode.value.trim()) {
          showFeedback(`${tf('engineCode')} — ${tf('required')}`, 'error');
          els.engineCode.focus();
          return false;
        }
        return true;
      }
      if (step === 3) {
        if (!form.supplierName.value.trim()) {
          showFeedback(`${tf('supplierName')} — ${tf('required')}`, 'error');
          form.supplierName.focus();
          return false;
        }
        if (!isLooseTruckPart && !form.mileage.value.trim()) {
          showFeedback(`${tf('mileage')} — ${tf('required')}`, 'error');
          form.mileage.focus();
          return false;
        }
        const priceUsd = Number(form.priceUsd.value);
        if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
          showFeedback(tBi('fobPriceRequired'), 'error');
          form.priceUsd.focus();
          return false;
        }
        if (!form.supplierPhone.value.trim() && !form.supplierWechat.value.trim()) {
          showFeedback(tBi('phoneOrWechat'), 'error');
          form.supplierPhone.focus();
          return false;
        }
        if (!form.inventoryStatus.value) {
          showFeedback(`${tf('inventoryStatus')} — ${tf('required')}`, 'error');
          form.inventoryStatus.focus();
          return false;
        }
        return true;
      }
      if (step === 4) {
        const maxPhotos = isCabUpload
          ? (v.MAX_PHOTOS_CAB || v.MAX_PHOTOS || 15)
          : (v.MAX_PHOTOS || 15);
        if (photoData.size < v.MIN_PHOTOS) {
          showFeedback(tBi('photosMin'), 'error');
          return false;
        }
        if (photoData.size > maxPhotos) {
          showFeedback(`Maximum ${maxPhotos} photos allowed.`, 'error');
          return false;
        }
        return true;
      }
      return true;
    }

    function goToStep(step) {
      currentStep = Math.max(1, Math.min(TOTAL_STEPS, step));
      panels.forEach(panel => {
        panel.classList.toggle('is-active', Number(panel.dataset.step) === currentStep);
      });
      progressItems.forEach(item => {
        const n = Number(item.dataset.progressStep);
        item.classList.toggle('is-active', n === currentStep);
        item.classList.toggle('is-complete', n < currentStep);
      });
      backBtn.classList.toggle('hidden', currentStep === 1);
      nextBtn.classList.toggle('hidden', currentStep === TOTAL_STEPS);
      submitBtn.classList.toggle('hidden', currentStep !== TOTAL_STEPS);
      showFeedback('', 'info');
      const activePanel = root.querySelector(`.supplier-step-panel[data-step="${currentStep}"]`);
      activePanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (currentStep === 2) focusFirstMissingField();
    }

    document.getElementById('decode-vin-btn')?.addEventListener('click', runVinDecode);

    els.brandFilter?.addEventListener('input', () => filterBrandOptions(els.brandFilter.value));
    els.brandFilter?.addEventListener('search', () => filterBrandOptions(els.brandFilter.value));

    els.brand?.addEventListener('change', () => {
      if (autoFilledFields.has('brand')) return;
      populateModelSelect(els.brand.value, '');
      setFieldLocked('model', false);
    });

    els.model?.addEventListener('change', () => {
      if (autoFilledFields.has('model')) return;
      if (els.model.value === MODEL_OTHER) {
        showModelOther('');
        els.modelOther?.focus();
      } else {
        hideModelOther();
      }
    });

    els.modelOther?.addEventListener('input', () => {
      if (els.model.value !== MODEL_OTHER || isTruckUpload) return;
      scheduleRememberCustomModel();
    });
    els.modelOther?.addEventListener('blur', () => {
      if (els.model.value === MODEL_OTHER) rememberCustomModel();
    });

    els.vin?.addEventListener('input', () => {
      const vinNorm = v.normalizeVin(els.vin.value);
      if (els.vin.value !== vinNorm) els.vin.value = vinNorm;
      updateVinCounter();
      if (vinNorm !== lastDecodedVin) {
        els.decodePreview?.classList.add('hidden');
        els.confidenceBadge?.classList.add('hidden');
        els.vinStatus.textContent = '';
      }
      clearTimeout(decodeTimer);
      if (vinNorm.length === 17) {
        decodeTimer = setTimeout(runVinDecode, 350);
      }
    });

    els.vin?.addEventListener('blur', () => {
      if (v.normalizeVin(els.vin.value).length === 17) runVinDecode();
    });

    root.querySelectorAll('[data-unlock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.unlock;
        setFieldLocked(key, false);
        els[key]?.focus();
        markMissingFields([]);
      });
    });

    Object.values(FIELD_ELS).forEach((key) => {
      els[key]?.addEventListener('mousedown', (event) => {
        if (autoFilledFields.has(key) && els[key]?.dataset?.locked === 'true') event.preventDefault();
      });
    });

    backBtn?.addEventListener('click', () => goToStep(currentStep - 1));
    nextBtn?.addEventListener('click', async () => {
      if (await validateStep(currentStep)) goToStep(currentStep + 1);
    });

    function bindPhotoInput(input) {
      const index = Number(input.id.replace('photo-', ''));
      const preview = document.getElementById(`photo-preview-${index}`);
      const img = preview?.querySelector('img');
      const slot = input.closest('.supplier-photo-slot');

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif)$/i.test(file.name || '')) {
          showFeedback(tBi('imagesOnly'), 'error');
          input.value = '';
          return;
        }

        slot?.classList.add('is-uploading');
        showFeedback(tBi('uploadingMedia'), 'info');
        try {
          const prepared = await preparePhotoForUpload(file);
          const labels = getActivePhotoLabels();
          const label = input.dataset.label || labels[index];
          const uploaded = await MediaApi().uploadPhoto(prepared, label);
          photoData.set(index, {
            label: uploaded.label || label,
            url: uploaded.url,
            thumbUrl: uploaded.thumbUrl || '',
          });
          if (preview && img) {
            img.src = uploaded.url;
            preview.hidden = false;
          }
          slot?.classList.add('has-photo');
          showUploadToast(tf('photoUploaded') || 'Photo uploaded', 'success');
          showFeedback('', 'info');
        } catch (err) {
          showFeedback(err.message || tBi('uploadFailed'), 'error');
          showUploadModal({
            type: 'error',
            title: tf('uploadFailed') || 'Upload failed',
            message: err.message || tBi('uploadFailed'),
          });
          input.value = '';
        } finally {
          slot?.classList.remove('is-uploading');
        }
      });
    }

    refreshPhotoGrid = function refreshPhotoGridImpl() {
      const grid = document.getElementById('supplier-photo-grid');
      const legend = document.getElementById('supplier-photos-legend');
      const hint = document.getElementById('supplier-photos-hint');
      if (!grid) return;

      const labels = getActivePhotoLabels();
      const prevSlots = grid.querySelectorAll('.supplier-photo-slot').length;
      if (labels.length < prevSlots) {
        for (let i = labels.length; i < prevSlots; i++) photoData.delete(i);
      }

      if (legend) legend.innerHTML = photosStepLegend();
      if (hint) hint.innerHTML = photosStepHint();
      grid.innerHTML = buildPhotoSlotsHtml(labels);
      grid.querySelectorAll('.supplier-photo-slot__input').forEach(bindPhotoInput);

      photoData.forEach((data, index) => {
        if (index >= labels.length) return;
        const preview = document.getElementById(`photo-preview-${index}`);
        const img = preview?.querySelector('img');
        const slot = document.getElementById(`photo-${index}`)?.closest('.supplier-photo-slot');
        if (preview && img && data.url) {
          img.src = data.url;
          preview.hidden = false;
          slot?.classList.add('has-photo');
        }
      });
    };

    root.querySelectorAll('.supplier-photo-slot__input').forEach(bindPhotoInput);

    const videoInput = document.getElementById('video-file');
    const videoPreview = document.getElementById('video-preview');
    const videoPlayer = document.getElementById('video-preview-player');
    const videoMeta = document.getElementById('video-file-meta');
    const videoSlot = document.getElementById('supplier-video-slot');

    function formatFileSize(bytes) {
      if (!bytes) return '';
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function clearVideoPreview() {
      videoData = null;
      if (videoInput) videoInput.value = '';
      if (videoPlayer) videoPlayer.removeAttribute('src');
      if (videoPlayer) videoPlayer.load?.();
      if (videoPreview) videoPreview.hidden = true;
      if (videoMeta) videoMeta.textContent = '';
      videoSlot?.classList.remove('has-video');
    }

    function showVideoPreview(data) {
      if (!videoPlayer || !videoPreview || !data?.url) return;
      videoPlayer.src = data.url;
      if (videoMeta) {
        videoMeta.textContent = `${data.fileName} · ${formatFileSize(data.size)}`;
      }
      videoPreview.hidden = false;
      videoSlot?.classList.add('has-video');
    }

      videoInput?.addEventListener('change', async () => {
      const file = videoInput.files?.[0];
      if (!file) return;

      const UploadLayer = window.HalfCutUploadLayer;
      const check = UploadLayer?.validateVideoFile?.(file) || { valid: true };
      if (!check.valid) {
        showFeedback(
          check.error?.includes('MB') ? tBi('videoTooLarge') : tBi('videoOnly'),
          'error'
        );
        videoInput.value = '';
        return;
      }

      videoSlot?.classList.add('is-uploading');
      showFeedback(tBi('uploadingMedia'), 'info');
      try {
        const uploaded = await MediaApi().uploadVideo(file);
        videoData = {
          url: uploaded.url,
          fileName: uploaded.fileName || file.name,
          mimeType: uploaded.mimeType || file.type || 'video/mp4',
          size: uploaded.size || file.size,
        };
        showVideoPreview(videoData);
        showUploadToast(tf('videoUploaded') || 'Video uploaded', 'success');
        showFeedback('', 'info');
      } catch (err) {
        showFeedback(err.message || tBi('uploadFailed'), 'error');
        showUploadModal({
          type: 'error',
          title: tf('uploadFailed') || 'Upload failed',
          message: err.message || tBi('uploadFailed'),
        });
        videoInput.value = '';
      } finally {
        videoSlot?.classList.remove('is-uploading');
      }
    });

    document.getElementById('video-remove-btn')?.addEventListener('click', clearVideoPreview);

    root.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-remove]');
      if (!btn) return;
      const index = Number(btn.dataset.remove);
      photoData.delete(index);
      const input = document.getElementById(`photo-${index}`);
      const preview = document.getElementById(`photo-preview-${index}`);
      if (input) input.value = '';
      if (preview) preview.hidden = true;
      input?.closest('.supplier-photo-slot')?.classList.remove('has-photo');
    });

    form.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || currentStep >= TOTAL_STEPS) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        event.preventDefault();
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      syncTruckPartMode();
      if (!(await validateAllSteps())) return;

      const photos = [];
      const activePhotoLabels = getActivePhotoLabels();
      for (let i = 0; i < activePhotoLabels.length; i++) {
        if (photoData.has(i)) photos.push(photoData.get(i));
      }

      const payload = {
        vin: getSubmissionVin(),
        supplierName: String(form.supplierName.value || '').trim(),
        supplierPhone: String(form.supplierPhone.value || '').trim(),
        supplierWechat: String(form.supplierWechat.value || '').trim(),
        supplierCity: String(form.supplierCity.value || '').trim(),
        brand: String(form.brand.value || '').trim(),
        model: getModelValue(),
        year: form.year.value,
        mileage: String(form.mileage.value || '').trim(),
        priceUsd: Number(Number(form.priceUsd.value).toFixed(2)),
        engineCode: String(form.engineCode.value || '').trim(),
        transmissionCode: String(form.transmissionCode.value || '').trim(),
        fuelType: String(form.fuelType?.value || '').trim(),
        vehicleCondition: form.vehicleCondition.value,
        vehicleCategory: getSubmissionVehicleCategory(),
        truckPartType: getSubmissionTruckPartType(),
        passengerPartType: getSubmissionPassengerPartType(),
        vehicleListingType: getSubmissionVehicleListingType(),
        inventoryStatus: String(form.inventoryStatus.value || '').trim(),
        decodeMethod: els.decodeMethod.value || decodeMethod,
        decodeConfidence: els.decodeConfidence?.value || decodeConfidence,
        decodedData: decodedSnapshot,
        notes: buildSubmissionNotes(form.notes.value),
        video: videoData,
        photos,
      };

      const uploadLayer = window.HalfCutUploadLayer;
      const precheck = uploadLayer?.validateSubmission?.(payload);
      if (precheck && !precheck.valid) {
        const errorText = precheck.errors.join(' ');
        showFeedback(errorText, 'error');
        showUploadModal({
          type: 'error',
          title: tf('uploadFailed') || 'Upload failed',
          message: errorText,
        });
        return;
      }

      showFeedback(tBi('uploadingMedia'), 'info');

      s.addSubmission(payload).then(async (submission) => {
        await rememberCustomModel();
        form.reset();
        photoData.clear();
        clearVideoPreview();
        decodedSnapshot = null;
        decodeMethod = 'Manual Entry';
        decodeConfidence = 'manual';
        lastDecodedVin = '';
        autoFilledFields.clear();
        root.querySelectorAll('.supplier-photo-slot__preview').forEach(el => { el.hidden = true; });
        root.querySelectorAll('.supplier-photo-slot').forEach(el => el.classList.remove('has-photo'));
        els.manualNotice.classList.add('hidden');
        els.decodeNotice.classList.add('hidden');
        els.confidenceNotice?.classList.add('hidden');
        els.decodePreview?.classList.add('hidden');
        els.confidenceBadge?.classList.add('hidden');
        els.vinDisplay.textContent = '—';
        els.vinStatus.textContent = '';
        if (els.vehicleCondition) els.vehicleCondition.value = 'Half Cut';
        clearVehicleFields();
        updateVinCounter();
        goToStep(1);
        const successVin = submission.vin ? `\nVIN: ${submission.vin}` : '';
        const successText = `${tf('pendingReview')}: ${submission.submissionId}${successVin}`;
        showFeedback(successText, 'success');
        showUploadModal({
          type: 'success',
          title: tf('uploadSuccess') || 'Upload successful',
          message: tf('pendingReview'),
          details: `ID: ${submission.submissionId}${successVin}`,
        });
      }).catch((err) => {
        const errorText = err.message || tf('submissionFailed');
        showFeedback(errorText, 'error');
        showUploadModal({
          type: 'error',
          title: tf('uploadFailed') || 'Upload failed',
          message: err.message || tf('submissionFailed'),
          details: tf('submissionFailed'),
        });
      });
    });

    goToStep(1);
    updateVinCounter();

    function refreshPartSelectLabels(selectEl, keysByValue) {
      if (!selectEl) return;
      const selected = selectEl.value;
      Array.from(selectEl.options).forEach((opt) => {
        const key = keysByValue[opt.value];
        if (key) opt.textContent = tf(key);
      });
      selectEl.value = selected;
    }

    function refreshSupplierUploadI18n() {
      I18n()?.registerFormStrings?.();
      const intro = root.querySelector('.supplier-upload-intro');
      if (intro) {
        const eyebrow = intro.querySelector('.section-eyebrow');
        if (eyebrow) eyebrow.textContent = pubT(introKeys.eyebrowKey, introKeys.eyebrowFallback);
        const h2 = intro.querySelector('h2');
        if (h2) h2.innerHTML = t(introKeys.title);
        const lead = intro.querySelector('.section-lead');
        if (lead) lead.innerHTML = th(introKeys.lead);
        const warn = intro.querySelector('.supplier-upload-warning');
        if (warn) warn.innerHTML = `<strong>${pubT('supplier.form.important', 'Important')}:</strong> ${th('supplierWarning')}`;
      }
      root.querySelector('.supplier-step-progress')?.setAttribute('aria-label', tf('stepProgressLabel'));
      root.querySelectorAll('.supplier-step-progress__label').forEach((el, i) => {
        if (stepLabels[i]) el.textContent = tBtn(stepLabels[i].key);
      });
      refreshPartSelectLabels(document.getElementById('truckPartType'), {
        cab: 'truckPartCab', engine: 'truckPartEngine', axle: 'truckPartAxle', other: 'truckPartOther',
      });
      refreshPartSelectLabels(document.getElementById('passengerPartType'), {
        front: 'passengerPartFront', engine: 'passengerPartEngine', transmission: 'passengerPartTransmission',
        chassis: 'passengerPartChassis', tire: 'passengerPartTire', other: 'passengerPartOther',
      });
      refreshPartSelectLabels(document.getElementById('vehicleListingType'), {
        scrap: 'listingTypeScrap', used: 'listingTypeUsed',
      });
      refreshPartSelectLabels(document.getElementById('vehicleCondition'), {
        'Running Vehicle': 'conditionRunning', 'Half Cut': 'conditionHalfCut',
        'Truck Half Cut': 'conditionTruckHalfCut', 'Driver Cab': 'conditionDriverCab',
        'Front Cut': 'conditionFrontCut', 'Dismantled': 'conditionDismantled',
        'Engine Removed': 'conditionEngineRemoved', 'Transmission Assembly': 'conditionTransmissionAssembly',
        'Chassis Part': 'conditionChassisPart', 'Used Tire': 'conditionUsedTire', 'Part': 'conditionPart',
      });
      refreshPartSelectLabels(document.getElementById('fuelType'), {
        Petrol: 'fuelPetrol', Diesel: 'fuelDiesel', Hybrid: 'fuelHybrid',
        'Plug-in Hybrid': 'fuelPlugInHybrid', Electric: 'fuelElectric',
      });
      refreshPartSelectLabels(document.getElementById('inventoryStatus'), {
        Available: 'available', Reserved: 'reserved', 'In Transit': 'inTransit', Sold: 'sold',
      });
      const photosHint = document.getElementById('supplier-photos-hint');
      if (photosHint) photosHint.innerHTML = photosStepHint();
      updateVinCounter();
      syncTruckPartMode?.();
      syncVehicleListingType?.();
    }

    if (!root.dataset.langRefreshBound) {
      root.dataset.langRefreshBound = '1';
      window.addEventListener('asiapower:langchange', refreshSupplierUploadI18n);
    }
  }

  function showBootState(root, message) {
    if (!root) return;
    root.innerHTML = `
      <div class="supplier-upload-layout supplier-upload-boot">
        <p class="supplier-upload-boot__text" role="status" aria-live="polite">${message}</p>
        <div class="supplier-upload-boot__bar" aria-hidden="true"><span></span></div>
      </div>`;
  }

  async function bootSupplierUpload() {
    const root = document.getElementById('supplier-half-cut-upload-root');
    const s = store();
    const Media = MediaApi();
    if (!s || !Media) return;
    showBootState(root, `${tf('supplierUploadTitle') || 'Upload'} — ${tf('uploadingMedia') || 'Loading…'}`);
    try {
      await s.whenReady();
      if (!Media.isServerMode()) {
        if (root) {
          root.innerHTML = `<div class="supplier-upload-warning"><strong>Server required / 需要本地服务器：</strong> Run <code>node server/half-cut-local-server.js</code> then open this page at <code>http://localhost:8787/supplier-portal/half-cut-upload.html</code></div>`;
        }
        return;
      }
      if (!window.SUPPLIER_UPLOAD_KEY) {
        if (root) {
          root.innerHTML = '<div class="supplier-upload-feedback supplier-upload-feedback--error"><strong>Upload key not loaded / 上传密钥未加载</strong><br>Please refresh the page. If this continues, contact AsiaPower support.<br>请刷新页面重试，若仍失败请联系 AsiaPower。</div>';
        }
        return;
      }
      try {
        await Media.checkUploadReady();
      } catch (err) {
        if (root) {
          root.innerHTML = `<div class="supplier-upload-feedback supplier-upload-feedback--error"><strong>Upload unavailable / 上传不可用</strong><br>${String(err.message || err).replace(/\n/g, '<br>')}</div>`;
        }
        return;
      }
      initSupplierHalfCutUpload();
      loadLearnedModels(Catalog()).catch((err) => {
        console.warn('[supplier-upload] learned models unavailable', err);
      });
    } catch (err) {
      if (root) root.innerHTML = `<div class="supplier-upload-feedback supplier-upload-feedback--error">${err.message}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', bootSupplierUpload);
})();
