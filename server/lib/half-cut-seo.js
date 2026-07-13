'use strict';

const halfCutTitle = require('./half-cut-title');

const SITE_DEFAULT = 'https://asia-power.com';
const INVENTORY_DISCLAIMER = 'Whole-vehicle startup video available before dismantling. Parts can be dismantled according to buyer requirements after confirmation. Inventory is subject to final confirmation. Photos, price and shipping cost are confirmed on request before export.';

function isAvailable(item) {
  return item?.status === 'Available';
}

function isReserved(item) {
  return item?.status === 'Reserved';
}

function isSold(item) {
  return item?.status === 'Sold';
}

function listingTypeLabel(item) {
  if (item?.vehicleCategory === 'machinery') {
    return item.vehicleCondition || require('./machinery-brand-catalog').typeLabel(item?.machineryType);
  }
  if (item?.truckPartType === 'cab') return 'Driver Cab';
  if (item?.vehicleCategory === 'truck') return 'Truck Half Cut';
  return 'Half Cut';
}

function displayTitle(item, lang = 'en') {
  return halfCutTitle.buildDisplayTitle(item, lang)
    || item?.title
    || `${item.year} ${item.brand} ${item.model} ${listingTypeLabel(item)}`.replace(/\s+/g, ' ').trim();
}

function seoTitle(item) {
  const core = displayTitle(item);
  if (isReserved(item)) return `${core} — Reserved | AsiaPower`;
  if (isSold(item)) return `${core} — Sold | AsiaPower`;
  return `${core} | AsiaPower`;
}

function seoPriceSnippet(item) {
  const price = parsePriceUsd(item);
  if (!price) return '';
  const label = `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (isSold(item)) return `Reference EXW ${label} USD`;
  return `EXW ${label} USD`;
}

function seoDescription(item) {
  const typeLabel = listingTypeLabel(item).toLowerCase();
  const pricePart = seoPriceSnippet(item) ? `${seoPriceSnippet(item)}. ` : '';
  if (item?.vehicleCategory === 'machinery') {
    const engineHint = item.engineCode ? ` — ${item.engineCode} engine` : '';
    const hasVideo = !!(item?.video?.url || item?.videoUrl);
    const videoHint = hasVideo ? ' Whole-vehicle startup video available before dismantling.' : '';
    if (isAvailable(item)) {
      return `${item.brand} ${item.model} ${typeLabel} export from China${engineHint}.${videoHint} ${pricePart}Photos and shipping on request. Stock ${item.stockId}.`;
    }
    if (isReserved(item)) {
      return `Reserved ${item.brand} ${item.model} ${typeLabel}${engineHint}. ${pricePart}Confirm availability or request similar units. Stock ${item.stockId}.`;
    }
    return `Sold ${item.brand} ${item.model} ${typeLabel} reference${engineHint}. ${pricePart}Request similar available units. Stock ${item.stockId}.`;
  }
  if (isAvailable(item)) {
    return `${item.brand} ${item.model} half cut — ${item.engineCode} / ${item.transmissionCode}. ${pricePart}Photos and shipping on request. Stock ID ${item.stockId}.`;
  }
  if (isReserved(item)) {
    return `Reserved ${item.brand} ${item.model} half cut — ${item.engineCode} / ${item.transmissionCode}. ${pricePart}Confirm availability or request similar units. Stock ID ${item.stockId}.`;
  }
  return `Sold ${item.brand} ${item.model} half cut — ${item.engineCode} / ${item.transmissionCode}. ${pricePart}Request similar available units. Stock ID ${item.stockId}.`;
}

function canonicalUrl(siteUrl, slug, detailPath = '/half-cuts/detail.html') {
  const base = String(siteUrl || SITE_DEFAULT).replace(/\/$/, '');
  const pathPart = detailPath.startsWith('/') ? detailPath : `/${detailPath}`;
  return `${base}${pathPart}?slug=${encodeURIComponent(slug)}`;
}

function defaultProductImage(siteUrl) {
  const base = String(siteUrl || SITE_DEFAULT).replace(/\/$/, '');
  return `${base}/assets/images/supply-halfcut.jpg?v=img-v3`;
}

function productImages(item, siteUrl) {
  const images = [];
  if (Array.isArray(item.photos)) {
    item.photos.forEach((photo) => {
      const url = typeof photo === 'string' ? photo : photo?.url;
      if (url && !url.startsWith('data:')) {
        images.push(url.startsWith('http') ? url : `${String(siteUrl || SITE_DEFAULT).replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`);
      }
    });
  }
  if (!images.length) images.push(defaultProductImage(siteUrl));
  return images;
}

function offerAvailability(item) {
  if (isAvailable(item)) return 'https://schema.org/InStock';
  if (isReserved(item)) return 'https://schema.org/LimitedAvailability';
  if (item?.status === 'In Transit') return 'https://schema.org/LimitedAvailability';
  return 'https://schema.org/OutOfStock';
}

function parsePriceUsd(item) {
  const candidates = [item?.priceUsd, item?.priceUSD, item?.fobPriceUsd, item?.fobPrice, item?.price];
  for (const value of candidates) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return null;
}

function productJsonLd(item, siteUrl, detailPath = '/half-cuts/detail.html') {
  const canonical = canonicalUrl(siteUrl, item.slug, detailPath);
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: displayTitle(item),
    description: item.shortDescription || seoDescription(item),
    sku: item.stockId,
    image: productImages(item, siteUrl),
    brand: { '@type': 'Brand', name: item.brand },
    url: canonical,
  };
  const price = parsePriceUsd(item);
  if (price != null && !isSold(item)) {
    product.offers = {
      '@type': 'Offer',
      url: canonical,
      priceCurrency: 'USD',
      price: price.toFixed(2),
      availability: offerAvailability(item),
      itemCondition: 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: 'AsiaPower', url: String(siteUrl || SITE_DEFAULT).replace(/\/$/, '') },
    };
  }
  return product;
}

function isPartBoilerplate(line) {
  const text = String(line || '').trim();
  if (!text) return true;
  if (halfCutTitle.isRemarkBoilerplate(text)) return true;
  if (/^原始车型:|^原始说明:|^VIN OCR|^VIN decode|^子龙预估|^transmission /i.test(text)) return true;
  if (/^999 km|^仅为占位|占位，不代表真实里程/i.test(text)) return true;
  return false;
}

function sanitizeIncludedParts(parts) {
  return (parts || []).filter((part) => !isPartBoilerplate(part));
}

function catalogContext(item, base) {
  const isTruck = item?.vehicleCategory === 'truck';
  const isMachinery = item?.vehicleCategory === 'machinery';
  return {
    isTruck,
    isMachinery,
    catalogLabel: isMachinery ? 'Machinery' : (isTruck ? 'Trucks' : 'Half-Cuts'),
    catalogHref: isMachinery ? `${base}machinery/` : (isTruck ? `${base}trucks/` : `${base}half-cuts/`),
    cutLabel: isMachinery
      ? (item.vehicleCondition || 'Construction Equipment')
      : (isTruck ? 'Truck Half Cut' : 'Half Cut'),
  };
}

function renderBuyBoxActions(item, base) {
  const contact = `${base}contact.html?stock=${encodeURIComponent(item.stockId || '')}&slug=${encodeURIComponent(item.slug || '')}`;
  const pageUrl = `${SITE_DEFAULT}/half-cuts/detail.html?slug=${encodeURIComponent(item.slug || '')}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
  const waText = [
    'Hello AsiaPower,',
    `Stock ID: ${item.stockId || ''}`,
    `Brand: ${item.brand || ''}`,
    `Model: ${item.model || ''}`,
    `Listing: ${pageUrl}`,
    'Please send price, photos and shipping options.',
  ].join('\n');
  const wa = `https://wa.me/8616638801930?text=${encodeURIComponent(waText)}`;
  if (item.status === 'Available') {
    return [
      `<a class="hc-item-detail__btn hc-item-detail__btn--primary" href="${contact}">Contact Sourcing Team</a>`,
      `<a class="hc-item-detail__btn hc-item-detail__btn--secondary hc-item-detail__btn--facebook" href="${fb}" target="_blank" rel="noopener noreferrer">Share on Facebook</a>`,
      `<a class="hc-item-detail__btn hc-item-detail__btn--secondary hc-item-detail__btn--whatsapp" href="${wa}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`,
    ].join('');
  }
  return `<a class="hc-item-detail__btn hc-item-detail__btn--primary" href="${contact}">Request Similar Unit</a>`;
}

function renderCifShell(exwUsd) {
  const hasExw = Number.isFinite(Number(exwUsd)) && Number(exwUsd) > 0;
  return `<section class="hc-cif-calc" data-cif-calculator aria-labelledby="hc-cif-heading">
      <h3 class="hc-cif-calc__title" id="hc-cif-heading">CIF Calculator</h3>
      <p class="hc-cif-calc__lead">Indicative ocean freight &amp; marine insurance to your port.</p>
      <form class="hc-cif-calc__form" data-cif-form novalidate>
        <label class="hc-cif-calc__field">
          <span>Destination port</span>
          <select name="portId" data-cif-port required>
            <option value="">Loading ports…</option>
          </select>
        </label>
        <label class="hc-cif-calc__field">
          <span>EXW (this unit)</span>
          <div class="hc-cif-calc__exw-row">
            <span class="hc-cif-calc__currency">USD</span>
            <input type="number" name="exwUsd" data-cif-exw min="0" step="50" value="${hasExw ? Number(exwUsd) : ''}" placeholder="Enter EXW quote"${hasExw ? ' readonly' : ''}>
          </div>
        </label>
        <div class="hc-cif-calc__results" data-cif-results hidden>
          <dl class="hc-cif-calc__breakdown">
            <div><dt>Ocean freight</dt><dd data-cif-freight>—</dd></div>
            <div><dt>Marine insurance</dt><dd data-cif-insurance>—</dd></div>
          </dl>
          <div class="hc-cif-calc__total">
            <span>Est. CIF total</span>
            <strong data-cif-total>—</strong>
          </div>
          <p class="hc-cif-calc__note" data-cif-note></p>
        </div>
        <p class="hc-cif-calc__status" data-cif-status aria-live="polite"></p>
        <p class="hc-cif-calc__disclaimer">Indicative only — final CIF confirmed on enquiry. Destination duties &amp; local port charges not included.</p>
      </form>
    </section>`;
}

function buildDetailRootHtml(item, siteUrl) {
  const base = '../';
  const titleText = displayTitle(item);
  const ctx = catalogContext(item, base);
  const price = parsePriceUsd(item);
  const priceHtml = price
    ? `<div class="hc-item-detail__price">$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="ap-exw-badge" translate="no">EXW</span></div>`
    : `<div class="hc-item-detail__price hc-item-detail__price--enquiry">Quote on enquiry <span class="ap-exw-badge" translate="no">EXW</span></div>`;
  const photos = Array.isArray(item.photos) ? item.photos.filter(Boolean) : [];
  const absUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${String(siteUrl || SITE_DEFAULT).replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
  };
  const gallery = photos.length
    ? `<div class="hc-item-detail__gallery-wrap">
        <div class="ap-photo-viewer hc-item-detail__viewer" data-ap-photo-viewer>
          <div class="ap-photo-viewer__stage">
            <span class="hc-item-detail__photo-badge">${escapeHtml(item.stockId || '')}</span>
            <figure class="ap-photo-viewer__figure"><img class="ap-photo-viewer__img" src="${escapeAttr(absUrl(typeof photos[0] === 'string' ? photos[0] : (photos[0]?.url || '')))}" alt="${escapeHtml(titleText)}" decoding="async"></figure>
          </div>
        </div>
        ${photos.length > 1 ? `<div class="hc-item-detail__thumbs-col"><div class="hc-item-detail__thumbs">${photos.map((photo, index) => {
          const url = absUrl(typeof photo === 'string' ? photo : (photo?.url || ''));
          const active = index === 0 ? ' is-active' : '';
          return `<button type="button" class="hc-item-detail__thumb${active}" data-photo-index="${index}" aria-selected="${index === 0 ? 'true' : 'false'}"><img src="${escapeAttr(url)}" alt="" loading="lazy"></button>`;
        }).join('')}</div></div>` : ''}
      </div>`
    : `<div class="hc-item-detail__gallery hc-item-detail__gallery--empty"><div class="hc-item-detail__placeholder"><span>Photos on request</span></div></div>`;
  const parts = sanitizeIncludedParts(Array.isArray(item.includedParts) ? item.includedParts : []);
  const intro = escapeHtml(`${titleText}. EXW export from China — availability, photos and CIF shipping confirmed on enquiry.`);
  const specRow = (label, value) => (value ? `<div class="hc-item-detail__spec"><dt>${label}</dt><dd>${value}</dd></div>` : '');
  const brandUrl = `${base}brands/${escapeAttr(item.brandSlug)}.html#halfcuts-inventory`;
  const vehicleInfoHtml = [
    specRow('Brand', `<a href="${brandUrl}">${escapeHtml(item.brand || '')}</a>`),
    specRow('Model', escapeHtml(item.model || '')),
    specRow('Year', escapeHtml(String(item.year || ''))),
    specRow('Engine Code', escapeHtml(item.engineCode || '')),
    specRow('Transmission', escapeHtml(item.transmissionCode || '')),
    specRow('Drivetrain', escapeHtml(item.drivetrain || '')),
    specRow('Mileage', escapeHtml(item.mileage || '')),
    item.maskedVin ? specRow('VIN', `<span class="half-cut-detail__vin">${escapeHtml(item.maskedVin)}</span>`) : '',
    specRow('Condition', escapeHtml(item.vehicleCondition || ctx.cutLabel)),
    specRow('Origin', escapeHtml(item.origin || '')),
    specRow('Status', escapeHtml(item.status || '')),
    specRow('Stock ID', `<strong>${escapeHtml(item.stockId || '')}</strong>`),
  ].filter(Boolean).join('');

  return `
<section class="hc-item-detail">
  <div class="container">
    <nav class="hc-item-detail__crumb" aria-label="Breadcrumb">
      <a href="${base}index.html">Home</a><span aria-hidden="true">›</span>
      <a href="${ctx.catalogHref}">${ctx.catalogLabel}</a><span aria-hidden="true">›</span>
      <a href="${brandUrl}">${escapeHtml(item.brand)}</a><span aria-hidden="true">›</span>
      <span>${escapeHtml(item.stockId)}</span>
    </nav>
    <div class="hc-item-detail__layout">
      <div class="hc-item-detail__media-col">${gallery}</div>
      <aside class="hc-item-detail__buybox" aria-label="View Details">
        <p class="hc-item-detail__secure">Verified export listing</p>
        <h1 class="hc-item-detail__title">${escapeHtml(titleText)}</h1>
        <p class="hc-item-detail__stock">${escapeHtml(item.stockId)} · ${escapeHtml(item.status || 'Available')}</p>
        ${priceHtml}
        <section class="hc-item-detail__seller-card">
          <h2 class="hc-item-detail__section-label">Seller</h2>
          <div class="hc-item-detail__seller">
            <div class="hc-item-detail__seller-mark" aria-hidden="true">AP</div>
            <div class="hc-item-detail__seller-body"><strong>AsiaPower Sourcing</strong><span>China export network · B2B only</span></div>
            <a class="hc-item-detail__seller-msg" href="${base}contact.html">Message</a>
          </div>
          <p class="hc-item-detail__ship">Ships from China · EXW Zhengzhou · CIF on request</p>
        </section>
        <div class="hc-item-detail__actions">${renderBuyBoxActions(item, base)}</div>
      </aside>
    </div>
    <div class="hc-item-detail__lower">
      <div class="hc-item-detail__main-col">
        <section class="hc-item-detail__panel hc-item-detail__panel--about">
          <h2 class="hc-item-detail__panel-title">About this item</h2>
          <p class="hc-item-detail__about">${intro}</p>
          <div class="hc-item-detail__about-vehicle" aria-label="Vehicle information">
            <h3 class="hc-item-detail__about-subtitle">Vehicle information</h3>
            <dl class="hc-item-detail__specifics hc-item-detail__specifics--about">${vehicleInfoHtml}</dl>
          </div>
          ${parts.length ? `<h3 class="half-cut-detail__parts-title">Included Parts</h3><ul class="half-cut-detail__parts">${parts.map((part) => `<li>${escapeHtml(part)}</li>`).join('')}</ul>` : ''}
          <p class="hc-item-detail__about-disclaimer">${INVENTORY_DISCLAIMER}</p>
        </section>
      </div>
      <aside class="hc-item-detail__side-col">
        ${renderCifShell(price)}
        <h3>Browse ${escapeHtml(item.brand)}</h3>
        <ul class="engine-detail__links">
          <li><a href="${brandUrl}">${escapeHtml(item.brand)} Half-Cut Listings</a></li>
          <li><a href="${base}brands/${escapeAttr(item.brandSlug)}.html#engines">${escapeHtml(item.brand)} Engines</a></li>
          <li><a href="${base}brands/${escapeAttr(item.brandSlug)}.html#gearboxes">${escapeHtml(item.brand)} Gearboxes</a></li>
        </ul>
        <h3>Catalog</h3>
        <ul class="engine-detail__links">
          <li><a href="${ctx.catalogHref}">${ctx.isMachinery ? 'All Machinery' : (ctx.isTruck ? 'All Trucks' : 'All Half Cuts')}</a></li>
        </ul>
      </aside>
    </div>
  </div>
</section>`;
}

function noscriptSummary(item) {
  const lines = [
    `<h1>${escapeHtml(displayTitle(item))}</h1>`,
    `<p>${escapeHtml(item.shortDescription || seoDescription(item))}</p>`,
    '<dl>',
    `<dt>Stock ID</dt><dd>${escapeHtml(item.stockId)}</dd>`,
    `<dt>Brand</dt><dd>${escapeHtml(item.brand)}</dd>`,
    `<dt>Model</dt><dd>${escapeHtml(item.model)}</dd>`,
    `<dt>Year</dt><dd>${escapeHtml(String(item.year || ''))}</dd>`,
    `<dt>Engine</dt><dd>${escapeHtml(item.engineCode || '')}</dd>`,
    `<dt>Transmission</dt><dd>${escapeHtml(item.transmissionCode || '')}</dd>`,
    `<dt>Status</dt><dd>${escapeHtml(item.status || '')}</dd>`,
    '</dl>',
  ];
  return lines.join('\n');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

module.exports = {
  seoTitle,
  seoDescription,
  canonicalUrl,
  productJsonLd,
  buildDetailRootHtml,
  noscriptSummary,
  displayTitle,
  listingTypeLabel,
  escapeHtml,
  escapeAttr,
};
