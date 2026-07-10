'use strict';

/**
 * Display localization: Chinese values from the Mapping Layer → English,
 * for the public-facing frontend. Supplier upload / admin / raw storage
 * keep the original Chinese values untouched — this module only produces
 * an additional English view.
 *
 * Lookup order for brand/model: knowledge base dictionary (learned +
 * reviewed entries, including the manual seed below) first.
 *
 * When QXB successfully decodes a VIN but AsiaPower has no brand/model yet,
 * we auto-learn from the QXB parse so suppliers can save immediately
 * (CEO policy 2026-07-10). Unknown Chinese names still go to Unknown Queue
 * for human English polish when needed.
 */

const seed = require('./zh-en-seed');

function hasCjk(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''));
}

function slugifyBrand(english) {
  return String(english || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function seedKnowledgeBase(kb) {
  Object.entries(seed.BRAND_ZH_TO_EN).forEach(([zh, en]) => {
    kb.learnBrand(zh, { chinese: zh, english: en, source: 'manual_seed' });
  });
  Object.entries(seed.MODEL_ZH_TO_EN).forEach(([brandSlug, models]) => {
    Object.entries(models).forEach(([zh, en]) => {
      kb.learnModel(brandSlug, zh, { chinese: zh, english: en, source: 'manual_seed' });
    });
  });
}

/**
 * Recognizes BMW/Mercedes-Benz-style alphanumeric series names that are
 * already effectively English and don't need a dictionary lookup. Verified
 * against official sources (bmw.com.cn, mercedes-benz.com.cn, 2026-06-27):
 * "3系" -> "3 Series", "C级"/"E级" -> "C-Class"/"E-Class", "X5"/"GLC" pass
 * through unchanged. Returns null if the string doesn't match this pattern
 * (falls through to dictionary lookup / Unknown Queue instead).
 */
function genericAlphanumericSeriesName(series) {
  const xi = /^([0-9]+)系$/.exec(series); // "3系" -> "3 Series"
  if (xi) return `${xi[1]} Series`;
  const ji = /^([A-Za-z])级$/.exec(series); // "C级" -> "C-Class"
  if (ji) return `${ji[1].toUpperCase()}-Class`;
  if (/^[A-Za-z]+[0-9]*$/.test(series)) return series; // "X5", "GLC" already alphanumeric
  return null;
}

/**
 * Resolve English brand from seed / existing KB / Latin passthrough.
 * Never returns empty when QXB provided a brand string.
 */
function resolveBrandEnglish(rawBrand, kb) {
  const raw = String(rawBrand || '').trim();
  if (!raw) return { english: '', from: 'empty' };

  if (seed.BRAND_ZH_TO_EN[raw]) {
    return { english: seed.BRAND_ZH_TO_EN[raw], from: 'seed' };
  }

  // Longest-prefix seed match (e.g. 捷豹路虎)
  const seedKeys = Object.keys(seed.BRAND_ZH_TO_EN).sort((a, b) => b.length - a.length);
  for (const cn of seedKeys) {
    if (raw === cn || raw.startsWith(cn) || raw.includes(cn)) {
      return { english: seed.BRAND_ZH_TO_EN[cn], from: 'seed_prefix' };
    }
  }

  const existing = kb.repos.brandDictionary.read()[raw];
  if (existing?.english && !existing.needsHumanEnglish && !hasCjk(existing.english)) {
    return { english: existing.english, from: 'dictionary', needsHuman: false };
  }
  if (existing?.english && !hasCjk(existing.english)) {
    return { english: existing.english, from: 'dictionary', needsHuman: Boolean(existing.needsHumanEnglish) };
  }

  if (!hasCjk(raw)) {
    return { english: raw, from: 'latin' };
  }

  // QXB Chinese brand not yet in AsiaPower — keep raw so supplier can save;
  // flag for human English polish.
  return { english: raw, from: 'qxb_raw', needsHuman: true };
}

function resolveSeriesEnglish(rawSeries, brandSlug, kb) {
  const raw = String(rawSeries || '').trim();
  if (!raw) return { english: '', from: 'empty' };

  if (brandSlug) {
    const seedModels = seed.MODEL_ZH_TO_EN[brandSlug] || {};
    if (seedModels[raw]) {
      return { english: seedModels[raw], from: 'seed' };
    }
    // Longest-prefix seed within brand (揽胜运动 → 揽胜)
    const keys = Object.keys(seedModels).sort((a, b) => b.length - a.length);
    for (const zh of keys) {
      if (raw === zh || raw.startsWith(zh)) {
        return { english: seedModels[zh], from: 'seed_prefix' };
      }
    }

    const modelEntry = kb.repos.modelDictionary.read()[brandSlug]?.[raw];
    if (modelEntry?.english && !modelEntry.needsHumanEnglish && !hasCjk(modelEntry.english)) {
      return { english: modelEntry.english, from: 'dictionary' };
    }
    if (modelEntry?.english && !hasCjk(modelEntry.english)) {
      return { english: modelEntry.english, from: 'dictionary', needsHuman: Boolean(modelEntry.needsHumanEnglish) };
    }
  }

  const generic = genericAlphanumericSeriesName(raw);
  if (generic) return { english: generic, from: 'generic' };

  if (!hasCjk(raw)) return { english: raw, from: 'latin' };

  // Cross-brand seed fallback
  for (const map of Object.values(seed.MODEL_ZH_TO_EN)) {
    if (map[raw]) return { english: map[raw], from: 'seed_cross' };
  }

  return { english: raw, from: 'qxb_raw', needsHuman: true };
}

/**
 * Persist QXB-discovered brand/model into the knowledge base so the next
 * decode and supplier form can use them without blocking upload.
 */
function autoLearnFromQxb(mapped, brandResolved, seriesResolved, brandSlug, kb) {
  const rawBrand = String(mapped.brand || '').trim();
  if (rawBrand && brandResolved.english) {
    const existing = kb.repos.brandDictionary.read()[rawBrand];
    if (!existing?.english || existing.needsHumanEnglish) {
      kb.learnBrand(rawBrand, {
        chinese: rawBrand,
        english: brandResolved.english,
        source: brandResolved.from === 'seed' || brandResolved.from === 'seed_prefix' ? 'manual_seed' : 'qxb_auto_decode',
        needsHumanEnglish: Boolean(brandResolved.needsHuman),
      });
    }
  }

  const rawSeries = String(mapped.series || '').trim();
  if (brandSlug && rawSeries && seriesResolved.english) {
    const existing = kb.repos.modelDictionary.read()[brandSlug]?.[rawSeries];
    if (!existing?.english || existing.needsHumanEnglish) {
      kb.learnModel(brandSlug, rawSeries, {
        chinese: rawSeries,
        english: seriesResolved.english,
        source: seriesResolved.from.startsWith('seed') ? 'manual_seed' : 'qxb_auto_decode',
        needsHumanEnglish: Boolean(seriesResolved.needsHuman),
      });
    }
  }
}

/**
 * @param {object} mapped Output of mapping-layer.applyMapping().mapped (Chinese raw values)
 * @param {object} kb createVehicleKnowledgeBase() instance
 * @param {object} opts.brandSlugMap English brand name -> slug (e.g. js/vehicle-catalog.js BRAND_SLUG)
 * @param {string} opts.vin for Unknown Queue context
 * @param {boolean} opts.autoLearn when true (default), persist unknown QXB brands/models
 */
function localizeForDisplay(mapped, kb, { brandSlugMap = {}, vin = null, autoLearn = true } = {}) {
  const out = { ...mapped };
  const unresolved = [];

  const brandResolved = resolveBrandEnglish(mapped.brand, kb);
  if (brandResolved.english) {
    out.brandEnglish = brandResolved.english;
    out.brandSlug = brandSlugMap[brandResolved.english] || slugifyBrand(brandResolved.english) || null;
    if (brandResolved.needsHuman) {
      out.needsTranslation = [...(out.needsTranslation || []), 'brand'];
      unresolved.push({ type: 'brand', value: mapped.brand });
    }
  } else if (mapped.brand) {
    out.brandEnglish = mapped.brand;
    out.needsTranslation = [...(out.needsTranslation || []), 'brand'];
    unresolved.push({ type: 'brand', value: mapped.brand });
  }

  const seriesResolved = resolveSeriesEnglish(mapped.series, out.brandSlug, kb);
  if (seriesResolved.english) {
    out.seriesEnglish = seriesResolved.english;
    if (seriesResolved.needsHuman) {
      out.needsTranslation = [...(out.needsTranslation || []), 'series'];
      unresolved.push({ type: 'model', value: mapped.series, context: { brandSlug: out.brandSlug } });
    }
  } else if (mapped.series) {
    out.seriesEnglish = mapped.series;
    out.needsTranslation = [...(out.needsTranslation || []), 'series'];
    unresolved.push({ type: 'model', value: mapped.series, context: { brandSlug: out.brandSlug } });
  }

  if (autoLearn) {
    autoLearnFromQxb(mapped, brandResolved, seriesResolved, out.brandSlug, kb);
  }

  // Fuel type: 汽油 -> Petrol
  if (mapped.fuelTypeRaw) {
    const fuel = seed.FUEL_TYPE_ZH_TO_EN[mapped.fuelTypeRaw];
    if (fuel) {
      out.fuelType = fuel;
    } else {
      out.fuelType = mapped.fuelTypeRaw;
      out.needsTranslation = [...(out.needsTranslation || []), 'fuelTypeRaw'];
      unresolved.push({ type: 'fuel_type', value: mapped.fuelTypeRaw });
    }
  }

  // Drivetrain: 前置前驱 -> 2WD
  if (mapped.drivetrainRaw) {
    const code = seed.DRIVETRAIN_ZH_TO_CODE[mapped.drivetrainRaw];
    if (code) {
      out.drivetrain = code;
    } else {
      out.drivetrain = mapped.drivetrainRaw;
      out.needsTranslation = [...(out.needsTranslation || []), 'drivetrainRaw'];
      unresolved.push({ type: 'drivetrain', value: mapped.drivetrainRaw });
    }
  }

  // Displacement: cc -> liters string (e.g. "1498" -> "1.5L")
  if (mapped.displacementCc && /^\d+$/.test(String(mapped.displacementCc).trim())) {
    out.displacement = `${(Number(mapped.displacementCc) / 1000).toFixed(1)}L`;
  }

  unresolved.forEach((entry) => {
    kb.enqueueUnknown({ ...entry, vin, context: { ...(entry.context || {}), mapped } });
  });

  return out;
}

/**
 * Prefer English (non-CJK) display name; never blank a successful QXB field.
 */
function pickPublicName(english, raw) {
  const en = String(english || '').trim();
  const zh = String(raw || '').trim();
  if (en && !hasCjk(en)) return en;
  if (zh && !hasCjk(zh)) return zh;
  return en || zh || '';
}

module.exports = {
  seedKnowledgeBase,
  localizeForDisplay,
  pickPublicName,
  resolveBrandEnglish,
  resolveSeriesEnglish,
  slugifyBrand,
};
