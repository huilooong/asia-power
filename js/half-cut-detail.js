/**
 * AsiaPower — Half-Cut Detail Page
 */
(function () {
  'use strict';

  let currentSlug = '';

  function t(key, fallback) {
    return window.PublicI18n?.t(key, fallback) ?? fallback;
  }

  function base() {
    return window.SitePaths?.base?.() || '../';
  }

  function upsertJsonLd(id, data) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function absoluteUrl(path) {
    if (window.AsiaPowerSEO?.absoluteUrl) return window.AsiaPowerSEO.absoluteUrl(path);
    return new URL(path, window.location.href).href;
  }

  function upsertMeta(attr, key, content) {
    if (!content) return;
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.content = content;
  }

  function escapeHtml(value) {
    return window.HalfCutGalleryLightbox?.escapeHtml?.(value) ?? String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function photoLabel(photo, index) {
    return window.HalfCutGalleryLightbox?.photoLabel?.(photo, index)
      ?? (typeof photo === 'object' && photo.label ? photo.label : `Photo ${index + 1}`);
  }

  function readPrerenderItem() {
    if (window.__HALF_CUT_PRERENDER_ITEM__ && typeof window.__HALF_CUT_PRERENDER_ITEM__ === 'object') {
      return window.__HALF_CUT_PRERENDER_ITEM__;
    }
    const el = document.getElementById('half-cut-prerender-item');
    if (!el?.textContent) return null;
    try {
      return JSON.parse(el.textContent);
    } catch {
      return null;
    }
  }

  function slugFromUrl() {
    const params = new URLSearchParams(window.location.search);
    // Accept id= as stockId alias (CEO / ops links often use ?id=HC25xxxx)
    return params.get('slug') || params.get('stockId') || params.get('id') || '';
  }

  function photoCount(item) {
    return Array.isArray(item?.photos) ? item.photos.length : 0;
  }

  function mergeCatalogItem(item) {
    if (!item?.slug || !window.HalfCutDirectory?.rebuildHalfCutList) return;
    const list = window.HALF_CUT_LIST || [];
    const idx = list.findIndex((entry) => entry.slug === item.slug);
    if (idx >= 0) {
      // Catalog list API may ship a truncated photo set — upgrade in place when fuller.
      if (photoCount(item) <= photoCount(list[idx])) return;
      const next = list.slice();
      next[idx] = { ...list[idx], ...item, photos: item.photos };
      window.HalfCutDirectory.rebuildHalfCutList(next);
      return;
    }
    window.HalfCutDirectory.rebuildHalfCutList([...list, item]);
  }

  function preferRicherItem(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return photoCount(b) > photoCount(a) ? b : a;
  }

  function prerenderMatchesLookup(prerender, lookup) {
    if (!prerender || !lookup) return false;
    const needle = String(lookup).trim();
    if (!needle) return false;
    if (prerender.slug === needle) return true;
    if ((prerender.slugAliases || []).includes(needle)) return true;
    const stock = String(prerender.stockId || '').toUpperCase();
    return !!stock && stock === needle.toUpperCase();
  }

  function resolveHalfCutItem(slug) {
    if (!slug) return null;

    const prerender = readPrerenderItem();
    const prerenderHit = prerenderMatchesLookup(prerender, slug) ? prerender : null;

    let item = window.getHalfCutBySlug?.(slug) || null;
    item = preferRicherItem(prerenderHit, item);

    const fromStore = window.HalfCutInventoryStore?.getPublicItemBySlug?.(slug) || null;
    item = preferRicherItem(item, fromStore);

    if (item && fromStore && photoCount(fromStore) > photoCount(prerenderHit || {})) {
      mergeCatalogItem(fromStore);
    }
    return item;
  }

  async function fetchPublicItemBySlug(slug) {
    try {
      const res = await fetch(`${window.location.origin}/api/half-cuts/public/item?slug=${encodeURIComponent(slug)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      return data.item || null;
    } catch {
      return null;
    }
  }

  function showDetailLoading(root) {
    if (!root || root.innerHTML.trim()) return;
    root.innerHTML = `
      <section class="section">
        <div class="container">
          <p>${t('hc.loadingDetail', 'Loading listing…')}</p>
        </div>
      </section>`;
  }

  function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve('timeout'), ms);
    });
    return Promise.race([
      Promise.resolve(promise).then((value) => {
        clearTimeout(timer);
        return value;
      }).catch(() => {
        clearTimeout(timer);
        return null;
      }),
      timeout,
    ]);
  }

  function hasUsableDetailHtml(root) {
    if (!root) return false;
    const html = String(root.innerHTML || '').trim();
    if (!html) return false;
    // Server prerender or a prior successful client render — never wipe these on transient failures.
    if (root.dataset.prerenderSlug) return true;
    if (root.querySelector?.('.hc-item-detail')) return true;
    return html.length > 200;
  }

  function renderHalfCutDetail(slug) {
    currentSlug = slug || '';
    const item = resolveHalfCutItem(slug);
    const root = document.getElementById('half-cut-detail-root');
    if (!item || !root) {
      if (hasUsableDetailHtml(root)) return;
      if (root) {
        root.innerHTML = `
          <section class="section">
            <div class="container">
              <h1>${t('hc.notFound', 'Half Cut Not Found')}</h1>
              <p>${t('hc.notFoundLead', 'This listing is unavailable.')} <a href="${base()}half-cuts/">${t('hc.browseInventory', 'Browse half-cut inventory')}</a> ${t('catalog.or', 'or')} <a href="${base()}contact.html">${t('footer.contactUs', 'contact us')}</a>.</p>
            </div>
          </section>`;
      }
      return;
    }

    const snapshot = hasUsableDetailHtml(root) ? root.innerHTML : '';
    try {
      renderHalfCutDetailContent(item, root);
    } catch (err) {
      console.error('[HalfCutDetail] render failed', err);
      // Restore prerender/last-good HTML — do not leave header+footer-only blank pages.
      if (snapshot) {
        root.innerHTML = snapshot;
        return;
      }
      if (hasUsableDetailHtml(root)) return;
      root.innerHTML = `
        <section class="section">
          <div class="container">
            <h1>${t('hc.notFound', 'Half Cut Not Found')}</h1>
            <p>${t('hc.notFoundLead', 'This listing is unavailable.')} <a href="${base()}half-cuts/">${t('hc.browseInventory', 'Browse half-cut inventory')}</a>.</p>
          </div>
        </section>`;
    }
  }

  function renderDetailGallery(item, u) {
    if (!u.hasPhotos(item)) {
      const label = t('hc.photosOnRequest', 'Photos on request');
      const ppt = String(item.passengerPartType || '').trim().toLowerCase();
      const truckPart = String(item.truckPartType || '').trim().toLowerCase();
      let partType = '';
      if (ppt === 'engine' || ppt === 'transmission' || ppt === 'chassis' || ppt === 'front') partType = ppt;
      else if (truckPart === 'engine') partType = 'engine';
      if (partType && typeof u.partsCatalogPlaceholderSrc === 'function') {
        const phSrc = u.partsCatalogPlaceholderSrc(partType);
        return `<div class="hc-item-detail__gallery hc-item-detail__gallery--empty" aria-label="${escapeHtml(label)}">
          <div class="hc-item-detail__placeholder hc-item-detail__placeholder--parts-ph">
            <img src="${phSrc}" alt="" loading="lazy" decoding="async">
            <span class="ebay-listing-row__photo-ph-badge">${escapeHtml(label)}</span>
          </div>
        </div>`;
      }
      return `<div class="hc-item-detail__gallery hc-item-detail__gallery--empty" aria-label="${escapeHtml(label)}">
        <div class="hc-item-detail__placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.75"/><path d="M21 17l-5-5-4 4-2-2-4 4"/></svg>
          <span>${escapeHtml(label)}</span>
        </div>
      </div>`;
    }

    const photos = item.photos;
    const photoCount = photos.length;
    const firstLabel = escapeHtml(photoLabel(item.photos[0], 0));
    const fitClass = u.listingPhotoUseContain?.(item) ? ' ap-photo-viewer__img--contain' : '';
    const badgeHtml = u.renderPhotoStockBadge?.(item) || '';
    const badgeOnStage = badgeHtml
      ? badgeHtml.replace('ebay-listing-row__year', 'hc-item-detail__photo-badge')
      : '';

    const thumbsHtml = photos.map((photo, i) => {
      const thumbUrl = u.thumbPhotoUrl?.(photo) || u.photoUrl(photo);
      const label = escapeHtml(photoLabel(photo, i));
      return `<button type="button" class="hc-item-detail__thumb${i === 0 ? ' is-active' : ''}" data-photo-index="${i}" aria-label="${label}" aria-selected="${i === 0 ? 'true' : 'false'}">
        <img src="${thumbUrl}" alt="" loading="lazy" decoding="async">
      </button>`;
    }).join('');

    const navHtml = photoCount > 1
      ? `<button type="button" class="ap-photo-viewer__nav ap-photo-viewer__nav--prev" aria-label="${t('hc.prevPhoto', 'Previous photo')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
         <button type="button" class="ap-photo-viewer__nav ap-photo-viewer__nav--next" aria-label="${t('hc.nextPhoto', 'Next photo')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
         <button type="button" class="ap-photo-viewer__hit ap-photo-viewer__hit--prev" aria-label="${t('hc.prevPhoto', 'Previous photo')}" tabindex="-1"></button>
         <button type="button" class="ap-photo-viewer__hit ap-photo-viewer__hit--next" aria-label="${t('hc.nextPhoto', 'Next photo')}" tabindex="-1"></button>`
      : '';

    return `<div class="hc-item-detail__gallery-wrap">
      <div class="ap-photo-viewer hc-item-detail__viewer" data-ap-photo-viewer>
        <div class="ap-photo-viewer__stage" tabindex="0" role="region" aria-label="${t('hc.photoGallery', 'Photo gallery')}">
          ${badgeOnStage}
          <figure class="ap-photo-viewer__figure">
            <img class="ap-photo-viewer__img${fitClass}" src="${u.photoUrl(item.photos[0])}" alt="${firstLabel}" decoding="async">
          </figure>
          ${navHtml}
          <button type="button" class="ap-photo-viewer__expand" aria-label="${t('hc.fullScreen', 'Full screen')}" title="${t('hc.fullScreen', 'Full screen')}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="ap-photo-progress ap-photo-viewer__progress" role="progressbar" aria-valuemin="1" aria-valuemax="${photoCount}" aria-valuenow="1"${photoCount <= 1 ? ' hidden' : ''}>
          <div class="ap-photo-progress__track">${photos.map((_, i) => `<span class="ap-photo-progress__seg${i === 0 ? ' is-active' : ''}" aria-hidden="true"></span>`).join('')}</div>
          <span class="ap-photo-viewer__counter">1 / ${photoCount}</span>
        </div>
      </div>
      ${photoCount > 1 ? `<div class="hc-item-detail__thumbs-col" role="tablist" aria-label="${t('hc.photoGallery', 'Photo gallery')}">
        <div class="hc-item-detail__thumbs">${thumbsHtml}</div>
      </div>` : ''}
    </div>`;
  }

  function renderBuyBoxActions(item, u) {
    const primary = item.status === 'Available'
      ? u.leadLink(item, 'price', 'hc-item-detail__btn hc-item-detail__btn--primary', t('hc.contactTeam', 'Contact Sourcing Team'))
      : u.leadLink(item, 'similar', 'hc-item-detail__btn hc-item-detail__btn--primary', t('hc.requestSimilar', 'Request Similar Unit'));

    const secondary = [];
    if (item.status === 'Available') {
      secondary.push(u.facebookShareLink(item, 'hc-item-detail__btn hc-item-detail__btn--secondary hc-item-detail__btn--facebook', t('hc.shareFacebook', 'Share on Facebook')));
      secondary.push(u.whatsappLink(item, 'hc-item-detail__btn hc-item-detail__btn--secondary hc-item-detail__btn--whatsapp', 'WhatsApp'));
      const price = Number(item.priceUsd);
      secondary.push(
        `<button type="button" class="hc-item-detail__btn hc-item-detail__btn--secondary hc-item-detail__btn--quote" data-quote-add`
        + ` data-stock-id="${escapeHtml(item.stockId || '')}"`
        + ` data-slug="${escapeHtml(item.slug || '')}"`
        + ` data-title="${escapeHtml(item.title || '')}"`
        + ` data-brand="${escapeHtml(item.brand || '')}"`
        + ` data-model="${escapeHtml(item.model || '')}"`
        + ` data-year="${escapeHtml(String(item.year || ''))}"`
        + ` data-engine="${escapeHtml(item.engineCode || '')}"`
        + ` data-price-usd="${Number.isFinite(price) ? price : ''}"`
        + ` data-page-url="${escapeHtml(u.listingSharePageUrl?.(item) || u.detailUrl?.(item) || '')}"`
        + `>${t('hc.addToQuoteList', 'Add to quote list')}</button>`,
      );
    } else if (item.status === 'Reserved' || item.status === 'In Transit') {
      secondary.push(u.leadLink(item, 'availability', 'hc-item-detail__btn hc-item-detail__btn--secondary', t('hc.checkAvailability', 'Check Availability')));
    }
    return `${primary}${secondary.join('')}`;
  }

  function renderVehicleInfoInAbout(item, opts) {
    const specRow = (label, value) => {
      if (!value) return '';
      return `<div class="hc-item-detail__spec"><dt>${label}</dt><dd>${value}</dd></div>`;
    };
    const rows = [
      specRow(t('spec.brand', 'Brand'), `<a href="${opts.brandUrl}">${escapeHtml(item.brand)}</a>`),
      specRow(t('spec.model', 'Model'), escapeHtml(item.model)),
      specRow(t('spec.year', 'Year'), escapeHtml(String(item.year || ''))),
      specRow(t('spec.engine', 'Engine Code'), opts.engineUrl
        ? `<a href="${opts.engineUrl}">${escapeHtml(item.engineCode)}</a>`
        : escapeHtml(item.engineCode)),
      specRow(t('spec.transmission', 'Transmission'), escapeHtml(
        window.PowertrainLabels?.formatTransmissionDisplay?.(item) || item.transmissionCode || ''
      )),
      specRow(t('hc.drivetrain', 'Drivetrain'), escapeHtml(item.drivetrain || '')),
      specRow(t('spec.mileage', 'Mileage'), escapeHtml(item.mileage || '')),
      item.maskedVin
        ? specRow(t('spec.vin', 'VIN'), `<span class="half-cut-detail__vin">${escapeHtml(item.maskedVin)}</span>`)
        : '',
      specRow(t('hc.condition', 'Condition'), escapeHtml(opts.conditionText)),
      specRow(t('hc.origin', 'Origin'), escapeHtml(item.origin || '')),
      specRow(t('hc.status', 'Status'), `<span class="half-cut-card__status half-cut-card__status--${opts.statusClass}">${escapeHtml(opts.statusLabel)}</span>`),
      specRow('Stock ID', `<strong>${escapeHtml(item.stockId)}</strong>`),
    ].filter(Boolean).join('');

    if (!rows) return '';

    return `<div class="hc-item-detail__about-vehicle" aria-label="${t('hc.vehicleInfo', 'Vehicle information')}">
      <h3 class="hc-item-detail__about-subtitle">${t('hc.vehicleInfo', 'Vehicle information')}</h3>
      <dl class="hc-item-detail__specifics hc-item-detail__specifics--about">${rows}</dl>
    </div>`;
  }

  function renderSellerCard(b) {
    return `<section class="hc-item-detail__seller-card" aria-label="${t('hc.sellerInfo', 'Seller information')}">
      <h2 class="hc-item-detail__section-label">${t('hc.sellerInfo', 'Seller')}</h2>
      <div class="hc-item-detail__seller">
        <div class="hc-item-detail__seller-mark" aria-hidden="true">AP</div>
        <div class="hc-item-detail__seller-body">
          <strong>${t('hc.detailSellerName', 'AsiaPower Sourcing')}</strong>
          <span>${t('hc.detailSellerMeta', 'China export network · B2B only')}</span>
        </div>
        <a class="hc-item-detail__seller-msg" href="${b}contact.html">${t('hc.messageSeller', 'Message')}</a>
      </div>
      <p class="hc-item-detail__ship">${t('hc.shipsFromChina', 'Ships from China · EXW Zhengzhou · CIF on request')}</p>
    </section>`;
  }

  function isPartBoilerplate(line) {
    const text = String(line || '').trim();
    if (!text) return true;
    if (/^汽修宝|^里程数|^原始车型|^原始说明|^VIN OCR|^VIN decode|^子龙预估|^transmission /i.test(text)) return true;
    if (/^999 km|^仅为占位|占位，不代表真实里程/i.test(text)) return true;
    return false;
  }

  function sanitizeIncludedParts(parts) {
    return (parts || []).filter((part) => !isPartBoilerplate(part));
  }

  const EXPORT_USED_CAR_DISCLAIMER = 'This listing is a complete, undismantled used vehicle for whole-vehicle export. Export shipment proceeds only after registration, inspection, export licensing and destination-market requirements are verified for the order.';

  function buildDetailIntro(displayTitle, item, isUsedCar) {
    const title = String(displayTitle || '').trim();
    if (isUsedCar) {
      return `${title}. ${t('hc.usedCarDetailLead', 'Complete, undismantled China export used vehicle with VIN. Availability, documents and destination eligibility are confirmed before contract.')}`;
    }
    return `${title}. ${t('hc.detailExportLead', 'EXW export from China — availability, photos and CIF shipping confirmed on enquiry.')}`;
  }

  function renderExportUsedCarIdentity(item) {
    const supplierDeclared = item.exportSupplierDeclaration === true;
    const documentsVerified = item.exportDocumentationStatus === 'verified';
    const supplierText = supplierDeclared
      ? t('hc.usedCarSupplierDeclared', 'Whole-vehicle export availability declared by supplier')
      : t('hc.usedCarSupplierNotRecorded', 'Whole-vehicle export declaration not recorded');
    const documentText = documentsVerified
      ? t('hc.usedCarDocsVerified', 'Export document review verified by AsiaPower')
      : t('hc.usedCarDocsPending', 'AsiaPower document review pending — confirmed before contract and shipment');
    return `<section class="hc-item-detail__about-vehicle" aria-label="${escapeHtml(t('hc.usedCarIdentityTitle', 'Export vehicle identity'))}">
      <h3 class="hc-item-detail__about-subtitle">${t('hc.usedCarIdentityHeading', 'Complete vehicle & export status')}</h3>
      <dl class="hc-item-detail__specifics hc-item-detail__specifics--about">
        <div class="hc-item-detail__spec"><dt>${t('hc.usedCarIdentityLabel', 'Vehicle identity')}</dt><dd>${t('hc.usedCarIdentityValue', 'Complete late-model used vehicle · VIN-listed · not dismantled')}</dd></div>
        <div class="hc-item-detail__spec"><dt>${t('hc.usedCarSupplierLabel', 'Supplier declaration')}</dt><dd>${supplierText}</dd></div>
        <div class="hc-item-detail__spec"><dt>${t('hc.usedCarDocsLabel', 'AsiaPower document review')}</dt><dd>${documentText}</dd></div>
        <div class="hc-item-detail__spec"><dt>${t('hc.usedCarExportConditionLabel', 'China export condition')}</dt><dd>${t('hc.usedCarExportConditionValue', 'Registration, inspection, export licence and destination compliance required before shipment')}</dd></div>
      </dl>
    </section>`;
  }

  function normalizeMatchText(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function isSameListing(a, b) {
    if (!a || !b) return false;
    if (a.slug && b.slug && a.slug === b.slug) return true;
    const stockA = String(a.stockId || '').trim().toUpperCase();
    const stockB = String(b.stockId || '').trim().toUpperCase();
    return Boolean(stockA && stockB && stockA === stockB);
  }

  function detailInventoryPool() {
    const store = window.HalfCutInventoryStore;
    const approved = store?.getApprovedInventory?.() || [];
    if (approved.length) return approved;
    return window.HALF_CUT_LIST || [];
  }

  function inventorySegmentForItem(item) {
    const u = window.HalfCutUtils;
    if (u?.isTruckItem?.(item)) return 'truck';
    if (u?.isMachineryItem?.(item)) return 'machinery';
    return 'passenger';
  }

  function similarListingScore(candidate, current) {
    if (isSameListing(candidate, current)) return -1;

    let score = 0;
    const status = String(candidate.status || '').trim();
    if (status === 'Available') score += 10;
    else if (status === 'Reserved' || status === 'In Transit') score += 4;

    if (candidate.brandSlug === current.brandSlug) score += 12;
    if (normalizeMatchText(candidate.model) === normalizeMatchText(current.model)) score += 25;
    if (normalizeMatchText(candidate.engineCode) === normalizeMatchText(current.engineCode)) score += 18;
    if (candidate.vehicleCategory === current.vehicleCategory) score += 5;

    const candidateYear = Number(candidate.year) || 0;
    const currentYear = Number(current.year) || 0;
    if (candidateYear && currentYear) {
      const yearDiff = Math.abs(candidateYear - currentYear);
      if (yearDiff === 0) score += 6;
      else if (yearDiff <= 2) score += 3;
    }

    if (normalizeMatchText(candidate.transmissionCode) === normalizeMatchText(current.transmissionCode)) {
      score += 4;
    }

    return score;
  }

  function pickSimilarProducts(current, limit = 8) {
    const u = window.HalfCutUtils;
    const segment = inventorySegmentForItem(current);
    const segmentPool = u?.filterInventoryBySegment?.(detailInventoryPool(), segment) || detailInventoryPool();
    const currentIsUsedCar = !!u?.isExportableUsedCarItem?.(current);
    const pool = segment === 'passenger'
      ? segmentPool.filter((entry) => !!u?.isExportableUsedCarItem?.(entry) === currentIsUsedCar)
      : segmentPool;

    const ranked = pool
      .map((entry) => {
        const item = u?.toPublicItem?.(entry) ?? entry;
        return { item, score: similarListingScore(item, current) };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const yearA = Number(a.item.year) || 0;
        const yearB = Number(b.item.year) || 0;
        return yearB - yearA;
      });

    let picks = ranked.slice(0, limit).map((entry) => entry.item);
    if (picks.length) return picks;

    picks = pool
      .map((entry) => u?.toPublicItem?.(entry) ?? entry)
      .filter((entry) => !isSameListing(entry, current) && entry.brandSlug === current.brandSlug)
      .slice(0, limit);
    return picks;
  }

  function similarSectionSeeAllLabel(brand) {
    return t('hc.viewAllBrand', 'View all {brand}').replace('{brand}', brand);
  }

  function renderSimilarProductsSection(item, u, b) {
    const similar = pickSimilarProducts(item, 8);
    if (!similar.length) return '';

    const cards = similar
      .map((entry) => u.renderListingCard(entry, { base: b }))
      .join('');
    const brandUrl = u?.isExportableUsedCarItem?.(item)
      ? `${b}half-cuts/?cat=used-cars&brand=${encodeURIComponent(item.brandSlug || '')}`
      : `${b}brands/${item.brandSlug}.html#halfcuts-inventory`;

    return `<section class="hc-item-detail__panel hc-item-detail__similar" aria-labelledby="hc-similar-heading">
      <div class="ebay-section__head hc-item-detail__similar-head">
        <h2 class="hc-item-detail__panel-title" id="hc-similar-heading">${t('hc.similarProducts', 'Similar products')}</h2>
        <a href="${brandUrl}">${escapeHtml(similarSectionSeeAllLabel(item.brand))}</a>
      </div>
      <div class="ebay-carousel hc-item-detail__similar-carousel" data-carousel>
        <button type="button" class="ebay-carousel__nav ebay-carousel__nav--prev" data-carousel-prev aria-label="${t('hc.prevPhoto', 'Previous')}">‹</button>
        <div class="ebay-carousel__track" data-carousel-track>${cards}</div>
        <button type="button" class="ebay-carousel__nav ebay-carousel__nav--next" data-carousel-next aria-label="${t('hc.nextPhoto', 'Next')}">›</button>
      </div>
    </section>`;
  }

  function usedCarCoreTitle(item) {
    const year = item?.vinSpecs?.modelYear || item?.year;
    return [year, item?.brand, item?.model].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function usedCarBodyDescription(item) {
    const specs = item?.vinSpecs || {};
    const doors = Number(specs.doors);
    const seats = Number(specs.seats);
    const configuration = String(specs.bodyConfiguration || '').trim();
    const style = /\u4e24\u53a2\u8f66/.test(configuration)
      ? 'Hatchback'
      : (/\u4e09\u53a2\u8f66/.test(configuration) ? 'Sedan' : String(specs.bodyStyle || item?.bodyType || '').trim());
    return [
      Number.isFinite(doors) && doors > 0 ? `${doors}-door` : '',
      Number.isFinite(seats) && seats > 0 ? `${seats}-seat` : '',
      style,
    ].filter(Boolean).join(', ').replace(', ' + style, ` ${style}`).trim();
  }

  function usedCarTransmission(item) {
    const specs = item?.vinSpecs || {};
    if (specs.fuelType === 'Electric' && /\u56fa\u5b9a\u9f7f\u6bd4|\u5355\u901f/.test(`${specs.transmissionDescription || ''} ${specs.transmissionType || ''}`)) {
      return 'Fixed-ratio single-speed';
    }
    return specs.transmissionDescription || specs.transmissionType || item?.transmissionCode || '';
  }

  function usedCarDimensions(item) {
    const dimensions = item?.vinSpecs?.dimensions;
    if (!dimensions) return '';
    const values = [dimensions.length, dimensions.width, dimensions.height].map(Number);
    if (values.some((value) => !Number.isFinite(value) || value <= 0)) return '';
    return `${values.map((value) => value.toLocaleString('en-US')).join(' × ')} ${dimensions.unit || 'mm'}`;
  }

  function usedCarSpecRows(item) {
    const specs = item?.vinSpecs || {};
    const row = (label, value, note = '') => {
      if (value == null || String(value).trim() === '') return '';
      return `<div class="uc-vdp__spec"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}${note ? `<small>${escapeHtml(note)}</small>` : ''}</dd></div>`;
    };
    const tire = specs.frontTire || specs.rearTire
      ? [specs.frontTire ? `${specs.frontTire} front` : '', specs.rearTire ? `${specs.rearTire} rear` : ''].filter(Boolean).join(' · ')
      : '';
    return [
      row('Model year', specs.modelYear || item.year),
      row('Factory trim (CN)', specs.trimName || item.trimName),
      row('Fuel type', specs.fuelType || item.fuelType),
      row('Drivetrain', specs.drivetrainDisplay || specs.drivetrain || item.drivetrain),
      row('Transmission', usedCarTransmission(item)),
      row('Body configuration', usedCarBodyDescription(item) || specs.bodyConfiguration),
      row('Dimensions', usedCarDimensions(item)),
      row('Wheelbase', specs.wheelbaseMm ? `${Number(specs.wheelbaseMm).toLocaleString('en-US')} mm` : ''),
      row('Curb weight', specs.curbWeightKg ? `${Number(specs.curbWeightKg).toLocaleString('en-US')} kg` : ''),
      row('Tires', tire),
      row('Variant range label', specs.trimRangeKm ? `${specs.trimRangeKm} km` : '', specs.trimRangeKm ? 'Model designation; not a battery-health or real-world range test.' : ''),
      row('Catalog launch', specs.catalogLaunchMonth),
      row('Engine', specs.engineDescription),
      row('Displacement', specs.displacementCc ? `${Number(specs.displacementCc).toLocaleString('en-US')} cc` : ''),
      row('Maximum power', specs.maxPowerKw ? `${Number(specs.maxPowerKw).toLocaleString('en-US')} kW` : ''),
    ].filter(Boolean).join('');
  }

  function usedCarConditionRows() {
    const row = (title, body, confirmed = false) => `<div class="uc-vdp__condition-row${confirmed ? ' is-confirmed' : ''}">
      <span class="uc-vdp__condition-icon" aria-hidden="true">${confirmed ? '✓' : '○'}</span>
      <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div>
      <span class="uc-vdp__condition-status">${confirmed ? 'Confirmed' : 'Pending'}</span>
    </div>`;
    return [
      row('Identity and factory configuration', 'VIN decoder matched the vehicle series, model year and factory trim.', true),
      row('Battery state of health', 'A diagnostic battery report has not yet been uploaded. Request it before contracting.'),
      row('Accident, flood and fire history', 'Physical inspection and supporting history documents are still required.'),
      row('Exterior and interior condition report', 'Inventory photos are available; a standardized inspection sheet is still pending.'),
    ].join('');
  }

  function renderExportUsedCarDetailContent(item, root, context) {
    const { b, u, canonical } = context;
    const specs = item.vinSpecs || {};
    const coreTitle = usedCarCoreTitle(item);
    const catalogHref = `${b}half-cuts/?cat=used-cars`;
    const brandUrl = `${catalogHref}&brand=${encodeURIComponent(item.brandSlug || '')}`;
    const statusLabel = window.PublicI18n?.translateStatus?.(item.status) || item.status || 'Available';
    const available = item.status === 'Available';
    const amount = Number(u.parsePriceUsd?.(item));
    const priceText = Number.isFinite(amount) && amount > 0 ? `US$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : t('hc.priceOnEnquiry', 'Quote on enquiry');
    const trimLine = [
      specs.trimRangeKm ? `${specs.trimRangeKm} km variant` : '',
      specs.drivetrainDisplay || specs.drivetrain || item.drivetrain,
    ].filter(Boolean).join(' · ');
    const bodyText = usedCarBodyDescription(item) || specs.bodyConfiguration || specs.bodyStyle || item.bodyType || '';
    const gallery = renderDetailGallery(item, u);
    const leadAction = available
      ? u.leadLink(item, 'price', 'uc-vdp__button uc-vdp__button--primary', 'Request CIF quote')
      : u.leadLink(item, 'similar', 'uc-vdp__button uc-vdp__button--primary', 'Request Similar Unit');
    const whatsapp = u.whatsappLink(item, 'uc-vdp__button uc-vdp__button--whatsapp', 'WhatsApp');
    const documentsVerified = item.exportDocumentationStatus === 'verified';
    const publicTitle = `${coreTitle} — Export Used Car`;
    const configText = [specs.fuelType || item.fuelType, specs.drivetrain || item.drivetrain].filter(Boolean).join(', ');
    const publicDescription = `${item.brand} ${item.model} export used car${configText ? ` — ${configText}` : ''}. ${Number.isFinite(amount) && amount > 0 ? `EXW US$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}. ` : ''}VIN configuration, condition evidence and destination eligibility are confirmed before shipment. Stock ${item.stockId}.`;

    document.body.classList.add('page-export-used-car-detail');
    document.title = `${publicTitle} | AsiaPower`;
    upsertMeta('property', 'og:title', publicTitle);
    upsertMeta('property', 'og:description', publicDescription);
    upsertMeta('name', 'twitter:title', publicTitle);
    upsertMeta('name', 'twitter:description', publicDescription);
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.content = publicDescription;
    upsertJsonLd('schema-halfcut-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl(`${b}index.html`) },
        { '@type': 'ListItem', position: 2, name: 'Export Used Cars', item: absoluteUrl(catalogHref) },
        { '@type': 'ListItem', position: 3, name: coreTitle, item: canonical },
      ],
    });
    const images = typeof u.productImages === 'function' ? u.productImages(item, b) : [];
    const product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: publicTitle,
      description: publicDescription,
      sku: item.stockId,
      image: images,
      brand: { '@type': 'Brand', name: item.brand },
      url: canonical,
    };
    if (Number.isFinite(amount) && amount > 0 && item.status !== 'Sold') {
      product.offers = {
        '@type': 'Offer',
        url: canonical,
        priceCurrency: 'USD',
        price: amount.toFixed(2),
        availability: available ? 'https://schema.org/InStock' : 'https://schema.org/LimitedAvailability',
        itemCondition: 'https://schema.org/UsedCondition',
      };
    }
    upsertJsonLd('schema-halfcut-product', product);

    root.innerHTML = `<section class="uc-vdp">
      <div class="container">
        <nav class="uc-vdp__crumb" aria-label="Breadcrumb">
          <a href="${b}index.html">Home</a><span>/</span><a href="${catalogHref}">Export Used Cars</a><span>/</span><a href="${brandUrl}">${escapeHtml(item.brand)}</a><span>/</span><span>${escapeHtml(item.stockId)}</span>
        </nav>

        <div class="uc-vdp__hero">
          <div class="uc-vdp__gallery">${gallery}</div>
          <aside class="uc-vdp__summary" aria-label="Vehicle summary">
            <div class="uc-vdp__eyebrow"><span>${escapeHtml([item.brand, specs.fuelType || item.fuelType, bodyText].filter(Boolean).join(' · '))}</span><span>Stock ${escapeHtml(item.stockId)}</span></div>
            <h1>${escapeHtml(coreTitle)}</h1>
            ${trimLine ? `<p class="uc-vdp__trim">${escapeHtml(trimLine)}</p>` : ''}
            <div class="uc-vdp__price"><div><span>EXW vehicle price</span><strong>${escapeHtml(priceText)}</strong></div><span>CIF quote available</span></div>
            <dl class="uc-vdp__quick-facts">
              <div><dt>Mileage</dt><dd>${escapeHtml(item.mileage || 'Confirm on enquiry')}</dd></div>
              <div><dt>Powertrain</dt><dd>${escapeHtml(specs.fuelType || item.fuelType || 'Confirm on enquiry')}</dd></div>
              <div><dt>Drive</dt><dd>${escapeHtml(specs.drivetrain || item.drivetrain || '—')}</dd></div>
              <div><dt>Transmission</dt><dd>${escapeHtml(usedCarTransmission(item) || '—')}</dd></div>
              <div><dt>Body</dt><dd>${escapeHtml(bodyText || '—')}</dd></div>
              <div><dt>Seats</dt><dd>${escapeHtml(String(specs.seats || '—'))}</dd></div>
            </dl>
            <div class="uc-vdp__actions">${leadAction}${whatsapp}</div>
            <p class="uc-vdp__availability"><span aria-hidden="true">✓</span> ${escapeHtml(statusLabel)} · availability and final vehicle condition are reconfirmed before order.</p>
          </aside>
        </div>

        <div class="uc-vdp__content-layout">
          <div class="uc-vdp__content-main">
            <section class="uc-vdp__panel" aria-labelledby="uc-overview">
              <div class="uc-vdp__section-head"><div><span>Vehicle overview</span><h2 id="uc-overview">Factory configuration decoded from VIN</h2></div><em>✓ VIN matched</em></div>
              <p class="uc-vdp__intro">These fields identify the original factory model and configuration. They do not replace a physical condition inspection or battery health report.</p>
              <dl class="uc-vdp__spec-grid">${usedCarSpecRows(item)}</dl>
            </section>

            <section class="uc-vdp__panel" aria-labelledby="uc-condition">
              <div class="uc-vdp__section-head"><div><span>Condition &amp; history</span><h2 id="uc-condition">What is verified—and what is still pending</h2></div></div>
              <div class="uc-vdp__condition-list">${usedCarConditionRows()}</div>
            </section>

            <section class="uc-vdp__panel" aria-labelledby="uc-identity">
              <div class="uc-vdp__section-head"><div><span>Vehicle identity</span><h2 id="uc-identity">VIN and listing reference</h2></div></div>
              <div class="uc-vdp__identity-grid">
                ${item.maskedVin ? `<div><span>Masked VIN</span><strong class="uc-vdp__vin">${escapeHtml(item.maskedVin)}</strong></div>` : ''}
                <div><span>Stock ID</span><strong>${escapeHtml(item.stockId)}</strong></div>
                <div><span>Origin</span><strong>${escapeHtml(item.origin || 'China')}</strong></div>
                <div><span>Listing status</span><strong>${escapeHtml(statusLabel)}</strong></div>
              </div>
              <p class="uc-vdp__privacy">The full chassis number is withheld from public pages and can be shared with a qualified buyer during verification.</p>
            </section>

            <section class="uc-vdp__panel" aria-labelledby="uc-export">
              <div class="uc-vdp__section-head"><div><span>Export purchase</span><h2 id="uc-export">Documents, inspection and shipment</h2></div></div>
              <ol class="uc-vdp__steps">
                <li><span>1</span><div><strong>Confirm the unit</strong><p>Reconfirm availability, VIN, price and buyer requirements.</p></div></li>
                <li><span>2</span><div><strong>Inspect and document</strong><p>Obtain condition, battery and export-document evidence.</p></div></li>
                <li><span>3</span><div><strong>Quote to your port</strong><p>AsiaPower prepares the EXW or CIF offer for the destination.</p></div></li>
                <li><span>4</span><div><strong>Contract and ship</strong><p>Commercial terms and logistics are confirmed in writing.</p></div></li>
              </ol>
              <div class="uc-vdp__export-note"><strong>${documentsVerified ? 'Document review verified.' : 'Document review pending.'}</strong> ${documentsVerified ? 'Export documentation has been reviewed for this listing.' : 'Supplier has declared whole-vehicle export availability; registration, inspection, export licence and destination requirements will be verified before contract and shipment.'}</div>
            </section>
            ${renderSimilarProductsSection(item, u, b)}
          </div>

          <aside class="uc-vdp__lead" aria-label="Get price and shipping">
            <span>Ask about this car</span><h2>Get price and shipping</h2>
            <p>Choose a destination port for an indicative CIF estimate, then request the confirmed export quote.</p>
            ${window.AsiaPowerCifCalculator?.renderDetailPanel?.({ exwUsd: u.parsePriceUsd(item), cargo: window.AsiaPowerCifCalculator?.cargoForItem?.(item), item, base: b }) || ''}
            <div class="uc-vdp__lead-actions">${leadAction}${whatsapp}</div>
            <ul><li>Real inventory photos</li><li>VIN-based configuration</li><li>EXW and CIF quotation</li></ul>
          </aside>
        </div>
      </div>
    </section>`;

    bindGalleryLightbox(root, item, u);
    window.AsiaPowerCifCalculator?.bindDetailPanel?.(root, { exwUsd: u.parsePriceUsd(item), cargo: window.AsiaPowerCifCalculator?.cargoForItem?.(item), item });
    window.AsiaPowerEbayLayout?.bindCarousels?.();
  }

  function renderHalfCutDetailContent(item, root) {
    const b = base();
    const u = window.HalfCutUtils;
    const displayTitle = window.EngineCardLabel?.formatHalfCutDetailH1?.(item)
      || u.listingVehiclePrimaryTitle?.(item)
      || u.listingTitle(item)
      || item.title;
    const title = u.seoTitle(item);
    const description = u.seoDescription(item);

    const isTruck = item.vehicleCategory === 'truck';
    const isMachinery = item.vehicleCategory === 'machinery';
    const isUsedCar = !!(u.isExportableUsedCarItem?.(item));
    const detailPath = isMachinery
      ? 'machinery/detail.html'
      : (isTruck ? 'trucks/detail.html' : (isUsedCar ? 'used-cars/detail.html' : 'half-cuts/detail.html'));
    const canonical = absoluteUrl(u.detailUrl?.(b, item.slug, item) || `${b}${detailPath}?slug=${encodeURIComponent(item.slug)}`);
    // OG images must never block buy-box CTAs (WhatsApp / Facebook / inquiry).
    let ogImage = '';
    try {
      const images = typeof u.productImages === 'function'
        ? u.productImages(item, b)
        : (Array.isArray(item.photos) ? item.photos.map((p) => absoluteUrl(u.photoUrl?.(p) || p?.url || '')).filter(Boolean) : []);
      ogImage = images[0] || '';
    } catch (err) {
      console.warn('[HalfCutDetail] og image skipped', err);
    }

    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = description;

    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:type', 'product');
    if (ogImage) {
      upsertMeta('property', 'og:image', ogImage);
      upsertMeta('property', 'og:image:secure_url', ogImage);
      upsertMeta('name', 'twitter:card', 'summary_large_image');
      upsertMeta('name', 'twitter:title', title);
      upsertMeta('name', 'twitter:description', description);
      upsertMeta('name', 'twitter:image', ogImage);
    }
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) canonicalLink.href = canonical;

    if (isUsedCar) {
      renderExportUsedCarDetailContent(item, root, { b, u, canonical });
      return;
    }
    document.body.classList.remove('page-export-used-car-detail');

    const passengerPart = String(item.passengerPartType || '').trim();
    let catalogLabel = isMachinery
      ? t('nav.machinery', 'Machinery')
      : (isTruck ? t('nav.trucks', 'Trucks') : (isUsedCar ? t('ebay.catUsedCars', 'Export Used Cars') : t('nav.halfcuts', 'Half-Cuts')));
    let catalogHref = isMachinery
      ? `${b}machinery/`
      : (isTruck ? `${b}trucks/` : (isUsedCar ? `${b}half-cuts/?cat=used-cars` : `${b}half-cuts/`));
    if (passengerPart === 'engine' || passengerPart === 'transmission') {
      catalogLabel = t('nav.engines', 'Engines');
      catalogHref = `${b}engines/`;
    } else if (passengerPart === 'chassis') {
      catalogLabel = t('catalog.chassis', 'Chassis Parts');
      catalogHref = `${b}chassis-parts/`;
    } else if (passengerPart === 'tire') {
      catalogLabel = t('catalog.tires', 'Used Tires');
      catalogHref = `${b}tires/`;
    } else if (isTruck && item.truckPartType === 'engine') {
      catalogHref = `${b}trucks/?part=engine`;
    } else if (isTruck && item.truckPartType === 'cab') {
      catalogHref = `${b}trucks/?part=head`;
    } else if (isTruck && item.truckPartType === 'axle') {
      catalogHref = `${b}trucks/?part=axle`;
    } else if (isTruck && item.truckPartType === 'vehicle') {
      catalogHref = `${b}trucks/?part=whole`;
    }
    const cutLabel = isMachinery
      ? (item.vehicleCondition || t('machinery.equipment', 'Construction Equipment'))
      : (isTruck
        ? t('trucks.halfCut', 'Truck Half Cut')
        : (isUsedCar ? t('ebay.catUsedCars', 'Export Used Car') : t('hc.halfCut', 'Half Cut')));

    upsertJsonLd('schema-halfcut-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl(`${b}index.html`) },
        { '@type': 'ListItem', position: 2, name: catalogLabel, item: absoluteUrl(catalogHref) },
        { '@type': 'ListItem', position: 3, name: displayTitle, item: canonical },
      ],
    });

    upsertJsonLd('schema-halfcut-product', u.productJsonLd(item, canonical));

    const engineUrl = isUsedCar ? null : u.enginePageUrl(b, item);
    const brandUrl = isUsedCar
      ? `${b}half-cuts/?cat=used-cars&brand=${encodeURIComponent(item.brandSlug || '')}`
      : `${b}brands/${item.brandSlug}.html#halfcuts-inventory`;
    const statusLabel = window.PublicI18n?.translateStatus?.(item.status) || item.status;
    const statusClass = u.statusSlug(item.status);
    const priceLabel = u.formatFobPrice(item);
    const priceHtml = priceLabel
      ? `<div class="hc-item-detail__price">${escapeHtml(priceLabel)} ${u.exwBadgeHtml?.() || '<span class="ap-exw-badge">EXW</span>'}</div>`
      : `<div class="hc-item-detail__price hc-item-detail__price--enquiry">${t('hc.priceOnEnquiry', 'Quote on enquiry')} ${u.exwBadgeHtml?.() || '<span class="ap-exw-badge">EXW</span>'}</div>`;

    const intro = buildDetailIntro(displayTitle, item, isUsedCar);
    const conditionText = item.vehicleCondition || cutLabel;
    const gallery = renderDetailGallery(item, u);
    const videoSection = u.hasVideo(item)
      ? `<section class="hc-item-detail__video">
          <h3 class="hc-item-detail__video-title">${t('hc.vehicleVideo', 'Vehicle Video')}</h3>
          ${u.renderVideoPlayer(item, { className: 'half-cut-detail__video-player', title: `${item.brand} ${item.model} video` })}
        </section>`
      : '';
    const supplierNotice = item.supplierVerified
      ? `<p class="hc-item-detail__verified">${t('hc.supplierVerified', 'Supplier verified listing — inventory confirmed by AsiaPower supplier network before publication.')}</p>`
      : '';

    const cleanParts = isUsedCar ? [] : sanitizeIncludedParts(item.includedParts);
    const partsHtml = cleanParts.length
      ? `<h3 class="half-cut-detail__parts-title">${t('hc.includedParts', 'Included Parts')}</h3><ul class="half-cut-detail__parts">${cleanParts.map((part) => `<li>${escapeHtml(part)}</li>`).join('')}</ul>`
      : '';

    const trustItems = [
      item.video?.url ? t('hc.trustVideo', 'Real inventory video') : null,
      t('hc.trustPhotos', 'Real inventory photos'),
      item.maskedVin ? t('hc.trustVin', 'VIN / chassis verifiable') : null,
      t('hc.trustPrice', 'Transparent EXW price'),
      t('hc.trustCif', 'EXW + CIF to your port'),
    ].filter(Boolean);
    const trustHtml = trustItems.slice(0, 4).map((label) => `<li>${escapeHtml(label)}</li>`).join('');
    const inventoryNote = isUsedCar
      ? t('hc.usedCarExportDisclaimer', EXPORT_USED_CAR_DISCLAIMER)
      : (u.inventoryDisclaimer || u.INVENTORY_DISCLAIMER);

    root.innerHTML = `
      <section class="hc-item-detail">
        <div class="container">
          <nav class="hc-item-detail__crumb" aria-label="Breadcrumb">
            <a href="${b}index.html">${t('catalog.home', 'Home')}</a>
            <span aria-hidden="true">›</span>
            <a href="${catalogHref}">${catalogLabel}</a>
            <span aria-hidden="true">›</span>
            <a href="${brandUrl}">${escapeHtml(item.brand)}</a>
            <span aria-hidden="true">›</span>
            <span>${escapeHtml(item.stockId)}</span>
          </nav>

          <div class="hc-item-detail__product-head">
            <h1 class="hc-item-detail__title">${escapeHtml(displayTitle)}</h1>
            <p class="hc-item-detail__stock">${escapeHtml(item.stockId)} · ${escapeHtml(statusLabel)}</p>
            ${window.InquiryCta?.render?.({
              context: { product: `${item.brand} ${item.model} (${item.stockId})`, category: isUsedCar ? 'used-car' : 'half-cut' },
              variant: 'product-head',
            }) || u.whatsappLink(item, 'inquiry-cta-banner__btn inquiry-cta-banner__btn--whatsapp', t('inquiryCta.whatsapp', 'WhatsApp Us for Price'))}
          </div>

          <div class="hc-item-detail__layout">
            <div class="hc-item-detail__media-col">
              ${gallery}
              ${videoSection}
            </div>

            <aside class="hc-item-detail__buybox" aria-label="${t('hc.viewDetails', 'View Details')}">
              <p class="hc-item-detail__secure">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
                ${isUsedCar
                  ? t('hc.usedCarCompleteListing', 'Complete vehicle export listing')
                  : t('hc.detailVerifiedExport', 'Verified export listing')}
              </p>

              ${priceHtml}

              ${renderSellerCard(b)}

              <div class="hc-item-detail__actions">
                ${renderBuyBoxActions(item, u)}
              </div>

              <ol class="hc-item-detail__process" aria-label="${t('hc.buyProcessTitle', 'How buying works')}">
                <li>${escapeHtml(t('hc.buyProcessInspect', 'Inspect — Confirm photos, VIN/engine code and condition before quote.'))}</li>
                <li>${escapeHtml(t('hc.buyProcessQuote', 'Quote — EXW price plus CIF options to your destination port on request.'))}</li>
                <li>${escapeHtml(t('hc.buyProcessLogistics', 'Logistics — Crating, export docs and ocean freight coordinated after order confirm.'))}</li>
                <li>${escapeHtml(t('hc.buyProcessPayment', 'Payment — Terms confirmed in writing before shipment; inventory held after deposit as agreed.'))}</li>
              </ol>

              <ul class="hc-item-detail__trust" aria-label="${t('hc.whyBuy', 'Why buy from AsiaPower')}">${trustHtml}</ul>
              ${supplierNotice}
            </aside>
          </div>

          <div class="hc-item-detail__lower">
            <div class="hc-item-detail__main-col">
              <section class="hc-item-detail__panel hc-item-detail__panel--about">
                <h2 class="hc-item-detail__panel-title">${t('hc.aboutThisItem', 'About this item')}</h2>
                <p class="hc-item-detail__about">${escapeHtml(intro)}</p>
                ${isUsedCar ? renderExportUsedCarIdentity(item) : ''}
                ${renderVehicleInfoInAbout(item, {
                  brandUrl,
                  engineUrl,
                  statusLabel,
                  statusClass,
                  conditionText,
                })}
                ${partsHtml}
                <p class="hc-item-detail__about-disclaimer">${inventoryNote}</p>
              </section>
              ${renderSimilarProductsSection(item, u, b)}
            </div>
            <aside class="hc-item-detail__side-col">
              ${window.AsiaPowerCifCalculator?.renderDetailPanel?.({
                exwUsd: u.parsePriceUsd(item),
                cargo: window.AsiaPowerCifCalculator?.cargoForItem?.(item),
                item,
                base: b,
              }) || ''}
              <h3>${t('engine.browseBrand', 'Browse')} ${escapeHtml(item.brand)}</h3>
              <ul class="engine-detail__links">
                ${isUsedCar
                  ? `<li><a href="${brandUrl}">${escapeHtml(item.brand)} ${t('ebay.catUsedCars', 'Export Used Cars')}</a></li>`
                  : `<li><a href="${brandUrl}">${escapeHtml(item.brand)} ${t('hc.halfCutListings', 'Half-Cut Listings')}</a></li>
                <li><a href="${b}brands/${item.brandSlug}.html#engines">${escapeHtml(item.brand)} ${t('engine.brandEngines', 'Engines')}</a></li>
                <li><a href="${b}brands/${item.brandSlug}.html#gearboxes">${escapeHtml(item.brand)} ${t('engine.brandGearboxes', 'Gearboxes')}</a></li>`}
              </ul>
              <h3>${t('hc.catalog', 'Catalog')}</h3>
              <ul class="engine-detail__links">
                <li><a href="${catalogHref}">${isMachinery ? t('machinery.allMachinery', 'All Machinery') : (isTruck ? t('trucks.allTrucks', 'All Trucks') : (isUsedCar ? t('hc.allExportUsedCars', 'All Export Used Cars') : t('hc.allHalfCuts', 'All Half Cuts')))}</a></li>
                ${engineUrl ? `<li><a href="${engineUrl}">${escapeHtml(item.engineCode)} ${t('hc.enginePage', 'Engine Page')}</a></li>` : ''}
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section class="cta-block">
        <div class="container cta-block__inner">
          <div>
            <h2>${item.status === 'Sold' ? `${t('hc.ctaSold', 'Similar')} ${escapeHtml(displayTitle.replace(/\s+Half Cut.*$/i, '').trim() || item.brand)} ${cutLabel}` : `${t('hc.ctaExport', 'Export')} ${escapeHtml(displayTitle.replace(/\s+Half Cut.*$/i, '').trim() || item.brand)} ${cutLabel}`}</h2>
            <p>${item.status === 'Sold'
              ? `${t('hc.ctaSoldIntro', 'Stock ID')} <strong>${escapeHtml(item.stockId)}</strong> ${t('hc.ctaSoldRest', 'is sold. Reference this listing when requesting a similar unit.')}`
              : `${t('hc.ctaSoldIntro', 'Stock ID')} <strong>${escapeHtml(item.stockId)}</strong>${t('hc.ctaAvailableRest', ' — reference for EXW/CIF quotation; availability confirmed on enquiry.')}`}</p>
          </div>
          ${item.status === 'Available'
            ? u.leadLink(item, 'price', 'btn btn-accent', t('hc.contactTeam', 'Contact Sourcing Team'))
            : u.leadLink(item, 'similar', 'btn btn-accent', t('hc.requestSimilar', 'Request Similar Unit'))}
        </div>
      </section>`;

    bindGalleryLightbox(root, item, u);
    window.AsiaPowerCifCalculator?.bindDetailPanel?.(root, {
      exwUsd: u.parsePriceUsd(item),
      cargo: window.AsiaPowerCifCalculator?.cargoForItem?.(item),
      item,
    });
    window.AsiaPowerEbayLayout?.bindCarousels?.();
    window.QuoteList?.wireAddButtons?.(root);
  }

  function bindDetailReadMore(root) {
    const btn = root.querySelector('[data-detail-read-more]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const shortEl = root.querySelector('[data-detail-intro-short]');
      const fullEl = root.querySelector('[data-detail-intro-full]');
      if (shortEl) shortEl.hidden = true;
      if (fullEl) fullEl.hidden = false;
    });
  }

  function bindGalleryLightbox(root, item, u) {
    window.HalfCutGalleryLightbox?.bindPhotoViewer?.(root, item, u)
      || window.HalfCutGalleryLightbox?.bindDetailGallery?.(root, item, u);
  }

  async function bootHalfCutDetailPage() {
    const slug = slugFromUrl();
    if (!slug) return;

    const root = document.getElementById('half-cut-detail-root');
    const prerender = readPrerenderItem();
    if (prerenderMatchesLookup(prerender, slug)) {
      renderHalfCutDetail(slug);
    } else {
      showDetailLoading(root);
    }

    // Fetch the single listing immediately. Do NOT block on the full public catalog —
    // that payload is large and used to leave ?id=HC25xxxx pages as header+footer only.
    const fetchedPromise = fetchPublicItemBySlug(slug);
    const Store = window.HalfCutInventoryStore;
    if (Store?.whenReady) {
      await withTimeout(Store.whenReady(), 2500);
    }

    if (prerenderMatchesLookup(prerender, slug)) mergeCatalogItem(prerender);

    // Always fetch the full public item. List/catalog payloads truncate photos for
    // performance; detail must show every uploaded photo (compress ≠ drop).
    const fetched = await fetchedPromise;
    if (fetched) {
      mergeCatalogItem(fetched);
      if (photoCount(fetched) > photoCount(prerender || {})) {
        window.__HALF_CUT_PRERENDER_ITEM__ = {
          ...(prerender && typeof prerender === 'object' ? prerender : {}),
          ...fetched,
          photos: fetched.photos,
        };
      }
      // Canonicalize share/ops links that used ?id= / stockId as the lookup key.
      if (fetched.slug && fetched.slug !== slug) {
        try {
          const next = new URL(window.location.href);
          next.searchParams.delete('id');
          next.searchParams.delete('stockId');
          next.searchParams.set('slug', fetched.slug);
          window.history.replaceState({}, '', next.toString());
          currentSlug = fetched.slug;
        } catch {
          // ignore history failures
        }
      }
    }

    renderHalfCutDetail(fetched?.slug || slug);
  }

  function needsDetailRetry(root) {
    if (!root || !slugFromUrl()) return false;
    if (!root.innerHTML.trim()) return true;
    return /not found|未找到乘用车/i.test(root.textContent || '');
  }

  function scheduleHalfCutDetailBoot() {
    const run = () => { bootHalfCutDetailPage(); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }
    window.addEventListener('load', () => {
      const root = document.getElementById('half-cut-detail-root');
      if (needsDetailRetry(root)) bootHalfCutDetailPage();
    }, { once: true });
  }

  (function renderFromPrerenderImmediately() {
    const slug = slugFromUrl();
    if (!slug) return;
    const prerender = readPrerenderItem();
    if (!prerenderMatchesLookup(prerender, slug)) return;
    renderHalfCutDetail(slug);
  })();

  scheduleHalfCutDetailBoot();

  window.HalfCutDetailPage = { refresh: bootHalfCutDetailPage };

  window.addEventListener('asiapower:langchange', () => {
    if (currentSlug) renderHalfCutDetail(currentSlug);
  });
})();
