/**
 * Parse sales-agent WhatsApp JSON replies and build deal-aware exception fallbacks.
 * Extracted for unit tests (openclaw_reply_not_json hardening).
 *
 * P0 (2026-07-22): recover plain-text model replies; never send the
 * "Continuing the … deal — what do you need next?" carousal fallback.
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
  const seen = new Set();
  return bodies.filter((b) => {
    if (!b || seen.has(b)) return false;
    seen.add(b);
    return true;
  });
}

function emptyParsedFlags() {
  return {
    needsPriceConfirmation: false,
    supportLineUnreachable: false,
    buyingIntentConfirmed: false,
    quoteDeclineReasonCaptured: "",
    chatAngleUsed: "",
  };
}

/**
 * When the model forgot the JSON wrapper but wrote a real customer-facing
 * answer, recover it instead of throwing openclaw_reply_not_json.
 */
export function looksLikePlainCustomerReply(raw) {
  const t = String(raw || "").trim();
  if (!t || t.length < 12 || t.length > 500) return false;
  if (/^\s*You are AsiaPower/i.test(t)) return false;
  if (/\b(needs_price_confirmation|deal_state|Gateway|sales_hint|customer_reply)\b/i.test(t)) {
    return false;
  }
  if (/^(sorry\s+i\s+cannot|i\s+cannot\s+format|error:|traceback)/i.test(t)) return false;
  if (/^\s*\{[\s\S]*\}\s*$/.test(t)) return false; // bare JSON that failed earlier parse
  // Prefer sentence-like text (letters + space / punctuation).
  if (!/[A-Za-z\u4e00-\u9fff]{8,}/.test(t)) return false;
  if ((t.match(/\n/g) || []).length > 6) return false;
  return true;
}

/**
 * @param {string} text - agent payload text
 * @returns {{ reply: string, needsPriceConfirmation: boolean, supportLineUnreachable: boolean, buyingIntentConfirmed: boolean, quoteDeclineReasonCaptured: string, chatAngleUsed: string, plainTextRecovered?: boolean }}
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
    const declineRaw = payload.quote_decline_reason_captured;
    const quoteDeclineReasonCaptured =
      typeof declineRaw === "string" ? declineRaw.trim().slice(0, 240) : "";
    const chatAngleUsed =
      typeof payload.chat_angle_used === "string"
        ? payload.chat_angle_used.trim().slice(0, 40)
        : "";
    return {
      reply,
      needsPriceConfirmation: payload.needs_price_confirmation === true,
      supportLineUnreachable: payload.support_line_unreachable === true,
      buyingIntentConfirmed: payload.buying_intent_confirmed === true,
      quoteDeclineReasonCaptured,
      chatAngleUsed,
    };
  }

  if (sawInvalidReply) {
    const err = new Error("openclaw_reply_invalid");
    err.rawText = raw.slice(0, 1000);
    throw err;
  }

  if (looksLikePlainCustomerReply(raw)) {
    return {
      reply: raw.slice(0, 500).trim(),
      ...emptyParsedFlags(),
      plainTextRecovered: true,
    };
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

function latestTeamText(dealState) {
  const team = Array.isArray(dealState?.team_replies) ? dealState.team_replies : [];
  for (let i = team.length - 1; i >= 0; i -= 1) {
    const t = String(team[i]?.text || "").trim();
    if (t) return t;
  }
  return "";
}

function vehicleLabel(dealState) {
  const brand = String(dealState?.brand || "").trim();
  const model = String(dealState?.model || "").trim();
  const year = String(dealState?.year || "").trim();
  const engine = String(dealState?.engine_code || "").trim();
  return [year, brand, model, engine].filter(Boolean).join(" ").trim();
}

/**
 * Exception / rate-limit fallback. Must respect dealState so we never re-ask VIN
 * after the customer already confirmed a vehicle on an active deal.
 *
 * Answers the customer's CURRENT question when possible; never asks the vague
 * "what do you need next?" carousel question.
 */
export function buildExceptionFallback(text, mediaPlaceholder, dealState = null) {
  const typed = extractVinOrFrameFromText(text);
  const lower = String(text || "").toLowerCase();
  const knownVin = String(dealState?.vin || "").trim();
  const knownFrame = String(dealState?.frame_no || "").trim();
  const part = String(dealState?.part_intent || "").trim();
  const vehicle = vehicleLabel(dealState) || "your vehicle";
  const teamText = latestTeamText(dealState);
  const teamQuoted =
    String(dealState?.confirmation_status || "") === "team_quoted" ||
    Boolean(dealState?.team_confirmed_at);
  const hasQuantity = Boolean(String(dealState?.quantity || "").trim());

  const asksPrice = /\b(?:how\s*much|price|cost|quote|pricing)\b|多少钱|报价/i.test(lower);
  const asksDelivery =
    /\b(?:days?|shipping|delivery|freight|eta|import|china|ghana|stock|local)\b|几天|多久|海运|进口/i.test(
      lower,
    );
  const asksPayment = /\b(?:pay|payment|deposit|half|full)\b|付款|定金/i.test(lower);

  if (asksPrice) {
    if (teamText && /\d/.test(teamText)) {
      const snippet = teamText.length > 160 ? `${teamText.slice(0, 157)}…` : teamText;
      return hasQuantity
        ? `Our team quoted: ${snippet}. Which port should we ship to?`
        : `Our team quoted: ${snippet}. How many units do you need?`;
    }
    if (teamQuoted) {
      return hasQuantity
        ? `We already have a team price on file for this ${part || "unit"}. Which port should we ship to?`
        : `We already have a team price on file for this ${part || "unit"}. How many units do you need?`;
    }
    return `I'll confirm the exact price with the team for your ${vehicle}. How many units do you need?`;
  }

  if (asksDelivery) {
    if (/china|import|45|60|sea/i.test(teamText)) {
      return `Yes — it ships from China by sea, about 45–60 days (not Accra local stock). Freight/duty is separate. ${
        hasQuantity ? "Which port should we use?" : "How many units do you need?"
      }`;
    }
    return `Stock is in China and ships by sea — usually about 45–60 days, not Accra local stock. ${
      hasQuantity ? "Want the payment steps next?" : "How many units do you need?"
    }`;
  }

  if (asksPayment) {
    return `Ghana customers can usually pay half to ship; others pay in full before shipping. Sea freight is about 45–60 days. ${
      hasQuantity ? "Which port should we use?" : "How many units do you need?"
    }`;
  }

  // Active deal — advance with ONE missing closing detail (never "what next?").
  if (knownVin || knownFrame || dealState?.brand) {
    if (!hasQuantity) {
      return `Got it — ${vehicle} is on file. How many units do you need?`;
    }
    if (part === "engine" && !String(dealState?.engine_code || "").trim()) {
      return `Got it — ${vehicle} is on file. What's the engine code so we can lock the exact unit?`;
    }
    if (!String(dealState?.destination_port || "").trim()) {
      return `Got it — ${vehicle} is on file. Which port or city should we ship to?`;
    }
    if (teamText) {
      const snippet = teamText.length > 140 ? `${teamText.slice(0, 137)}…` : teamText;
      return `Got it — staying with ${vehicle}. Latest from the team: ${snippet}`;
    }
    return `Got it — ${vehicle} is on file. I'll have the team follow up on the next step here on WhatsApp.`;
  }

  if (typed?.id) {
    return `Got it — ${typed.id}. See real stock on www.asia-power.com — engine, gearbox, or half-cut?`;
  }
  if (mediaPlaceholder) {
    return "Got your photo — you can see our real stock on www.asia-power.com. Could you also send the VIN or chassis number?";
  }
  return "Please check our real stock at www.asia-power.com — what VIN or model are you looking for?";
}
