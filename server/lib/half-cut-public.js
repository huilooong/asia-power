/**
 * Server-side public sanitization for half-cut inventory (no VIN / supplier PII).
 * Public marketplace fields default to English brand / model / title.
 */
'use strict';

const halfCutTitle = require('./half-cut-title');
const contactRedact = require('./contact-redact');
const vehicleTitleI18n = require('./half-cut-vehicle-title-i18n');
const { BRAND_ZH_TO_EN, MODEL_ZH_TO_EN } = require('./vin/zh-en-seed');

function maskVin(vin) {
  const value = String(vin || '').toUpperCase();
  if (value.length !== 17) return '';
  return `${value.slice(0, 10)}${'*'.repeat(4)}${value.slice(14)}`;
}

const SUPPLIER_FIELDS = [
  'vin',
  'decodedData',
  'decodeMethod',
  'decodeConfidence',
  'submissionId',
  'supplierId',
  'supplierName',
  'supplierPhone',
  'supplierPhoneNormalized',
  'supplierWechat',
  'supplierCity',
  'approvedAt',
  'reviewStatus',
  'rejectReason',
  'reviewedAt',
  'approvedStockId',
  'approvedSlug',
  'notes',
  'reservedOrderId',
  'reserveReason',
  'reservedAt',
  'categoryCorrection',
  'nameCorrections',
  'updatedBySupplierId',
];

const EXTRA_BRAND_ZH_TO_EN = {
  ...BRAND_ZH_TO_EN,
  '猎豹汽车': 'Liebao',
  '猎豹': 'Liebao',
  '克莱斯勒': 'Chrysler',
  '北京克莱斯勒': 'Chrysler',
  'Jeep': 'Jeep',
  '吉普': 'Jeep',
};

function hasCjk(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''));
}

function slugifyAscii(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function genericAlphanumericSeriesName(series) {
  const xi = /^([0-9]+)系$/.exec(series);
  if (xi) return `${xi[1]} Series`;
  const ji = /^([A-Za-z])级$/.exec(series);
  if (ji) return `${ji[1].toUpperCase()}-Class`;
  if (/^[A-Za-z]+[0-9]*$/.test(series)) return series;
  return null;
}

function translateBrand(brand) {
  const raw = String(brand || '').trim();
  if (!raw) return '';
  if (!hasCjk(raw)) return raw;
  if (EXTRA_BRAND_ZH_TO_EN[raw]) return EXTRA_BRAND_ZH_TO_EN[raw];
  const lexicon = vehicleTitleI18n.loadLexicon();
  if (lexicon.brands?.[raw]) return lexicon.brands[raw];
  // Longest-prefix match (e.g. 一汽大众)
  const keys = Object.keys(EXTRA_BRAND_ZH_TO_EN).sort((a, b) => b.length - a.length);
  for (const cn of keys) {
    if (raw.startsWith(cn) || raw.includes(cn)) return EXTRA_BRAND_ZH_TO_EN[cn];
  }
  return raw;
}

function translateModel(model, brandEn) {
  const raw = String(model || '').trim();
  if (!raw) return '';
  if (!hasCjk(raw)) return raw;

  const brandSlug = slugifyAscii(brandEn);
  const seedModels = MODEL_ZH_TO_EN[brandSlug] || {};
  if (seedModels[raw]) return seedModels[raw];

  const generic = genericAlphanumericSeriesName(raw);
  if (generic) return generic;

  // Strip brand prefix inside model (宝马7系)
  let rest = raw;
  for (const [cn] of Object.entries(EXTRA_BRAND_ZH_TO_EN).sort((a, b) => b[0].length - a[0].length)) {
    if (rest.startsWith(cn)) {
      rest = rest.slice(cn.length).trim();
      break;
    }
  }
  if (seedModels[rest]) return seedModels[rest];
  const generic2 = genericAlphanumericSeriesName(rest);
  if (generic2) return generic2;

  const lexicon = vehicleTitleI18n.loadLexicon();
  const lexKey = `${brandSlug}:${raw}`;
  if (lexicon.models?.[lexKey]) return lexicon.models[lexKey];
  if (rest && lexicon.models?.[`${brandSlug}:${rest}`]) return lexicon.models[`${brandSlug}:${rest}`];

  // Keep latin tokens (H6, CS10, GL, Polo) if present
  const latin = raw.match(/[A-Za-z][A-Za-z0-9\-]*/g);
  if (latin && latin.length) return latin.join(' ');

  // Cross-brand seed fallback (e.g. Hyundai Trucks → hyundai map)
  for (const map of Object.values(MODEL_ZH_TO_EN)) {
    if (map[raw]) return map[raw];
    if (rest && map[rest]) return map[rest];
  }

  // Last resort: drop CJK so public cards never show Chinese model names
  const scrubbed = raw.replace(/[\u4e00-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim();
  return scrubbed || raw;
}

function localizePublicNames(item) {
  const brandEn = translateBrand(item.brand);
  const modelEn = translateModel(item.model, brandEn);
  const next = {
    ...item,
    brand: brandEn || item.brand,
    model: modelEn || item.model,
  };
  if (brandEn && !hasCjk(brandEn)) {
    next.brandSlug = slugifyAscii(brandEn) || item.brandSlug;
  }

  // Prefer English display title for marketplace default
  const enTitle = halfCutTitle.buildDisplayTitle(
    {
      ...item,
      brand: brandEn || item.brand,
      model: modelEn || item.model,
    },
    'en'
  );
  if (enTitle && !hasCjk(enTitle)) {
    next.title = enTitle;
  } else if (enTitle) {
    // Scrub residual CJK from translated title
    const scrubbed = enTitle.replace(/[\u4e00-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim();
    next.title = scrubbed || [item.year, brandEn, modelEn, item.engineCode].filter(Boolean).join(' ');
  } else {
    next.title = [item.year, brandEn, modelEn, item.engineCode].filter(Boolean).join(' ');
  }

  if (next.shortDescription && hasCjk(next.shortDescription)) {
    // Keep shortDescription English-ish: use title without flooding trim jargon
    next.shortDescription = [brandEn, modelEn, item.year].filter(Boolean).join(' ');
  }

  return next;
}

function filterPublicIncludedParts(parts) {
  return (parts || []).filter((part) => {
    const text = String(part || '').trim();
    if (!text) return false;
    if (halfCutTitle.isRemarkBoilerplate(text)) return false;
    if (/^原始车型:|^原始说明:|^VIN OCR|^VIN decode|^子龙预估|^transmission code\b|^transmission:/i.test(text)) return false;
    if (/^999 km|^仅为占位|占位，不代表真实里程/i.test(text)) return false;
    return true;
  });
}

function toPublicItem(item) {
  if (!item || typeof item !== 'object') return null;
  const copy = { ...item };
  for (const key of SUPPLIER_FIELDS) delete copy[key];
  if (item.vin) copy.maskedVin = maskVin(item.vin);

  if (halfCutTitle.isQxbListing(item)) {
    if (!copy.originalVehicleName && item.notes) {
      copy.originalVehicleName = halfCutTitle.extractOriginalVehicleName(item.notes);
    } else if (!copy.originalVehicleName && item.originalVehicleName) {
      copy.originalVehicleName = item.originalVehicleName;
    }
  } else {
    delete copy.originalVehicleName;
  }

  // Localize only the already-sanitized copy. Passing the raw item here would
  // merge VIN, supplier PII, notes, and review metadata back into public JSON.
  Object.assign(copy, localizePublicNames(copy));

  if (Array.isArray(copy.includedParts)) {
    copy.includedParts = filterPublicIncludedParts(copy.includedParts);
  }

  const listedAt = String(item.approvedAt || item.updatedAt || '').trim();
  if (listedAt) copy.listedAt = listedAt;

  return contactRedact.redactPublicStrings(copy);
}

function trimPhotoForPublic(photo) {
  if (!photo || typeof photo !== 'object') return null;
  const url = String(photo.url || '').trim();
  if (!url) return null;
  const thumbUrl = String(photo.thumbUrl || '').trim();
  const label = String(photo.label || '').trim();
  const out = thumbUrl && thumbUrl !== url ? { url, thumbUrl } : { url };
  if (label) out.label = label;
  return out;
}

function toPublicCatalogItem(item, maxPhotos = 4) {
  const pub = toPublicItem(item);
  if (!pub) return null;
  if (Array.isArray(pub.photos)) {
    pub.photos = pub.photos
      .slice(0, Math.max(1, maxPhotos))
      .map(trimPhotoForPublic)
      .filter(Boolean);
  }
  return pub;
}

function toPublicCatalogList(items, maxPhotos = 4) {
  return (items || []).map((item) => toPublicCatalogItem(item, maxPhotos)).filter(Boolean);
}

function toPublicList(items) {
  return (items || []).map(toPublicItem).filter(Boolean);
}

function stripSubmissionForStorage(submission) {
  return submission;
}

module.exports = {
  maskVin,
  toPublicItem,
  toPublicList,
  toPublicCatalogItem,
  toPublicCatalogList,
  trimPhotoForPublic,
  stripSubmissionForStorage,
  translateBrand,
  translateModel,
  localizePublicNames,
};
