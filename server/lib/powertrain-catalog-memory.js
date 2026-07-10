'use strict';

const fs = require('fs');
const path = require('path');
const powertrainLabels = require('./powertrain-labels');

function normCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

function emptyStore() {
  return { engines: {}, gearboxes: {}, chassis: {} };
}

function createPowertrainCatalogMemory(dataDir) {
  const file = path.join(dataDir, 'powertrain-catalog-memory.json');

  function load() {
    if (!fs.existsSync(file)) return emptyStore();
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!data || typeof data !== 'object') return emptyStore();
      return {
        engines: data.engines && typeof data.engines === 'object' ? data.engines : {},
        gearboxes: data.gearboxes && typeof data.gearboxes === 'object' ? data.gearboxes : {},
        chassis: data.chassis && typeof data.chassis === 'object' ? data.chassis : {},
      };
    } catch {
      return emptyStore();
    }
  }

  function save(data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }

  function rememberFromHalfCut(item) {
    const slug = String(item?.brandSlug || '').trim().toLowerCase();
    if (!slug || !item) return false;

    const store = load();
    const context = {
      model: item.model,
      year: item.year,
      drivetrain: item.drivetrain,
      engineCode: item.engineCode,
      transmissionCode: item.transmissionCode,
      stockId: item.stockId || '',
      addedAt: new Date().toISOString(),
      fromInventory: true,
    };
    let changed = false;

    const engineCode = String(item.engineCode || '').trim();
    if (engineCode) {
      if (!Array.isArray(store.engines[slug])) store.engines[slug] = [];
      if (!store.engines[slug].some((entry) => normCode(entry.code) === normCode(engineCode))) {
        store.engines[slug].push({ ...context, code: engineCode });
        changed = true;
      }
    }

    const gearboxCode = String(item.transmissionCode || 'AT').trim();
    const gearbox = {
      ...context,
      code: gearboxCode,
      generic: powertrainLabels.isGenericGearboxCode?.(gearboxCode) ?? true,
    };
    gearbox.label = powertrainLabels.formatGearboxLabel?.(gearbox)
      || `${gearbox.year ? `${gearbox.year} ` : ''}${gearbox.model} ${gearboxCode}`.trim();
    gearbox.key = normCode(gearbox.generic ? gearbox.label : gearbox.code);
    if (gearbox.model) {
      if (!Array.isArray(store.gearboxes[slug])) store.gearboxes[slug] = [];
      if (!store.gearboxes[slug].some((entry) => entry.key === gearbox.key)) {
        store.gearboxes[slug].push(gearbox);
        changed = true;
      }
    }

    const chassis = { ...context, model: String(item.model || '').trim() };
    chassis.label = powertrainLabels.formatChassisLabel?.(chassis)
      || `${chassis.year ? `${chassis.year} ` : ''}${chassis.model} Full Chassis Set`.trim();
    chassis.key = powertrainLabels.chassisEntryKey?.(chassis)
      || `${String(chassis.model || '').trim().toLowerCase()}:${chassis.year || ''}`;
    if (chassis.model) {
      if (!Array.isArray(store.chassis[slug])) store.chassis[slug] = [];
      if (!store.chassis[slug].some((entry) => entry.key === chassis.key)) {
        store.chassis[slug].push(chassis);
        changed = true;
      }
    }

    if (changed) save(store);
    return changed;
  }

  function rebuildFromApproved(approved) {
    const store = emptyStore();
    for (const item of approved || []) {
      const slug = String(item?.brandSlug || '').trim().toLowerCase();
      if (!slug) continue;
      rememberFromHalfCutInStore(store, item, slug);
    }
    save(store);
  }

  function rememberFromHalfCutInStore(store, item, slug) {
    const context = {
      model: item.model,
      year: item.year,
      drivetrain: item.drivetrain,
      engineCode: item.engineCode,
      transmissionCode: item.transmissionCode,
      stockId: item.stockId || '',
      addedAt: item.addedAt || new Date().toISOString(),
      fromInventory: true,
    };

    const engineCode = String(item.engineCode || '').trim();
    if (engineCode) {
      if (!Array.isArray(store.engines[slug])) store.engines[slug] = [];
      if (!store.engines[slug].some((entry) => normCode(entry.code) === normCode(engineCode))) {
        store.engines[slug].push({ ...context, code: engineCode });
      }
    }

    const gearboxCode = String(item.transmissionCode || 'AT').trim();
    const gearbox = {
      ...context,
      code: gearboxCode,
      generic: powertrainLabels.isGenericGearboxCode?.(gearboxCode) ?? true,
    };
    gearbox.label = powertrainLabels.formatGearboxLabel?.(gearbox)
      || `${gearbox.year ? `${gearbox.year} ` : ''}${gearbox.model} ${gearboxCode}`.trim();
    gearbox.key = normCode(gearbox.generic ? gearbox.label : gearbox.code);
    if (gearbox.model) {
      if (!Array.isArray(store.gearboxes[slug])) store.gearboxes[slug] = [];
      if (!store.gearboxes[slug].some((entry) => entry.key === gearbox.key)) {
        store.gearboxes[slug].push(gearbox);
      }
    }

    const chassis = { ...context, model: String(item.model || '').trim() };
    chassis.label = powertrainLabels.formatChassisLabel?.(chassis)
      || `${chassis.year ? `${chassis.year} ` : ''}${chassis.model} Full Chassis Set`.trim();
    chassis.key = powertrainLabels.chassisEntryKey?.(chassis)
      || `${String(chassis.model || '').trim().toLowerCase()}:${chassis.year || ''}`;
    if (chassis.model) {
      if (!Array.isArray(store.chassis[slug])) store.chassis[slug] = [];
      if (!store.chassis[slug].some((entry) => entry.key === chassis.key)) {
        store.chassis[slug].push(chassis);
      }
    }
  }

  function getAll() {
    return load();
  }

  return {
    file,
    getAll,
    rememberFromHalfCut,
    rebuildFromApproved,
  };
}

module.exports = { createPowertrainCatalogMemory };
