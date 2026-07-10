/**
 * AsiaPower — translate QXB Chinese vehicle titles for export locales
 */
(function () {
  'use strict';

  const MFR_PREFIXES = [
    '进口', '华晨', '长安', '上汽', '广汽', '一汽', '东风', '北京', '广州', '深圳',
  ];

  function slugify(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function getLexicon() {
    return window.VehicleTitleLexicon || { brands: {}, models: {}, terms: [] };
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
      if (rest.startsWith(prefix)) rest = rest.slice(prefix.length).trim();
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
      if (text.includes(key)) return lexicon.models[`${slug}:${key}`] || key;
    }

    const latin = text.match(/[A-Za-z][A-Za-z0-9\-]*/g) || [];
    if (latin.length) return latin.join(' ');

    const cjk = text.match(/[\u4e00-\u9fff]+/g) || [];
    for (const part of cjk) {
      const cleaned = stripMfrPrefix(part);
      if (cleaned && lexicon.models[`${slug}:${cleaned}`]) return lexicon.models[`${slug}:${cleaned}`];
    }

    if (item?.model) return item.model;
    return stripMfrPrefix(text.replace(/[\u4e00-\u9fff]/g, ' ')).trim() || null;
  }

  function translateTrimSegment(segment, lang, lexicon) {
    let rest = String(segment || '').trim();
    const out = [];
    const terms = lexicon?.terms || [];
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

  function translateOriginalVehicleName(cnText, lang, item) {
    const text = String(cnText || '').trim();
    if (!text) return '';
    if (lang === 'zh') return text;

    const lexicon = getLexicon();
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

  window.HalfCutVehicleTitleI18n = {
    translateOriginalVehicleName,
  };
})();
