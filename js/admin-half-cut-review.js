/**
 * AsiaPower — Admin Half-Cut Review (VIN-aware)
 */
(function () {
  'use strict';

  const store = () => window.HalfCutInventoryStore;
  const Vin = () => window.HalfCutVin;
  const Catalog = () => window.VehicleCatalog;
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
      'Truck Half Cut': 'conditionTruckHalfCut',
      'Driver Cab': 'conditionDriverCab',
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
    const item = {
      video: submission.video,
      videoUrl: submission.videoUrl,
    };
    if (!u?.hasVideo?.(item)) {
      return `<p class="admin-review-empty">${tBtn('noVideo')}</p>`;
    }
    const fileName = submission.video?.fileName || 'vehicle-video';
    const player = u.renderVideoPlayer(item, {
      className: 'admin-review-video',
      title: fileName,
    });
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

  function renderEditForm(submission) {
    const v = Vin();
    const brandOptions = (() => {
      const catalog = Catalog();
      const names = catalog?.getBrandNames?.() || store().getSupportedBrands?.() || store().SUPPORTED_BRANDS || [];
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
    })();
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
          <label>${t('fobPriceUsd')} <input type="number" data-edit="priceUsd" min="0" step="0.01" value="${escapeHtml(submission.priceUsd ?? '')}"></label>
          <label>${t('vehicleCondition')} <select data-edit="vehicleCondition">${conditionOptions}</select></label>
          <label>${t('vehicleCategory')} <select data-edit="vehicleCategory">
            <option value="passenger" ${submission.vehicleCategory !== 'truck' ? 'selected' : ''}>${I18n().labelInline('categoryPassenger')}</option>
            <option value="truck" ${submission.vehicleCategory === 'truck' ? 'selected' : ''}>${I18n().labelInline('categoryTruck')}</option>
          </select></label>
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
    if (edits.priceUsd !== undefined && edits.priceUsd !== '') {
      edits.priceUsd = Number(Number(edits.priceUsd).toFixed(2));
    }
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
      <article class="admin-review-card" data-submission-id="${escapeHtml(submission.submissionId)}">
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
              <div><dt>${t('vehicleCategory')}</dt><dd>${submission.vehicleCategory === 'truck' ? I18n().labelInline('categoryTruck') : I18n().labelInline('categoryPassenger')}</dd></div>
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
    if (!submissions.length) return `<p class="admin-review-empty">${tBtn('noSubmissions')}</p>`;
    return submissions.map(item => renderSubmissionCard(item, {
      showActions: status === 'pending',
    })).join('');
  }

  function initAdminHalfCutReview() {
    const root = document.getElementById('admin-half-cut-review-root');
    const s = store();
    if (!root || !s || !I18n()) return;

    async function ensureAdminSession() {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        const data = await res.json();
        return data.user?.role === 'admin' ? data.user : null;
      } catch {
        return null;
      }
    }

    function renderLogin() {
      root.innerHTML = `
        <div class="admin-review-login supplier-bilingual">
          <h2>Admin sign in</h2>
          <p class="admin-review-login__hint">Half-cut review requires administrator authentication.</p>
          <form id="admin-login-form" class="admin-review-login__form">
            <label>
              <span>Username</span>
              <input type="text" name="username" autocomplete="username" required>
            </label>
            <label>
              <span>Password</span>
              <input type="password" name="password" autocomplete="current-password" required>
            </label>
            <button type="submit" class="btn btn--primary">Sign in</button>
          </form>
          <div id="admin-login-feedback" class="supplier-upload-feedback" role="status"></div>
        </div>`;

      const form = document.getElementById('admin-login-form');
      const feedback = document.getElementById('admin-login-feedback');
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        feedback.className = 'supplier-upload-feedback';
        const body = Object.fromEntries(new FormData(form));
        try {
          const res = await fetch('/api/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Login failed');
          if (data.role !== 'admin') throw new Error('Admin access required');
          bootReview();
        } catch (err) {
          feedback.textContent = err.message || 'Login failed';
          feedback.className = 'supplier-upload-feedback supplier-upload-feedback--error';
        }
      });
    }

    function bootReview() {
    s.whenReady().then(() => {
    function render() {
      const pending = s.getSubmissionsByStatus('pending');
      const approved = s.getSubmissionsByStatus('approved');
      const rejected = s.getSubmissionsByStatus('rejected');

      root.innerHTML = `
        <div id="admin-review-feedback" class="admin-page-feedback" role="status" aria-live="polite" hidden></div>
        <div class="admin-review-toolbar supplier-bilingual">
          <div class="admin-review-counts">
            <span><strong>${pending.length}</strong> ${tBtn('adminPending')}</span>
            <span><strong>${approved.length}</strong> ${tBtn('adminApproved')}</span>
            <span><strong>${rejected.length}</strong> ${tBtn('adminRejected')}</span>
          </div>
          <div class="admin-leads-toolbar__links">
            <a href="inventory.html" class="btn btn-outline-navy btn-sm">Inventory Editor</a>
            <a href="leads.html" class="btn btn-outline-navy btn-sm">Lead Inbox</a>
            <a href="analytics.html" class="btn btn-outline-navy btn-sm">Analytics</a>
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
        </div>`;

      const tabs = root.querySelectorAll('.admin-review-tab');
      const panels = root.querySelectorAll('.admin-review-panel');
      const feedback = document.getElementById('admin-review-feedback');
      if (feedback) feedback.className = 'admin-page-feedback';

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
          approveBtn.disabled = true;
          const approvalPromise = s.approveSubmission(id, edits);
          render();
          approvalPromise.then((item) => {
            if (item) {
              feedback.hidden = false;
              feedback.innerHTML = `${tBtn('approvalSuccess')} ${escapeHtml(id)} → ${tBtn('stockId')} ${escapeHtml(item.stockId)}. VIN: ${escapeHtml(Vin().maskVin(item.vin))}`;
              feedback.className = 'admin-page-feedback admin-page-feedback--success';
              feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              render();
            }
          }).catch((err) => {
            feedback.hidden = false;
            feedback.innerHTML = `${tBtn('approvalFailed')} ${escapeHtml(err.message || '')}`;
            feedback.className = 'admin-page-feedback admin-page-feedback--error';
            feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            render();
          });
          return;
        }
        if (rejectBtn) {
          const id = rejectBtn.dataset.reject;
          s.rejectSubmission(id).then((ok) => {
            if (ok) {
              feedback.hidden = false;
              feedback.textContent = `${tBtn('rejectSuccess')} (${id})`;
              feedback.className = 'admin-page-feedback admin-page-feedback--error';
              feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              render();
            }
          });
        }
      });
    }

    render();
    }).catch((err) => {
      root.innerHTML = `<p class="admin-review-empty">${escapeHtml(err.message || 'Failed to load review data')}</p>`;
    });
    }

    ensureAdminSession().then((user) => {
      if (user) bootReview();
      else renderLogin();
    });
  }

  document.addEventListener('DOMContentLoaded', initAdminHalfCutReview);
})();
