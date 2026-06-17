/**
 * AsiaPower — Supplier Half-Cut Upload (VIN-first, step wizard)
 */
(function () {
  'use strict';

  const TOTAL_STEPS = 4;

  const store = () => window.HalfCutInventoryStore;
  const Vin = () => window.HalfCutVin;
  const I18n = () => window.HalfCutSupplierI18n;
  const MediaApi = () => window.HalfCutMediaApi;
  const t = (key) => I18n()?.labelHtml(key) || key;
  const tBtn = (key) => I18n()?.labelInline(key) || key;
  const tBi = (key) => {
    const item = I18n()?.L[key];
    if (!item) return key;
    return `${item.en}\n${item.zh}`;
  };

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

  function initSupplierHalfCutUpload() {
    const root = document.getElementById('supplier-half-cut-upload-root');
    const s = store();
    const v = Vin();
    if (!root || !s || !v || !I18n()) return;

    const brandOptions = s.SUPPORTED_BRANDS.map(brand =>
      `<option value="${escapeHtml(brand)}">${escapeHtml(brand)}</option>`
    ).join('');

    const conditionOptions = [
      ['Running Vehicle', 'conditionRunning'],
      ['Half Cut', 'conditionHalfCut'],
      ['Dismantled', 'conditionDismantled'],
      ['Engine Removed', 'conditionEngineRemoved'],
    ].map(([val, key]) => `<option value="${val}">${I18n().labelInline(key)}</option>`).join('');

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

    const photoLabelBi = I18n().L.photoLabels || [];
    const photoSlots = v.PHOTO_LABELS.map((label, index) => {
      const bi = photoLabelBi[index];
      const labelText = bi ? `${bi.en} / ${bi.zh}` : label;
      const reqTag = index < v.MIN_PHOTOS
        ? `<span class="supplier-photo-slot__req">${I18n().labelInline('required')}</span>`
        : `<span class="supplier-photo-slot__opt">${I18n().labelInline('recommended')}</span>`;
      return `
      <div class="supplier-photo-slot" data-slot="${index}">
        <label class="supplier-photo-slot__label" for="photo-${index}">
          <span class="supplier-photo-slot__num">${index + 1}</span>
          ${escapeHtml(labelText)}
          ${reqTag}
        </label>
        <input type="file" id="photo-${index}" class="supplier-photo-slot__input" accept="image/*" data-label="${escapeHtml(label)}">
        <div class="supplier-photo-slot__preview" id="photo-preview-${index}" hidden>
          <img alt="">
          <button type="button" class="supplier-photo-slot__remove btn-bilingual" data-remove="${index}">${tBtn('remove')}</button>
        </div>
      </div>`;
    }).join('');

    root.innerHTML = `
      <div class="supplier-upload-layout supplier-bilingual supplier-upload-wizard">
        <div class="supplier-upload-intro">
          <span class="section-eyebrow">Supplier Inventory / 供应商库存</span>
          <h2>${t('supplierUploadTitle')}</h2>
          <p class="section-lead supplier-instruction-en">${I18n().labelEn('supplierUploadLead')}</p>
          <p class="section-lead supplier-instruction-zh">${I18n().labelZh('supplierUploadLead')}</p>
          <div class="supplier-upload-warning">
            <strong>Important / 重要提示：</strong> ${I18n().labelEn('supplierWarning')}<br>
            <span class="bi-zh-block">${I18n().labelZh('supplierWarning')}</span>
          </div>
        </div>

        <form id="supplier-half-cut-form" class="supplier-upload-form" novalidate>
          <nav class="supplier-step-progress" aria-label="${I18n().labelEn('stepProgressLabel')} / ${I18n().labelZh('stepProgressLabel')}">
            <ol class="supplier-step-progress__list">${progressSteps}</ol>
          </nav>

          <div class="supplier-step-panels">
            <fieldset class="supplier-form-section supplier-step-panel supplier-vin-step is-active" data-step="1">
              <legend>${t('stepVin')} <span class="req">*</span></legend>
              <p class="form-hint supplier-vin-lead">${I18n().labelEn('supplierUploadLead')}<span class="bi-zh-block">${I18n().labelZh('supplierUploadLead')}</span></p>
              <div class="supplier-vin-block">
                <label for="vin">${t('vin')}</label>
                <input type="text" id="vin" name="vin" required maxlength="17" placeholder="17-character VIN" autocomplete="off" class="supplier-input-lg supplier-vin-input" inputmode="text" autocapitalize="characters" spellcheck="false">
                <div class="supplier-vin-meta">
                  <span id="vin-char-count" class="supplier-vin-counter" aria-live="polite">0/17 ${I18n().labelEn('vinCounter')}</span>
                  <span id="vin-confidence-badge" class="supplier-vin-confidence hidden" aria-live="polite"></span>
                </div>
                <button type="button" class="btn btn-navy btn-lg btn-bilingual supplier-decode-btn" id="decode-vin-btn">${tBtn('decodeVin')}</button>
              </div>
              <p id="vin-decode-status" class="form-hint supplier-vin-status" aria-live="polite"></p>
              <p class="form-hint supplier-vin-display">${t('vinFullSupplier')}: <strong id="vin-full-display">—</strong></p>
              <div id="vin-decode-preview" class="supplier-decode-preview hidden" aria-live="polite"></div>
              <input type="hidden" id="decodeConfidence" name="decodeConfidence" value="manual">
            </fieldset>

            <fieldset class="supplier-form-section supplier-step-panel" data-step="2" id="vehicle-fields">
              <legend>${t('stepVehicle')}</legend>
              <div id="decode-confidence-notice" class="supplier-decode-notice hidden" role="status"></div>
              <div id="manual-entry-notice" class="supplier-upload-warning hidden" role="alert">
                ${I18n().labelEn('decodeUnavailable')}<br><span class="bi-zh-block">${I18n().labelZh('decodeUnavailable')}</span>
              </div>
              <div id="decode-success-notice" class="supplier-decode-success hidden" role="status">
                ${I18n().labelEn('decodeConfirm')}<br><span class="bi-zh-block">${I18n().labelZh('decodeConfirm')}</span>
              </div>
              <p id="vehicle-missing-hint" class="form-hint supplier-missing-hint hidden"></p>
              <div class="form-row supplier-field-row" data-field="brand">
                <div class="supplier-field-row__head">
                  <label for="brand">${t('brand')} <span class="req">*</span></label>
                  <span class="supplier-field-tag hidden" data-tag="brand"></span>
                  <button type="button" class="supplier-field-unlock hidden" data-unlock="brand">${tBtn('editField')}</button>
                </div>
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
                <input type="text" id="model" name="model" class="supplier-input-lg" placeholder="Hilux Revo">
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
                <div class="supplier-field-row" data-field="engineCode">
                  <div class="supplier-field-row__head">
                    <label for="engineCode">${t('engineCode')}</label>
                    <span class="supplier-field-tag hidden" data-tag="engineCode"></span>
                    <button type="button" class="supplier-field-unlock hidden" data-unlock="engineCode">${tBtn('editField')}</button>
                  </div>
                  <input type="text" id="engineCode" name="engineCode" class="supplier-input-lg" placeholder="2GD-FTV">
                </div>
              </div>
              <div class="form-row supplier-field-row" data-field="transmissionCode">
                <div class="supplier-field-row__head">
                  <label for="transmissionCode">${t('transmission')}</label>
                  <span class="supplier-field-tag hidden" data-tag="transmissionCode"></span>
                  <button type="button" class="supplier-field-unlock hidden" data-unlock="transmissionCode">${tBtn('editField')}</button>
                </div>
                <input type="text" id="transmissionCode" name="transmissionCode" class="supplier-input-lg" placeholder="6AT">
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
                <label for="mileage">${t('mileage')} <span class="req">*</span></label>
                <input type="text" id="mileage" name="mileage" required class="supplier-input-lg" placeholder="43000 or 43,000 km">
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
              <p class="form-hint">${I18n().labelEn('phoneOrWechat')}<span class="bi-zh-inline">${I18n().labelZh('phoneOrWechat')}</span></p>
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
                <p class="form-hint">${I18n().labelEn('videoOptional')}<span class="bi-zh-inline">${I18n().labelZh('videoOptional')}</span></p>
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
              <legend>${t('stepPhotos')} <span class="req">*</span> (min ${v.MIN_PHOTOS})</legend>
              <p class="form-hint">${I18n().labelEn('photosMin')}<span class="bi-zh-inline">${I18n().labelZh('photosMin')}</span></p>
              <div class="supplier-photo-grid">${photoSlots}</div>
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
      brand: document.getElementById('brand'),
      model: document.getElementById('model'),
      year: document.getElementById('year'),
      engineCode: document.getElementById('engineCode'),
      transmissionCode: document.getElementById('transmissionCode'),
      vehicleCondition: document.getElementById('vehicleCondition'),
    };

    if (els.vehicleCondition) els.vehicleCondition.value = 'Half Cut';

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
      return `${I18n().labelEn(map[confidence] || 'confidenceManualHint')}<span class="bi-zh-block">${I18n().labelZh(map[confidence] || 'confidenceManualHint')}</span>`;
    }

    function updateVinCounter() {
      const len = v.normalizeVin(els.vin.value).length;
      if (!els.vinCounter) return;
      const suffix = I18n().labelEn('vinCounter');
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
        const needs = requiredMissing.includes(key) || (!els[key]?.value && ['brand', 'model', 'year'].includes(key));
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
          els.missingHint.innerHTML = `<strong>${count}</strong> ${I18n().labelEn('fieldsAutoFilled')} / ${count}${I18n().labelZh('fieldsAutoFilled')}. ${I18n().labelEn('onlyFillMissing')}<span class="bi-zh-inline">${I18n().labelZh('onlyFillMissing')}</span>`;
          els.missingHint.classList.remove('hidden');
        } else {
          els.missingHint.classList.add('hidden');
        }
      }
    }

    function applyFieldLocking(result) {
      Object.keys(FIELD_ELS).forEach((key) => setFieldLocked(key, false));
      (result?.filledFields || []).forEach((key) => {
        if (els[key]?.value) setFieldLocked(key, true);
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
      if (data.brand) els.brand.value = data.brand;
      if (data.model) els.model.value = data.model;
      if (data.year) els.year.value = data.year;
      if (data.engineCode) els.engineCode.value = data.engineCode;
      if (data.transmissionCode) els.transmissionCode.value = data.transmissionCode;
      decodeMethod = method;
      els.decodeMethod.value = method;
    }

    function clearVehicleFields() {
      Object.keys(FIELD_ELS).forEach((key) => setFieldLocked(key, false));
      els.brand.value = '';
      els.model.value = '';
      els.year.value = '';
      els.engineCode.value = '';
      els.transmissionCode.value = '';
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

    function runVinDecode() {
      const raw = els.vin.value;
      const vinNorm = v.normalizeVin(raw);
      els.vin.value = vinNorm;
      updateVinCounter();

      if (vinNorm.length !== 17) {
        showFeedback(`${I18n().labelEn('vin')} must be 17 characters / ${I18n().labelZh('vin')}必须为17位`, 'error');
        return;
      }

      if (vinNorm === lastDecodedVin) return;
      lastDecodedVin = vinNorm;

      const result = v.decodeVin(raw);
      applyDecodeResult(result);
      showFeedback('', 'info');
    }

    function focusFirstMissingField() {
      const order = ['brand', 'model', 'year', 'engineCode', 'transmissionCode'];
      const target = order.find((key) => {
        if (autoFilledFields.has(key)) return false;
        if (['brand', 'model', 'year'].includes(key)) return !els[key]?.value;
        return false;
      });
      if (target && els[target]) {
        if (els[target].dataset?.locked === 'true') root.querySelector(`[data-unlock="${target}"]`)?.click();
        els[target].focus();
      }
    }

    function validateStep(step) {
      if (step === 1) {
        const check = v.validateVin(els.vin.value);
        if (!check.valid) {
          showFeedback(check.error || tBi('decodeUnavailable'), 'error');
          els.vin.focus();
          return false;
        }
        if (v.normalizeVin(els.vin.value) !== lastDecodedVin) runVinDecode();
        return true;
      }
      if (step === 2) {
        if (!els.brand.value.trim()) {
          showFeedback(`${I18n().labelEn('brand')} required / ${I18n().labelZh('brand')}必填`, 'error');
          els.brand.focus();
          return false;
        }
        if (!els.model.value.trim()) {
          showFeedback(`${I18n().labelEn('model')} required / ${I18n().labelZh('model')}必填`, 'error');
          els.model.focus();
          return false;
        }
        if (!els.year.value) {
          showFeedback(`${I18n().labelEn('year')} required / ${I18n().labelZh('year')}必填`, 'error');
          els.year.focus();
          return false;
        }
        return true;
      }
      if (step === 3) {
        if (!form.supplierName.value.trim()) {
          showFeedback(`${I18n().labelEn('supplierName')} required / ${I18n().labelZh('supplierName')}必填`, 'error');
          form.supplierName.focus();
          return false;
        }
        if (!form.mileage.value.trim()) {
          showFeedback(`${I18n().labelEn('mileage')} required / ${I18n().labelZh('mileage')}必填`, 'error');
          form.mileage.focus();
          return false;
        }
        if (!form.supplierPhone.value.trim() && !form.supplierWechat.value.trim()) {
          showFeedback(tBi('phoneOrWechat'), 'error');
          form.supplierPhone.focus();
          return false;
        }
        if (!form.inventoryStatus.value) {
          showFeedback(`${I18n().labelEn('inventoryStatus')} required / ${I18n().labelZh('inventoryStatus')}必填`, 'error');
          form.inventoryStatus.focus();
          return false;
        }
        return true;
      }
      if (step === 4) {
        if (photoData.size < v.MIN_PHOTOS) {
          showFeedback(tBi('photosMin'), 'error');
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
    nextBtn?.addEventListener('click', () => {
      if (validateStep(currentStep)) goToStep(currentStep + 1);
    });

    function bindPhotoInput(input) {
      const index = Number(input.id.replace('photo-', ''));
      const preview = document.getElementById(`photo-preview-${index}`);
      const img = preview?.querySelector('img');
      const slot = input.closest('.supplier-photo-slot');

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          showFeedback(tBi('imagesOnly'), 'error');
          input.value = '';
          return;
        }

        slot?.classList.add('is-uploading');
        showFeedback(tBi('uploadingMedia'), 'info');
        try {
          const label = input.dataset.label || v.PHOTO_LABELS[index];
          const uploaded = await MediaApi().uploadPhoto(file, label);
          photoData.set(index, { label: uploaded.label || label, url: uploaded.url });
          if (preview && img) {
            img.src = uploaded.url;
            preview.hidden = false;
          }
          slot?.classList.add('has-photo');
          showFeedback('', 'info');
        } catch (err) {
          showFeedback(err.message || tBi('uploadFailed'), 'error');
          input.value = '';
        } finally {
          slot?.classList.remove('is-uploading');
        }
      });
    }

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
        showFeedback('', 'info');
      } catch (err) {
        showFeedback(err.message || tBi('uploadFailed'), 'error');
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

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!validateStep(4)) return;
      showFeedback(tBi('uploadingMedia'), 'info');

      const photos = [];
      for (let i = 0; i < v.PHOTO_LABELS.length; i++) {
        if (photoData.has(i)) photos.push(photoData.get(i));
      }

      const payload = {
        vin: els.vin.value,
        supplierName: String(form.supplierName.value || '').trim(),
        supplierPhone: String(form.supplierPhone.value || '').trim(),
        supplierWechat: String(form.supplierWechat.value || '').trim(),
        supplierCity: String(form.supplierCity.value || '').trim(),
        brand: String(form.brand.value || '').trim(),
        model: String(form.model.value || '').trim(),
        year: form.year.value,
        mileage: String(form.mileage.value || '').trim(),
        engineCode: String(form.engineCode.value || '').trim(),
        transmissionCode: String(form.transmissionCode.value || '').trim(),
        vehicleCondition: form.vehicleCondition.value,
        inventoryStatus: String(form.inventoryStatus.value || '').trim(),
        decodeMethod: els.decodeMethod.value || decodeMethod,
        decodeConfidence: els.decodeConfidence?.value || decodeConfidence,
        decodedData: decodedSnapshot,
        notes: String(form.notes.value || '').trim(),
        video: videoData,
        photos,
      };

      s.addSubmission(payload).then((submission) => {
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
        showFeedback(
          `${I18n().labelEn('pendingReview')} / ${I18n().labelZh('pendingReview')}: ${submission.submissionId}\nVIN: ${submission.vin}`,
          'success'
        );
      }).catch((err) => {
        showFeedback(`${err.message}\n${I18n().labelZh('submissionFailed')}`, 'error');
      });
    });

    goToStep(1);
    updateVinCounter();
  }

  async function bootSupplierUpload() {
    const s = store();
    const Media = MediaApi();
    if (!s || !Media) return;
    try {
      await s.whenReady();
      if (!Media.isServerMode()) {
        const root = document.getElementById('supplier-half-cut-upload-root');
        if (root) {
          root.innerHTML = `<div class="supplier-upload-warning"><strong>Server required / 需要本地服务器：</strong> Run <code>node server/half-cut-local-server.js</code> then open this page at <code>http://localhost:8787/supplier-portal/half-cut-upload.html</code></div>`;
        }
        return;
      }
      initSupplierHalfCutUpload();
    } catch (err) {
      const root = document.getElementById('supplier-half-cut-upload-root');
      if (root) root.innerHTML = `<div class="supplier-upload-feedback supplier-upload-feedback--error">${err.message}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', bootSupplierUpload);
})();
