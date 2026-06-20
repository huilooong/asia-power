/**
 * AsiaPower — Normalize brand/model names against VehicleCatalog (typos, casing, fuzzy match).
 */
(function () {
  'use strict';

  const BRAND_ALIASES = {
    mercedes: 'Mercedes-Benz',
    mercedesbenz: 'Mercedes-Benz',
    benz: 'Mercedes-Benz',
    vw: 'Volkswagen',
    chevy: 'Chevrolet',
    ssangyong: 'Ssangyong',
    ssangyong: 'Ssangyong',
    landrover: 'Land Rover',
    greatwall: 'Great Wall',
    lynkco: 'Lynk & Co',
    mini: 'MINI',
    byd: 'BYD',
    gmc: 'GMC',
    bmw: 'BMW',
    mg: 'MG',
    jac: 'JAC',
    gac: 'GAC',
    changan: 'Changan',
    长安: 'Changan',
    长安汽车: 'Changan',
    jmc: 'JMC',
  };

  /** @type {Record<string, Record<string, string>>} */
  const MODEL_ALIASES = {
    Toyota: {
      pardo: 'Land Cruiser Prado',
      prado: 'Land Cruiser Prado',
      lcprado: 'Land Cruiser Prado',
      hiluxrevo: 'Hilux Revo',
      hialux: 'Hilux',
      hiace: 'Hiace',
      fortuner: 'Fortuner',
    },
    Nissan: {
      navara: 'Navara',
      xtrail: 'X-Trail',
      patrol: 'Patrol',
    },
    Honda: {
      crv: 'CR-V',
    },
    Hyundai: {
      santafe: 'Santa Fe',
      santafé: 'Santa Fe',
    },
  };

  function catalog() {
    return window.VehicleCatalog;
  }

  function normalizeKey(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const row = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) row[j] = j;
    for (let i = 1; i <= a.length; i++) {
      let prev = i - 1;
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const temp = row[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
        prev = temp;
      }
    }
    return row[b.length];
  }

  function modelWords(model) {
    return String(model || '')
      .split(/[\s/+-]+/)
      .map((w) => normalizeKey(w))
      .filter((w) => w.length >= 3);
  }

  function resolveBrand(rawBrand, cat) {
    const raw = String(rawBrand || '').trim();
    if (!raw) return { brand: '', brandSlug: '', corrected: false };

    const names = cat?.getBrandNames?.() || [];
    const exact = names.find((n) => n.toLowerCase() === raw.toLowerCase());
    if (exact) {
      return {
        brand: exact,
        brandSlug: cat.brandToSlug(exact),
        corrected: exact !== raw,
      };
    }

    const alias = BRAND_ALIASES[normalizeKey(raw)];
    if (alias && names.includes(alias)) {
      return { brand: alias, brandSlug: cat.brandToSlug(alias), corrected: true };
    }

    const key = normalizeKey(raw);
    let best = null;
    let bestDist = 2;
    for (const name of names) {
      const d = levenshtein(key, normalizeKey(name));
      if (d < bestDist) {
        bestDist = d;
        best = name;
      }
    }
    if (best && bestDist <= 1 && key.length >= 3) {
      return { brand: best, brandSlug: cat.brandToSlug(best), corrected: true };
    }

    return { brand: raw, brandSlug: cat.brandToSlug(raw), corrected: false };
  }

  function resolveModel(brand, rawModel, cat) {
    const raw = String(rawModel || '').trim();
    if (!raw || !brand) return { model: raw, corrected: false };

    const models = cat?.getModels?.(brand) || [];
    if (!models.length) return { model: raw, corrected: false };

    const key = normalizeKey(raw);
    const exact = models.find((m) => normalizeKey(m) === key);
    if (exact) return { model: exact, corrected: exact !== raw };

    const brandAliases = MODEL_ALIASES[brand] || {};
    const aliasTarget = brandAliases[key] || MODEL_ALIASES['*']?.[key];
    if (aliasTarget) {
      const canonical = models.find((m) => normalizeKey(m) === normalizeKey(aliasTarget)) || aliasTarget;
      return { model: canonical, corrected: canonical !== raw };
    }

    const contains = models.filter((m) => {
      const mk = normalizeKey(m);
      return mk.includes(key) || (key.length >= 4 && key.includes(mk) && mk.length >= 4);
    });
    if (contains.length === 1) {
      return { model: contains[0], corrected: contains[0] !== raw };
    }
    if (contains.length > 1) {
      const tight = contains.filter((m) => normalizeKey(m).includes(key));
      if (tight.length === 1) return { model: tight[0], corrected: tight[0] !== raw };
    }

    let bestModel = null;
    let bestDist = 2;
    for (const model of models) {
      for (const word of modelWords(model)) {
        const d = levenshtein(key, word);
        if (d < bestDist) {
          bestDist = d;
          bestModel = model;
        }
      }
      const fullKey = normalizeKey(model);
      if (key.length >= 4 && fullKey.length >= 4) {
        const d = levenshtein(key, fullKey);
        if (d < bestDist) {
          bestDist = d;
          bestModel = model;
        }
      }
    }
    if (bestModel && bestDist <= 1 && key.length >= 4) {
      return { model: bestModel, corrected: bestModel !== raw };
    }

    return { model: raw, corrected: false };
  }

  function normalizeVehicleNames(brand, model) {
    const cat = catalog();
    if (!cat) {
      return {
        brand: String(brand || '').trim(),
        model: String(model || '').trim(),
        brandSlug: '',
        corrected: false,
        brandCorrected: false,
        modelCorrected: false,
      };
    }

    const b = resolveBrand(brand, cat);
    const m = resolveModel(b.brand, model, cat);
    return {
      brand: b.brand,
      brandSlug: b.brandSlug,
      model: m.model,
      corrected: b.corrected || m.corrected,
      brandCorrected: b.corrected,
      modelCorrected: m.corrected,
      originalBrand: b.corrected ? String(brand || '').trim() : undefined,
      originalModel: m.corrected ? String(model || '').trim() : undefined,
    };
  }

  function slugifyPart(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function rebuildInventoryDerivedFields(item) {
    if (!item || !item.stockId) return item;
    const next = { ...item };
    if (next.brand && next.model && next.engineCode) {
      next.title = `${next.brand} ${next.model} ${next.engineCode} Half Cut`;
    }
    if (next.brandSlug && next.model && next.year && next.engineCode) {
      next.slug = [
        next.brandSlug,
        slugifyPart(next.model),
        next.year,
        slugifyPart(next.engineCode),
        'half-cut',
        String(next.stockId).toLowerCase(),
      ].filter(Boolean).join('-');
    }
    if (next.brand && next.model && next.year && next.engineCode) {
      const autoDesc = `${next.year} ${next.brand} ${next.model} with ${next.engineCode} — supplier-verified listing via AsiaPower.`;
      if (!next.shortDescription || /supplier-verified listing via AsiaPower/i.test(next.shortDescription)) {
        next.shortDescription = autoDesc;
      }
    }
    return next;
  }

  function normalizeInventoryRecord(item) {
    if (!item) return item;
    const n = normalizeVehicleNames(item.brand, item.model);
    if (!n.corrected) return item;
    const next = rebuildInventoryDerivedFields({
      ...item,
      brand: n.brand,
      brandSlug: n.brandSlug,
      model: n.model,
      nameCorrections: {
        ...(item.nameCorrections || {}),
        ...(n.originalBrand ? { brand: n.originalBrand } : {}),
        ...(n.originalModel ? { model: n.originalModel } : {}),
        correctedAt: new Date().toISOString(),
      },
    });
    return next;
  }

  function normalizeSubmissionRecord(submission) {
    if (!submission) return submission;
    const n = normalizeVehicleNames(submission.brand, submission.model);
    if (!n.corrected) return submission;
    return {
      ...submission,
      brand: n.brand,
      brandSlug: n.brandSlug,
      model: n.model,
      nameCorrections: {
        ...(submission.nameCorrections || {}),
        ...(n.originalBrand ? { brand: n.originalBrand } : {}),
        ...(n.originalModel ? { model: n.originalModel } : {}),
        correctedAt: new Date().toISOString(),
      },
    };
  }

  window.VehicleNameNormalize = {
    normalizeVehicleNames,
    normalizeInventoryRecord,
    normalizeSubmissionRecord,
    rebuildInventoryDerivedFields,
  };
})();
