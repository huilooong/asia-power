'use strict';

/**
 * Display localization: Chinese values from the Mapping Layer → English,
 * for the public-facing frontend. Supplier upload / admin / raw storage
 * keep the original Chinese values untouched — this module only produces
 * an additional English view.
 *
 * Lookup order for brand/model: knowledge base dictionary (learned +
 * reviewed entries, including the manual seed below) first; anything not
 * found is NOT guessed — it's pushed to the Unknown Queue and the raw
 * Chinese value is passed through untranslated so nothing breaks, with an
 * explicit `needsTranslation: true` flag so the frontend/admin can tell.
 */

const seed = require('./zh-en-seed');

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
 * @param {object} mapped Output of mapping-layer.applyMapping().mapped (Chinese raw values)
 * @param {object} kb createVehicleKnowledgeBase() instance
 * @param {object} opts.brandSlugMap English brand name -> slug (e.g. js/vehicle-catalog.js BRAND_SLUG)
 * @param {string} opts.vin for Unknown Queue context
 */
function localizeForDisplay(mapped, kb, { brandSlugMap = {}, vin = null } = {}) {
  const out = { ...mapped };
  const unresolved = [];

  // Brand: 日产 -> Nissan
  const brandEntry = kb.repos.brandDictionary.read()[mapped.brand];
  if (brandEntry?.english) {
    out.brandEnglish = brandEntry.english;
    out.brandSlug = brandSlugMap[brandEntry.english] || null;
  } else {
    out.brandEnglish = mapped.brand;
    out.needsTranslation = [...(out.needsTranslation || []), 'brand'];
    unresolved.push({ type: 'brand', value: mapped.brand });
  }

  // Series/model: 玛驰 -> March (keyed by resolved brand slug)
  if (out.brandSlug) {
    const modelEntry = kb.repos.modelDictionary.read()[out.brandSlug]?.[mapped.series];
    const generic = mapped.series ? genericAlphanumericSeriesName(mapped.series) : null;
    if (modelEntry?.english) {
      out.seriesEnglish = modelEntry.english;
    } else if (generic) {
      // Verified pattern (BMW/Mercedes-Benz China use alphanumeric series names
      // directly, e.g. "3系" -> "3 Series", "C级" -> "C-Class", "X5"/"GLC" as-is).
      out.seriesEnglish = generic;
    } else if (mapped.series) {
      out.seriesEnglish = mapped.series;
      out.needsTranslation = [...(out.needsTranslation || []), 'series'];
      unresolved.push({ type: 'model', value: mapped.series, context: { brandSlug: out.brandSlug } });
    }
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

module.exports = { seedKnowledgeBase, localizeForDisplay };
