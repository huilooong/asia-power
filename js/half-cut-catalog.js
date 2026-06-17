/**
 * AsiaPower — Half-Cut Catalog Listing
 */
(function () {
  'use strict';

  function base() {
    return window.SitePaths?.base?.() || '../';
  }

  function normalizeSearch(value) {
    return String(value || '').toLowerCase().replace(/[\s-/]/g, '');
  }

  function matchesSearch(item, query) {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    const qn = normalizeSearch(q);
    const haystack = [
      item.stockId,
      item.brand,
      item.model,
      item.engineCode,
      item.transmissionCode,
      item.title,
    ].join(' ').toLowerCase();
    if (haystack.includes(q)) return true;
    return normalizeSearch(haystack).includes(qn);
  }

  function renderHalfCutCard(item) {
    const b = base();
    const u = window.HalfCutUtils;
    const display = u.toPublicItem(item);
    const detail = u.detailUrl(b, display.slug);
    const brandUrl = `${b}brands/${display.brandSlug}.html#halfcuts-inventory`;
    const engineUrl = u.enginePageUrl(b, display);
    const statusClass = `half-cut-card__status--${u.statusSlug(display.status)}`;
    const thumbUrl = u.firstPhotoUrl(display);
    const thumb = thumbUrl
      ? `<div class="half-cut-card__thumb"><img src="${thumbUrl}" alt="${display.title} thumbnail" loading="lazy"></div>`
      : '';
    const photosNote = u.hasPhotos(display)
      ? ''
      : '<p class="half-cut-card__photos-note">Photos on request</p>';
    const vinRow = display.maskedVin
      ? `<div><dt>VIN</dt><dd class="half-cut-card__vin">${display.maskedVin}</dd></div>`
      : '';

    return `
      <article class="half-cut-card engine-model" data-slug="${display.slug}" data-brand="${display.brandSlug}" data-status="${u.statusSlug(display.status)}">
        ${thumb}
        <div class="half-cut-card__header">
          <span class="half-cut-card__stock-id">${display.stockId}</span>
          <span class="half-cut-card__status ${statusClass}">${display.status}</span>
        </div>
        <h3 class="half-cut-card__title"><a href="${detail}">${display.title}</a></h3>
        <dl class="half-cut-card__specs">
          <div><dt>Brand</dt><dd><a href="${brandUrl}">${display.brand}</a></dd></div>
          <div><dt>Model</dt><dd>${display.model}</dd></div>
          <div><dt>Year</dt><dd>${display.year}</dd></div>
          <div><dt>Engine</dt><dd>${engineUrl ? `<a href="${engineUrl}">${display.engineCode}</a>` : display.engineCode}</dd></div>
          <div><dt>Transmission</dt><dd>${display.transmissionCode}</dd></div>
          <div><dt>Mileage</dt><dd>${display.mileage}</dd></div>
          ${vinRow}
        </dl>
        ${photosNote}
        <p class="engine-model__apps">${display.shortDescription}</p>
        <div class="engine-model__footer half-cut-card__footer">
          ${u.renderCardActions(display, b)}
        </div>
      </article>`;
  }

  function initHalfCutCatalog() {
    const root = document.getElementById('half-cut-catalog-root');
    if (!root) return;

    const boot = () => {
    if (!window.HALF_CUT_LIST) return;

    const u = window.HalfCutUtils;
    const brands = window.getHalfCutBrands();
    const brandOptions = brands.map(b =>
      `<option value="${b.slug}">${b.name}</option>`
    ).join('');
    const availableCount = window.HALF_CUT_LIST.filter(i => i.status === 'Available').length;

    root.innerHTML = `
      <p class="half-cut-disclaimer">${u.INVENTORY_DISCLAIMER}</p>
      <div class="half-cut-toolbar catalog-toolbar">
        <div class="half-cut-toolbar__search brands-toolbar__search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="half-cut-search" placeholder="Search stock ID, brand, model, engine or transmission…" aria-label="Search half-cut inventory">
        </div>
        <div class="half-cut-toolbar__filters">
          <label class="half-cut-toolbar__label" for="half-cut-brand-filter">Brand</label>
          <select id="half-cut-brand-filter" class="half-cut-toolbar__select" aria-label="Filter by brand">
            <option value="all">All Brands</option>
            ${brandOptions}
          </select>
        </div>
        <div class="filter-group" id="half-cut-status-filter" role="group" aria-label="Filter by status">
          <button class="filter-btn" data-status="all" type="button">All</button>
          <button class="filter-btn active" data-status="available" type="button">Available</button>
          <button class="filter-btn" data-status="reserved" type="button">Reserved</button>
          <button class="filter-btn" data-status="in-transit" type="button">In Transit</button>
          <button class="filter-btn" data-status="sold" type="button">Sold</button>
        </div>
      </div>
      <div class="catalog-toolbar">
        <div class="catalog-toolbar__count">Showing <strong id="half-cut-visible-count">${availableCount}</strong> of <strong id="half-cut-total-count">${window.HALF_CUT_LIST.length}</strong> half cuts</div>
      </div>
      <div class="half-cut-grid engine-catalog__grid" id="half-cut-grid" aria-live="polite">
        ${window.HALF_CUT_LIST.map(renderHalfCutCard).join('')}
      </div>
      <div class="brands-empty hidden" id="half-cut-empty">
        <p>No half cuts match your search. <a href="${base()}contact.html">Send us your request</a>.</p>
      </div>`;

    const searchInput = document.getElementById('half-cut-search');
    const brandFilter = document.getElementById('half-cut-brand-filter');
    const statusButtons = document.querySelectorAll('#half-cut-status-filter .filter-btn');
    const cards = () => Array.from(document.querySelectorAll('#half-cut-grid .half-cut-card'));
    const visibleEl = document.getElementById('half-cut-visible-count');
    const emptyEl = document.getElementById('half-cut-empty');
    let activeStatus = 'available';

    function applyFilters() {
      const query = searchInput?.value || '';
      const brand = brandFilter?.value || 'all';
      let visible = 0;

      cards().forEach(card => {
        const slug = card.dataset.brand;
        const status = card.dataset.status;
        const item = window.getHalfCutBySlugInternal?.(card.dataset.slug) || window.getHalfCutBySlug(card.dataset.slug);
        const matchBrand = brand === 'all' || slug === brand;
        const matchStatus = activeStatus === 'all' || status === activeStatus;
        const matchQuery = item ? matchesSearch(item, query) : true;
        const show = matchBrand && matchStatus && matchQuery;
        card.classList.toggle('hidden', !show);
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });

      if (visibleEl) visibleEl.textContent = visible;
      if (emptyEl) emptyEl.classList.toggle('hidden', visible > 0);
    }

    searchInput?.addEventListener('input', applyFilters);
    searchInput?.addEventListener('search', applyFilters);
    brandFilter?.addEventListener('change', applyFilters);
    statusButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        statusButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeStatus = btn.dataset.status || 'all';
        applyFilters();
      });
    });

    applyFilters();
  };

    const Store = window.HalfCutInventoryStore;
    if (Store?.whenReady) {
      Store.whenReady().then(boot).catch(boot);
    } else {
      boot();
    }
  }

  window.renderHalfCutCard = renderHalfCutCard;

  document.addEventListener('DOMContentLoaded', initHalfCutCatalog);
})();
