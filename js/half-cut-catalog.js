/**
 * AsiaPower — Half-Cut Catalog Listing
 */
(function () {
  'use strict';

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

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
    const statusLabel = window.PublicI18n?.translateStatus?.(display.status) || display.status;
    const statusClass = `half-cut-card__status--${u.statusSlug(display.status)}`;
    const thumbUrl = u.firstPhotoThumbUrl(display);
    const photoCount = (display.photos || []).filter(Boolean).length;
    const hasPhotos = u.hasPhotos(display);
    const hasVideo = u.hasVideo(display);
    const mediaBadges = [
      photoCount ? `<span class="half-cut-card__media-badge">${photoCount} ${t('hc.photos', 'Photos')}</span>` : '',
      hasVideo ? `<span class="half-cut-card__media-badge half-cut-card__media-badge--video">${t('hc.video', 'Video')}</span>` : '',
    ].filter(Boolean).join('');
    const safeTitle = String(display.title || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const thumbInner = thumbUrl && hasPhotos
      ? `<button type="button" class="half-cut-card__zoom" aria-label="${t('hc.viewPhotos', 'View photos')} — ${display.stockId}">
          <img src="${thumbUrl}" alt="${safeTitle}" loading="lazy" decoding="async">
          <span class="half-cut-gallery__zoom-hint">${t('hc.zoom', 'Zoom')}</span>
        </button>`
      : thumbUrl
        ? `<img src="${thumbUrl}" alt="${safeTitle}" loading="lazy" decoding="async">`
        : `<div class="half-cut-card__placeholder" aria-hidden="true">
          <svg class="half-cut-card__placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="2"/><path d="M21 17l-5-5-4 4-2-2-4 4"/></svg>
          <span class="half-cut-card__placeholder-text">${t('hc.photosOnRequest', 'Photos on request')}</span>
        </div>`;
    const thumb = `<div class="half-cut-card__thumb${thumbUrl ? '' : ' half-cut-card__thumb--placeholder'}">${mediaBadges ? `<div class="half-cut-card__media">${mediaBadges}</div>` : ''}${thumbInner}</div>`;
    const photosNote = '';
    const vinRow = display.maskedVin
      ? `<div><dt>${t('spec.vin', 'VIN')}</dt><dd class="half-cut-card__vin">${display.maskedVin}</dd></div>`
      : '';
    const priceLabel = u.formatFobPrice(display);
    const priceRow = priceLabel
      ? `<p class="half-cut-card__price"><span class="half-cut-card__price-label">${t('hc.fobPrice', 'FOB Price')}</span> ${priceLabel}</p>`
      : `<p class="half-cut-card__price half-cut-card__price--enquiry">${t('hc.priceOnEnquiry', 'FOB price on enquiry')}</p>`;

    return `
      <article class="half-cut-card engine-model" data-slug="${display.slug}" data-brand="${display.brandSlug}" data-status="${u.statusSlug(display.status)}">
        ${thumb}
        <div class="half-cut-card__header">
          <span class="half-cut-card__stock-id">${display.stockId}</span>
          <span class="half-cut-card__status ${statusClass}">${statusLabel}</span>
        </div>
        <h3 class="half-cut-card__title"><a href="${detail}">${display.title}</a></h3>
        ${priceRow}
        <dl class="half-cut-card__specs">
          <div><dt>${t('spec.brand', 'Brand')}</dt><dd><a href="${brandUrl}">${display.brand}</a></dd></div>
          <div><dt>${t('spec.model', 'Model')}</dt><dd>${display.model}</dd></div>
          <div><dt>${t('spec.year', 'Year')}</dt><dd>${display.year}</dd></div>
          <div><dt>${t('spec.engine', 'Engine')}</dt><dd>${display.engineCode
      ? (engineUrl ? `<a href="${engineUrl}">${display.engineCode}</a>` : display.engineCode)
      : (display.truckPartType === 'cab' ? '—' : '')}</dd></div>
          <div><dt>${t('spec.transmission', 'Transmission')}</dt><dd>${window.PowertrainLabels?.formatTransmissionDisplay?.(display) || display.transmissionCode || (display.truckPartType === 'cab' ? '—' : '')}</dd></div>
          <div><dt>${t('spec.mileage', 'Mileage')}</dt><dd>${display.mileage}</dd></div>
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

    const inventory = window.getPassengerHalfCutInventory?.()
      || window.HALF_CUT_LIST.filter((item) => {
        if (window.HalfCutUtils?.isMachineryItem?.(item)) return false;
        if (window.HalfCutUtils?.isTruckItem?.(item)) return false;
        return item.vehicleCategory !== 'truck' && item.vehicleCategory !== 'machinery';
      });
    const u = window.HalfCutUtils;
    const brands = window.getHalfCutBrands('passenger');
    const brandOptions = brands.map(b =>
      `<option value="${b.slug}">${b.name}</option>`
    ).join('');
    const availableCount = inventory.filter(i => i.status === 'Available').length;

    root.innerHTML = `
      <p class="half-cut-disclaimer">${window.PublicI18n?.inventoryDisclaimer?.() || u.INVENTORY_DISCLAIMER}</p>
      <div class="half-cut-toolbar catalog-toolbar">
        <div class="half-cut-toolbar__search brands-toolbar__search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="half-cut-search" placeholder="${t('hc.searchPlaceholder', 'Search stock ID, brand, model, engine or transmission…')}" aria-label="Search half-cut inventory" data-i18n-placeholder="hc.searchPlaceholder">
        </div>
        <div class="half-cut-toolbar__filters">
          <label class="half-cut-toolbar__label" for="half-cut-brand-filter">${t('hc.brand', 'Brand')}</label>
          <select id="half-cut-brand-filter" class="half-cut-toolbar__select" aria-label="Filter by brand">
            <option value="all">${t('hc.allBrands', 'All Brands')}</option>
            ${brandOptions}
          </select>
        </div>
        <div class="filter-group" id="half-cut-status-filter" role="group" aria-label="Filter by status">
          <button class="filter-btn" data-status="all" type="button">${t('hc.all', 'All')}</button>
          <button class="filter-btn active" data-status="available" type="button">${t('hc.available', 'Available')}</button>
          <button class="filter-btn" data-status="reserved" type="button">${t('hc.reserved', 'Reserved')}</button>
          <button class="filter-btn" data-status="in-transit" type="button">${t('hc.inTransit', 'In Transit')}</button>
          <button class="filter-btn" data-status="sold" type="button">${t('hc.sold', 'Sold')}</button>
        </div>
      </div>
      <div class="catalog-toolbar">
        <div class="catalog-toolbar__count">${t('hc.showing', 'Showing')} <strong id="half-cut-visible-count">${availableCount}</strong> ${t('hc.of', 'of')} <strong id="half-cut-total-count">${inventory.length}</strong> ${t('hc.halfCuts', 'half cuts')}</div>
      </div>
      <div class="half-cut-grid engine-catalog__grid" id="half-cut-grid" aria-live="polite">
        ${inventory.map(renderHalfCutCard).join('')}
      </div>
      <div class="brands-empty hidden" id="half-cut-empty">
        <p>${t('hc.noMatch', 'No half cuts match your search.')} <a href="${base()}contact.html">${t('hc.sendRequest', 'Send us your request')}</a>.</p>
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
        const item = window.getHalfCutBySlug(card.dataset.slug);
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
  window.addEventListener('asiapower:langchange', () => {
    const root = document.getElementById('half-cut-catalog-root');
    if (root) initHalfCutCatalog();
  });
})();
