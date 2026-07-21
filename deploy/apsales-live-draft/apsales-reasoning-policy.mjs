/** Last-resort text used only if the model's single red-line rewrite is unsafe. */
export function buildEvidenceBoundedFallback(dealState = {}) {
  const engine = String(dealState.engine_code || "").trim();
  const brand = String(dealState.brand || "").trim();
  const model = String(dealState.model || "").trim();
  const year = String(dealState.year || "").trim();
  const part = String(dealState.part_intent || "part").replace(/_/g, " ");
  const vehicle = [year, brand, model].filter(Boolean).join(" ");

  if (engine) {
    const missing = !model ? "Which Toyota model and year is it for?" : "Do you need one unit?";
    return `${engine} identifies the engine family, so I can narrow the correct unit without guessing a final price. ${missing}`;
  }
  if (vehicle) {
    const next = part === "gearbox" ? "Is yours automatic or manual?" : "Please send the VIN so I can narrow the exact fitment.";
    return `I can narrow the correct ${part} for your ${vehicle} without guessing a final price. ${next}`;
  }
  return "I won't guess a final price or stock status. Please send the model, year, and VIN so I can narrow the correct option first.";
}
