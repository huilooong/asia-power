'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/** @type {Map<string, object>} */
const cacheByRoot = new Map();

function normCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

function normModel(value) {
  return String(value || '').trim().toLowerCase();
}

function runJs(rootDir, relPath) {
  const candidates = [
    path.join(rootDir, 'public', relPath),
    path.join(rootDir, relPath),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const sandbox = { window: {} };
      vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
      return sandbox.window;
    } catch (err) {
      console.warn('[static-powertrain-catalog] load failed:', relPath, err.message);
    }
  }
  return {};
}

function loadStaticCatalog(rootDir) {
  const key = path.resolve(rootDir);
  if (cacheByRoot.has(key)) return cacheByRoot.get(key);

  const engineWin = runJs(rootDir, 'js/engine-directory.js');
  const gearboxWin = runJs(rootDir, 'js/gearbox-directory.js');
  const chassisWin = runJs(rootDir, 'js/chassis-directory.js');

  /** @type {Record<string, Set<string>>} */
  const engines = {};
  /** @type {Record<string, Set<string>>} */
  const gearboxes = {};
  /** @type {Record<string, Set<string>>} */
  const chassis = {};

  Object.entries(engineWin.ENGINE_DIRECTORY || {}).forEach(([slug, brand]) => {
    if (!engines[slug]) engines[slug] = new Set();
    (brand.models || []).forEach((model) => {
      if (model?.code) engines[slug].add(normCode(model.code));
    });
  });

  Object.entries(gearboxWin.GEARBOX_DIRECTORY || {}).forEach(([slug, brand]) => {
    if (!gearboxes[slug]) gearboxes[slug] = new Set();
    (brand.models || []).forEach((model) => {
      if (model?.code) gearboxes[slug].add(normCode(model.code));
    });
  });

  Object.entries(chassisWin.CHASSIS_DIRECTORY || {}).forEach(([slug, brand]) => {
    if (!chassis[slug]) chassis[slug] = new Set();
    (brand.models || []).forEach((model) => {
      if (model?.model) chassis[slug].add(normModel(model.model));
    });
  });

  const catalog = { engines, gearboxes, chassis };
  cacheByRoot.set(key, catalog);
  return catalog;
}

function isStaticEngine(rootDir, brandSlug, code) {
  const catalog = loadStaticCatalog(rootDir);
  const set = catalog.engines[String(brandSlug || '').trim()];
  return set ? set.has(normCode(code)) : false;
}

function isStaticGearbox(rootDir, brandSlug, code) {
  const catalog = loadStaticCatalog(rootDir);
  const set = catalog.gearboxes[String(brandSlug || '').trim()];
  return set ? set.has(normCode(code)) : false;
}

function isStaticChassis(rootDir, brandSlug, model) {
  const catalog = loadStaticCatalog(rootDir);
  const set = catalog.chassis[String(brandSlug || '').trim()];
  return set ? set.has(normModel(model)) : false;
}

module.exports = {
  loadStaticCatalog,
  isStaticEngine,
  isStaticGearbox,
  isStaticChassis,
  normCode,
  normModel,
};
