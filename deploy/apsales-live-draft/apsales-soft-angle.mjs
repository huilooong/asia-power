/**
 * Stage-3 soft chat angles (5W2H material every turn — judgment-based, not
 * gated only on possible_repeat_detected; answer the customer first).
 * Does NOT touch payment_status / fulfillment_stage from closing-flow.
 */

/** Holding / stall phrases that loop while waiting for team quote. */
const HOLDING_PHRASE_RES = [
  /\bteam\s+(is\s+)?(still\s+)?(checking|confirming)\b/i,
  /\bstill\s+confirming\b/i,
  /\bteam\s+will\s+confirm\b/i,
  /\bworking\s+on\s+confirming\b/i,
  /\bwe\s+are\s+checking\s+(the\s+)?price\b/i,
  /\bchecking\s+the\s+price\b/i,
  /\bwaiting\s+for\s+(the\s+)?(team|confirmation|price)\b/i,
  /\bwill\s+(get|come)\s+back\b/i,
  /\bapologies?\s+for\s+the\s+wait\b/i,
];

export const CHAT_ANGLES = Object.freeze(["why", "when", "where", "how", "how_much", "none"]);

function normalizeReply(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function holdingHits(text) {
  const raw = String(text || "");
  return HOLDING_PHRASE_RES.filter((re) => re.test(raw)).map((re) => re.source);
}

/**
 * Deterministic anti-repeat: last 2 agent replies share holding phrases.
 * @param {string[]} recentAgentReplies - newest last, usually length 1–2
 */
export function detectPossibleRepeat(recentAgentReplies) {
  const replies = (Array.isArray(recentAgentReplies) ? recentAgentReplies : [])
    .map((r) => String(r || "").trim())
    .filter(Boolean)
    .slice(-2);
  if (replies.length < 2) {
    return {
      possible_repeat_detected: false,
      matched_phrases: [],
      recent_agent_replies: replies,
    };
  }
  const [a, b] = replies;
  const hitsA = new Set(holdingHits(a));
  const hitsB = new Set(holdingHits(b));
  const matched = [...hitsA].filter((p) => hitsB.has(p));
  // Two consecutive holding/wait-loop replies = repeat risk (even if phrase variants differ)
  const bothHolding = hitsA.size > 0 && hitsB.size > 0;
  const normA = normalizeReply(a);
  const normB = normalizeReply(b);
  const nearDup =
    bothHolding &&
    (normA === normB ||
      (normA.length > 40 &&
        normB.length > 40 &&
        (normA.includes(normB.slice(0, 40)) || normB.includes(normA.slice(0, 40)))));

  return {
    possible_repeat_detected: matched.length > 0 || bothHolding || nearDup,
    matched_phrases: matched.length ? matched : [...hitsA, ...hitsB],
    recent_agent_replies: replies,
  };
}

/**
 * Optional 5W2H angles not yet covered in deal_state.
 * Reuses destination_port / quantity / payment_notes only — never invents
 * parallel payment/fulfillment enums.
 */
export function uncoveredClosingAngles(dealState) {
  const d = dealState || {};
  const uncovered = [];
  // why / when are conversational; no dedicated schema fields from closing-flow
  if (d.last_chat_angle !== "why") uncovered.push("why");
  if (d.last_chat_angle !== "when") uncovered.push("when");
  // where/how/how_much (port, payment, quantity) are stage-3 per LIVE-RULES
  // three-stage flow — do not surface until vehicle + part are locked
  // (stage 1), otherwise the agent gets nudged to ask port/payment/quantity
  // before it even knows what it's selling.
  const vehiclePartLocked = Boolean((d.vin || d.frame_no) && d.part_intent);
  if (!vehiclePartLocked) return uncovered;
  if (!d.destination_port && d.last_chat_angle !== "where") uncovered.push("where");
  const payKnown =
    Boolean(d.payment_notes) ||
    (d.payment_status && d.payment_status !== "unpaid");
  if (!payKnown && d.last_chat_angle !== "how") uncovered.push("how");
  if (!d.quantity && d.last_chat_angle !== "how_much") uncovered.push("how_much");
  return uncovered;
}

export function normalizeChatAngleUsed(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!v || v === "none" || v === "null") return "";
  if (CHAT_ANGLES.includes(v)) return v === "none" ? "" : v;
  const aliases = {
    urgency: "when",
    urgent: "when",
    port: "where",
    destination: "where",
    payment: "how",
    qty: "how_much",
    quantity: "how_much",
    purpose: "why",
    use: "why",
  };
  return aliases[v] || "";
}

export function stampChatAngle(prev, angle, nowIso, { dryRun = false } = {}) {
  const cleaned = normalizeChatAngleUsed(angle);
  if (!cleaned) return {};
  return {
    last_chat_angle: cleaned,
    last_chat_angle_at: nowIso || new Date().toISOString(),
    last_chat_angle_dry_run: Boolean(dryRun),
  };
}
