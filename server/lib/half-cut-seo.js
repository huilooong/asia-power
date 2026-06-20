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

function seoTitle(item) {
  const core = `${item.year} ${item.brand} ${item.model} Half Cut ${item.engineCode} ${item.transmissionCode}`;
  if (isReserved(item)) return `${core} — Reserved | AsiaPower`;
  if (isSold(item)) return `${core} — Sold | AsiaPower`;
  return `${core} | AsiaPower`;
}

function seoDescription(item) {
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
  noscriptSummary,
  escapeHtml,
  escapeAttr,
};
