'use strict';

const fs = require('fs');
const path = require('path');
const nameNorm = require('./vehicle-name-normalize');

const MAX_MODELS_PER_BRAND = 500;
const MAX_MODEL_LEN = 80;

function createVehicleModelMemory(dataDir, rootDir) {
  const file = path.join(dataDir, 'vehicle-model-memory.json');

  function load() {
    if (!fs.existsSync(file)) return {};
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
      return {};
    }
  }

  function save(data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }

  function staticModels(brand) {
    const catalog = nameNorm.loadCatalog(rootDir);
    return catalog?.getModels?.(brand) || [];
  }

  function isStaticModel(brand, model) {
    const target = String(model || '').trim().toLowerCase();
    if (!target) return false;
    return staticModels(brand).some((entry) => String(entry).trim().toLowerCase() === target);
  }

  function remember(brand, model) {
    const brandName = String(brand || '').trim();
    const modelName = String(model || '').trim().slice(0, MAX_MODEL_LEN);
    if (!brandName || !modelName || modelName.length < 2) return false;
    if (isStaticModel(brandName, modelName)) return false;

    const store = load();
    if (!Array.isArray(store[brandName])) store[brandName] = [];

    const exists = store[brandName].some((entry) => String(entry).trim().toLowerCase() === modelName.toLowerCase());
    if (exists) return false;

    store[brandName].push(modelName);
    store[brandName].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    if (store[brandName].length > MAX_MODELS_PER_BRAND) {
      store[brandName] = store[brandName].slice(-MAX_MODELS_PER_BRAND);
    }
    save(store);
    return true;
  }

  function rememberVehicle(vehicle) {
    if (!vehicle || typeof vehicle !== 'object') return false;
    return remember(vehicle.brand, vehicle.model);
  }

  function getAll() {
    return load();
  }

  function getForBrand(brand) {
    const brandName = String(brand || '').trim();
    if (!brandName) return [];
    return (load()[brandName] || []).slice();
  }

  return {
    file,
    remember,
    rememberVehicle,
    getAll,
    getForBrand,
    isStaticModel,
  };
}

module.exports = { createVehicleModelMemory };
