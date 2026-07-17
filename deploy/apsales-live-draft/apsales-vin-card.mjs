/**
 * WhatsApp "confirmation card" after successful VIN / nameplate decode.
 * Plain text + newlines (not Business API rich cards).
 */

function clean(value) {
  return String(value || "").trim();
}

/** Display title-case for MAKE/MODEL-style ALL CAPS from NHTSA. */
export function titleCaseVehicleToken(value) {
  const s = clean(value);
  if (!s) return "";
  // Keep short codes (YD25, 2TR-FE) as-is.
  if (/^[A-Z0-9][A-Z0-9-]{1,12}$/.test(s) && /\d/.test(s)) return s;
  return s
    .toLowerCase()
    .split(/(\s+|[-/])/)
    .map((part) => {
      if (!part || /^[\s\-/]$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

/**
 * @param {object|null|undefined} vehicle vin_decode.vehicle
 * @returns {string|null}
 */
export function formatVehicleConfirmationCard(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return null;

  const brand = titleCaseVehicleToken(vehicle.brand || vehicle.manufacturer);
  const model = titleCaseVehicleToken(vehicle.model || vehicle.model_code);
  const year = clean(vehicle.year);
  const engine = clean(vehicle.engine_code);
  const displacement = clean(vehicle.displacement);
  const frame = clean(vehicle.frame_no);
  const vin = clean(vehicle.vin);

  const lines = ["✅ Vehicle confirmed"];
  if (brand) lines.push(`Brand: ${brand}`);
  if (model) lines.push(`Model: ${model}`);
  if (year) lines.push(`Year: ${year}`);
  if (frame) lines.push(`Frame: ${frame}`);

  if (engine && displacement) {
    lines.push(`Engine: ${engine} (${displacement})`);
  } else if (engine) {
    lines.push(`Engine: ${engine}`);
  } else if (displacement) {
    lines.push(`Displacement: ${displacement}`);
  }

  // OCR-only China VIN path: confirm the ID we read when nothing else decoded.
  const hasIdentity = Boolean(brand || model || year || frame || engine || displacement);
  if (!hasIdentity && vin && !vin.includes("*")) {
    lines.push(`VIN: ${vin}`);
  }

  if (lines.length <= 1) return null;

  lines.push("");
  lines.push(
    "Is this correct? What part are you looking for — engine, gearbox, or half-cut?",
  );
  return lines.join("\n");
}
