/**
 * Stage-1/2 closing memory for +233 deals (Where / How / How much).
 * Passive only — no forced customer interrogation prompts.
 */

const PORT_PATTERNS = [
  { re: /\btema\b/i, value: "Tema" },
  { re: /\btakoradi\b/i, value: "Takoradi" },
  { re: /\baccra\b/i, value: "Accra" },
  { re: /\bapapa\b/i, value: "Apapa" },
  { re: /\btin\s*can\b/i, value: "Tin Can" },
  { re: /\blagos\b/i, value: "Lagos" },
  { re: /\blome\b/i, value: "Lome" },
  { re: /\bcotonou\b/i, value: "Cotonou" },
  { re: /\babidjan\b/i, value: "Abidjan" },
  { re: /\bmombasa\b/i, value: "Mombasa" },
  { re: /\bdar(\s+es)?\s*salaam\b/i, value: "Dar es Salaam" },
  { re: /\bdurban\b/i, value: "Durban" },
];

/**
 * Passiveively extract closing fields the customer already said.
 * @returns {{ destination_port?: string, quantity?: string, payment_notes?: string }}
 */
export function extractClosingFieldsFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return {};
  const out = {};

  for (const { re, value } of PORT_PATTERNS) {
    if (re.test(raw)) {
      out.destination_port = value;
      break;
    }
  }

  const qtyMatch =
    raw.match(/\b(\d+)\s*(units?|pcs|pieces|engines?|gearboxes?|half[\s-]?cuts?|containers?)\b/i) ||
    raw.match(/\b(just\s+one|one\s+unit|a\s+container|one\s+container)\b/i);
  if (qtyMatch) {
    out.quantity = String(qtyMatch[0]).trim().slice(0, 80);
  }

  if (/\b(payment|pay\s+by|t\s*\/\s*t|tt\b|wire|deposit|balance|letter of credit|\bLC\b|cash on)\b/i.test(raw)) {
    out.payment_notes = raw.slice(0, 240);
  }

  return out;
}

export function mergeClosingFields(prev, extracted) {
  const patch = {};
  if (extracted.destination_port && !prev?.destination_port) {
    patch.destination_port = extracted.destination_port;
  }
  if (extracted.quantity && !prev?.quantity) {
    patch.quantity = extracted.quantity;
  }
  if (extracted.payment_notes) {
    // Keep latest payment note snippet if customer adds detail.
    patch.payment_notes = extracted.payment_notes;
  }
  return patch;
}

export function stampBuyingIntentConfirmed(prev, buyingIntentConfirmed, nowIso) {
  if (!buyingIntentConfirmed) return {};
  if (prev?.buying_intent_confirmed_at) return { buying_intent_confirmed: true };
  return {
    buying_intent_confirmed: true,
    buying_intent_confirmed_at: nowIso || new Date().toISOString(),
  };
}

/**
 * Hot-deal stall: team quoted + buying intent + quiet too long + not yet alerted.
 */
export function shouldAlertHotDealStall(dealState, nowMs = Date.now(), stallMs = 2 * 60 * 60 * 1000) {
  if (!dealState || typeof dealState !== "object") return false;
  if (dealState.confirmation_status !== "team_quoted") return false;
  if (!dealState.buying_intent_confirmed && !dealState.buying_intent_confirmed_at) return false;
  if (dealState.stall_alert_sent_at) return false;
  const updated = Date.parse(dealState.updated_at || dealState.buying_intent_confirmed_at || 0);
  if (!Number.isFinite(updated) || updated <= 0) return false;
  return nowMs - updated >= stallMs;
}

export function formatHotDealStallAlert(dealState, senderId) {
  const quietHours = (() => {
    const updated = Date.parse(dealState?.updated_at || 0);
    if (!Number.isFinite(updated)) return "?";
    return ((Date.now() - updated) / 3600000).toFixed(1);
  })();
  const lines = [
    "🔥 Hot deal may be stalling — please follow up",
    `Customer: ${senderId}`,
    `Quoted: ${dealState?.confirmation_status || "n/a"} @ ${dealState?.team_confirmed_at || "n/a"}`,
    `Buying intent since: ${dealState?.buying_intent_confirmed_at || "n/a"}`,
    `Quiet for: ~${quietHours}h (last update ${dealState?.updated_at || "n/a"})`,
    `Port: ${dealState?.destination_port || "(not said)"}`,
    `Qty: ${dealState?.quantity || "(not said)"}`,
    `Payment notes: ${dealState?.payment_notes || "(not said)"}`,
    `VIN/part: ${dealState?.vin || dealState?.frame_no || "n/a"} / ${dealState?.part_intent || "n/a"}`,
  ];
  return lines.join("\n");
}
