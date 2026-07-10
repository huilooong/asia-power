/**
 * AsiaPower — Half-Cut Catalog Listing
 */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const qParam = params.get('q') || '';
  if (window.SitePaths?.isSupplierUploadSearch?.(qParam)) {
    window.location.replace(window.SitePaths.supplierPortalHref());
    return;
  }

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
    const u = window.HalfCutUtils;
    // catalog-search-v1
    if (u?.matchesCatalogSearch) return u.matchesCatalogSearch(item, query);
    if (u?.isStockIdQuery?.(query) && u?.matchesStockId?.(item, query)) return true;
    const q = query.toLowerCase().trim();
    const qn = normalizeSearch(q);
    const haystack = [
      item.stockId,
      item.brand,
      item.model,
      item.engineCode,
      item.transmissionCode,
      item.title,
      item.originalVehicleName,
      item.vin,
      item.maskedVin,
      item.gearboxModel,
    ].join(' ').toLowerCase();
    if (haystack.includes(q)) return true;
    return normalizeSearch(haystack).includes(qn);
  }

  function renderHalfCutCard(item) {
    return window.HalfCutUtils?.renderListingListRow?.(item, { base: base() }) || '';
  }

  function resolveCatalogRoute() {
    if (window.parseHalfCutCatalogRoute) return window.parseHalfCutCatalogRoute();
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('cat');
    const qRaw = params.get('q') || '';
    const qNorm = decodeURIComponent(qRaw.replace(/\+/g, ' ')).toLowerCase().trim();
    if (cat === 'used-cars' || ['used car', 'usedcar', 'used-car', 'used-cars', '二手车', '出口二手车'].includes(qNorm)) {
      return { category: 'used-cars', searchQuery: '', brand: params.get('brand') || '' };
    }
    if (cat === 'trucks' || ['truck', 'trucks', '卡车'].includes(qNorm)) {
      return { category: 'trucks', searchQuery: '', brand: params.get('brand') || '' };
    }
    if (cat === 'machinery' || ['machinery', '工程机械'].includes(qNorm)) {
      return { category: 'machinery', searchQuery: '', brand: params.get('brand') || '' };
    }
    return {
      category: 'halfcuts',
      searchQuery: qNorm,
      brand: params.get('brand') || '',
    };
  }

  function syncCatalogPageHeader(category) {
    if (window.AsiaPowerEbayCatalogHub?.syncPageHeader) {
      window.AsiaPowerEbayCatalogHub.syncPageHeader(category);
      return;
    }
    const titles = {
      'used-cars': t('ebay.catUsedCars', 'Export Used Cars'),
      halfcuts: t('ebay.catHalfCuts', 'Half-Cuts'),
      trucks: t('ebay.catTrucks', 'Trucks'),
      machinery: t('ebay.catMachinery', 'Construction Machinery'),
    };
    const title = titles[category] || titles.halfcuts;
    const titleEl = document.querySelector('.ebay-page-title');
    if (titleEl) titleEl.textContent = title;
    document.querySelector('.ebay-page-subtitle')?.remove();
    if (category === 'halfcuts') {
      const intro = document.querySelector('.ebay-page__intro');
      const subEl = document.createElement('p');
      subEl.className = 'ebay-page-subtitle';
      subEl.dataset.i18n = 'ebay.catHalfCutsSubtitle';
      subEl.textContent = t('ebay.catHalfCutsSubtitle', 'Custom dismantling · Parts on demand');
      titleEl?.insertAdjacentElement('afterend', subEl);
      window.PublicI18n?.applyDataI18n?.(intro);
    }
    document.title = `${title} | AsiaPower`;
  }

  function initHalfCutCatalog() {
    const root = document.getElementById('half-cut-catalog-root');
    if (!root) return;

    const route = resolveCatalogRoute();
    const category = route.category || 'halfcuts';
    root.dataset.catalogCategory = category;

    const boot = () => {
      if (window.AsiaPowerEbayCatalogHub?.initHalfCut) {
        window.AsiaPowerEbayCatalogHub.initHalfCut(root, route);
        return;
      }
      syncCatalogPageHeader(category);
    };

    if (category === 'trucks') {
      window.AsiaPowerEbayCatalogHub?.syncTruckSidebarSubmodules?.(route);
    } else {
      window.AsiaPowerEbayCatalogHub?.syncTruckSidebarSubmodules?.({ category: 'halfcuts' });
    }

    boot();

    const Store = window.HalfCutInventoryStore;
    if (Store?.whenReady) {
      Store.whenReady().then(boot).catch(boot);
    }
  }

  window.renderHalfCutCard = renderHalfCutCard;
  window.matchesHalfCutSearch = matchesSearch;

  document.addEventListener('DOMContentLoaded', initHalfCutCatalog);
  window.addEventListener('asiapower:langchange', () => {
    if (document.getElementById('half-cut-catalog-root')) initHalfCutCatalog();
  });
  window.addEventListener('asiapower:layoutrefresh', () => {
    if (document.getElementById('half-cut-catalog-root')) initHalfCutCatalog();
  });
})();
