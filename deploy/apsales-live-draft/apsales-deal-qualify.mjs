/**
 * Precomputed deal flags for the sales agent prompt.
 * Logic lives in code so the model obeys a boolean, not a buried rule bullet.
 */

/** $50 inspection fee only for high-value powertrain parts. */
export const INSPECTION_FEE_PARTS = Object.freeze(new Set(["engine", "gearbox"]));

/**
 * Year from free text (e.g. "Honda Civic 2007").
 * @returns {string|null}
 */
export function extractYearFromText(text) {
  const raw = String(text || "");
  const m = raw.match(/\b((?:19[89]\d|20[0-2]\d))\b/);
  return m ? m[1] : null;
}

/**
 * Engine code from free text. Prefers hyphenated OEM-style codes (1ND-TV, 2TR-FE).
 * Avoids matching bare model words like "C180" alone.
 * @returns {string|null}
 */
export function extractEngineCodeFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const labeled = raw.match(
    /\b(?:engine\s*code|motor\s*code|code\s*moteur|发动机代码|发动机型号)\s*[:：]?\s*([A-Z0-9][A-Z0-9-]{1,12})\b/i,
  );
  if (labeled) return labeled[1].toUpperCase();
  // OEM-style: 1ND-TV, 2TR-FE, 1ZZ-FE (digit or letter lead + hyphen).
  const hyphenated = raw.match(/\b([A-Z0-9]{2,6}-[A-Z0-9]{1,6})\b/i);
  if (hyphenated) return hyphenated[1].toUpperCase();
  return null;
}

/** VIN / frame / (year + engine_code) — enough to quote without re-asking identity. */
export function hasIdentifyingInfo(dealState) {
  const d = dealState || {};
  if (String(d.vin || "").trim()) return true;
  if (String(d.frame_no || "").trim()) return true;
  const year = String(d.year || "").trim();
  const engine = String(d.engine_code || "").trim();
  return Boolean(year && engine);
}

/**
 * True when customer already named a part but we still lack VIN or year+engine_code.
 * Model must ask for year+engine (or VIN) and must NOT say it will check price this turn.
 */
export function computeMustQualifyBeforePrice(dealState) {
  const part = String(dealState?.part_intent || "").trim();
  if (!part) return false;
  return !hasIdentifyingInfo(dealState);
}

/** $50 inspection fee language only for engine/gearbox. */
export function computeInspectionFeeApplicable(dealState) {
  const part = String(dealState?.part_intent || "")
    .trim()
    .toLowerCase();
  return INSPECTION_FEE_PARTS.has(part);
}

/**
 * Ask quantity before locking a firm quote — only once identifying info is ready
 * (or team/inventory already has a price path) and quantity is still missing.
 *
 * Wholesale vs retail pricing math is NOT implemented here (waiting on CEO rules).
 */
export function computeMustAskQuantityBeforePrice(dealState, { inventoryMatches } = {}) {
  if (String(dealState?.quantity || "").trim()) return false;
  if (computeMustQualifyBeforePrice(dealState)) return false;
  const hasInventory = Array.isArray(inventoryMatches) && inventoryMatches.length > 0;
  const teamQuoted = String(dealState?.confirmation_status || "") === "team_quoted";
  const ready =
    hasIdentifyingInfo(dealState) ||
    hasInventory ||
    teamQuoted ||
    Boolean(dealState?.part_intent && (dealState?.brand || dealState?.model));
  return Boolean(ready);
}

/**
 * Patch year / engine_code from customer text into deal_state (once).
 */
export function extractVehicleQualifyFromText(text) {
  const out = {};
  const year = extractYearFromText(text);
  if (year) out.year = year;
  const engine = extractEngineCodeFromText(text);
  if (engine) out.engine_code = engine;
  return out;
}

export function mergeVehicleQualifyFields(prev, extracted) {
  const patch = {};
  if (extracted.year && !prev?.year) patch.year = extracted.year;
  if (extracted.engine_code && !prev?.engine_code) patch.engine_code = extracted.engine_code;
  return patch;
}
