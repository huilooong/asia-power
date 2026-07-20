/**
 * AsiaPower — Shared admin submission review card rendering
 */
(function () {
  'use strict';

  const store = () => window.HalfCutInventoryStore;
  const Vin = () => window.HalfCutVin;
  const Catalog = () => window.VehicleCatalog;
  const I18n = () => window.HalfCutSupplierI18n;
  const t = (key) => I18n()?.labelHtml(key) || key;
  const tBtn = (key) => I18n()?.labelInline(key) || key;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  function statusLabel(status) {
    const map = { pending: 'adminPending', approved: 'adminApproved', rejected: 'adminRejected' };
    return tBtn(map[status] || status);
  }

  function conditionOptionLabel(value) {
    const map = {
      'Running Vehicle': 'conditionRunning',
      'Half Cut': 'conditionHalfCut',
      'Front Cut': 'conditionFrontCut',
      'Truck Half Cut': 'conditionTruckHalfCut',
      'Driver Cab': 'conditionDriverCab',
      'Engine Assembly': 'conditionEngineAssembly',
      'Transmission Assembly': 'conditionTransmissionAssembly',
      'Chassis Part': 'conditionChassisPart',
      'Axle Assembly': 'conditionAxleAssembly',
      'Truck Part': 'conditionTruckPart',
      'Part': 'conditionPart',
      'Dismantled': 'conditionDismantled',
      'Engine Removed': 'conditionEngineRemoved',
    };
    return I18n()?.labelInline(map[value]) || value;
  }

  function passengerPartTypeLabel(type) {
    const map = {
      front: 'passengerPartFront',
      engine: 'passengerPartEngine',
      transmission: 'passengerPartTransmission',
      chassis: 'passengerPartChassis',
      tire: 'passengerPartTire',
      other: 'passengerPartOther',
    };
    return I18n()?.labelInline(map[type] || 'passengerPartOther') || type;
  }

  function truckPartTypeLabel(type) {
    const map = {
      cab: 'truckPartCab',
      engine: 'truckPartEngine',
      axle: 'truckPartAxle',
      other: 'truckPartOther',
      vehicle: 'truckPartVehicle',
    };
    return I18n()?.labelInline(map[type] || 'truckPartOther') || type;
  }

  function inventoryStatusLabel(value) {
    const map = {
      Available: 'available',
      Reserved: 'reserved',
      'In Transit': 'inTransit',
      Sold: 'sold',
    };
    return I18n()?.labelInline(map[value]) || value;
  }

  function renderPhotos(photos) {
    if (!Array.isArray(photos) || !photos.length) {
      return `<p class="admin-review-empty">${tBtn('noPhotos')}</p>`;
    }
    return `
      <div class="admin-review-photos">
        ${photos.map((photo, index) => {
          const url = typeof photo === 'string' ? photo : (photo.url || '');
          const label = typeof photo === 'object' && photo.label ? photo.label : `Photo ${index + 1}`;
          return `
            <figure class="admin-review-photo">
              <img src="${url}" alt="${escapeHtml(label)}" loading="lazy">
              <figcaption>${escapeHtml(label)}</figcaption>
            </figure>`;
        }).join('')}
      </div>`;
  }

  function renderVideoBlock(submission) {
    const u = window.HalfCutUtils;
    const item = { video: submission.video, videoUrl: submission.videoUrl };
    if (!u?.hasVideo?.(item)) {
      return `<p class="admin-review-empty">${tBtn('noVideo')}</p>`;
    }
    const fileName = submission.video?.fileName || 'vehicle-video';
    const player = u.renderVideoPlayer(item, { className: 'admin-review-video', title: fileName });
    return `
      <div class="admin-review-video-wrap">
        ${player}
        <p class="admin-review-video-meta">${escapeHtml(fileName)}</p>
      </div>`;
  }

  function renderDecodedBlock(submission) {
    if (!submission.decodedData) return '';
    const d = submission.decodedData;
    return `
      <section class="admin-review-decode">
        <h3>${t('autoDecodedSnapshot')}</h3>
        <dl class="admin-review-specs">
          <div><dt>${t('brand')}</dt><dd>${escapeHtml(d.brand || '—')}</dd></div>
          <div><dt>${t('model')}</dt><dd>${escapeHtml(d.model || '—')}</dd></div>
          <div><dt>${t('year')}</dt><dd>${escapeHtml(d.year || '—')}</dd></div>
          <div><dt>${t('engineCode')}</dt><dd>${escapeHtml(d.engineCode || '—')}</dd></div>
          <div><dt>${t('transmission')}</dt><dd>${escapeHtml(d.transmissionCode || '—')}</dd></div>
        </dl>
      </section>`;
  }

  function brandOptionsForSubmission(submission) {
    const isTruck = submission.vehicleCategory === 'truck';
    const catalog = isTruck && window.TruckBrandCatalog ? window.TruckBrandCatalog : Catalog();
    const names = catalog?.getBrandNames?.() || store()?.getSupportedBrands?.() || store()?.SUPPORTED_BRANDS || [];
    const raw = submission.brand;
    const resolved = (() => {
      const r = String(raw || '').trim();
      if (!r) return '';
      const exact = names.find((n) => n.toLowerCase() === r.toLowerCase());
      if (exact) return exact;
      const norm = window.VehicleNameNormalize?.normalizeVehicleNames?.(r, '');
      if (norm?.brand && names.includes(norm.brand)) return norm.brand;
      return r;
    })();
    const label = (name) => catalog?.getBrandLabel?.(name) || name;
    const groups = catalog?.getBrandOptionGroups?.();
    if (!groups) {
      return names.map((brand) =>
        `<option value="${escapeHtml(brand)}" ${brand === resolved ? 'selected' : ''}>${escapeHtml(label(brand))}</option>`
      ).join('');
    }
    if (isTruck && window.TruckBrandCatalog?.GROUP_LABELS) {
      const labels = window.TruckBrandCatalog.GROUP_LABELS;
      const extra = resolved && !names.includes(resolved) ? [resolved] : [];
      return [
        extra.length ? `<optgroup label="Current">${extra.map((brand) =>
          `<option value="${escapeHtml(brand)}" selected>${escapeHtml(label(brand))}</option>`
        ).join('')}</optgroup>` : '',
        ...Object.keys(labels)
          .filter((key) => Array.isArray(groups[key]) && groups[key].length)
          .map((key) => `<optgroup label="${escapeHtml(labels[key])}">${groups[key].map((brand) =>
            `<option value="${escapeHtml(brand)}" ${brand === resolved ? 'selected' : ''}>${escapeHtml(label(brand))}</option>`
          ).join('')}</optgroup>`),
      ].join('');
    }
    const renderGroup = (title, list) => {
      const items = list.filter((name) => names.includes(name));
      if (!items.length) return '';
      return `<optgroup label="${escapeHtml(title)}">${items.map((brand) =>
        `<option value="${escapeHtml(brand)}" ${brand === resolved ? 'selected' : ''}>${escapeHtml(label(brand))}</option>`
      ).join('')}</optgroup>`;
    };
    const extra = resolved && !names.includes(resolved) ? [resolved] : [];
    return [
      extra.length ? `<optgroup label="Current">${extra.map((brand) =>
        `<option value="${escapeHtml(brand)}" selected>${escapeHtml(label(brand))}</option>`
      ).join('')}</optgroup>` : '',
      renderGroup('Chinese brands · 中国品牌', groups.chinese),
      renderGroup('Other brands · 其他品牌', groups.other),
    ].join('');
  }

  function renderEditForm(submission) {
    const v = Vin();
    const meta = window.HalfCutUploadLayer?.resolveListingMeta?.(submission) || submission;
    const loosePart = window.HalfCutReviewLayer?.isLoosePartListing?.(submission, meta)
      || window.HalfCutUploadLayer?.isLooseTruckPartType?.(meta.truckPartType)
      || window.HalfCutUploadLayer?.isLoosePassengerPartType?.(meta.passengerPartType);
    const optionalPart = loosePart ? ' <span class="admin-field-optional">(配件选填 · optional)</span>' : '';
    const statusOptions = (v?.ADMIN_STATUSES || []).map((st) =>
      `<option value="${escapeHtml(st)}" ${submission.inventoryStatus === st ? 'selected' : ''}>${escapeHtml(inventoryStatusLabel(st))}</option>`
    ).join('');
    const conditionList = [...(v?.VEHICLE_CONDITIONS || [])];
    const currentCondition = String(submission.vehicleCondition || meta.vehicleCondition || '').trim();
    if (currentCondition && !conditionList.includes(currentCondition)) conditionList.unshift(currentCondition);
    const conditionOptions = conditionList.map((c) =>
      `<option value="${escapeHtml(c)}" ${currentCondition === c ? 'selected' : ''}>${escapeHtml(conditionOptionLabel(c))}</option>`
    ).join('');
    const isTruck = meta.vehicleCategory === 'truck';
    const isPassengerPart = Boolean(meta.passengerPartType)
      || ['Front Cut', 'Engine Assembly', 'Transmission Assembly', 'Chassis Part', 'Part'].includes(currentCondition);

    return `
      <details class="admin-review-edit" open>
        <summary>${tBtn('editBeforeApprove')}</summary>
        <div class="admin-review-edit-grid">
          <label>${t('vin')}${optionalPart} <input type="text" data-edit="vin" value="${escapeHtml(submission.vin || '')}" maxlength="17" placeholder="${loosePart ? 'optional' : '17-char VIN'}"></label>
          <label>${t('brand')} <select data-edit="brand">${brandOptionsForSubmission(submission)}</select></label>
          <label>${t('model')} <input type="text" data-edit="model" value="${escapeHtml(submission.model || '')}"></label>
          <label>${t('year')} <input type="number" data-edit="year" value="${escapeHtml(submission.year || '')}"></label>
          <label>${t('engineCode')}${optionalPart} <input type="text" data-edit="engineCode" value="${escapeHtml(submission.engineCode || '')}"></label>
          <label>${t('transmission')}${optionalPart} <input type="text" data-edit="transmissionCode" value="${escapeHtml(submission.transmissionCode || '')}"></label>
          <label>${t('mileage')} <input type="text" data-edit="mileage" value="${escapeHtml(submission.mileage || '')}"></label>
          <label>${t('fobPriceUsd')} <input type="number" data-edit="priceUsd" min="0" step="0.01" value="${escapeHtml(submission.priceUsd ?? '')}"></label>
          <label>${t('vehicleCondition')} <select data-edit="vehicleCondition">${conditionOptions}</select></label>
          <label>${t('vehicleCategory')} <select data-edit="vehicleCategory">
            <option value="passenger" ${!isTruck ? 'selected' : ''}>${I18n().labelInline('categoryPassenger')}</option>
            <option value="truck" ${isTruck ? 'selected' : ''}>${I18n().labelInline('categoryTruck')}</option>
          </select></label>
          <label class="${isTruck ? '' : 'hidden'}" data-truck-part-type-row>${t('truckPartType')} <select data-edit="truckPartType">
            <option value="cab" ${meta.truckPartType === 'cab' ? 'selected' : ''}>${I18n().labelInline('truckPartCab')}</option>
            <option value="engine" ${meta.truckPartType === 'engine' ? 'selected' : ''}>${I18n().labelInline('truckPartEngine')}</option>
            <option value="axle" ${meta.truckPartType === 'axle' ? 'selected' : ''}>${I18n().labelInline('truckPartAxle')}</option>
            <option value="other" ${meta.truckPartType === 'other' ? 'selected' : ''}>${I18n().labelInline('truckPartOther')}</option>
            <option value="vehicle" ${meta.truckPartType === 'vehicle' ? 'selected' : ''}>${I18n().labelInline('truckPartVehicle')}</option>
          </select></label>
          <label class="${isPassengerPart || (!isTruck && meta.passengerPartType) ? '' : 'hidden'}" data-passenger-part-type-row>${t('passengerPartType') || 'Part type'} <select data-edit="passengerPartType">
            <option value="">—</option>
            <option value="front" ${meta.passengerPartType === 'front' ? 'selected' : ''}>${I18n().labelInline('passengerPartFront')}</option>
            <option value="engine" ${meta.passengerPartType === 'engine' ? 'selected' : ''}>${I18n().labelInline('passengerPartEngine')}</option>
            <option value="transmission" ${meta.passengerPartType === 'transmission' ? 'selected' : ''}>${I18n().labelInline('passengerPartTransmission')}</option>
            <option value="chassis" ${meta.passengerPartType === 'chassis' ? 'selected' : ''}>${I18n().labelInline('passengerPartChassis')}</option>
            <option value="tire" ${meta.passengerPartType === 'tire' ? 'selected' : ''}>${I18n().labelInline('passengerPartTire')}</option>
            <option value="other" ${meta.passengerPartType === 'other' ? 'selected' : ''}>${I18n().labelInline('passengerPartOther')}</option>
          </select></label>
          <label>${t('inventoryStatus')} <select data-edit="inventoryStatus">${statusOptions}</select></label>
        </div>
      </details>`;
  }

  function collectEdits(card) {
    const edits = {};
    card.querySelectorAll('[data-edit]').forEach((el) => {
      const key = el.dataset.edit;
      edits[key] = el.tagName === 'SELECT' ? el.value : el.value.trim();
    });
    if (edits.vin) edits.vin = Vin().normalizeVin(edits.vin);
    if (edits.year) edits.year = Number(edits.year);
    if (edits.priceUsd !== undefined && edits.priceUsd !== '') {
      edits.priceUsd = Number(Number(edits.priceUsd).toFixed(2));
    }
    if (edits.brand) {
      const truckCatalog = window.TruckBrandCatalog;
      if ((edits.vehicleCategory || card?.dataset?.vehicleCategory) === 'truck' && truckCatalog) {
        edits.brand = truckCatalog.resolveBrand(edits.brand);
        edits.brandSlug = truckCatalog.brandToSlug(edits.brand);
      } else {
        edits.brandSlug = Catalog()?.brandToSlug?.(edits.brand) || Vin().brandToSlug(edits.brand);
      }
    }
    return edits;
  }

  function renderSubmissionCard(submission, options = {}) {
    const { showActions = false } = options;
    const actions = showActions ? `
      <div class="admin-review-actions">
        <button type="button" class="btn btn-accent btn-sm btn-bilingual" data-approve="${escapeHtml(submission.submissionId)}">${tBtn('approve')}</button>
        <button type="button" class="btn btn-outline-navy btn-sm btn-bilingual" data-reject="${escapeHtml(submission.submissionId)}">${tBtn('reject')}</button>
      </div>` : '';

    const decodeKey = submission.decodeMethod === 'Auto Decoded'
      ? (submission.decodeConfidence === 'partial' ? 'partialDecoded' : 'autoDecoded')
      : 'manualEntry';
    const confidenceBadge = submission.decodeConfidence
      ? `<span class="admin-review-confidence admin-review-confidence--${escapeHtml(submission.decodeConfidence)}">${escapeHtml(submission.decodeConfidence)}</span>`
      : '';
    const approvedMeta = submission.approvedStockId
      ? `<p class="admin-review-meta"><strong>${tBtn('stockId')}:</strong> ${escapeHtml(submission.approvedStockId)} · <strong>${tBtn('slug')}:</strong> ${escapeHtml(submission.approvedSlug || '')}</p>`
      : '';

    return `
      <article class="admin-review-card" data-submission-id="${escapeHtml(submission.submissionId)}" data-vehicle-category="${escapeHtml(submission.vehicleCategory || '')}" data-truck-part-type="${escapeHtml(submission.truckPartType || '')}">
        <header class="admin-review-card__header">
          <div>
            <span class="admin-review-card__id">${escapeHtml(submission.submissionId)}</span>
            <span class="admin-review-card__status admin-review-card__status--${escapeHtml(submission.reviewStatus)}">${statusLabel(submission.reviewStatus)}</span>
            <span class="admin-review-decode-badge">${tBtn(decodeKey)}</span>
            ${confidenceBadge}
          </div>
          <time datetime="${escapeHtml(submission.createdAt)}">${formatDate(submission.createdAt)}</time>
        </header>
        <p class="admin-review-vin"><strong>${t('fullVin')}:</strong> <code>${escapeHtml(submission.vin || '—')}</code></p>
        ${showActions ? renderEditForm(submission) : ''}
        <div class="admin-review-grid">
          <section>
            <h3>${t('supplier')}</h3>
            <dl class="admin-review-specs">
              <div><dt>${t('name')}</dt><dd>${escapeHtml(submission.supplierName)}</dd></div>
              <div><dt>${t('phone')}</dt><dd>${escapeHtml(submission.supplierPhone || '—')}</dd></div>
              <div><dt>${t('wechat')}</dt><dd>${escapeHtml(submission.supplierWechat || '—')}</dd></div>
              <div><dt>${t('city')}</dt><dd>${escapeHtml(submission.supplierCity || '—')}</dd></div>
            </dl>
          </section>
          <section>
            <h3>${t('submittedVehicle')}</h3>
            <dl class="admin-review-specs">
              <div><dt>${t('brand')}</dt><dd>${escapeHtml(submission.brand)} (${escapeHtml(submission.brandSlug)})</dd></div>
              <div><dt>${t('model')}</dt><dd>${escapeHtml(submission.model)}</dd></div>
              <div><dt>${t('year')}</dt><dd>${escapeHtml(submission.year)}</dd></div>
              <div><dt>${t('mileage')}</dt><dd>${escapeHtml(submission.mileage)}</dd></div>
              <div><dt>${t('fobPriceUsd')}</dt><dd>${submission.priceUsd ? `$${Number(submission.priceUsd).toLocaleString('en-US')} EXW` : '—'}</dd></div>
              <div><dt>${t('engineCode')}</dt><dd>${escapeHtml(submission.engineCode || '—')}</dd></div>
              <div><dt>${t('transmission')}</dt><dd>${escapeHtml(submission.transmissionCode || '—')}</dd></div>
              <div><dt>${t('vehicleCondition')}</dt><dd>${escapeHtml(conditionOptionLabel(submission.vehicleCondition) || submission.vehicleCondition || '—')}</dd></div>
              ${(() => {
                const meta = window.HalfCutUploadLayer?.resolveListingMeta?.(submission) || submission;
                const partRow = meta.vehicleCategory === 'truck'
                  ? `<div><dt>${t('truckPartType')}</dt><dd>${truckPartTypeLabel(meta.truckPartType)}</dd></div>`
                  : (meta.passengerPartType
                    ? `<div><dt>${t('passengerPartType') || 'Part type'}</dt><dd>${passengerPartTypeLabel(meta.passengerPartType)}</dd></div>`
                    : '');
                const vinNote = window.HalfCutReviewLayer?.isLoosePartListing?.(submission, meta)
                  ? `<div><dt>VIN</dt><dd>选填 · optional</dd></div>`
                  : '';
                return `<div><dt>${t('vehicleCategory')}</dt><dd>${meta.vehicleCategory === 'truck' ? I18n().labelInline('categoryTruck') : I18n().labelInline('categoryPassenger')}</dd></div>
              ${partRow}${vinNote}`;
              })()}
              <div><dt>${t('inventoryStatus')}</dt><dd>${escapeHtml(inventoryStatusLabel(submission.inventoryStatus) || submission.inventoryStatus)}</dd></div>
            </dl>
          </section>
        </div>
        ${renderDecodedBlock(submission)}
        ${submission.notes ? `<p><strong>${tBtn('notesLabel')}:</strong> ${escapeHtml(submission.notes)}</p>` : ''}
        <h3>${t('photos')} (${submission.photos?.length || 0})</h3>
        ${renderPhotos(submission.photos)}
        <h3>${t('videoLabel')}</h3>
        ${renderVideoBlock(submission)}
        ${approvedMeta}
        ${actions}
      </article>`;
  }

  function renderPanel(status, submissions) {
    if (!submissions.length) {
      return `<p class="admin-review-empty">${tBtn('noSubmissions')}</p>`;
    }
    return submissions.map((item) => renderSubmissionCard(item, {
      showActions: status === 'pending',
    })).join('');
  }

  window.AdminReviewCards = {
    collectEdits,
    renderPanel,
    renderSubmissionCard,
    tBtn,
  };
})();
