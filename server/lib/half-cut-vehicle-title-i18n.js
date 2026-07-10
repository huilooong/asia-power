'use strict';

const fs = require('fs');
const path = require('path');

const MFR_PREFIXES = [
  '进口', '华晨', '长安', '上汽', '广汽', '一汽', '东风', '北京', '广州', '深圳',
];

const TRIM_TERMS = [
  ['自动两驱', { en: 'Automatic 2WD', fr: 'Automatique 2WD', ar: 'أوتوماتيك 2WD' }],
  ['手动两驱', { en: 'Manual 2WD', fr: 'Manuelle 2WD', ar: 'يدوي 2WD' }],
  ['自动四驱', { en: 'Automatic 4WD', fr: 'Automatique 4WD', ar: 'أوتوماتيك 4WD' }],
  ['手动四驱', { en: 'Manual 4WD', fr: 'Manuelle 4WD', ar: 'يدوي 4WD' }],
  ['无级变速', { en: 'CVT', fr: 'CVT', ar: 'CVT' }],
  ['手自一体', { en: 'Automatic', fr: 'Automatique', ar: 'أوتوماتيك' }],
  ['双离合', { en: 'DCT', fr: 'DCT', ar: 'DCT' }],
  ['全景天窗', { en: 'Panoramic Sunroof', fr: 'Toit panoramique', ar: 'فتحة سقف بانورامية' }],
  ['天窗版', { en: 'Sunroof', fr: 'Toit ouvrant', ar: 'فتحة سقف' }],
  ['精英版', { en: 'Elite', fr: 'Élite', ar: 'Elite' }],
  ['豪华版', { en: 'Luxury', fr: 'Luxe', ar: 'Luxury' }],
  ['尊贵版', { en: 'Premium', fr: 'Premium', ar: 'Premium' }],
  ['旗舰版', { en: 'Flagship', fr: 'Flagship', ar: 'Flagship' }],
  ['时尚型', { en: 'Fashion', fr: 'Fashion', ar: 'Fashion' }],
  ['时尚版', { en: 'Fashion', fr: 'Fashion', ar: 'Fashion' }],
  ['舒适型', { en: 'Comfort', fr: 'Confort', ar: 'Comfort' }],
  ['舒适版', { en: 'Comfort', fr: 'Confort', ar: 'Comfort' }],
  ['智能型', { en: 'Smart', fr: 'Smart', ar: 'Smart' }],
  ['智能版', { en: 'Smart', fr: 'Smart', ar: 'Smart' }],
  ['新锐版', { en: 'Trend', fr: 'Trend', ar: 'Trend' }],
  ['领先版', { en: 'Leading', fr: 'Leading', ar: 'Leading' }],
  ['标准版', { en: 'Standard', fr: 'Standard', ar: 'Standard' }],
  ['经典型', { en: 'Classic', fr: 'Classique', ar: 'Classic' }],
  ['经典版', { en: 'Classic', fr: 'Classique', ar: 'Classic' }],
  ['百万纪念版', { en: 'Million Edition', fr: 'Édition Million', ar: 'Million Edition' }],
  ['国VI', { en: 'China VI', fr: 'Chine VI', ar: 'China VI' }],
  ['国V', { en: 'China V', fr: 'Chine V', ar: 'China V' }],
  ['国IV', { en: 'China IV', fr: 'Chine IV', ar: 'China IV' }],
  ['国iii', { en: 'China III', fr: 'Chine III', ar: 'China III' }],
  ['国III', { en: 'China III', fr: 'Chine III', ar: 'China III' }],
  ['两厢', { en: 'Hatchback', fr: 'Berline compacte', ar: 'Hatchback' }],
  ['三厢', { en: 'Sedan', fr: 'Berline', ar: 'Sedan' }],
  ['七座', { en: '7-Seat', fr: '7 places', ar: '7 seats' }],
  ['五座', { en: '5-Seat', fr: '5 places', ar: '5 seats' }],
  ['旅行版', { en: 'Wagon', fr: 'Break', ar: 'Wagon' }],
  ['双擎', { en: 'Hybrid', fr: 'Hybride', ar: 'Hybrid' }],
  ['混动', { en: 'Hybrid', fr: 'Hybride', ar: 'Hybrid' }],
  ['两驱', { en: '2WD', fr: '2WD', ar: '2WD' }],
  ['四驱', { en: '4WD', fr: '4WD', ar: '4WD' }],
  ['自动', { en: 'Automatic', fr: 'Automatique', ar: 'أوتوماتيك' }],
  ['手动', { en: 'Manual', fr: 'Manuelle', ar: 'يدوي' }],
];

let cachedLexicon = null;

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function loadLexicon(dataDir) {
  if (cachedLexicon) return cachedLexicon;
  const kb = path.join(dataDir || path.join(process.cwd(), 'data'), 'knowledge-base');
  let brandDict = {};
  let modelDict = {};
  try {
    brandDict = JSON.parse(fs.readFileSync(path.join(kb, 'brand-dictionary.json'), 'utf8'));
  } catch { /* optional */ }
  try {
    modelDict = JSON.parse(fs.readFileSync(path.join(kb, 'model-dictionary.json'), 'utf8'));
  } catch { /* optional */ }

  const brands = {};
  // Seed first, then KB overrides
  try {
    const seed = require('./vin/zh-en-seed');
    Object.assign(brands, seed.BRAND_ZH_TO_EN || {});
  } catch { /* optional */ }
  Object.entries(brandDict).forEach(([cn, rec]) => {
    if (rec?.english) brands[cn] = rec.english;
  });

  const models = {};
  try {
    const seed = require('./vin/zh-en-seed');
    Object.entries(seed.MODEL_ZH_TO_EN || {}).forEach(([brandSlug, map]) => {
      Object.entries(map || {}).forEach(([zh, en]) => {
        models[`${brandSlug}:${zh}`] = en;
      });
    });
  } catch { /* optional */ }
  Object.entries(modelDict).forEach(([brandSlug, modelsForBrand]) => {
    Object.entries(modelsForBrand || {}).forEach(([modelKey, rec]) => {
      const english = rec?.english || null;
      if (english) models[`${brandSlug}:${modelKey}`] = english;
      if (rec?.chinese) models[`${brandSlug}:${rec.chinese}`] = english || modelKey;
    });
  });

  cachedLexicon = { brands, models, terms: TRIM_TERMS };
  return cachedLexicon;
}

function setLexicon(lexicon) {
  cachedLexicon = lexicon;
}

function hasCjk(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''));
}

function lookupBrandCn(text, lexicon) {
  const keys = Object.keys(lexicon.brands || {}).sort((a, b) => b.length - a.length);
  for (const cn of keys) {
    if (text.startsWith(cn)) return { cn, en: lexicon.brands[cn], rest: text.slice(cn.length).trim() };
  }
  return { cn: null, en: null, rest: text };
}

function stripMfrPrefix(text) {
  let rest = String(text || '').trim();
  for (const prefix of MFR_PREFIXES) {
    if (rest.startsWith(prefix)) {
      rest = rest.slice(prefix.length).trim();
    }
  }
  return rest;
}

function lookupModelEn(text, brandSlug, item, lexicon) {
  const slug = brandSlug || slugify(item?.brand);
  const keys = Object.keys(lexicon.models || {})
    .filter((k) => k.startsWith(`${slug}:`))
    .map((k) => k.slice(slug.length + 1))
    .sort((a, b) => b.length - a.length);

  for (const key of keys) {
    if (text.includes(key)) {
      return lexicon.models[`${slug}:${key}`] || key;
    }
  }

  const latin = text.match(/[A-Za-z][A-Za-z0-9\-]*/g) || [];
  if (latin.length) return latin.join(' ');

  const cjk = text.match(/[\u4e00-\u9fff]+/g) || [];
  for (const part of cjk) {
    const cleaned = stripMfrPrefix(part);
    if (cleaned && lexicon.models[`${slug}:${cleaned}`]) {
      return lexicon.models[`${slug}:${cleaned}`];
    }
  }

  if (item?.model) return item.model;
  return stripMfrPrefix(text.replace(/[\u4e00-\u9fff]/g, ' ')).trim() || null;
}

function translateTrimSegment(segment, lang, lexicon) {
  let rest = String(segment || '').trim();
  const out = [];
  const terms = lexicon?.terms || TRIM_TERMS;
  for (const [cn, map] of terms) {
    if (rest.includes(cn)) {
      out.push(map[lang] || map.en);
      rest = rest.replace(cn, ' ');
    }
  }
  const latin = (rest.match(/[A-Za-z0-9\+]+(?:-[A-Za-z0-9]+)*/g) || [])
    .filter((token) => token.length > 1 || /[A-Z]/.test(token));
  out.push(...latin);
  return out;
}

function translateOriginalVehicleName(cnText, lang, item, lexiconInput) {
  const text = String(cnText || '').trim();
  if (!text) return '';
  if (lang === 'zh') return text;

  const lexicon = lexiconInput || loadLexicon();
  const activeLang = ['en', 'fr', 'ar'].includes(lang) ? lang : 'en';
  const parts = [];

  let rest = text;
  const yearMatch = rest.match(/(\d{4})款/);
  if (yearMatch) {
    parts.push(yearMatch[1]);
    rest = rest.replace(yearMatch[0], ' ').trim();
  } else if (item?.year) {
    parts.push(String(item.year));
  }

  const dispMatch = rest.match(/(\d\.\d[Ll]?)/);
  let displacement = '';
  if (dispMatch) {
    displacement = dispMatch[1].toUpperCase();
    rest = rest.replace(dispMatch[0], ' ').trim();
  }

  const brandHit = lookupBrandCn(rest, lexicon);
  const brandEn = item?.brand || brandHit.en;
  if (brandEn) parts.push(brandEn);
  rest = brandHit.rest || rest;

  const tokens = rest.split(/\s+/).filter(Boolean);
  let modelText = tokens.length > 1 ? tokens.slice(0, -1).join(' ') : rest;
  let trimText = tokens.length > 1 ? tokens[tokens.length - 1] : '';

  if (!trimText && /[\u4e00-\u9fff]/.test(modelText) && /[A-Za-z]/.test(modelText)) {
    const latinTail = modelText.match(/[A-Za-z0-9\+]+(?:-[A-Za-z0-9\+]+)*$/);
    if (latinTail) {
      trimText = latinTail[0];
      modelText = modelText.slice(0, modelText.length - latinTail[0].length).trim();
    }
  }

  if (!trimText && tokens.length === 1) {
    const only = tokens[0];
    const yearInline = only.match(/^[\u4e00-\u9fffA-Za-z0-9]+?(自动|手动|两驱|四驱|精英|豪华|尊贵|时尚|舒适|智能|旗舰)/);
    if (yearInline) {
      modelText = only.slice(0, yearInline.index).trim();
      trimText = only.slice(yearInline.index).trim();
    } else {
      modelText = only;
    }
  }

  const modelEn = lookupModelEn(modelText, slugify(item?.brandSlug || item?.brand), item, lexicon);
  if (modelEn) parts.push(modelEn);

  if (displacement) parts.push(displacement);

  const trimParts = translateTrimSegment(trimText || rest, activeLang, lexicon);
  trimParts.forEach((p) => parts.push(p));

  let title = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  if (hasCjk(title)) {
    const scrubbed = title.replace(/[\u4e00-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (scrubbed) title = scrubbed;
  }

  return title;
}

module.exports = {
  TRIM_TERMS,
  loadLexicon,
  setLexicon,
  translateOriginalVehicleName,
};
