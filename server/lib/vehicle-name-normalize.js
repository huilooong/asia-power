'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

const MODEL_ALIASES = {
  Toyota: {
    pardo: 'Land Cruiser Prado',
    prado: 'Land Cruiser Prado',
    lcprado: 'Land Cruiser Prado',
    hiluxrevo: 'Hilux Revo',
    hialux: 'Hilux',
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
  },
};

/** @type {Map<string, object>} */
const catalogByRoot = new Map();

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

function loadCatalog(rootDir) {
  const key = path.resolve(rootDir);
  if (catalogByRoot.has(key)) return catalogByRoot.get(key);

  const candidates = [
    path.join(rootDir, 'public', 'js', 'vehicle-catalog.js'),
    path.join(rootDir, 'js', 'vehicle-catalog.js'),
  ];

  for (const catalogFile of candidates) {
    if (!fs.existsSync(catalogFile)) continue;
    try {
      const sandbox = { window: {} };
      vm.runInNewContext(fs.readFileSync(catalogFile, 'utf8'), sandbox, { filename: catalogFile });
      const catalog = sandbox.window.VehicleCatalog || null;
      catalogByRoot.set(key, catalog);
      return catalog;
    } catch (err) {
      console.warn('[vehicle-name-normalize] catalog load failed:', err.message);
    }
  }

  catalogByRoot.set(key, null);
  return null;
}

function resolveBrand(rawBrand, cat) {
  const raw = String(rawBrand || '').trim();
  if (!raw) return { brand: '', brandSlug: '', corrected: false };

  const names = cat?.getBrandNames?.() || [];
  const exact = names.find((n) => n.toLowerCase() === raw.toLowerCase());
  if (exact) {
    return { brand: exact, brandSlug: cat.brandToSlug(exact), corrected: exact !== raw };
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
  const aliasTarget = brandAliases[key];
  if (aliasTarget) {
    const canonical = models.find((m) => normalizeKey(m) === normalizeKey(aliasTarget)) || aliasTarget;
    return { model: canonical, corrected: canonical !== raw };
  }

  const contains = models.filter((m) => {
    const mk = normalizeKey(m);
    return mk.includes(key) || (key.length >= 4 && key.includes(mk) && mk.length >= 4);
  });
  if (contains.length === 1) return { model: contains[0], corrected: contains[0] !== raw };
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

function normalizeVehicleNames(brand, model, catalog) {
  if (!catalog) {
    return {
      brand: String(brand || '').trim(),
      model: String(model || '').trim(),
      brandSlug: '',
      corrected: false,
    };
  }

  const b = resolveBrand(brand, catalog);
  const m = resolveModel(b.brand, model, catalog);
  return {
    brand: b.brand,
    brandSlug: b.brandSlug,
    model: m.model,
    corrected: b.corrected || m.corrected,
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

function normalizeListingMeta(record) {
  if (!record || typeof record !== 'object') return record;
  const condition = String(record.vehicleCondition || '').trim();
  let vehicleCategory = String(record.vehicleCategory || '').trim();
  let truckPartType = String(record.truckPartType || '').trim();
  const slug = String(record.slug || record.approvedSlug || '');

  if (condition === 'Driver Cab' || truckPartType === 'cab') {
    return {
      ...record,
      vehicleCategory: 'truck',
      truckPartType: 'cab',
      vehicleCondition: 'Driver Cab',
    };
  }
  if (condition === 'Truck Half Cut' || (vehicleCategory === 'truck' && truckPartType === 'vehicle')) {
    return {
      ...record,
      vehicleCategory: 'truck',
      truckPartType: 'vehicle',
      vehicleCondition: 'Truck Half Cut',
    };
  }
  if (vehicleCategory === 'truck') {
    return {
      ...record,
      vehicleCategory: 'truck',
      truckPartType: truckPartType === 'cab' ? 'cab' : 'vehicle',
      vehicleCondition: condition || (truckPartType === 'cab' ? 'Driver Cab' : 'Truck Half Cut'),
    };
  }
  if (vehicleCategory === 'machinery' || String(record.machineryType || '').trim()) {
    const machineryCatalog = require('./machinery-brand-catalog');
    const machineryType = String(record.machineryType || 'other').trim() || 'other';
    return {
      ...record,
      vehicleCategory: 'machinery',
      truckPartType: '',
      machineryType,
      vehicleCondition: condition || machineryCatalog.typeLabel(machineryType),
    };
  }
  if (slug.includes('-machinery-')) {
    const machineryCatalog = require('./machinery-brand-catalog');
    const match = slug.match(/-machinery-([a-z0-9-]+)-hc/i);
    const machineryType = String(record.machineryType || match?.[1] || 'other').replace(/-hc.*$/i, '');
    return {
      ...record,
      vehicleCategory: 'machinery',
      truckPartType: '',
      machineryType,
      vehicleCondition: condition || machineryCatalog.typeLabel(machineryType),
    };
  }
  if (slug.includes('-truck-cab-')) {
    return {
      ...record,
      vehicleCategory: 'truck',
      truckPartType: 'cab',
      vehicleCondition: 'Driver Cab',
    };
  }
  if (slug.includes('-truck-half-cut-')) {
    return {
      ...record,
      vehicleCategory: 'truck',
      truckPartType: 'vehicle',
      vehicleCondition: 'Truck Half Cut',
    };
  }
  return {
    ...record,
    vehicleCategory: vehicleCategory === 'truck'
      ? 'truck'
      : (vehicleCategory === 'machinery' ? 'machinery' : 'passenger'),
    truckPartType: vehicleCategory === 'truck' ? (truckPartType === 'cab' ? 'cab' : 'vehicle') : '',
    vehicleCondition: condition || record.vehicleCondition || (vehicleCategory === 'machinery' ? 'Construction Equipment' : 'Half Cut'),
  };
}

function catalogCutLabel(item) {
  if (item?.truckPartType === 'cab') return 'Driver Cab';
  if (item?.vehicleCategory === 'truck') return 'Truck Half Cut';
  if (item?.vehicleCategory === 'machinery') {
    return item?.vehicleCondition || require('./machinery-brand-catalog').typeLabel(item?.machineryType);
  }
  return item?.vehicleCondition || 'Half Cut';
}

function catalogSlugCutSegment(item) {
  if (item?.vehicleCategory === 'truck') {
    return item?.truckPartType === 'cab' ? 'truck-cab' : 'truck-half-cut';
  }
  if (item?.vehicleCategory === 'machinery') {
    const type = String(item?.machineryType || 'equipment').trim() || 'equipment';
    return `machinery-${type}`;
  }
  return 'half-cut';
}

function rebuildInventoryDerivedFields(item) {
  if (!item || !item.stockId) return item;
  const next = { ...item };
  if (next.brand && next.model && next.engineCode) {
    next.title = `${next.brand} ${next.model} ${next.engineCode} ${catalogCutLabel(next)}`;
  } else if (next.brand && next.model) {
    next.title = `${next.brand} ${next.model} ${catalogCutLabel(next)}`;
  }
  if (next.brandSlug && next.model && next.year) {
    const enginePart = slugifyPart(next.engineCode) || (next.truckPartType === 'cab' ? 'cab' : '');
    next.slug = [
      next.brandSlug,
      slugifyPart(next.model),
      next.year,
      enginePart,
      catalogSlugCutSegment(next),
      String(next.stockId).toLowerCase(),
    ].filter(Boolean).join('-');
  }
  if (next.brand && next.model && next.year) {
    const vehicleHint = next.truckPartType === 'cab'
      ? 'driver cab'
      : (next.vehicleCategory === 'truck'
        ? 'light truck'
        : (next.vehicleCategory === 'machinery'
          ? (next.vehicleCondition || 'construction equipment').toLowerCase()
          : 'vehicle'));
    const engineHint = next.engineCode ? ` with ${next.engineCode}` : '';
    const autoDesc = `${next.year} ${next.brand} ${next.model} ${vehicleHint}${engineHint} — supplier-verified listing via AsiaPower.`;
    if (!next.shortDescription || /supplier-verified listing via AsiaPower/i.test(next.shortDescription)) {
      next.shortDescription = autoDesc;
    }
  }
  return next;
}

function applyNameCorrection(record, catalog) {
  if (!record || !catalog) return { record, changed: false };
  const n = normalizeVehicleNames(record.brand, record.model, catalog);
  if (!n.corrected) return { record, changed: false };

  const next = rebuildInventoryDerivedFields({
    ...record,
    brand: n.brand,
    brandSlug: n.brandSlug,
    model: n.model,
    nameCorrections: {
      ...(record.nameCorrections || {}),
      ...(n.originalBrand ? { brand: n.originalBrand } : {}),
      ...(n.originalModel ? { model: n.originalModel } : {}),
      correctedAt: new Date().toISOString(),
    },
  });
  return { record: next, changed: true };
}

function normalizeSubmissionRecord(submission, rootDir) {
  let next = normalizeListingMeta(submission);
  if (next?.vehicleCategory === 'truck') {
    const truckCatalog = require('./truck-brand-catalog');
    return truckCatalog.normalizeTruckRecord(next, rootDir);
  }
  const catalog = loadCatalog(rootDir);
  return applyNameCorrection(next, catalog).record;
}

function normalizeInventoryRecord(item, rootDir) {
  let next = normalizeListingMeta(item);
  if (next?.vehicleCategory === 'truck') {
    const truckCatalog = require('./truck-brand-catalog');
    const normalized = truckCatalog.normalizeTruckRecord(next, rootDir);
    return rebuildInventoryDerivedFields(normalized);
  }
  if (next?.vehicleCategory === 'machinery') {
    const machineryCatalog = require('./machinery-brand-catalog');
    const normalized = machineryCatalog.normalizeMachineryRecord(next, rootDir);
    return rebuildInventoryDerivedFields(normalized);
  }
  const catalog = loadCatalog(rootDir);
  return applyNameCorrection(next, catalog).record;
}

function findLinkedSubmission(approvedItem, submissions) {
  if (!approvedItem || !Array.isArray(submissions)) return null;
  const stockId = String(approvedItem.stockId || '').toUpperCase();
  const submissionId = String(approvedItem.submissionId || '');
  return submissions.find((sub) => {
    if (submissionId && sub.submissionId === submissionId) return true;
    return stockId && String(sub.approvedStockId || '').toUpperCase() === stockId;
  }) || null;
}

function syncApprovedFromSubmission(approvedItem, submissions) {
  const submission = findLinkedSubmission(approvedItem, submissions);
  if (!submission) return approvedItem;
  const subMeta = normalizeListingMeta(submission);
  if (subMeta.vehicleCategory === 'truck' || subMeta.vehicleCategory === 'machinery') {
    return {
      ...approvedItem,
      vehicleCategory: subMeta.vehicleCategory,
      truckPartType: subMeta.truckPartType || '',
      machineryType: subMeta.machineryType || approvedItem.machineryType || '',
      vehicleCondition: subMeta.vehicleCondition,
    };
  }
  return approvedItem;
}

function normalizeState(state, rootDir) {
  const catalog = loadCatalog(rootDir);
  if (!catalog) return { state, changed: false };

  let changed = false;
  const submissions = (state.submissions || []).map((item) => {
    let next = normalizeListingMeta(item);
    if (next?.vehicleCategory === 'truck') {
      const truckCatalog = require('./truck-brand-catalog');
      next = truckCatalog.normalizeTruckRecord(next, rootDir);
    } else if (next?.vehicleCategory === 'machinery') {
      const machineryCatalog = require('./machinery-brand-catalog');
      next = machineryCatalog.normalizeMachineryRecord(next, rootDir);
    } else {
      const { record, changed: itemChanged } = applyNameCorrection(next, catalog);
      next = record;
      if (itemChanged) changed = true;
    }
    if (JSON.stringify(next) !== JSON.stringify(item)) changed = true;
    return next;
  });
  const approved = (state.approved || []).map((item) => {
    let next = syncApprovedFromSubmission(item, submissions);
    next = normalizeListingMeta(next);
    if (next?.vehicleCategory === 'truck') {
      const truckCatalog = require('./truck-brand-catalog');
      next = rebuildInventoryDerivedFields(truckCatalog.normalizeTruckRecord(next, rootDir));
    } else if (next?.vehicleCategory === 'machinery') {
      const machineryCatalog = require('./machinery-brand-catalog');
      next = rebuildInventoryDerivedFields(machineryCatalog.normalizeMachineryRecord(next, rootDir));
    } else {
      const { record, changed: itemChanged } = applyNameCorrection(next, catalog);
      next = record;
      if (itemChanged) changed = true;
    }
    if (item.slug && next.slug && item.slug !== next.slug) {
      next.slugAliases = [...new Set([...(Array.isArray(next.slugAliases) ? next.slugAliases : []), item.slug])];
      changed = true;
    }
    if (JSON.stringify(next) !== JSON.stringify(item)) changed = true;
    return next;
  });
  return { state: { submissions, approved }, changed };
}

module.exports = {
  loadCatalog,
  normalizeVehicleNames,
  normalizeListingMeta,
  normalizeSubmissionRecord,
  normalizeInventoryRecord,
  normalizeState,
  rebuildInventoryDerivedFields,
};
