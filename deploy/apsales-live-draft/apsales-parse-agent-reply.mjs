/**
 * Parse sales-agent WhatsApp JSON replies and build deal-aware exception fallbacks.
 * Extracted for unit tests (openclaw_reply_not_json hardening).
 */

export function extractFirstJsonObject(raw) {
  const text = String(raw || "");
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function candidateBodies(raw) {
  const bodies = [];
  const fullFence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fullFence) bodies.push(fullFence[1].trim());
  const anyFence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (anyFence) bodies.push(anyFence[1].trim());
  bodies.push(raw);
  const extracted = extractFirstJsonObject(raw);
  if (extracted) bodies.push(extracted.trim());
  // de-dupe while preserving order
  const seen = new Set();
  return bodies.filter((b) => {
    if (!b || seen.has(b)) return false;
    seen.add(b);
    return true;
  });
}

/**
 * @param {string} text - agent payload text
 * @returns {{ reply: string, needsPriceConfirmation: boolean }}
 * @throws Error with message openclaw_reply_not_json | openclaw_reply_invalid; may set err.rawText
 */
export function parseAgentReply(text) {
  const raw = String(text || "").trim();
  let sawInvalidReply = false;

  for (const body of candidateBodies(raw)) {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      continue;
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    if (!Object.prototype.hasOwnProperty.call(payload, "customer_reply")) continue;

    const reply = String(payload.customer_reply || "").trim();
    if (!reply || reply.length > 500) {
      sawInvalidReply = true;
      continue;
    }
    return {
      reply,
      needsPriceConfirmation: payload.needs_price_confirmation === true,
    };
  }

  if (sawInvalidReply) {
    const err = new Error("openclaw_reply_invalid");
    err.rawText = raw.slice(0, 1000);
    throw err;
  }
  const err = new Error("openclaw_reply_not_json");
  err.rawText = raw.slice(0, 1000);
  throw err;
}

function extractVinOrFrameFromText(text) {
  const upper = String(text || "").toUpperCase();
  const vin = upper.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  if (vin) return { id: vin[1], id_type: "vin17" };
  const frame = upper.match(/\b([A-Z]{2,5}\d{1,3}-\d{6,8})\b/);
  if (frame) return { id: frame[1], id_type: "jp_frame" };
  return null;
}

/**
 * Exception / rate-limit fallback. Must respect dealState so we never re-ask VIN
 * after the customer already confirmed a vehicle on an active deal.
 */
export function buildExceptionFallback(text, mediaPlaceholder, dealState = null) {
  const typed = extractVinOrFrameFromText(text);
  const lower = String(text || "").toLowerCase();
  const wantsGear = /\b(gear\s*box|gearbox|transmission|auto|manual)\b/i.test(lower);
  const knownVin = String(dealState?.vin || "").trim();
  const knownFrame = String(dealState?.frame_no || "").trim();
  const knownId = knownVin || knownFrame || typed?.id || "";
  const brand = String(dealState?.brand || "").trim();
  const model = String(dealState?.model || "").trim();
  const engine = String(dealState?.engine_code || "").trim();
  const part = String(dealState?.part_intent || "").trim();
  const vehicleBits = [brand, model, engine].filter(Boolean).join(" / ");

  // Active deal with confirmed VIN — never ask for VIN/model again.
  if (knownVin || knownFrame || dealState?.brand) {
    if (part === "gearbox" || wantsGear) {
      return vehicleBits
        ? `Got it — we already have ${vehicleBits} on file. Continuing the gearbox deal — what do you need next?`
        : "Got it — we already have your VIN on file. Continuing this gearbox deal — what do you need next?";
    }
    if (part === "engine") {
      return vehicleBits
        ? `Got it — we already have ${vehicleBits} on file. Continuing the engine deal — what do you need next?`
        : "Got it — we already have your VIN on file. Continuing this engine deal — what do you need next?";
    }
    return vehicleBits
      ? `Got it — we already have ${vehicleBits} on file. Sorry for the short delay — what do you need next on this deal?`
      : "Got it — we already have your VIN on file. Sorry for the short delay — what do you need next on this deal?";
  }

  if (typed?.id) {
    return wantsGear
      ? `Got it — ${typed.id}. Real stock, photos and VIN are on www.asia-power.com — for the gearbox, automatic or manual, and which city/port?`
      : `Got it — ${typed.id}. See real stock, photos and VIN on www.asia-power.com — engine, gearbox, or half-cut?`;
  }
  if (wantsGear) {
    return "Real stock, photos and VIN are on www.asia-power.com — for the gearbox, automatic or manual, and please share the VIN/frame so I can match the right unit.";
  }
  if (mediaPlaceholder) {
    return "Got your photo — you can see our real stock, photos and VIN on www.asia-power.com. Could you also send the VIN or chassis number?";
  }
  void knownId;
  return "Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?";
}
