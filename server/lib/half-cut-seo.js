'use strict';

const SITE_DEFAULT = 'https://asia-power.com';

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

function seoTitle(item) {
  const typeLabel = listingTypeLabel(item);
  const enginePart = item.engineCode ? ` ${item.engineCode}` : '';
  const transPart = item.transmissionCode && item.vehicleCategory !== 'machinery' ? ` ${item.transmissionCode}` : '';
  const core = `${item.year} ${item.brand} ${item.model} ${typeLabel}${enginePart}${transPart}`.replace(/\s+/g, ' ').trim();
  if (isReserved(item)) return `${core} — Reserved | AsiaPower`;
  if (isSold(item)) return `${core} — Sold | AsiaPower`;
  return `${core} | AsiaPower`;
}

function seoDescription(item) {
  const typeLabel = listingTypeLabel(item).toLowerCase();
  if (item?.vehicleCategory === 'machinery') {
    const engineHint = item.engineCode ? ` — ${item.engineCode} engine` : '';
    const hasVideo = !!(item?.video?.url || item?.videoUrl);
    const videoHint = hasVideo ? ' Whole-vehicle startup video available before dismantling.' : '';
    if (isAvailable(item)) {
      return `${item.brand} ${item.model} ${typeLabel} export from China${engineHint}.${videoHint} Request FOB price and shipping from AsiaPower. Stock ${item.stockId}.`;
    }
    if (isReserved(item)) {
      return `Reserved ${item.brand} ${item.model} ${typeLabel}${engineHint}. Confirm availability or request similar units. Stock ${item.stockId}.`;
    }
    return `Sold ${item.brand} ${item.model} ${typeLabel} reference${engineHint}. Request similar available units. Stock ${item.stockId}.`;
  }
  if (isAvailable(item)) {
    return `${item.brand} ${item.model} half cut listing with ${item.engineCode} engine and ${item.transmissionCode} transmission. Request price, photos and shipping from AsiaPower. Stock ID ${item.stockId}.`;
  }
  if (isReserved(item)) {
    return `Reserved ${item.brand} ${item.model} half cut reference — ${item.engineCode} / ${item.transmissionCode}. Confirm availability or request similar units. Stock ID ${item.stockId}.`;
  }
  return `Sold ${item.brand} ${item.model} half cut reference — ${item.engineCode} / ${item.transmissionCode}. Request similar available units. Stock ID ${item.stockId}.`;
}

function canonicalUrl(siteUrl, slug) {
  const base = String(siteUrl || SITE_DEFAULT).replace(/\/$/, '');
  return `${base}/half-cuts/detail.html?slug=${encodeURIComponent(slug)}`;
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

function productJsonLd(item, siteUrl) {
  const canonical = canonicalUrl(siteUrl, item.slug);
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.title,
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

function buildDetailRootHtml(item, siteUrl) {
  const canonical = canonicalUrl(siteUrl, item.slug);
  const price = parsePriceUsd(item);
  const priceHtml = price
    ? `<p class="half-cut-detail__price-hero">$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="half-cut-detail__price-note">FOB</span></p>`
    : '';
  const photos = Array.isArray(item.photos) ? item.photos.filter(Boolean) : [];
  const gallery = photos.length
    ? `<div class="half-cut-gallery" role="list">${photos.map((photo, index) => {
        const url = typeof photo === 'string' ? photo : (photo?.url || '');
        const abs = url.startsWith('http') ? url : `${String(siteUrl || SITE_DEFAULT).replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
        const label = escapeHtml(typeof photo === 'object' && photo.label ? photo.label : `Photo ${index + 1}`);
        return `<figure class="half-cut-gallery__item" role="listitem"><img src="${escapeAttr(abs)}" alt="${label}" loading="lazy"><figcaption>${label}</figcaption></figure>`;
      }).join('')}</div>`
    : '';
  const parts = Array.isArray(item.includedParts) ? item.includedParts : [];
  return `
<section class="page-hero page-hero--catalog">
  <div class="container">
    <div class="page-hero__breadcrumb">
      <a href="../index.html">Home</a> /
      <a href="../half-cuts/">Half-Cuts</a> /
      <a href="../brands/${escapeAttr(item.brandSlug)}.html#halfcuts-inventory">${escapeHtml(item.brand)}</a> /
      <span>${escapeHtml(item.stockId)}</span>
    </div>
    <h1>${escapeHtml(item.title)}</h1>
    ${priceHtml}
    <p>${escapeHtml(item.shortDescription || seoDescription(item))}</p>
  </div>
</section>
<section class="section">
  <div class="container">
    <div class="engine-detail half-cut-detail">
      <div class="engine-detail__main">
        <span class="section-eyebrow">${escapeHtml(item.origin || 'China')} · Half Cut · ${escapeHtml(item.status || 'Available')}</span>
        <h2 class="half-cut-detail__stock-id">${escapeHtml(item.stockId)}</h2>
        ${gallery}
        <dl class="engine-detail__specs half-cut-detail__specs">
          <div><dt>Brand</dt><dd>${escapeHtml(item.brand)}</dd></div>
          <div><dt>Model</dt><dd>${escapeHtml(item.model)}</dd></div>
          <div><dt>Year</dt><dd>${escapeHtml(String(item.year || ''))}</dd></div>
          <div><dt>Engine Code</dt><dd>${escapeHtml(item.engineCode || '')}</dd></div>
          <div><dt>Transmission</dt><dd>${escapeHtml(item.transmissionCode || '')}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(item.status || '')}</dd></div>
        </dl>
        ${parts.length ? `<h3 class="half-cut-detail__parts-title">Included Parts</h3><ul class="half-cut-detail__parts">${parts.map((part) => `<li>${escapeHtml(part)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>
  </div>
</section>`;
}

function noscriptSummary(item) {
  const lines = [
    `<h1>${escapeHtml(item.title)}</h1>`,
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
  escapeHtml,
  escapeAttr,
};
