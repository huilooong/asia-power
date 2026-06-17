/**
 * AsiaPower — Supplier Half-Cut Upload (VIN-first)
 */
(function () {
  'use strict';

  const store = () => window.HalfCutInventoryStore;
  const Vin = () => window.HalfCutVin;
  const I18n = () => window.HalfCutSupplierI18n;
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

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
          <button type="button" class="supplier-photo-slot__remove" data-remove="${index}">${tBtn('remove')}</button>
        </div>
      </div>`;
    }).join('');

    root.innerHTML = `
      <div class="supplier-upload-layout supplier-bilingual">
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
          <fieldset class="supplier-form-section supplier-vin-step">
            <legend>${t('stepVin')} <span class="req">*</span></legend>
            <div class="form-row form-row--2">
              <div>
                <label for="vin">${t('vin')}</label>
                <input type="text" id="vin" name="vin" required maxlength="17" placeholder="17-character VIN" autocomplete="off" style="text-transform:uppercase">
              </div>
              <div class="supplier-vin-actions">
                <button type="button" class="btn btn-navy btn-bilingual" id="decode-vin-btn">${tBtn('decodeVin')}</button>
              </div>
            </div>
            <p id="vin-decode-status" class="form-hint" aria-live="polite"></p>
            <p class="form-hint supplier-vin-display">${t('vinFullSupplier')}: <strong id="vin-full-display">—</strong></p>
          </fieldset>

          <fieldset class="supplier-form-section" id="vehicle-fields">
            <legend>${t('stepVehicle')}</legend>
            <div id="manual-entry-notice" class="supplier-upload-warning hidden" role="alert">
              ${I18n().labelEn('decodeUnavailable')}<br><span class="bi-zh-block">${I18n().labelZh('decodeUnavailable')}</span>
            </div>
            <div id="decode-success-notice" class="supplier-decode-success hidden" role="status">
              ${I18n().labelEn('decodeConfirm')}<br><span class="bi-zh-block">${I18n().labelZh('decodeConfirm')}</span>
            </div>
            <div class="form-row form-row--2">
              <div>
                <label for="brand">${t('brand')} <span class="req">*</span></label>
                <select id="brand" name="brand">
                  <option value="">${I18n().labelInline('selectBrand')}</option>
                  ${brandOptions}
                </select>
              </div>
              <div>
                <label for="model">${t('model')} <span class="req">*</span></label>
                <input type="text" id="model" name="model" placeholder="Hilux Revo">
              </div>
            </div>
            <div class="form-row form-row--3">
              <div>
                <label for="year">${t('year')} <span class="req">*</span></label>
                <input type="number" id="year" name="year" min="1990" max="2030" placeholder="2022">
              </div>
              <div>
                <label for="engineCode">${t('engineCode')}</label>
                <input type="text" id="engineCode" name="engineCode" placeholder="2GD-FTV">
              </div>
              <div>
                <label for="transmissionCode">${t('transmission')}</label>
                <input type="text" id="transmissionCode" name="transmissionCode" placeholder="6AT">
              </div>
            </div>
            <input type="hidden" id="decodeMethod" name="decodeMethod" value="Manual Entry">
          </fieldset>

          <fieldset class="supplier-form-section">
            <legend>${t('stepListing')}</legend>
            <div class="form-row form-row--2">
              <div>
                <label for="supplierName">${t('supplierName')} <span class="req">*</span></label>
                <input type="text" id="supplierName" name="supplierName" required autocomplete="organization">
              </div>
              <div>
                <label for="mileage">${t('mileage')} <span class="req">*</span></label>
                <input type="text" id="mileage" name="mileage" required placeholder="43000 or 43,000 km">
              </div>
            </div>
            <div class="form-row form-row--2">
              <div>
                <label for="supplierPhone">${t('supplierPhone')}</label>
                <input type="tel" id="supplierPhone" name="supplierPhone" placeholder="+86 …">
              </div>
              <div>
                <label for="supplierWechat">${t('supplierWechat')}</label>
                <input type="text" id="supplierWechat" name="supplierWechat" placeholder="WeChat ID">
              </div>
            </div>
            <p class="form-hint">${I18n().labelEn('phoneOrWechat')}<span class="bi-zh-inline">${I18n().labelZh('phoneOrWechat')}</span></p>
            <div class="form-row form-row--3">
              <div>
                <label for="vehicleCondition">${t('vehicleCondition')}</label>
                <select id="vehicleCondition" name="vehicleCondition">${conditionOptions}</select>
              </div>
              <div>
                <label for="inventoryStatus">${t('inventoryStatus')} <span class="req">*</span></label>
                <select id="inventoryStatus" name="inventoryStatus" required>
                  <option value="">${I18n().labelInline('selectStatus')}</option>
                  <option value="Available">${I18n().labelInline('available')}</option>
                  <option value="Reserved">${I18n().labelInline('reserved')}</option>
                </select>
              </div>
              <div>
                <label for="supplierCity">${t('supplierCity')}</label>
                <input type="text" id="supplierCity" name="supplierCity" placeholder="Guangzhou…">
              </div>
            </div>
            <div class="form-row">
              <label for="notes">${t('notes')}</label>
              <textarea id="notes" name="notes" rows="2"></textarea>
            </div>
            <div class="form-row">
              <label for="videoUrl">${t('videoLink')}</label>
              <input type="url" id="videoUrl" name="videoUrl" placeholder="https://…">
            </div>
          </fieldset>

          <fieldset class="supplier-form-section">
            <legend>${t('photosLegend')} / ${I18n().labelZh('photosLegend')} <span class="req">*</span> (min ${v.MIN_PHOTOS})</legend>
            <p class="form-hint">${I18n().labelEn('photosMin')}<span class="bi-zh-inline">${I18n().labelZh('photosMin')}</span></p>
            <div class="supplier-photo-grid">${photoSlots}</div>
          </fieldset>

          <div class="form-actions">
            <button type="submit" class="btn btn-accent btn-bilingual">${tBtn('submitListingShort')}</button>
            <a href="${base()}supplier-portal.html" class="btn btn-outline-navy btn-bilingual">${tBtn('backToPortal')}</a>
          </div>
          <div id="supplier-upload-feedback" class="supplier-upload-feedback" role="status" aria-live="polite"></div>
        </form>
      </div>`;

    const form = document.getElementById('supplier-half-cut-form');
    const feedback = document.getElementById('supplier-upload-feedback');
    const photoData = new Map();
    let decodedSnapshot = null;
    let decodeMethod = 'Manual Entry';

    const els = {
      vin: document.getElementById('vin'),
      vinStatus: document.getElementById('vin-decode-status'),
      vinDisplay: document.getElementById('vin-full-display'),
      manualNotice: document.getElementById('manual-entry-notice'),
      decodeNotice: document.getElementById('decode-success-notice'),
      decodeMethod: document.getElementById('decodeMethod'),
      brand: document.getElementById('brand'),
      model: document.getElementById('model'),
      year: document.getElementById('year'),
      engineCode: document.getElementById('engineCode'),
      transmissionCode: document.getElementById('transmissionCode'),
    };

    function showFeedback(message, type) {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.className = `supplier-upload-feedback supplier-upload-feedback--${type || 'info'}`;
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
      els.brand.value = '';
      els.model.value = '';
      els.year.value = '';
      els.engineCode.value = '';
      els.transmissionCode.value = '';
    }

    function runVinDecode() {
      const raw = els.vin.value;
      const result = v.decodeVin(raw);
      els.vinDisplay.textContent = result.vin || v.normalizeVin(raw) || '—';

      if (!result.success) {
        decodedSnapshot = null;
        decodeMethod = 'Manual Entry';
        els.decodeMethod.value = 'Manual Entry';
        clearVehicleFields();
        els.manualNotice.classList.remove('hidden');
        els.decodeNotice.classList.add('hidden');
        els.vinStatus.textContent = result.error || tBi('decodeUnavailable');
        els.vinStatus.className = 'form-hint supplier-vin-status--error';
        return;
      }

      decodedSnapshot = { ...result.data };
      setVehicleFields(result.data, result.decodeMethod);
      els.manualNotice.classList.add('hidden');
      els.decodeNotice.classList.remove('hidden');
      els.vinStatus.textContent = result.partial ? tBi('partialDecode') : tBi('decodeSuccessMsg');
      els.vinStatus.className = 'form-hint supplier-vin-status--success';
    }

    document.getElementById('decode-vin-btn')?.addEventListener('click', runVinDecode);
    els.vin?.addEventListener('blur', () => {
      if (els.vin.value.trim().length === 17) runVinDecode();
    });

    function bindPhotoInput(input) {
      const index = Number(input.id.replace('photo-', ''));
      const preview = document.getElementById(`photo-preview-${index}`);
      const img = preview?.querySelector('img');

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          showFeedback(tBi('imagesOnly'), 'error');
          input.value = '';
          return;
        }
        const dataUrl = await readFileAsDataUrl(file);
        photoData.set(index, { label: input.dataset.label || v.PHOTO_LABELS[index], dataUrl });
        if (preview && img) {
          img.src = dataUrl;
          preview.hidden = false;
        }
      });
    }

    root.querySelectorAll('.supplier-photo-slot__input').forEach(bindPhotoInput);

    root.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-remove]');
      if (!btn) return;
      const index = Number(btn.dataset.remove);
      photoData.delete(index);
      const input = document.getElementById(`photo-${index}`);
      const preview = document.getElementById(`photo-preview-${index}`);
      if (input) input.value = '';
      if (preview) preview.hidden = true;
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      showFeedback('', 'info');

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
        decodedData: decodedSnapshot,
        notes: String(form.notes.value || '').trim(),
        videoUrl: String(form.videoUrl.value || '').trim(),
        photos,
      };

      try {
        const submission = s.addSubmission(payload);
        form.reset();
        photoData.clear();
        decodedSnapshot = null;
        decodeMethod = 'Manual Entry';
        root.querySelectorAll('.supplier-photo-slot__preview').forEach(el => { el.hidden = true; });
        els.manualNotice.classList.add('hidden');
        els.decodeNotice.classList.add('hidden');
        els.vinDisplay.textContent = '—';
        showFeedback(
          `${I18n().labelEn('pendingReview')} / ${I18n().labelZh('pendingReview')}: ${submission.submissionId}\nVIN: ${submission.vin}`,
          'success'
        );
      } catch (err) {
        showFeedback(`${err.message}\n${I18n().labelZh('submissionFailed')}`, 'error');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initSupplierHalfCutUpload);
})();
