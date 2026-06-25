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
    return params.get('slug') || params.get('stockId') || '';
  }

  function mergeCatalogItem(item) {
    if (!item?.slug || !window.HalfCutDirectory?.rebuildHalfCutList) return;
    const list = window.HALF_CUT_LIST || [];
    if (list.some((entry) => entry.slug === item.slug)) return;
    window.HalfCutDirectory.rebuildHalfCutList([...list, item]);
  }

  function resolveHalfCutItem(slug) {
    if (!slug) return null;

    const prerender = readPrerenderItem();
    if (prerender && (prerender.slug === slug || (prerender.slugAliases || []).includes(slug))) {
      return prerender;
    }

    let item = window.getHalfCutBySlug?.(slug) || null;
    if (item) return item;

    item = window.HalfCutInventoryStore?.getPublicItemBySlug?.(slug) || null;
    if (item) {
      mergeCatalogItem(item);
      return window.getHalfCutBySlug?.(item.slug) || item;
    }

    return null;
  }

  async function fetchPublicItemBySlug(slug) {
    try {
      const res = await fetch(`${window.location.origin}/api/half-cuts/public`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      const approved = Array.isArray(data.approved) ? data.approved : [];
      let item = approved.find((entry) => entry?.slug === slug
        || (Array.isArray(entry?.slugAliases) && entry.slugAliases.includes(slug)));
      if (!item) {
        const stockMatch = String(slug).match(/(hc\d+)/i);
        if (stockMatch) {
          const stockId = stockMatch[0].toUpperCase();
          item = approved.find((entry) => String(entry.stockId || '').toUpperCase() === stockId) || null;
        }
      }
      return item || null;
    } catch {
      return null;
    }
  }

  function renderHalfCutDetail(slug) {
    currentSlug = slug || '';
    const item = resolveHalfCutItem(slug);
    const root = document.getElementById('half-cut-detail-root');
    if (!item || !root) {
      if (root && root.dataset.prerenderSlug === slug && root.innerHTML.trim()) {
        return;
      }
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

    try {
      renderHalfCutDetailContent(item, root);
    } catch (err) {
      console.error('[HalfCutDetail] render failed', err);
      if (root.dataset.prerenderSlug === slug && root.innerHTML.trim()) {
        return;
      }
      root.innerHTML = `
        <section class="section">
          <div class="container">
            <h1>${t('hc.notFound', 'Half Cut Not Found')}</h1>
            <p>${t('hc.notFoundLead', 'This listing is unavailable.')} <a href="${base()}half-cuts/">${t('hc.browseInventory', 'Browse half-cut inventory')}</a>.</p>
          </div>
        </section>`;
    }
  }

  function renderHalfCutDetailContent(item, root) {
    const b = base();
    const u = window.HalfCutUtils;
    const title = u.seoTitle(item);
    const description = u.seoDescription(item);

    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = description;

    const canonical = absoluteUrl(`${b}half-cuts/detail.html?slug=${encodeURIComponent(item.slug)}`);
    window.AsiaPowerSEO?.refresh?.();
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) canonicalLink.href = canonical;
    upsertMeta('property', 'og:url', canonical);

    const isTruck = item.vehicleCategory === 'truck';
    const isMachinery = item.vehicleCategory === 'machinery';
    const catalogLabel = isMachinery
      ? t('nav.machinery', 'Machinery')
      : (isTruck ? t('nav.trucks', 'Trucks') : t('nav.halfcuts', 'Half-Cuts'));
    const catalogHref = isMachinery
      ? `${b}machinery/`
      : (isTruck ? `${b}trucks/` : `${b}half-cuts/`);
    const cutLabel = isMachinery
      ? (item.vehicleCondition || t('machinery.equipment', 'Construction Equipment'))
      : (isTruck ? t('trucks.halfCut', 'Truck Half Cut') : t('hc.halfCut', 'Half Cut'));

    upsertJsonLd('schema-halfcut-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl(`${b}index.html`) },
        { '@type': 'ListItem', position: 2, name: catalogLabel, item: absoluteUrl(catalogHref) },
        { '@type': 'ListItem', position: 3, name: item.title, item: canonical },
      ],
    });

    upsertJsonLd('schema-halfcut-product', u.productJsonLd(item, canonical));

    const engineUrl = u.enginePageUrl(b, item);
    const brandUrl = `${b}brands/${item.brandSlug}.html#halfcuts-inventory`;
    const thumbUrl = u.firstPhotoUrl(item);
    const gallery = u.hasPhotos(item)
      ? `<div class="half-cut-gallery" role="list">${item.photos.map((photo, index) => {
          const url = u.photoUrl(photo);
          const label = escapeHtml(photoLabel(photo, index));
          return `<figure class="half-cut-gallery__item" role="listitem" data-gallery-index="${index}">
            <button type="button" class="half-cut-gallery__zoom" aria-label="View ${label} full size">
              <img src="${url}" alt="${label}" loading="lazy">
              <span class="half-cut-gallery__zoom-hint">${t('hc.zoom', 'Zoom')}</span>
            </button>
            <figcaption>${label}</figcaption>
          </figure>`;
        }).join('')}</div>`
      : `<p class="half-cut-card__photos-note">${t('hc.photosOnRequest', 'Photos on request')}</p>`;
    const videoSection = u.hasVideo(item)
      ? `<section class="half-cut-detail__video">
          <h3 class="half-cut-detail__video-title">${t('hc.vehicleVideo', 'Vehicle Video')}</h3>
          ${u.renderVideoPlayer(item, { className: 'half-cut-detail__video-player', title: `${item.brand} ${item.model} video` })}
        </section>`
      : '';
    const supplierNotice = item.supplierVerified
      ? `<p class="half-cut-supplier-notice">${t('hc.supplierVerified', 'Supplier verified listing — inventory confirmed by AsiaPower supplier network before publication.')}</p>`
      : '';

    const vinRow = item.maskedVin
      ? `<div><dt>${t('spec.vin', 'VIN')}</dt><dd class="half-cut-detail__vin">${item.maskedVin}</dd></div>`
      : '';
    const conditionRow = item.vehicleCondition
      ? `<div><dt>${t('hc.condition', 'Condition')}</dt><dd>${item.vehicleCondition}</dd></div>`
      : '';
    const priceLabel = u.formatFobPrice(item);
    const priceRow = priceLabel
      ? `<div><dt>${t('spec.fobPrice', 'FOB Price (USD)')}</dt><dd class="half-cut-detail__price">${priceLabel}</dd></div>`
      : `<div><dt>${t('spec.fobPrice', 'FOB Price (USD)')}</dt><dd class="half-cut-detail__price half-cut-detail__price--enquiry">${t('hc.onEnquiry', 'On enquiry')}</dd></div>`;
    const priceHero = priceLabel
      ? `<p class="half-cut-detail__price-hero">${priceLabel} <span class="half-cut-detail__price-note">FOB</span></p>`
      : '';

    const statusLabel = window.PublicI18n?.translateStatus?.(item.status) || item.status;

    const ctaHeading = item.status === 'Sold'
      ? `${t('hc.ctaSold', 'Similar')} ${item.brand} ${item.model} ${cutLabel}`
      : `${t('hc.ctaExport', 'Export')} ${item.brand} ${item.model} ${cutLabel}`;

    const ctaText = item.status === 'Sold'
      ? `${t('hc.ctaSoldIntro', 'Stock ID')} <strong>${item.stockId}</strong> ${t('hc.ctaSoldRest', 'is sold. Reference this listing when requesting a similar unit.')}`
      : item.status === 'Reserved' || item.status === 'In Transit'
        ? `${t('hc.ctaSoldIntro', 'Stock ID')} <strong>${item.stockId}</strong> ${t('hc.ctaReservedRest', 'is reserved/in transit. Confirm availability or request a similar unit before export.')}`
        : `${t('hc.ctaSoldIntro', 'Stock ID')} <strong>${item.stockId}</strong>${t('hc.ctaAvailableRest', ' — reference for FOB/CIF quotation; availability confirmed on enquiry.')}`;

    const ctaButton = item.status === 'Available'
      ? u.leadLink(item, 'price', 'btn btn-accent', t('hc.contactTeam', 'Contact Sourcing Team'))
      : u.leadLink(item, 'similar', 'btn btn-accent', t('hc.requestSimilar', 'Request Similar Unit'));

    root.innerHTML = `
      <section class="page-hero page-hero--catalog">
        <div class="container">
          <div class="page-hero__breadcrumb">
            <a href="${b}index.html">${t('catalog.home', 'Home')}</a> /
            <a href="${catalogHref}">${catalogLabel}</a> /
            <a href="${brandUrl}">${item.brand}</a> /
            <span>${item.stockId}</span>
          </div>
          <h1>${item.title}</h1>
          ${priceHero}
          <p>${u.heroIntro(item)}</p>
          <p class="half-cut-disclaimer half-cut-disclaimer--hero">${u.inventoryDisclaimer || u.INVENTORY_DISCLAIMER}</p>
          ${supplierNotice}
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="engine-detail half-cut-detail">
            <div class="engine-detail__main">
              <span class="section-eyebrow">${item.origin} · ${cutLabel} · ${statusLabel}</span>
              <h2 class="half-cut-detail__stock-id">${item.stockId}</h2>
              ${gallery}
              ${videoSection}
              <dl class="engine-detail__specs half-cut-detail__specs">
                ${priceRow}
                <div><dt>${t('spec.brand', 'Brand')}</dt><dd><a href="${brandUrl}">${item.brand}</a></dd></div>
                <div><dt>${t('spec.model', 'Model')}</dt><dd>${item.model}</dd></div>
                <div><dt>${t('spec.year', 'Year')}</dt><dd>${item.year}</dd></div>
                <div><dt>${t('spec.engine', 'Engine Code')}</dt><dd>${engineUrl ? `<a href="${engineUrl}">${item.engineCode}</a>` : item.engineCode}</dd></div>
                <div><dt>${t('spec.transmission', 'Transmission')}</dt><dd>${window.PowertrainLabels?.formatTransmissionDisplay?.(item) || item.transmissionCode}</dd></div>
                <div><dt>${t('hc.drivetrain', 'Drivetrain')}</dt><dd>${item.drivetrain}</dd></div>
                <div><dt>${t('spec.mileage', 'Mileage')}</dt><dd>${item.mileage}</dd></div>
                ${vinRow}
                ${conditionRow}
                <div><dt>${t('hc.origin', 'Origin')}</dt><dd>${item.origin}</dd></div>
                <div><dt>${t('hc.status', 'Status')}</dt><dd><span class="half-cut-card__status half-cut-card__status--${u.statusSlug(item.status)}">${statusLabel}</span></dd></div>
              </dl>
              <h3 class="half-cut-detail__parts-title">${t('hc.includedParts', 'Included Parts')}</h3>
              <ul class="half-cut-detail__parts">
                ${(item.includedParts || []).map(part => `<li>${part}</li>`).join('')}
              </ul>
              <div class="engine-detail__actions half-cut-detail__actions">
                ${u.renderDetailActions(item, b)}
              </div>
            </div>
            <aside class="engine-detail__aside">
              <h3>${t('engine.browseBrand', 'Browse')} ${item.brand}</h3>
              <ul class="engine-detail__links">
                <li><a href="${brandUrl}">${item.brand} ${t('hc.halfCutListings', 'Half-Cut Listings')}</a></li>
                <li><a href="${b}brands/${item.brandSlug}.html#engines">${item.brand} ${t('engine.brandEngines', 'Engines')}</a></li>
                <li><a href="${b}brands/${item.brandSlug}.html#gearboxes">${item.brand} ${t('engine.brandGearboxes', 'Gearboxes')}</a></li>
              </ul>
              <h3>${t('hc.catalog', 'Catalog')}</h3>
              <ul class="engine-detail__links">
                <li><a href="${catalogHref}">${isMachinery ? t('machinery.allMachinery', 'All Machinery') : (isTruck ? t('trucks.allTrucks', 'All Trucks') : t('hc.allHalfCuts', 'All Half Cuts'))}</a></li>
                ${engineUrl ? `<li><a href="${engineUrl}">${item.engineCode} ${t('hc.enginePage', 'Engine Page')}</a></li>` : ''}
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section class="cta-block">
        <div class="container cta-block__inner">
          <div>
            <h2>${ctaHeading}</h2>
            <p>${ctaText}</p>
          </div>
          ${ctaButton}
        </div>
      </section>`;

    bindGalleryLightbox(root, item, u);
  }

  function bindGalleryLightbox(root, item, u) {
    window.HalfCutGalleryLightbox?.bindDetailGallery?.(root, item, u);
  }

  async function bootHalfCutDetailPage() {
    const slug = slugFromUrl();
    if (!slug) return;

    const prerender = readPrerenderItem();
    if (prerender?.slug) {
      renderHalfCutDetail(slug);
    }

    const Store = window.HalfCutInventoryStore;
    if (Store?.whenReady) {
      try {
        await Store.whenReady();
      } catch {
        // still attempt render from prerender / public fetch
      }
    }

    if (prerender?.slug) mergeCatalogItem(prerender);

    if (!resolveHalfCutItem(slug)) {
      const fetched = await fetchPublicItemBySlug(slug);
      if (fetched) mergeCatalogItem(fetched);
    }

    renderHalfCutDetail(slug);
  }

  function needsDetailRetry(root) {
    if (!root || !slugFromUrl()) return false;
    if (!root.innerHTML.trim()) return true;
    return /not found|未找到半车/i.test(root.textContent || '');
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
    if (!prerender?.slug) return;
    if (prerender.slug !== slug && !(prerender.slugAliases || []).includes(slug)) return;
    renderHalfCutDetail(slug);
  })();

  scheduleHalfCutDetailBoot();

  window.HalfCutDetailPage = { refresh: bootHalfCutDetailPage };

  window.addEventListener('asiapower:langchange', () => {
    if (currentSlug) renderHalfCutDetail(currentSlug);
  });
})();
