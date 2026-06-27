'use strict';

/**
 * Vehicle Mapping Layer.
 *
 *   QXB API response  →  applyMapping()  →  AsiaPower Vehicle Schema
 *
 * This is the ONLY place that should know QXB's actual field names. Business
 * code (inventory correction, knowledge base learning, etc.) must only ever
 * see the AsiaPower schema below. If AsiaPower switches VIN providers later,
 * only this file changes.
 *
 * STATUS: DRAFT — built from exactly ONE real response so far (VIN
 * LGBN22E28AY002810, 2026-06-27, /VinDecoder/decode v4.6.0, number:200).
 * Field *names* below are taken directly from that real response (see
 * data/knowledge-base/vin-cache.json) — not guessed from other providers.
 * Field *value normalization* (Chinese enums → AsiaPower's English codes)
 * is flagged `needsDictionary: true` and intentionally NOT auto-applied:
 * one sample isn't enough to know the full value space (e.g. all possible
 * driver_type or fuel_type strings QXB can return), so these go through
 * the Unknown Queue for human review rather than being hardcoded here.
 *
 * DO NOT use this for batch inventory correction yet — pending user
 * confirmation per project process (small-batch test of 5-10 VINs first).
 */

const ASIAPOWER_VEHICLE_SCHEMA_KEYS = [
  'brand',
  'series',
  'model',
  'year',
  'engineCode',
  'engineDescription',
  'displacementCc',
  'transmissionCode',
  'transmissionDescription',
  'drivetrainRaw',
  'fuelTypeRaw',
  'bodyType',
  'manufacturer',
];

// QXB result.models[0] field name -> AsiaPower schema field name.
// Source: real response captured 2026-06-27 for VIN LGBN22E28AY002810.
const DIRECT_FIELD_MAP = {
  brand: 'brand',           // "日产" — Chinese brand name, not the English "Nissan" AsiaPower uses elsewhere
  series: 'series',         // "玛驰" — Chinese series name
  model_name: 'model',      // "2010款 1.5L 手动易型版" — full trim description, not a clean model string
  years: 'year',            // "2010" (string, not number)
  engine_code: 'engineCode',       // "HR15DE" — matches AsiaPower's existing engineCode convention directly
  engine_desc: 'engineDescription', // "1.5L 107马力 L4"
  displacement: 'displacementCc',  // "1498" — cubic centimeters, NOT liters (AsiaPower's existing brand-catalog.js uses "2.8L" style)
  trans_type: 'transmissionCode',  // "MT" — bare type, missing gear count (AsiaPower convention is "5MT"/"6AT")
  trans_des: 'transmissionDescription', // "手动变速器(MT)"
  driver_type: 'drivetrainRaw',    // "前置前驱" — Chinese descriptive phrase, NOT AsiaPower's "2WD/4WD/AWD/RWD" codes
  fuel_type: 'fuelTypeRaw',        // "汽油" — Chinese, NOT AsiaPower's "Petrol/Diesel/Hybrid" enum
  body: 'bodyType',                // "5门5座两厢车"
  factory: 'manufacturer',         // "东风日产"
};

// Fields whose VALUES need a human-reviewed translation dictionary before
// they can populate AsiaPower's existing enums. Each unseen value must go
// through knowledge-base unknownQueue, not be guessed here.
const NEEDS_DICTIONARY = ['transmissionCode', 'drivetrainRaw', 'fuelTypeRaw', 'brand'];

/**
 * Maps the first model in a QXB decode response to AsiaPower's schema.
 * Returns { mapped, rawUnmapped, needsDictionary } — never silently drops data:
 * any QXB field not in DIRECT_FIELD_MAP is preserved under `rawUnmapped` so
 * nothing is lost while the mapping is still a draft.
 */
function applyMapping(rawResponseJson) {
  const model = rawResponseJson?.result?.models?.[0];
  if (!model) {
    return { mapped: null, rawUnmapped: rawResponseJson, needsDictionary: [], reason: 'no models[0] in response' };
  }

  const mapped = {};
  const rawUnmapped = {};
  Object.entries(model).forEach(([qxbField, value]) => {
    const target = DIRECT_FIELD_MAP[qxbField];
    if (target) {
      mapped[target] = value;
    } else {
      rawUnmapped[qxbField] = value;
    }
  });

  const needsDictionary = NEEDS_DICTIONARY
    .filter((field) => mapped[field] !== undefined)
    .map((field) => ({ field, value: mapped[field] }));

  return { mapped, rawUnmapped, needsDictionary };
}

module.exports = { ASIAPOWER_VEHICLE_SCHEMA_KEYS, DIRECT_FIELD_MAP, NEEDS_DICTIONARY, applyMapping };
