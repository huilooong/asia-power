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
 * STATUS: validated against 10 real production VINs (2026-06-27, sampled
 * from data/half-cut-submissions.json + half-cut-approved.json on the VPS),
 * 9/10 decoded successfully. Field names below are taken directly from real
 * responses (see data/knowledge-base/vin-cache.json) — not guessed from
 * other providers.
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
  'transmissionType',
  'transmissionDescription',
  'gearboxModel',
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
  trans_type: 'transmissionType',  // "MT" — bare type (CVT/MT/AT), combined with shift_num below into transmissionCode
  trans_des: 'transmissionDescription', // "手动变速器(MT)"
  driver_type: 'drivetrainRaw',    // "前置前驱" — Chinese descriptive phrase, NOT AsiaPower's "2WD/4WD/AWD/RWD" codes
  fuel_type: 'fuelTypeRaw',        // "汽油" — Chinese, NOT AsiaPower's "Petrol/Diesel/Hybrid" enum
  body: 'bodyType',                // "5门5座两厢车"
  factory: 'manufacturer',         // "东风日产"
};

// Fields whose VALUES need a human-reviewed translation dictionary before
// they can populate AsiaPower's existing enums. Each unseen value must go
// through knowledge-base unknownQueue, not be guessed here.
const NEEDS_DICTIONARY = ['drivetrainRaw', 'fuelTypeRaw', 'brand'];

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

  // Combine shift_num (gear count) + trans_type into AsiaPower's existing
  // "5MT"/"6AT" convention. shift_num is numeric for MT/AT ("5", "6", ...)
  // but a Chinese phrase for CVT ("无级变速") — only prefix the gear count
  // when it's actually numeric, otherwise transmissionCode is just the type.
  const shiftNum = model.shift_num;
  if (mapped.transmissionType) {
    mapped.transmissionCode = /^\d+$/.test(String(shiftNum || '').trim())
      ? `${shiftNum}${mapped.transmissionType}`
      : mapped.transmissionType;
  }

  // result.trans_code is a SIBLING of models[] (not a field inside the model
  // object) — the actual gearbox model number (e.g. "RE0F10A/JF011E"), distinct
  // from trans_type/trans_des which only describe the gearbox TYPE (CVT/MT/AT).
  // Confirmed present in real responses 2026-06-27 (sample VIN batch).
  //
  // Observed data quality issue in QXB's own database (VIN LBEJMBKB48X114862,
  // 87-VIN sample 2026-06-27): trans_code returned as "G4GC" — identical to
  // engine_code for that record, i.e. QXB mixed up engine/gearbox fields on
  // their end. Defend against propagating that: if trans_code equals the
  // engine code, treat it as unreliable and drop it rather than mapping it.
  const transCode = rawResponseJson?.result?.trans_code;
  if (transCode && transCode !== mapped.engineCode) {
    mapped.gearboxModel = transCode;
  }

  const needsDictionary = NEEDS_DICTIONARY
    .filter((field) => mapped[field] !== undefined)
    .map((field) => ({ field, value: mapped[field] }));

  return { mapped, rawUnmapped, needsDictionary };
}

module.exports = { ASIAPOWER_VEHICLE_SCHEMA_KEYS, DIRECT_FIELD_MAP, NEEDS_DICTIONARY, applyMapping };
