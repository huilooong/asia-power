'use strict';

const halfCutTitle = require('./half-cut-title');

const SITE_DEFAULT = 'https://asia-power.com';
const INVENTORY_DISCLAIMER = 'Whole-vehicle startup video available before dismantling. Parts can be dismantled according to buyer requirements after confirmation. Inventory is subject to final confirmation. Photos, price and shipping cost are confirmed on request before export.';
const EXPORT_USED_CAR_DISCLAIMER = 'This listing is a complete, undismantled used vehicle for whole-vehicle export. Export shipment proceeds only after registration, inspection, export licensing and destination-market requirements are verified for the order.';

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
  if (halfCutTitle.isExportUsedCarListing(item)) return 'Export Used Car';
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
  if (halfCutTitle.isExportUsedCarListing(item)) {
    const fuel = item?.vinSpecs?.fuelType || item?.fuelType || '';
    const drive = item?.vinSpecs?.drivetrain || item?.drivetrain || '';
    const configHint = [fuel, drive].filter(Boolean).join(', ');
    const configText = configHint ? ` — ${configHint}` : '';
    if (isAvailable(item)) {
      return `${item.brand} ${item.model} export used car${configText}. ${pricePart}VIN configuration, condition evidence and destination eligibility are confirmed before shipment. Stock ${item.stockId}.`;
    }
    if (isReserved(item)) {
      return `Reserved ${item.brand} ${item.model} export used car${configText}. ${pricePart}Confirm availability and document review status. Stock ${item.stockId}.`;
    }
    return `Sold ${item.brand} ${item.model} export used car reference${configText}. ${pricePart}Request similar available vehicles. Stock ${item.stockId}.`;
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

function isExportUsedCarPathItem(item) {
  if (!item) return false;
  if (item.vehicleCategory === 'truck' || item.vehicleCategory === 'machinery') return false;
  if (halfCutTitle.isExportUsedCarListing(item)) return true;
  if (item.isExportUsedCar === true) return true;
  return String(item.vehicleCondition || '').trim().toLowerCase() === 'running vehicle';
}

function resolveDetailPath(item) {
  if (item?.vehicleCategory === 'truck') return '/trucks/detail.html';
  if (item?.vehicleCategory === 'machinery') return '/machinery/detail.html';
  if (isExportUsedCarPathItem(item)) return '/used-cars/detail.html';
  return '/half-cuts/detail.html';
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

/** Extract YouTube id from watch / youtu.be / embed / shorts, or item.youtubeVideoId. */
function youtubeVideoId(itemOrUrl) {
  if (itemOrUrl && typeof itemOrUrl === 'object') {
    const direct = String(itemOrUrl.youtubeVideoId || itemOrUrl.video?.youtubeId || '').trim();
    if (direct) return direct;
    return youtubeVideoId(itemOrUrl.video?.url || itemOrUrl.videoUrl || '');
  }
  const raw = String(itemOrUrl || '').trim();
  if (!raw) return '';
  let m = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m) return m[1];
  m = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:embed|shorts|live)\/)([a-zA-Z0-9_-]{6,})/i);
  return m ? m[1] : '';
}

function absoluteMediaUrl(url, siteUrl) {
  const raw = String(url || '').trim();
  if (!raw || raw.startsWith('data:')) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = String(siteUrl || SITE_DEFAULT).replace(/\/$/, '');
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

/**
 * VideoObject for GSC / Google video features after migrating playback to YouTube.
 * Prefer embedUrl (YouTube). Keep contentUrl only for first-party /uploads/videos files.
 */
function videoObjectJsonLd(item, siteUrl, detailPath = '/half-cuts/detail.html') {
  const ytId = youtubeVideoId(item);
  const rawUrl = String(item?.video?.url || item?.videoUrl || '').trim();
  const selfHosted = absoluteMediaUrl(
    rawUrl.includes('/uploads/videos/') ? rawUrl : (item?.video?.sourceLocalPath || ''),
    siteUrl,
  );
  // Only advertise self-hosted contentUrl when the public URL is still a site mp4
  // (not a YouTube watch page). YouTube playback uses embedUrl.
  const contentUrl = rawUrl.includes('/uploads/videos/') ? absoluteMediaUrl(rawUrl, siteUrl) : '';
  if (!ytId && !contentUrl) return null;

  const images = productImages(item, siteUrl);
  const thumb = ytId
    ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`
    : (images[0] || defaultProductImage(siteUrl));
  const name = `${displayTitle(item)} — startup video`;
  const description = item.shortDescription || seoDescription(item);
  const uploadDate = item.updatedAt || item.createdAt || item.approvedAt || item.listedAt || null;
  const video = {
    '@type': 'VideoObject',
    name,
    description,
    thumbnailUrl: [thumb],
    url: canonicalUrl(siteUrl, item.slug, detailPath),
  };
  if (uploadDate) video.uploadDate = String(uploadDate).slice(0, 10);
  if (ytId) video.embedUrl = `https://www.youtube.com/embed/${ytId}`;
  if (contentUrl) video.contentUrl = contentUrl;
  else if (selfHosted && selfHosted.includes('/uploads/videos/') && !ytId) {
    video.contentUrl = selfHosted;
  }
  return video;
}

function productJsonLd(item, siteUrl, detailPath = '/half-cuts/detail.html') {
  const canonical = canonicalUrl(siteUrl, item.slug, detailPath);
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: displayTitle(item),
    description: halfCutTitle.isExportUsedCarListing(item)
      ? seoDescription(item)
      : (item.shortDescription || seoDescription(item)),
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
  const video = videoObjectJsonLd(item, siteUrl, detailPath);
  if (video) product.video = video;
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
  const isUsedCar = isExportUsedCarPathItem(item);
  return {
    isTruck,
    isMachinery,
    isUsedCar,
    catalogLabel: isMachinery ? 'Machinery' : (isTruck ? 'Trucks' : (isUsedCar ? 'Export Used Cars' : 'Half-Cuts')),
    catalogHref: isMachinery ? `${base}machinery/` : (isTruck ? `${base}trucks/` : (isUsedCar ? `${base}half-cuts/?cat=used-cars` : `${base}half-cuts/`)),
    cutLabel: isMachinery
      ? (item.vehicleCondition || 'Construction Equipment')
      : (isTruck ? 'Truck Half Cut' : (isUsedCar ? 'Export Used Car' : 'Half Cut')),
  };
}

function renderBuyBoxActions(item, base) {
  const contact = `${base}contact.html?stock=${encodeURIComponent(item.stockId || '')}&slug=${encodeURIComponent(item.slug || '')}`;
  const pageUrl = `${SITE_DEFAULT}${resolveDetailPath(item)}?slug=${encodeURIComponent(item.slug || '')}`;
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

function renderExportUsedCarIdentity(item) {
  if (!isExportUsedCarPathItem(item)) return '';
  const supplierDeclared = item.exportSupplierDeclaration === true || halfCutTitle.hasExportReadyRemark(item);
  const documentsVerified = String(item.exportDocumentationStatus || '').trim() === 'verified';
  const supplierText = supplierDeclared
    ? 'Whole-vehicle export availability declared by supplier'
    : 'Whole-vehicle export declaration not recorded';
  const documentText = documentsVerified
    ? 'Export document review verified by AsiaPower'
    : 'AsiaPower document review pending — confirmed before contract and shipment';
  return `<section class="hc-item-detail__about-vehicle" aria-label="Export vehicle identity">
            <h3 class="hc-item-detail__about-subtitle">Complete vehicle &amp; export status</h3>
            <dl class="hc-item-detail__specifics hc-item-detail__specifics--about">
              <div class="hc-item-detail__spec"><dt>Vehicle identity</dt><dd>Complete late-model used vehicle · VIN-listed · not dismantled</dd></div>
              <div class="hc-item-detail__spec"><dt>Supplier declaration</dt><dd>${supplierText}</dd></div>
              <div class="hc-item-detail__spec"><dt>AsiaPower document review</dt><dd>${documentText}</dd></div>
              <div class="hc-item-detail__spec"><dt>China export condition</dt><dd>Registration, inspection, export licence and destination compliance required before shipment</dd></div>
            </dl>
          </section>`;
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

function usedCarCoreTitle(item) {
  return [item?.vinSpecs?.modelYear || item?.year, item?.brand, item?.model]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function usedCarBodyDescription(item) {
  const specs = item?.vinSpecs || {};
  const doors = Number(specs.doors);
  const seats = Number(specs.seats);
  const configuration = String(specs.bodyConfiguration || '').trim();
  const style = /\u4e24\u53a2\u8f66/.test(configuration)
    ? 'Hatchback'
    : (/\u4e09\u53a2\u8f66/.test(configuration) ? 'Sedan' : String(specs.bodyStyle || item?.bodyType || '').trim());
  const parts = [
    Number.isFinite(doors) && doors > 0 ? `${doors}-door` : '',
    Number.isFinite(seats) && seats > 0 ? `${seats}-seat` : '',
    style,
  ].filter(Boolean);
  return parts.join(', ').replace(style ? `, ${style}` : '$^', style ? ` ${style}` : '');
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

function renderUsedCarDetailRootHtml(item, siteUrl) {
  const base = '../';
  const specs = item.vinSpecs || {};
  const titleText = usedCarCoreTitle(item);
  const price = parsePriceUsd(item);
  const priceText = price ? `US$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'Quote on enquiry';
  const catalogHref = `${base}half-cuts/?cat=used-cars`;
  const brandUrl = `${catalogHref}&amp;brand=${escapeAttr(item.brandSlug || '')}`;
  const photos = Array.isArray(item.photos) ? item.photos.filter(Boolean) : [];
  const absUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${String(siteUrl || SITE_DEFAULT).replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
  };
  const gallery = photos.length
    ? `<div class="hc-item-detail__gallery-wrap"><div class="ap-photo-viewer hc-item-detail__viewer" data-ap-photo-viewer><div class="ap-photo-viewer__stage"><span class="hc-item-detail__photo-badge">Available</span><figure class="ap-photo-viewer__figure"><img class="ap-photo-viewer__img" src="${escapeAttr(absUrl(typeof photos[0] === 'string' ? photos[0] : photos[0]?.url || ''))}" alt="${escapeAttr(titleText)}" decoding="async"></figure></div></div>${photos.length > 1 ? `<div class="hc-item-detail__thumbs-col"><div class="hc-item-detail__thumbs">${photos.slice(0, 10).map((photo, index) => `<button type="button" class="hc-item-detail__thumb${index === 0 ? ' is-active' : ''}" data-photo-index="${index}" aria-selected="${index === 0 ? 'true' : 'false'}"><img src="${escapeAttr(absUrl(typeof photo === 'string' ? photo : photo?.thumbUrl || photo?.url || ''))}" alt="" loading="lazy"></button>`).join('')}</div></div>` : ''}</div>`
    : `<div class="hc-item-detail__gallery hc-item-detail__gallery--empty"><div class="hc-item-detail__placeholder"><span>Photos on request</span></div></div>`;
  const contact = `${base}contact.html?stock=${encodeURIComponent(item.stockId || '')}&amp;slug=${encodeURIComponent(item.slug || '')}`;
  const pageUrl = `${SITE_DEFAULT}/used-cars/detail.html?slug=${encodeURIComponent(item.slug || '')}`;
  const waText = `Hello AsiaPower,\nStock ID: ${item.stockId || ''}\nVehicle: ${titleText}\nListing: ${pageUrl}\nPlease confirm availability and CIF price.`;
  const whatsapp = `https://wa.me/8616638801930?text=${encodeURIComponent(waText)}`;
  const actionLabel = item.status === 'Available' ? 'Request CIF quote' : 'Request Similar Unit';
  const bodyText = usedCarBodyDescription(item) || specs.bodyConfiguration || specs.bodyStyle || item.bodyType || '';
  const trimLine = [specs.trimRangeKm ? `${specs.trimRangeKm} km variant` : '', specs.drivetrainDisplay || specs.drivetrain || item.drivetrain].filter(Boolean).join(' · ');
  const row = (label, value, note = '') => value == null || String(value).trim() === '' ? '' : `<div class="uc-vdp__spec"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}${note ? `<small>${escapeHtml(note)}</small>` : ''}</dd></div>`;
  const tire = specs.frontTire || specs.rearTire ? [specs.frontTire ? `${specs.frontTire} front` : '', specs.rearTire ? `${specs.rearTire} rear` : ''].filter(Boolean).join(' · ') : '';
  const specRows = [
    row('Model year', specs.modelYear || item.year),
    row('Factory trim (CN)', specs.trimName || item.trimName),
    row('Fuel type', specs.fuelType || item.fuelType),
    row('Drivetrain', specs.drivetrainDisplay || specs.drivetrain || item.drivetrain),
    row('Transmission', usedCarTransmission(item)),
    row('Body configuration', bodyText),
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
  const condition = (title, body, confirmed = false) => `<div class="uc-vdp__condition-row${confirmed ? ' is-confirmed' : ''}"><span class="uc-vdp__condition-icon" aria-hidden="true">${confirmed ? '✓' : '○'}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div><span class="uc-vdp__condition-status">${confirmed ? 'Confirmed' : 'Pending'}</span></div>`;
  const documentStatus = item.exportDocumentationStatus === 'verified';

  return `<section class="uc-vdp"><div class="container">
    <nav class="uc-vdp__crumb" aria-label="Breadcrumb"><a href="${base}index.html">Home</a><span>/</span><a href="${catalogHref}">Export Used Cars</a><span>/</span><a href="${brandUrl}">${escapeHtml(item.brand)}</a><span>/</span><span>${escapeHtml(item.stockId)}</span></nav>
    <div class="uc-vdp__hero"><div class="uc-vdp__gallery">${gallery}</div><aside class="uc-vdp__summary" aria-label="Vehicle summary">
      <div class="uc-vdp__eyebrow"><span>${escapeHtml([item.brand, specs.fuelType || item.fuelType, bodyText].filter(Boolean).join(' · '))}</span><span>Stock ${escapeHtml(item.stockId)}</span></div>
      <h1>${escapeHtml(titleText)}</h1>${trimLine ? `<p class="uc-vdp__trim">${escapeHtml(trimLine)}</p>` : ''}
      <div class="uc-vdp__price"><div><span>EXW vehicle price</span><strong>${escapeHtml(priceText)}</strong></div><span>CIF quote available</span></div>
      <dl class="uc-vdp__quick-facts"><div><dt>Mileage</dt><dd>${escapeHtml(item.mileage || 'Confirm on enquiry')}</dd></div><div><dt>Powertrain</dt><dd>${escapeHtml(specs.fuelType || item.fuelType || 'Confirm on enquiry')}</dd></div><div><dt>Drive</dt><dd>${escapeHtml(specs.drivetrain || item.drivetrain || '—')}</dd></div><div><dt>Transmission</dt><dd>${escapeHtml(usedCarTransmission(item) || '—')}</dd></div><div><dt>Body</dt><dd>${escapeHtml(bodyText || '—')}</dd></div><div><dt>Seats</dt><dd>${escapeHtml(String(specs.seats || '—'))}</dd></div></dl>
      <div class="uc-vdp__actions"><a class="uc-vdp__button uc-vdp__button--primary" href="${contact}">${actionLabel}</a><a class="uc-vdp__button uc-vdp__button--whatsapp" href="${whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>
      <p class="uc-vdp__availability"><span aria-hidden="true">✓</span> ${escapeHtml(item.status || 'Available')} · availability and final vehicle condition are reconfirmed before order.</p>
    </aside></div>
    <div class="uc-vdp__content-layout"><div class="uc-vdp__content-main">
      <section class="uc-vdp__panel"><div class="uc-vdp__section-head"><div><span>Vehicle overview</span><h2>Factory configuration decoded from VIN</h2></div><em>✓ VIN matched</em></div><p class="uc-vdp__intro">These fields identify the original factory model and configuration. They do not replace a physical condition inspection or battery health report.</p><dl class="uc-vdp__spec-grid">${specRows}</dl></section>
      <section class="uc-vdp__panel"><div class="uc-vdp__section-head"><div><span>Condition &amp; history</span><h2>What is verified—and what is still pending</h2></div></div><div class="uc-vdp__condition-list">${condition('Identity and factory configuration', 'VIN decoder matched the vehicle series, model year and factory trim.', true)}${condition('Battery state of health', 'A diagnostic battery report has not yet been uploaded. Request it before contracting.')}${condition('Accident, flood and fire history', 'Physical inspection and supporting history documents are still required.')}${condition('Exterior and interior condition report', 'Inventory photos are available; a standardized inspection sheet is still pending.')}</div></section>
      <section class="uc-vdp__panel"><div class="uc-vdp__section-head"><div><span>Vehicle identity</span><h2>VIN and listing reference</h2></div></div><div class="uc-vdp__identity-grid">${item.maskedVin ? `<div><span>Masked VIN</span><strong class="uc-vdp__vin">${escapeHtml(item.maskedVin)}</strong></div>` : ''}<div><span>Stock ID</span><strong>${escapeHtml(item.stockId)}</strong></div><div><span>Origin</span><strong>${escapeHtml(item.origin || 'China')}</strong></div><div><span>Listing status</span><strong>${escapeHtml(item.status || 'Available')}</strong></div></div><p class="uc-vdp__privacy">The full chassis number is withheld from public pages and can be shared with a qualified buyer during verification.</p></section>
      <section class="uc-vdp__panel"><div class="uc-vdp__section-head"><div><span>Export purchase</span><h2>Documents, inspection and shipment</h2></div></div><ol class="uc-vdp__steps"><li><span>1</span><div><strong>Confirm the unit</strong><p>Reconfirm availability, VIN, price and buyer requirements.</p></div></li><li><span>2</span><div><strong>Inspect and document</strong><p>Obtain condition, battery and export-document evidence.</p></div></li><li><span>3</span><div><strong>Quote to your port</strong><p>AsiaPower prepares the EXW or CIF offer for the destination.</p></div></li><li><span>4</span><div><strong>Contract and ship</strong><p>Commercial terms and logistics are confirmed in writing.</p></div></li></ol><div class="uc-vdp__export-note"><strong>${documentStatus ? 'Document review verified.' : 'Document review pending.'}</strong> ${documentStatus ? 'Export documentation has been reviewed for this listing.' : 'Supplier has declared whole-vehicle export availability; registration, inspection, export licence and destination requirements will be verified before contract and shipment.'}</div></section>
    </div><aside class="uc-vdp__lead" aria-label="Get price and shipping"><span>Ask about this car</span><h2>Get price and shipping</h2><p>Choose a destination port for an indicative CIF estimate, then request the confirmed export quote.</p>${renderCifShell(price)}<div class="uc-vdp__lead-actions"><a class="uc-vdp__button uc-vdp__button--primary" href="${contact}">${actionLabel}</a><a class="uc-vdp__button uc-vdp__button--whatsapp" href="${whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div><ul><li>Real inventory photos</li><li>VIN-based configuration</li><li>EXW and CIF quotation</li></ul></aside></div>
  </div></section>`;
}

function buildDetailRootHtml(item, siteUrl) {
  const base = '../';
  const titleText = displayTitle(item);
  const ctx = catalogContext(item, base);
  const isUsedCar = ctx.isUsedCar;
  if (isUsedCar) return renderUsedCarDetailRootHtml(item, siteUrl);
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
  // Server-rendered YouTube iframe so Googlebot sees a prominent video without waiting on client JS.
  const ytId = youtubeVideoId(item);
  const prerenderVideo = ytId
    ? `<section class="hc-item-detail__video" data-prerender-youtube>
        <h3 class="hc-item-detail__video-title">Vehicle Video</h3>
        <div class="half-cut-detail__video-player half-cut-detail__video-player--youtube">
          <div class="half-cut-detail__video-player__frame">
            <iframe class="half-cut-detail__video-player__player half-cut-detail__video-player__iframe"
              src="https://www.youtube.com/embed/${escapeAttr(ytId)}?rel=0&amp;modestbranding=1"
              title="${escapeAttr(titleText)} video"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"></iframe>
          </div>
        </div>
      </section>`
    : '';
  const parts = isUsedCar ? [] : sanitizeIncludedParts(Array.isArray(item.includedParts) ? item.includedParts : []);
  const intro = escapeHtml(isUsedCar
    ? `${titleText}. Complete, undismantled China export used vehicle with VIN. Availability, documents and destination eligibility are confirmed before contract.`
    : `${titleText}. EXW export from China — availability, photos and CIF shipping confirmed on enquiry.`);
  const specRow = (label, value) => (value ? `<div class="hc-item-detail__spec"><dt>${label}</dt><dd>${value}</dd></div>` : '');
  const brandUrl = isUsedCar
    ? `${base}half-cuts/?cat=used-cars&amp;brand=${escapeAttr(item.brandSlug)}`
    : `${base}brands/${escapeAttr(item.brandSlug)}.html#halfcuts-inventory`;
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
        <p class="hc-item-detail__secure">${isUsedCar ? 'Complete vehicle export listing' : 'Verified export listing'}</p>
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
          ${renderExportUsedCarIdentity(item)}
          <div class="hc-item-detail__about-vehicle" aria-label="Vehicle information">
            <h3 class="hc-item-detail__about-subtitle">Vehicle information</h3>
            <dl class="hc-item-detail__specifics hc-item-detail__specifics--about">${vehicleInfoHtml}</dl>
          </div>
          ${prerenderVideo}
          ${parts.length ? `<h3 class="half-cut-detail__parts-title">Included Parts</h3><ul class="half-cut-detail__parts">${parts.map((part) => `<li>${escapeHtml(part)}</li>`).join('')}</ul>` : ''}
          <p class="hc-item-detail__about-disclaimer">${isUsedCar ? EXPORT_USED_CAR_DISCLAIMER : INVENTORY_DISCLAIMER}</p>
        </section>
      </div>
      <aside class="hc-item-detail__side-col">
        ${renderCifShell(price)}
        <h3>Browse ${escapeHtml(item.brand)}</h3>
        <ul class="engine-detail__links">
          ${isUsedCar
            ? `<li><a href="${brandUrl}">${escapeHtml(item.brand)} Export Used Cars</a></li>`
            : `<li><a href="${brandUrl}">${escapeHtml(item.brand)} Half-Cut Listings</a></li>
          <li><a href="${base}brands/${escapeAttr(item.brandSlug)}.html#engines">${escapeHtml(item.brand)} Engines</a></li>
          <li><a href="${base}brands/${escapeAttr(item.brandSlug)}.html#gearboxes">${escapeHtml(item.brand)} Gearboxes</a></li>`}
        </ul>
        <h3>Catalog</h3>
        <ul class="engine-detail__links">
          <li><a href="${ctx.catalogHref}">${ctx.isMachinery ? 'All Machinery' : (ctx.isTruck ? 'All Trucks' : (isUsedCar ? 'All Export Used Cars' : 'All Half Cuts'))}</a></li>
        </ul>
      </aside>
    </div>
  </div>
</section>`;
}

function noscriptSummary(item) {
  const isUsedCar = halfCutTitle.isExportUsedCarListing(item);
  const specs = item?.vinSpecs || {};
  const lines = [
    `<h1>${escapeHtml(displayTitle(item))}</h1>`,
    `<p>${escapeHtml(item.shortDescription || seoDescription(item))}</p>`,
    '<dl>',
    `<dt>Stock ID</dt><dd>${escapeHtml(item.stockId)}</dd>`,
    `<dt>Brand</dt><dd>${escapeHtml(item.brand)}</dd>`,
    `<dt>Model</dt><dd>${escapeHtml(item.model)}</dd>`,
    `<dt>Year</dt><dd>${escapeHtml(String(item.year || ''))}</dd>`,
    isUsedCar
      ? `<dt>Powertrain</dt><dd>${escapeHtml(specs.fuelType || item.fuelType || '')}</dd>`
      : `<dt>Engine</dt><dd>${escapeHtml(item.engineCode || '')}</dd>`,
    isUsedCar
      ? `<dt>Drivetrain</dt><dd>${escapeHtml(specs.drivetrain || item.drivetrain || '')}</dd>`
      : `<dt>Transmission</dt><dd>${escapeHtml(item.transmissionCode || '')}</dd>`,
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
  resolveDetailPath,
  productJsonLd,
  videoObjectJsonLd,
  youtubeVideoId,
  buildDetailRootHtml,
  noscriptSummary,
  displayTitle,
  listingTypeLabel,
  escapeHtml,
  escapeAttr,
};
