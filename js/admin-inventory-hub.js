/**
 * AsiaPower — Shared admin inventory review hub (pending / live / rejected)
 */
(function () {
  'use strict';

  const Admin = () => window.AdminCommon;
  const store = () => window.HalfCutInventoryStore;
  const Vin = () => window.HalfCutVin;
  const ReviewCards = () => window.AdminReviewCards;

  function formatDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  function escapeHtml(str) {
    return Admin()?.escapeHtml?.(str) ?? String(str || '');
  }

  function statusOptions(current) {
    const statuses = Vin()?.ADMIN_STATUSES || ['Available', 'Reserved', 'In Transit', 'Sold'];
    return statuses.map((status) =>
      `<option value="${escapeHtml(status)}" ${current === status ? 'selected' : ''}>${escapeHtml(status)}</option>`
    ).join('');
  }

  function brandOptions(current) {
    const catalog = window.VehicleCatalog;
    const names = catalog?.getBrandNames?.() || store()?.getSupportedBrands?.() || store()?.SUPPORTED_BRANDS || [];
    const resolved = resolveBrandForSelect(current, names);
    const options = names.slice();
    if (resolved && !options.includes(resolved)) options.unshift(resolved);
    if (current && current !== resolved && !options.includes(current)) options.unshift(current);

    const label = (name) => catalog?.getBrandLabel?.(name) || name;
    const groups = catalog?.getBrandOptionGroups?.();
    if (!groups) {
      return options
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .map((brand) =>
          `<option value="${escapeHtml(brand)}" ${brand === resolved ? 'selected' : ''}>${escapeHtml(label(brand))}</option>`
        ).join('');
    }

    const renderGroup = (title, list) => {
      const items = list.filter((name) => options.includes(name));
      if (!items.length) return '';
      return `<optgroup label="${escapeHtml(title)}">${items.map((brand) =>
        `<option value="${escapeHtml(brand)}" ${brand === resolved ? 'selected' : ''}>${escapeHtml(label(brand))}</option>`
      ).join('')}</optgroup>`;
    };

    const extra = options.filter((name) => !groups.chinese.includes(name) && !groups.other.includes(name));
    return [
      renderGroup('Chinese brands · 中国品牌', groups.chinese),
      renderGroup('Other brands · 其他品牌', groups.other),
      extra.length ? `<optgroup label="Other · 其他">${extra.map((brand) =>
        `<option value="${escapeHtml(brand)}" ${brand === resolved ? 'selected' : ''}>${escapeHtml(label(brand))}</option>`
      ).join('')}</optgroup>` : '',
    ].join('');
  }

  function resolveBrandForSelect(brand, names) {
    const list = names || window.VehicleCatalog?.getBrandNames?.() || [];
    const raw = String(brand || '').trim();
    if (!raw) return '';
    const exact = list.find((name) => name.toLowerCase() === raw.toLowerCase());
    if (exact) return exact;
    const norm = window.VehicleNameNormalize?.normalizeVehicleNames?.(raw, '');
    if (norm?.brand && list.includes(norm.brand)) return norm.brand;
    const slug = window.VehicleCatalog?.brandToSlug?.(raw);
    if (slug) {
      const fromSlug = window.VehicleCatalog?.slugToBrand?.(slug);
      if (fromSlug && list.includes(fromSlug)) return fromSlug;
    }
    return raw;
  }

  function renderInventoryCard(item) {
    const publicUrl = item.slug ? `../half-cuts/detail.html?slug=${encodeURIComponent(item.slug)}` : '';
    const correctionNote = item.nameCorrections?.brand
      ? `<p class="admin-review-meta admin-review-meta--warn"><strong>Previous brand:</strong> ${escapeHtml(item.nameCorrections.brand)} → now <strong>${escapeHtml(item.brand)}</strong></p>`
      : '';
    return `
      <article class="admin-review-card" data-stock-id="${escapeHtml(item.stockId)}">
        <header class="admin-review-card__header">
          <div>
            <span class="admin-review-card__id">${escapeHtml(item.stockId)}</span>
            <span class="admin-review-card__status admin-review-card__status--approved">${escapeHtml(item.status || 'Available')}</span>
          </div>
          <time datetime="${escapeHtml(item.approvedAt || item.updatedAt || '')}">${formatDate(item.approvedAt || item.updatedAt)}</time>
        </header>
        <p class="admin-review-meta">
          <strong>Title:</strong> ${escapeHtml(item.title || '—')}
          ${publicUrl ? ` · <a href="${publicUrl}" target="_blank" rel="noopener">View listing →</a>` : ''}
        </p>
        <p class="admin-review-meta"><strong>Slug:</strong> <code>${escapeHtml(item.slug || '—')}</code></p>
        ${correctionNote}
        ${Array.isArray(item.slugAliases) && item.slugAliases.length
          ? `<p class="admin-review-meta"><strong>Slug aliases:</strong> ${item.slugAliases.map((s) => `<code>${escapeHtml(s)}</code>`).join(', ')}</p>`
          : ''}
        <details class="admin-review-edit" open>
          <summary>Edit fields / 编辑字段</summary>
          <div class="admin-review-edit-grid">
            <label>Brand / 品牌
              <select data-field="brand">${brandOptions(item.brand)}</select>
            </label>
            <label>Model / 车型
              <input type="text" data-field="model" value="${escapeHtml(item.model || '')}">
            </label>
            <label>Year / 年份
              <input type="number" data-field="year" value="${escapeHtml(item.year || '')}">
            </label>
            <label>Engine code / 发动机代号
              <input type="text" data-field="engineCode" value="${escapeHtml(item.engineCode || '')}" placeholder="EA211">
            </label>
            <label>Transmission / 变速箱
              <input type="text" data-field="transmissionCode" value="${escapeHtml(item.transmissionCode || '')}" placeholder="7AT">
            </label>
            <label>Drivetrain / 驱动
              <input type="text" data-field="drivetrain" value="${escapeHtml(item.drivetrain || '')}" placeholder="2WD">
            </label>
            <label>Mileage / 里程
              <input type="text" data-field="mileage" value="${escapeHtml(item.mileage || '')}">
            </label>
            <label>EXW USD
              <input type="number" data-field="priceUsd" min="0" step="0.01" value="${escapeHtml(item.priceUsd ?? '')}">
            </label>
            <label>Status / 状态
              <select data-field="status">${statusOptions(item.status || 'Available')}</select>
            </label>
            <label class="admin-review-edit-grid__wide">Short description
              <textarea data-field="shortDescription" rows="2">${escapeHtml(item.shortDescription || '')}</textarea>
            </label>
          </div>
          <div class="admin-review-actions">
            <button type="button" class="btn btn-accent btn-sm" data-save="${escapeHtml(item.stockId)}">Save changes / 保存</button>
          </div>
        </details>
      </article>`;
  }

  function collectFields(card) {
    const edits = {};
    card.querySelectorAll('[data-field]').forEach((el) => {
      const key = el.dataset.field;
      if (el.tagName === 'SELECT') edits[key] = el.value;
      else edits[key] = el.value.trim();
    });
    if (edits.year) edits.year = Number(edits.year);
    if (edits.priceUsd !== '') edits.priceUsd = Number(Number(edits.priceUsd).toFixed(2));
    else delete edits.priceUsd;
    if (edits.brand) {
      edits.brandSlug = window.VehicleCatalog?.brandToSlug?.(edits.brand)
        || Vin().brandToSlug(edits.brand);
    }
    return edits;
  }

  function filterInventory(items, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = [
        item.stockId, item.brand, item.model, item.engineCode,
        item.transmissionCode, item.slug, item.title,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  /**
   * @param {HTMLElement} root
   * @param {object} options
   * @param {string} options.activeTab - pending | approved | rejected
   * @param {HTMLElement} [options.feedbackRoot] - where to show approve/save toasts (defaults to root)
   * @param {boolean} options.embedded - skip outer toolbar/tabs (parent renders tabs)
   * @param {string} options.toolbarTitle
   * @param {string} options.navLinksHtml
   * @param {(tab:string)=>void} options.onTabChange
   * @param {()=>void} [options.onRefresh]
   */
  async function mount(root, options = {}) {
    const s = store();
    const admin = Admin();
    const cards = ReviewCards();
    if (!root || !s || !admin || !cards) {
      throw new Error('Inventory scripts failed to load');
    }

    const feedbackId = options.feedbackId || 'admin-inventory-feedback';
    const feedbackRoot = options.feedbackRoot || root;
    const embedded = options.embedded === true;
    let activeTab = options.activeTab || 'pending';
    let query = '';
    let sessionUser = await admin.ensureAdminSession();

    await s.whenReady();

    function refreshLists() {
      return {
        pending: s.getSubmissionsByStatus('pending'),
        approvedSubs: s.getSubmissionsByStatus('approved'),
        rejected: s.getSubmissionsByStatus('rejected'),
        inventory: s.getApprovedInventory().slice().sort((a, b) => {
          const ta = Date.parse(a.approvedAt || a.updatedAt || 0) || 0;
          const tb = Date.parse(b.approvedAt || b.updatedAt || 0) || 0;
          return tb - ta;
        }),
      };
    }

    let lists = refreshLists();

    async function handleSave(saveBtn) {
      const stockId = saveBtn.dataset.save;
      const card = saveBtn.closest('.admin-review-card');
      const edits = card ? collectFields(card) : null;
      const title = card?.querySelector('.admin-review-meta')?.textContent?.replace(/\s+/g, ' ').trim() || stockId;
      const ok = window.confirm(
        `Save inventory changes for ${stockId}?\n\n${title}\n\nThis may change the public listing.`
      );
      if (!ok) return;
      const bar = admin.ensureFeedbackBar(feedbackRoot, feedbackId);
      saveBtn.disabled = true;
      admin.showFeedback(bar, 'Saving…', 'info');
      try {
        const updated = await s.updateApprovedInventory(stockId, edits);
        if (!updated) throw new Error('Inventory item not found');
        lists = refreshLists();
        render();
        admin.showFeedback(
          admin.ensureFeedbackBar(feedbackRoot, feedbackId),
          `Saved ${stockId} — engine: ${updated.engineCode} · slug: ${updated.slug}`,
          'success'
        );
      } catch (err) {
        if (admin.isAuthError(err)) {
          sessionUser = null;
          admin.handleAuthFailure(root, bar, options.onAuthRequired);
        } else {
          admin.showFeedback(bar, err.message || 'Save failed', 'error');
        }
      } finally {
        saveBtn.disabled = false;
      }
    }

    function handleApprove(approveBtn) {
      const id = approveBtn.dataset.approve;
      const card = approveBtn.closest('.admin-review-card');
      const edits = card ? cards.collectEdits(card) : null;
      const ok = window.confirm(
        `Approve supplier submission ${id}?\n\nThis will publish it into live inventory after validation.`
      );
      if (!ok) return;
      const bar = admin.ensureFeedbackBar(feedbackRoot, feedbackId);
      approveBtn.disabled = true;
      admin.showFeedback(bar, 'Approving…', 'info');
      Promise.resolve(s.whenReady())
        .then(() => s.approveSubmission(id, edits))
        .then((item) => {
          if (item) {
            lists = refreshLists();
            if (activeTab === 'pending' && !lists.pending.length) {
              activeTab = 'approved';
              options.onTabChange?.('approved');
            }
            render();
            admin.showFeedback(
              admin.ensureFeedbackBar(feedbackRoot, feedbackId),
              `${cards.tBtn('approvalSuccess')} ${id} → ${cards.tBtn('stockId')} ${item.stockId}. VIN: ${Vin().maskVin(item.vin)}`,
              'success'
            );
            options.onCountsChange?.(lists);
            return;
          }
          admin.showFeedback(bar, `${cards.tBtn('approvalFailed')} Submission not found — refresh the page and try again.`, 'error');
        }).catch((err) => {
          if (admin.isAuthError(err)) {
            sessionUser = null;
            admin.handleAuthFailure(root, bar, options.onAuthRequired);
          } else {
            admin.showFeedback(bar, `${cards.tBtn('approvalFailed')} ${err.message || ''}`, 'error');
          }
        }).finally(() => {
          approveBtn.disabled = false;
        });
    }

    function handleReject(rejectBtn) {
      const id = rejectBtn.dataset.reject;
      const ok = window.confirm(
        `Reject supplier submission ${id}?\n\nIt will move out of the pending review queue.`
      );
      if (!ok) return;
      const bar = admin.ensureFeedbackBar(feedbackRoot, feedbackId);
      rejectBtn.disabled = true;
      admin.showFeedback(bar, 'Rejecting…', 'info');
      Promise.resolve(s.whenReady())
        .then(() => s.rejectSubmission(id))
        .then((didReject) => {
          if (didReject) {
            lists = refreshLists();
            render();
            admin.showFeedback(bar, `${cards.tBtn('rejectSuccess')} (${id})`, 'error');
            options.onCountsChange?.(lists);
            return;
          }
          admin.showFeedback(bar, 'Reject failed — submission not found. Refresh the page and try again.', 'error');
        }).catch((err) => {
          if (admin.isAuthError(err)) {
            sessionUser = null;
            admin.handleAuthFailure(root, bar, options.onAuthRequired);
          } else {
            admin.showFeedback(bar, err.message || 'Reject failed', 'error');
          }
        }).finally(() => {
          rejectBtn.disabled = false;
        });
    }

    function renderTabPanel() {
      if (activeTab === 'pending') {
        return `<div class="admin-inventory-list">${cards.renderPanel('pending', lists.pending)}</div>`;
      }
      if (activeTab === 'rejected') {
        return `<div class="admin-inventory-list">${cards.renderPanel('rejected', lists.rejected)}</div>`;
      }
      const filtered = filterInventory(lists.inventory, query);
      return `
        <label class="admin-leads-search">
          <input type="search" id="admin-inventory-search" placeholder="Search stock ID, brand, model, engine code…" value="${escapeHtml(query)}">
        </label>
        <div class="admin-inventory-list">
          ${!lists.inventory.length
            ? '<p class="admin-review-empty">No approved inventory yet. Approve pending submissions in the <strong>Pending Review</strong> tab first.</p>'
            : filtered.length
              ? filtered.map(renderInventoryCard).join('')
              : '<p class="admin-review-empty">No inventory matches your search.</p>'}
        </div>`;
    }

    function renderTabsHtml() {
      return `
        <div class="admin-review-tabs" role="tablist">
          <button type="button" class="admin-review-tab ${activeTab === 'pending' ? 'active' : ''}" data-tab="pending">
            待审 ${lists.pending.length ? `<span class="admin-review-tab__count">${lists.pending.length}</span>` : ''}
          </button>
          <button type="button" class="admin-review-tab ${activeTab === 'approved' ? 'active' : ''}" data-tab="approved">
            已上架 (${lists.inventory.length})
          </button>
          <button type="button" class="admin-review-tab ${activeTab === 'rejected' ? 'active' : ''}" data-tab="rejected">
            已拒绝 (${lists.rejected.length})
          </button>
        </div>`;
    }

    function render() {
      lists = refreshLists();
      const ownsFeedbackBar = feedbackRoot === root;
      const existingBar = ownsFeedbackBar ? root.querySelector(`#${feedbackId}`) : null;
      if (existingBar) existingBar.remove();

      if (embedded) {
        root.innerHTML = `<div class="admin-review-panel">${renderTabPanel()}</div>`;
      } else {
        const who = sessionUser?.email || sessionUser?.username || '';
        root.innerHTML = `
          <div class="admin-leads-toolbar" data-admin-ia="inventory-only-v1">
            <div>
              <h2>${options.toolbarTitle || '库存审核'}</h2>
              <p class="admin-review-counts">
                待审 <strong>${lists.pending.length}</strong> ·
                已上架 <strong>${lists.inventory.length}</strong> ·
                已拒绝 <strong>${lists.rejected.length}</strong>
              </p>
              ${who ? `<p class="admin-review-meta">已登录 <strong>${escapeHtml(who)}</strong></p>` : ''}
            </div>
            <div class="admin-leads-toolbar__links">
              ${options.navLinksHtml || ''}
              <button type="button" class="btn btn-outline-navy btn-sm" id="admin-inventory-refresh">刷新</button>
            </div>
          </div>
          ${renderTabsHtml()}
          <div class="admin-review-panel">${renderTabPanel()}</div>`;
      }

      if (ownsFeedbackBar) {
        if (existingBar) root.prepend(existingBar);
        else admin.ensureFeedbackBar(feedbackRoot, feedbackId);
      } else {
        admin.ensureFeedbackBar(feedbackRoot, feedbackId);
      }

      if (!embedded) {
        root.querySelectorAll('[data-tab]').forEach((tabBtn) => {
          tabBtn.addEventListener('click', () => {
            activeTab = tabBtn.dataset.tab;
            options.onTabChange?.(activeTab);
            render();
          });
        });

        document.getElementById('admin-inventory-refresh')?.addEventListener('click', async () => {
          s.resetReady?.();
          await s.whenReady();
          lists = refreshLists();
          render();
          options.onRefresh?.();
        });
      }

      document.getElementById('admin-inventory-search')?.addEventListener('input', (event) => {
        query = event.target.value;
        render();
      });
    }

    if (!root.dataset.inventoryHubBound) {
      root.dataset.inventoryHubBound = '1';
      root.addEventListener('click', (event) => {
        const saveBtn = event.target.closest('[data-save]');
        if (saveBtn) { handleSave(saveBtn); return; }
        const approveBtn = event.target.closest('[data-approve]');
        if (approveBtn) { handleApprove(approveBtn); return; }
        const rejectBtn = event.target.closest('[data-reject]');
        if (rejectBtn) handleReject(rejectBtn);
      });
    }

    const api = {
      render,
      setActiveTab(tab) {
        activeTab = tab;
        render();
      },
      refreshLists,
      getCounts: () => lists,
    };

    render();
    return api;
  }

  window.AdminInventoryHub = { mount };
})();
