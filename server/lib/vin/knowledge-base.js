'use strict';

/**
 * AsiaPower Vehicle Knowledge Base — long-term VIN/vehicle learning store.
 *
 * Backed by JSON files for now (see project decision: small data volume,
 * git-friendly, multi-agent shared, migrate to Supabase/Postgres later once
 * mature). All access goes through `createJsonRepository`, so a future
 * database migration only swaps the repository implementation — this
 * module's public methods stay the same.
 *
 * Stores:
 *  - brandDictionary / modelDictionary / engineDictionary / gearboxDictionary:
 *      confirmed vocabulary AsiaPower recognizes, learned from approved VIN decodes.
 *  - vehicleMapping: the QXB API field → AsiaPower schema field translation table.
 *      Only populated after a real API response has been captured and reviewed —
 *      see server/lib/vin/mapping-layer.js.
 *  - vinCache: raw decode result per VIN, so the same VIN is never re-requested.
 *  - unknownQueue: anything the decoder couldn't match against existing
 *      dictionaries (unknown brand/model/engine/gearbox) — awaits human review.
 */

const path = require('path');
const { createJsonRepository } = require('./repository');

function createVehicleKnowledgeBase(dataDir) {
  const kbDir = path.join(dataDir, 'knowledge-base');

  const brandDictionary = createJsonRepository(path.join(kbDir, 'brand-dictionary.json'), {});
  const modelDictionary = createJsonRepository(path.join(kbDir, 'model-dictionary.json'), {});
  const engineDictionary = createJsonRepository(path.join(kbDir, 'engine-dictionary.json'), {});
  const gearboxDictionary = createJsonRepository(path.join(kbDir, 'gearbox-dictionary.json'), {});
  const vehicleMapping = createJsonRepository(path.join(kbDir, 'vehicle-mapping.json'), {
    status: 'PENDING_REAL_RESPONSE',
    note: 'Mapping must not be written until a real QXB VinDecoder/decode response has been captured and reviewed. See server/lib/vin/mapping-layer.js.',
    fields: {},
    history: [],
  });
  const vinCache = createJsonRepository(path.join(kbDir, 'vin-cache.json'), {});
  const approvedVinFacts = createJsonRepository(path.join(kbDir, 'approved-vin-facts.json'), {});
  const unknownQueue = createJsonRepository(path.join(kbDir, 'unknown-queue.json'), { items: [] });

  function nowIso() {
    return new Date().toISOString();
  }

  // --- VIN cache -----------------------------------------------------------

  function getCachedVin(vin) {
    const store = vinCache.read();
    return store[vin] || null;
  }

  function getApprovedVinFact(vin) {
    const key = String(vin || '').trim().toUpperCase();
    if (key.length !== 17) return null;
    const store = approvedVinFacts.read();
    return store[key] || null;
  }

  function cacheVinResult(vin, rawResponse, meta = {}) {
    return vinCache.update((store) => {
      store[vin] = {
        vin,
        rawResponse,
        source: meta.source || 'qxb',
        requestedAt: meta.requestedAt || nowIso(),
        cachedAt: nowIso(),
      };
      return store;
    });
  }

  // --- Unknown queue ---------------------------------------------------------

  function enqueueUnknown(entry) {
    return unknownQueue.update((store) => {
      store.items.push({
        id: `UNK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: entry.type, // 'brand' | 'model' | 'engine' | 'gearbox' | 'mapping_conflict'
        value: entry.value,
        vin: entry.vin || null,
        context: entry.context || null,
        rawResponse: entry.rawResponse || null,
        detectedAt: nowIso(),
        status: 'pending',
        reviewedAt: null,
        reviewedBy: null,
      });
      return store;
    });
  }

  function listUnknown(status = 'pending') {
    const store = unknownQueue.read();
    return status ? store.items.filter((item) => item.status === status) : store.items;
  }

  function resolveUnknown(id, decision) {
    return unknownQueue.update((store) => {
      const item = store.items.find((entry) => entry.id === id);
      if (!item) return store;
      item.status = decision.status; // 'approved' | 'rejected'
      item.reviewedAt = nowIso();
      item.reviewedBy = decision.reviewedBy || null;
      return store;
    });
  }

  // --- Dictionaries (confirmed vocabulary only — populated after human review) --

  function learnBrand(slug, record) {
    return brandDictionary.update((store) => {
      store[slug] = { ...(store[slug] || {}), ...record, learnedAt: nowIso() };
      return store;
    });
  }

  function learnModel(brandSlug, modelKey, record) {
    return modelDictionary.update((store) => {
      if (!store[brandSlug]) store[brandSlug] = {};
      store[brandSlug][modelKey] = { ...(store[brandSlug][modelKey] || {}), ...record, learnedAt: nowIso() };
      return store;
    });
  }

  function learnEngine(brandSlug, engineCode, record) {
    return engineDictionary.update((store) => {
      if (!store[brandSlug]) store[brandSlug] = {};
      store[brandSlug][engineCode] = { ...(store[brandSlug][engineCode] || {}), ...record, learnedAt: nowIso() };
      return store;
    });
  }

  function learnGearbox(brandSlug, gearboxCode, record) {
    return gearboxDictionary.update((store) => {
      if (!store[brandSlug]) store[brandSlug] = {};
      store[brandSlug][gearboxCode] = { ...(store[brandSlug][gearboxCode] || {}), ...record, learnedAt: nowIso() };
      return store;
    });
  }

  // --- Mapping layer persistence (Before/After traceable) ---------------------

  function recordMappingDecision(fields, rationale) {
    return vehicleMapping.update((store) => {
      store.history.push({
        at: nowIso(),
        before: store.fields,
        after: fields,
        rationale: rationale || null,
      });
      store.fields = fields;
      store.status = 'ACTIVE';
      return store;
    });
  }

  return {
    dirs: { kbDir },
    repos: { brandDictionary, modelDictionary, engineDictionary, gearboxDictionary, vehicleMapping, vinCache, approvedVinFacts, unknownQueue },
    getCachedVin,
    getApprovedVinFact,
    cacheVinResult,
    enqueueUnknown,
    listUnknown,
    resolveUnknown,
    learnBrand,
    learnModel,
    learnEngine,
    learnGearbox,
    recordMappingDecision,
  };
}

module.exports = { createVehicleKnowledgeBase };
