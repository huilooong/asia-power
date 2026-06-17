/**
 * AsiaPower — Admin Half-Cut Review (VIN-aware)
 */
(function () {
  'use strict';

  const store = () => window.HalfCutInventoryStore;
  const Vin = () => window.HalfCutVin;
  const I18n = () => window.HalfCutSupplierI18n;
  const t = (key) => I18n()?.labelHtml(key) || key;
  const tBtn = (key) => I18n()?.labelInline(key) || key;

  function statusLabel(status) {
    const map = { pending: 'adminPending', approved: 'adminApproved', rejected: 'adminRejected' };
    return tBtn(map[status] || status);
  }

  function conditionOptionLabel(value) {
    const map = {
      'Running Vehicle': 'conditionRunning',
      'Half Cut': 'conditionHalfCut',
      'Dismantled': 'conditionDismantled',
      'Engine Removed': 'conditionEngineRemoved',
    };
    return I18n()?.labelInline(map[value]) || value;
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

  function renderPhotos(photos) {
    if (!Array.isArray(photos) || !photos.length) {
      return `<p class="admin-review-empty">${tBtn('noPhotos')}</p>`;
    }
    return `
      <div class="admin-review-photos">
        ${photos.map((photo, index) => {
          const url = typeof photo === 'string' ? photo : (photo.dataUrl || photo.url || '');
          const label = typeof photo === 'object' && photo.label ? photo.label : `Photo ${index + 1}`;
          return `
            <figure class="admin-review-photo">
              <img src="${url}" alt="${escapeHtml(label)}" loading="lazy">
              <figcaption>${escapeHtml(label)}</figcaption>
            </figure>`;
        }).join('')}
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

  function renderEditForm(submission) {
    const v = Vin();
    const brandOptions = (store().SUPPORTED_BRANDS || []).map(brand =>
      `<option value="${escapeHtml(brand)}" ${submission.brand === brand ? 'selected' : ''}>${escapeHtml(brand)}</option>`
    ).join('');
    const statusOptions = v.ADMIN_STATUSES.map(st =>
      `<option value="${escapeHtml(st)}" ${submission.inventoryStatus === st ? 'selected' : ''}>${escapeHtml(inventoryStatusLabel(st))}</option>`
    ).join('');
    const conditionOptions = v.VEHICLE_CONDITIONS.map(c =>
      `<option value="${escapeHtml(c)}" ${submission.vehicleCondition === c ? 'selected' : ''}>${escapeHtml(conditionOptionLabel(c))}</option>`
    ).join('');

    return `
      <details class="admin-review-edit" open>
        <summary>${tBtn('editBeforeApprove')}</summary>
        <div class="admin-review-edit-grid">
          <label>${t('vin')} <input type="text" data-edit="vin" value="${escapeHtml(submission.vin || '')}" maxlength="17"></label>
          <label>${t('brand')} <select data-edit="brand">${brandOptions}</select></label>
          <label>${t('model')} <input type="text" data-edit="model" value="${escapeHtml(submission.model || '')}"></label>
          <label>${t('year')} <input type="number" data-edit="year" value="${escapeHtml(submission.year || '')}"></label>
          <label>${t('engineCode')} <input type="text" data-edit="engineCode" value="${escapeHtml(submission.engineCode || '')}"></label>
          <label>${t('transmission')} <input type="text" data-edit="transmissionCode" value="${escapeHtml(submission.transmissionCode || '')}"></label>
          <label>${t('mileage')} <input type="text" data-edit="mileage" value="${escapeHtml(submission.mileage || '')}"></label>
          <label>${t('vehicleCondition')} <select data-edit="vehicleCondition">${conditionOptions}</select></label>
          <label>${t('inventoryStatus')} <select data-edit="inventoryStatus">${statusOptions}</select></label>
        </div>
      </details>`;
  }

  function collectEdits(card) {
    const edits = {};
    card.querySelectorAll('[data-edit]').forEach(el => {
      const key = el.dataset.edit;
      edits[key] = el.tagName === 'SELECT' ? el.value : el.value.trim();
    });
    if (edits.vin) edits.vin = Vin().normalizeVin(edits.vin);
    if (edits.year) edits.year = Number(edits.year);
    if (edits.brand) edits.brandSlug = Vin().brandToSlug(edits.brand);
    return edits;
  }

  function renderSubmissionCard(submission, options) {
    const { showActions } = options;

    const actions = showActions ? `
      <div class="admin-review-actions">
        <button type="button" class="btn btn-accent btn-sm btn-bilingual" data-approve="${escapeHtml(submission.submissionId)}">${tBtn('approve')}</button>
        <button type="button" class="btn btn-outline-navy btn-sm btn-bilingual" data-reject="${escapeHtml(submission.submissionId)}">${tBtn('reject')}</button>
      </div>` : '';

    const decodeKey = submission.decodeMethod === 'Auto Decoded' ? 'autoDecoded' : 'manualEntry';
    const approvedMeta = submission.approvedStockId
      ? `<p class="admin-review-meta"><strong>${tBtn('stockId')}:</strong> ${escapeHtml(submission.approvedStockId)} · <strong>${tBtn('slug')}:</strong> ${escapeHtml(submission.approvedSlug || '')}</p>`
      : '';

    return `
      <article class="admin-review-card" data-submission-id="${escapeHtml(submission.submissionId)}">
        <header class="admin-review-card__header">
          <div>
            <span class="admin-review-card__id">${escapeHtml(submission.submissionId)}</span>
            <span class="admin-review-card__status admin-review-card__status--${escapeHtml(submission.reviewStatus)}">${statusLabel(submission.reviewStatus)}</span>
            <span class="admin-review-decode-badge">${tBtn(decodeKey)}</span>
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
              <div><dt>${t('engineCode')}</dt><dd>${escapeHtml(submission.engineCode || '—')}</dd></div>
              <div><dt>${t('transmission')}</dt><dd>${escapeHtml(submission.transmissionCode || '—')}</dd></div>
              <div><dt>${t('vehicleCondition')}</dt><dd>${escapeHtml(conditionOptionLabel(submission.vehicleCondition) || submission.vehicleCondition || '—')}</dd></div>
              <div><dt>${t('inventoryStatus')}</dt><dd>${escapeHtml(inventoryStatusLabel(submission.inventoryStatus) || submission.inventoryStatus)}</dd></div>
            </dl>
          </section>
        </div>
        ${renderDecodedBlock(submission)}
        ${submission.notes ? `<p><strong>${tBtn('notesLabel')}:</strong> ${escapeHtml(submission.notes)}</p>` : ''}
        ${submission.videoUrl ? `<p><strong>${tBtn('videoLabel')}:</strong> <a href="${escapeHtml(submission.videoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(submission.videoUrl)}</a></p>` : ''}
        ${approvedMeta}
        <h3>${t('photos')} (${submission.photos?.length || 0})</h3>
        ${renderPhotos(submission.photos)}
        ${actions}
      </article>`;
  }

  function renderPanel(status, submissions) {
    if (!submissions.length) return `<p class="admin-review-empty">${tBtn('noSubmissions')}</p>`;
    return submissions.map(item => renderSubmissionCard(item, {
      showActions: status === 'pending',
    })).join('');
  }

  function initAdminHalfCutReview() {
    const root = document.getElementById('admin-half-cut-review-root');
    const s = store();
    if (!root || !s || !I18n()) return;

    function render() {
      const pending = s.getSubmissionsByStatus('pending');
      const approved = s.getSubmissionsByStatus('approved');
      const rejected = s.getSubmissionsByStatus('rejected');

      root.innerHTML = `
        <div class="admin-review-toolbar supplier-bilingual">
          <div class="admin-review-counts">
            <span><strong>${pending.length}</strong> ${tBtn('adminPending')}</span>
            <span><strong>${approved.length}</strong> ${tBtn('adminApproved')}</span>
            <span><strong>${rejected.length}</strong> ${tBtn('adminRejected')}</span>
          </div>
        </div>
        <div class="admin-review-tabs supplier-bilingual" role="tablist">
          <button type="button" class="admin-review-tab active" data-tab="pending">${tBtn('adminPending')}</button>
          <button type="button" class="admin-review-tab" data-tab="approved">${tBtn('adminApproved')}</button>
          <button type="button" class="admin-review-tab" data-tab="rejected">${tBtn('adminRejected')}</button>
        </div>
        <div class="admin-review-panels">
          <div class="admin-review-panel" data-panel="pending">${renderPanel('pending', pending)}</div>
          <div class="admin-review-panel hidden" data-panel="approved">${renderPanel('approved', approved)}</div>
          <div class="admin-review-panel hidden" data-panel="rejected">${renderPanel('rejected', rejected)}</div>
        </div>
        <div id="admin-review-feedback" class="supplier-upload-feedback" role="status" aria-live="polite"></div>`;

      const tabs = root.querySelectorAll('.admin-review-tab');
      const panels = root.querySelectorAll('.admin-review-panel');
      const feedback = document.getElementById('admin-review-feedback');

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const name = tab.dataset.tab;
          tabs.forEach(t => t.classList.toggle('active', t === tab));
          panels.forEach(p => p.classList.toggle('hidden', p.dataset.panel !== name));
        });
      });

      root.addEventListener('click', (event) => {
        const approveBtn = event.target.closest('[data-approve]');
        const rejectBtn = event.target.closest('[data-reject]');
        if (approveBtn) {
          const id = approveBtn.dataset.approve;
          const card = approveBtn.closest('.admin-review-card');
          const edits = card ? collectEdits(card) : null;
          try {
            const item = s.approveSubmission(id, edits);
            if (item) {
              feedback.innerHTML = `${tBtn('approvalSuccess')} ${escapeHtml(id)} → ${tBtn('stockId')} ${escapeHtml(item.stockId)}. VIN: ${escapeHtml(Vin().maskVin(item.vin))}`;
              feedback.className = 'supplier-upload-feedback supplier-upload-feedback--success';
              render();
            }
          } catch (err) {
            feedback.innerHTML = `${tBtn('approvalFailed')} ${escapeHtml(err.message || '')}`;
            feedback.className = 'supplier-upload-feedback supplier-upload-feedback--error';
          }
          return;
        }
        if (rejectBtn) {
          const id = rejectBtn.dataset.reject;
          if (s.rejectSubmission(id)) {
            feedback.textContent = `${tBtn('rejectSuccess')} (${id})`;
            feedback.className = 'supplier-upload-feedback supplier-upload-feedback--error';
            render();
          }
        }
      });
    }

    render();
  }

  document.addEventListener('DOMContentLoaded', initAdminHalfCutReview);
})();
