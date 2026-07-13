/**
 * AsiaPower — Homepage carousels (live inventory by category)
 */
(function () {
  'use strict';

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  function base() {
    return window.SitePaths?.base?.() || '';
  }

  function utils() {
    return window.HalfCutUtils;
  }

  function toDisplay(item) {
    if (item?.vin && window.HalfCutInventoryLayer?.toPublicItem) {
      return window.HalfCutInventoryLayer.toPublicItem(item);
    }
    return item;
  }

  function isTruckCab(item) {
    if (window.HalfCutUploadLayer?.isTruckCab?.(item)) {
      // Still require truck category to avoid passenger mis-tags
      if (item?.vehicleCategory && item.vehicleCategory !== 'truck') return false;
      return true;
    }
    if (item?.vehicleCategory && item.vehicleCategory !== 'truck') return false;
    return item?.truckPartType === 'cab' || String(item?.vehicleCondition || '').trim() === 'Driver Cab';
  }

  function isAvailable(item) {
    const status = String(item?.status || '').trim();
    return !status || status === 'Available';
  }

  function parsePrice(item) {
    return utils()?.parsePriceUsd?.(item) ?? null;
  }

  function sortByNewest(a, b) {
    return (Number(b?.year) || 0) - (Number(a?.year) || 0);
  }

  function enginePartPriceUsd(item) {
    const u = utils();
    if (typeof u?.catalogPartPriceAmount === 'function') {
      return u.catalogPartPriceAmount(item, 'engine');
    }
    const amount = parsePrice(item);
    if (amount == null) return null;
    const ratio = u?.PART_PRICE_RATIOS?.engine ?? 0.65;
    return Math.round(amount * ratio);
  }

  function sortByCheapestEngine(a, b) {
    const pa = enginePartPriceUsd(a);
    const pb = enginePartPriceUsd(b);
    if (pa != null && pb != null) return pa - pb;
    if (pa != null) return -1;
    if (pb != null) return 1;
    return sortByNewest(a, b);
  }

  function sortByHeat(a, b) {
    const cmp = utils()?.compareListingHeat?.(a, b, cachedTrending);
    if (typeof cmp === 'number') return cmp;
    return sortByNewest(a, b);
  }

  function swapStockPositions(items, stockIdA, stockIdB) {
    const list = items.slice();
    const ia = list.findIndex((item) => item?.stockId === stockIdA);
    const ib = list.findIndex((item) => item?.stockId === stockIdB);
    if (ia < 0 || ib < 0) return list;
    const tmp = list[ia];
    list[ia] = list[ib];
    list[ib] = tmp;
    return list;
  }

  function itemListedAt(item) {
    return Date.parse(item?.listedAt || item?.approvedAt || item?.updatedAt || 0) || 0;
  }

  function promoteRecentListings(items, { days = 7, max = 3 } = {}) {
    if (!days || !max || !items.length) return items;
    const cutoff = Date.now() - days * 86400000;
    const recent = [];
    const rest = [];
    items.forEach((item) => {
      if (recent.length < max && itemListedAt(item) >= cutoff) recent.push(item);
      else rest.push(item);
    });
    return recent.length ? [...recent, ...rest] : items;
  }

  let cachedTrending = [];

  async function loadTrendingQueries() {
    try {
      if (window.AsiaPowerSearchTrends?.refreshQueries) {
        cachedTrending = await window.AsiaPowerSearchTrends.refreshQueries();
        return cachedTrending;
      }
      const res = await fetch('/api/search/trending?limit=30', { credentials: 'same-origin' });
      if (!res.ok) return cachedTrending;
      const data = await res.json();
      cachedTrending = (data.queries || []).map((row) => row.q).filter(Boolean);
    } catch {
      // keep previous cache
    }
    return cachedTrending;
  }

  const SECTIONS = {
    'best-selling': {
      filter: (item) => utils()?.isPassengerHalfCutItem?.(item),
      seeAll: 'half-cuts/',
      variant: 'default',
      limit: 12,
      sort: sortByHeat,
      promoteRecentDays: 1,
      promoteRecentMax: 3,
    },
    'passenger-engines': {
      filter: (item) => {
        const u = utils();
        if (!u?.isPassengerHalfCutItem?.(item)) return false;
        const display = toDisplay(item);
        // Parallel: dedicated engine uploads OR rule-based half-cuts with engineCode + rule photo.
        if (u?.isDedicatedPartListing?.(display, 'engine')) return true;
        if (!String(item?.engineCode || '').trim()) return false;
        return !!u?.pickPartListingPhoto?.(display, 'engine');
      },
      seeAll: 'engines/',
      variant: 'engine',
      limit: 12,
      sort: sortByCheapestEngine,
    },
    deals: {
      filter: (item) => isTruckCab(item),
      seeAll: 'trucks/',
      variant: 'default',
      limit: 12,
      sort: sortByHeat,
    },
    'top-rated': {
      filter: (item) => utils()?.isMachineryItem?.(item),
      seeAll: 'half-cuts/?cat=machinery',
      variant: 'rated',
      limit: 12,
      sort: sortByHeat,
    },
    'used-cars': {
      filter: (item) => utils()?.isExportableUsedCarItem?.(item),
      seeAll: 'half-cuts/?cat=used-cars',
      variant: 'default',
      limit: 12,
      sort: sortByHeat,
      swapStocks: ['HC250241', 'HC250168'],
    },
  };

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function priceBlock(display) {
    const u = utils();
    const label = u?.formatFobPrice?.(display);
    if (u?.priceWithExwLabel) return u.priceWithExwLabel(label, 'Quote');
    const badge = u?.exwBadgeHtml?.() || '<span class="ap-exw-badge">EXW</span>';
    if (label) return `${escapeHtml(label)} ${badge}`;
    return `Quote ${badge}`;
  }

  function photoBlock(display, opts) {
    const showBadge = opts?.showBadge !== false;
    const badge = utils()?.listingPhotoBadge?.(display) || String(display?.stockId || '').trim().toUpperCase();
    const badgeHtml = showBadge && badge
      ? `<span class="ebay-listing-row__year">${escapeHtml(badge)}</span>`
      : '';
    const thumb = opts?.thumbUrl || utils()?.firstPhotoThumbUrl?.(display);
    if (thumb) {
      return `${badgeHtml}<img src="${thumb}" alt="" loading="lazy" decoding="async">`;
    }
    return `${badgeHtml}<img src="${base()}assets/images/supply-halfcut.jpg?v=img-v3" alt="" loading="lazy">`;
  }

  function enginePhotoBlock(display) {
    const u = utils();
    const enginePhoto = u?.pickPartListingPhoto?.(display, 'engine');
    const engineThumb = enginePhoto ? u?.thumbPhotoUrl?.(enginePhoto) : '';
    return photoBlock(display, { thumbUrl: engineThumb, showBadge: false });
  }

  function renderHalfCutCard(item, variant) {
    const display = toDisplay(item);
    const detail = utils()?.detailUrl?.(base(), display.slug)
      || `${base()}half-cuts/detail.html?slug=${encodeURIComponent(display.slug)}`;
    const photo = photoBlock(display);
    const u = utils();
    const label = window.EngineCardLabel;

    if (variant === 'engine') {
      const engineTitle = escapeHtml(
        label?.formatEngineCodeDisplacementFuel?.(display)
          || u?.formatEngineCatalogPrimaryTitle?.(display)
          || display.title
          || '',
      );
      const code = display.engineCode || display.code;
      const lookup = label?.lookupCatalogModelExact?.(code, display.brandSlug);
      const appsSummary = lookup?.model
        ? label.formatCompatibleVehiclesSummary?.(lookup.model.applications, {
          brandName: lookup.brandName || display.brand,
          limit: 2,
        })
        : '';
      const apps = appsSummary
        ? `<div class="ebay-card__meta">${escapeHtml(appsSummary)}</div>`
        : '';
      const enginePrice = u?.formatCatalogPartPrice?.(display, 'engine')
        || u?.formatPartPriceUsd?.(display, u?.PART_PRICE_RATIOS?.engine ?? 0.65);
      const enginePriceHtml = u?.priceWithExwLabel?.(enginePrice, 'Quote') || priceBlock(display);
      return `<a class="ebay-card ebay-card--engine" href="${detail}">
        <div class="ebay-card__photo">${enginePhotoBlock(display)}</div>
        <div class="ebay-card__title">${engineTitle}</div>
        ${apps}
        <div class="ebay-card__price">${enginePriceHtml}</div>
      </a>`;
    }

    const vehicleTitle = escapeHtml(
      label?.formatHalfCutVehicleTitle?.(display)
        || u?.listingVehiclePrimaryTitle?.(display)
        || u?.listingTitle?.(display)
        || display.title
        || '',
    );
    const engineLine = escapeHtml(
      label?.formatEngineCodeDisplacementFuel?.(display)
        || u?.listingEngineConfirmLine?.(display)
        || '',
    );
    const year = escapeHtml(String(display.year || ''));
    const status = escapeHtml(u?.listingStatusLabel?.(display) || display.status || '');
    const engineHtml = engineLine ? `<div class="ebay-card__engine">${engineLine}</div>` : '';
    const yearHtml = year ? `<div class="ebay-card__year">${year}</div>` : '';
    const statusHtml = status ? `<div class="ebay-card__status">${status}</div>` : '';

    if (variant === 'rated') {
      return `<a class="ebay-card ebay-card--vehicle-first" href="${detail}">
        <div class="ebay-card__photo">${photo}</div>
        <div class="ebay-card__title">${vehicleTitle}</div>
        ${engineHtml}
        ${yearHtml}
        ${statusHtml}
        <div class="ebay-card__price">${priceBlock(display)}</div>
      </a>`;
    }

    return `<a class="ebay-card ebay-card--vehicle-first" href="${detail}">
      <div class="ebay-card__photo">${photo}</div>
      <div class="ebay-card__title">${vehicleTitle}</div>
      ${engineHtml}
      ${yearHtml}
      ${statusHtml}
      <div class="ebay-card__price">${priceBlock(display)}</div>
    </a>`;
  }

  function renderEngineCard(brandSlug, brandName, model) {
    const pagePath = window.SitePaths?.enginePagePath?.(brandSlug, model.code);
    const url = pagePath
      ? `${base()}${pagePath}`
      : `${base()}engines/?q=${encodeURIComponent(model.code)}`;
    const label = window.EngineCardLabel;
    const title = label?.formatEngineCodeDisplacementFuel?.(model)
      || `${model.code} · ${model.displacement} ${model.fuel}`.replace(/\s+/g, ' ').trim();
    const apps = label?.formatCompatibleVehiclesSummary?.(model.applications, {
      brandName,
      limit: 3,
    }) || '';
    const img = `${base()}assets/images/supply-engines.jpg?v=img-v3`;
    return `<a class="ebay-card ebay-card--engine-first" href="${url}">
      <div class="ebay-card__photo"><img src="${img}" alt="" loading="lazy"></div>
      <div class="ebay-card__title">${escapeHtml(title)}</div>
      ${apps ? `<div class="ebay-card__meta">${escapeHtml(apps)}</div>` : ''}
      <div class="ebay-card__price">${t('home.fromQuote', 'From quote')} ${utils()?.exwBadgeHtml?.() || '<span class="ap-exw-badge">EXW</span>'}</div>
    </a>`;
  }

  function pickEngineCards(limit) {
    const brands = window.getAllEngineBrands?.() || [];
    const preferred = [
      ['toyota', '2AZ-FE'],
      ['toyota', '1KD-FTV'],
      ['isuzu', '4JB1'],
      ['hyundai', 'D4HB'],
      ['nissan', 'QR25'],
      ['mitsubishi', '4D56'],
      ['hino', 'J08E'],
      ['cummins', 'ISF2.8'],
    ];
    const cards = [];
    const seen = new Set();

    function push(brand, model) {
      const key = `${brand.slug}:${model.code}`;
      if (seen.has(key) || cards.length >= limit) return;
      seen.add(key);
      cards.push(renderEngineCard(brand.slug, brand.name, model));
    }

    preferred.forEach(([slug, code]) => {
      const brand = brands.find((b) => b.slug === slug);
      const model = brand?.models?.find((m) => m.code === code);
      if (brand && model) push(brand, model);
    });

    if (cards.length < limit) {
      brands.forEach((brand) => {
        (brand.models || []).forEach((model) => push(brand, model));
      });
    }

    return cards.slice(0, limit);
  }

  async function loadInventory() {
    const store = window.HalfCutInventoryStore;
    if (store?.whenReady) await store.whenReady();
    return store?.getApprovedInventory?.() || [];
  }

  function populateSection(key, config, inventory) {
    const track = document.querySelector(`[data-home-carousel="${key}"]`);
    const seeAll = document.querySelector(`[data-home-section="${key}"] .ebay-section__head a`);
    if (!track) return;

    if (seeAll) seeAll.href = `${base()}${config.seeAll}`;

    let items = inventory.filter((item) => isAvailable(item) && config.filter(item));
    items.sort(config.sort);
    if (config.promoteRecentDays && config.promoteRecentMax) {
      items = promoteRecentListings(items, {
        days: config.promoteRecentDays,
        max: config.promoteRecentMax,
      });
    }
    if (Array.isArray(config.swapStocks) && config.swapStocks.length === 2) {
      items = swapStockPositions(items, config.swapStocks[0], config.swapStocks[1]);
    }
    items = items.slice(0, config.limit);

    let html = items.map((item) => renderHalfCutCard(item, config.variant)).join('');
    if (config.includeEngines) {
      html += pickEngineCards(6).join('');
    }

    if (!html.trim()) {
      html = `<p class="ebay-carousel__empty">${t('home.noListings', 'No listings available right now.')}</p>`;
    }

    track.innerHTML = html;
  }

  async function refresh() {
    if (document.body.dataset.page !== 'home') return;
    await loadTrendingQueries();
    const inventory = await loadInventory();
    Object.entries(SECTIONS).forEach(([key, config]) => populateSection(key, config, inventory));
    window.AsiaPowerEbayLayout?.bindCarousels?.();
  }

  function init() {
    if (document.body.dataset.page !== 'home') return;
    refresh().catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('asiapower:langchange', () => {
    refresh().catch(() => {});
  });

  window.AsiaPowerHomeHub = { refresh };
})();
