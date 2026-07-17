/**
 * Closing memory for deals: port/qty/payment notes + parallel payment_status /
 * fulfillment_stage (video + inspection never skipped because of payment choice).
 * Passive extract from customer text; team WhatsApp text advances fulfillment/payment.
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

export const PAYMENT_STATUSES = Object.freeze([
  "unpaid",
  "inspection_fee_paid",
  "paid_in_full",
  "balance_paid",
]);

export const FULFILLMENT_STAGES = Object.freeze([
  "sourcing",
  "video_sent",
  "inspection_scheduled",
  "inspection_passed",
  "inspection_failed",
  "ready_to_ship",
]);

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
    patch.payment_notes = extracted.payment_notes;
  }
  return patch;
}

/**
 * Customer-side payment signals (passive). Does not skip fulfillment.
 * @returns {{ payment_status?: string }}
 */
export function extractPaymentStatusFromCustomerText(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return {};
  if (/\b(pay(ing|ed)?\s+(in\s+)?full|full\s+payment|pay\s+everything|one[\s-]?time\s+pay|一次性付清|全款)\b/i.test(t)) {
    return { payment_status: "paid_in_full" };
  }
  if (/\b(pay(ing|ed)?\s+(the\s+)?(balance|rest|remaining)|尾款)\b/i.test(t)) {
    return { payment_status: "balance_paid" };
  }
  if (
    /\b(pay(ing|ed)?\s+(\$?\s*)?50|inspection\s+fee|检测费|先付\s*\$?\s*50)\b/i.test(t) ||
    /\b\$\s*50\b/.test(t)
  ) {
    return { payment_status: "inspection_fee_paid" };
  }
  return {};
}

/**
 * Customer says they received / liked the video → video_sent (never skips inspection).
 */
export function extractFulfillmentHintFromCustomerText(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return {};
  if (/\b(video|clip|footage)\b/.test(t) && /\b(got|received|saw|watched|ok|good|fine|thanks|满意|收到)\b/.test(t)) {
    return { fulfillment_stage: "video_sent" };
  }
  return {};
}

/**
 * Team WhatsApp text advances payment / fulfillment (authoritative for inspection results).
 */
export function extractDealProgressFromTeamText(teamText) {
  const t = String(teamText || "").toLowerCase();
  if (!t.trim()) return {};
  const out = {};

  if (/\b(paid\s+in\s+full|full\s+payment\s+received|全款已收|已收全款)\b/i.test(t)) {
    out.payment_status = "paid_in_full";
  } else if (/\b(balance\s+paid|尾款已收|已收尾款)\b/i.test(t)) {
    out.payment_status = "balance_paid";
  } else if (/\b(inspection\s+fee\s+paid|\$\s*50\s+paid|50\s*usd\s+paid|检测费已收)\b/i.test(t)) {
    out.payment_status = "inspection_fee_paid";
  }

  if (/\b(ready\s+to\s+ship|可以发货|ready\s+for\s+shipment)\b/i.test(t)) {
    out.fulfillment_stage = "ready_to_ship";
  } else if (/\b(inspection\s+failed|检测不合格|不合格)\b/i.test(t)) {
    out.fulfillment_stage = "inspection_failed";
    const reasonMatch = String(teamText || "").match(/(?:reason|原因)[:：]\s*(.+)$/i);
    out.inspection_fail_reason = reasonMatch ? reasonMatch[1].trim().slice(0, 200) : "failed";
  } else if (/\b(inspection\s+passed|检测合格|合格)\b/i.test(t)) {
    out.fulfillment_stage = "inspection_passed";
  } else if (/\b(inspection\s+scheduled|安排检测|上门检测)\b/i.test(t)) {
    out.fulfillment_stage = "inspection_scheduled";
  } else if (/\b(video\s+sent|已发视频|sent\s+(the\s+)?video)\b/i.test(t)) {
    out.fulfillment_stage = "video_sent";
  } else if (/\b(sourcing|在找货|finding\s+(stock|unit))\b/i.test(t)) {
    out.fulfillment_stage = "sourcing";
  }

  return out;
}

function moneyReceived(status) {
  return status === "paid_in_full" || status === "balance_paid";
}

/**
 * Apply payment + fulfillment patches with independence rules.
 * inspection_failed → sourcing, payment unchanged; timestamps set once.
 */
export function applyDealProgressPatch(prev, progress, nowIso) {
  const at = nowIso || new Date().toISOString();
  const patch = {};
  const currentPay = prev?.payment_status || "unpaid";
  const currentStage = prev?.fulfillment_stage || "sourcing";

  if (progress.payment_status && PAYMENT_STATUSES.includes(progress.payment_status)) {
    const nextPay = progress.payment_status;
    // Never downgrade paid states back to unpaid via extract noise.
    const rank = { unpaid: 0, inspection_fee_paid: 1, paid_in_full: 2, balance_paid: 2 };
    if ((rank[nextPay] ?? 0) >= (rank[currentPay] ?? 0)) {
      patch.payment_status = nextPay;
      if (nextPay === "inspection_fee_paid" && !prev?.inspection_fee_paid_at) {
        patch.inspection_fee_paid_at = at;
      }
      if (nextPay === "paid_in_full" && !prev?.paid_in_full_at) {
        patch.paid_in_full_at = at;
      }
    }
  }

  let nextStage = progress.fulfillment_stage;
  if (nextStage && FULFILLMENT_STAGES.includes(nextStage)) {
    if (nextStage === "inspection_failed") {
      patch.fulfillment_stage = "sourcing";
      const history = Array.isArray(prev?.inspection_result_history)
        ? [...prev.inspection_result_history]
        : [];
      history.push({
        at,
        result: "failed",
        reason: progress.inspection_fail_reason || "failed",
      });
      patch.inspection_result_history = history;
    } else if (nextStage === "ready_to_ship") {
      // Only when money is in AND inspection already passed — never skip video/inspection.
      const pay = patch.payment_status || currentPay;
      if (moneyReceived(pay) && currentStage === "inspection_passed") {
        patch.fulfillment_stage = "ready_to_ship";
      }
    } else if (nextStage === "inspection_scheduled") {
      patch.fulfillment_stage = "inspection_scheduled";
      patch.inspection_attempt_count = Number(prev?.inspection_attempt_count || 0) + 1;
    } else if (nextStage === "inspection_passed") {
      patch.fulfillment_stage = "inspection_passed";
      const history = Array.isArray(prev?.inspection_result_history)
        ? [...prev.inspection_result_history]
        : [];
      history.push({ at, result: "passed", reason: "" });
      patch.inspection_result_history = history;
      const pay = patch.payment_status || currentPay;
      if (moneyReceived(pay)) {
        patch.fulfillment_stage = "ready_to_ship";
      }
    } else {
      // video_sent / sourcing — never jump past inspection because of payment
      patch.fulfillment_stage = nextStage;
    }
  }

  // Auto-advance to ready_to_ship when payment completes after inspection already passed.
  const payAfter = patch.payment_status || currentPay;
  const stageAfter = patch.fulfillment_stage || currentStage;
  if (stageAfter === "inspection_passed" && moneyReceived(payAfter)) {
    patch.fulfillment_stage = "ready_to_ship";
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

/** First-time buying intent → immediate ops notify (separate from 2h stall). */
export function shouldNotifyBuyingIntentInstant(dealStateBefore, buyingIntentConfirmed) {
  if (!buyingIntentConfirmed) return false;
  if (dealStateBefore?.buying_intent_confirmed_notified_at) return false;
  if (dealStateBefore?.buying_intent_confirmed_at) return false;
  return true;
}

export function formatBuyingIntentInstantAlert({
  senderId,
  customerMessage,
  dealState,
}) {
  const lines = [
    "🛒 Buying intent confirmed — please follow up now",
    `Customer: ${senderId}`,
    `Quote status: ${dealState?.confirmation_status || "n/a"} @ ${dealState?.team_confirmed_at || "n/a"}`,
    `Part: ${dealState?.part_intent || "n/a"}`,
    `VIN/frame: ${dealState?.vin || dealState?.frame_no || "n/a"}`,
    `Price notes: ${dealState?.payment_notes || "(none)"}`,
    `Customer just said: ${String(customerMessage || "").slice(0, 400)}`,
  ];
  return lines.join("\n");
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
    `Payment: ${dealState?.payment_status || "unpaid"}`,
    `Fulfillment: ${dealState?.fulfillment_stage || "sourcing"}`,
    `Port: ${dealState?.destination_port || "(not said)"}`,
    `Qty: ${dealState?.quantity || "(not said)"}`,
    `Payment notes: ${dealState?.payment_notes || "(not said)"}`,
    `VIN/part: ${dealState?.vin || dealState?.frame_no || "n/a"} / ${dealState?.part_intent || "n/a"}`,
  ];
  return lines.join("\n");
}

/**
 * 24h soft quote follow-up: quoted, no buying intent, last customer msg quiet, once only.
 */
export function shouldSendQuoteFollowup(
  dealState,
  nowMs = Date.now(),
  quietMs = 24 * 60 * 60 * 1000,
) {
  if (!dealState || typeof dealState !== "object") return false;
  if (dealState.confirmation_status !== "team_quoted") return false;
  if (dealState.buying_intent_confirmed || dealState.buying_intent_confirmed_at) return false;
  if (dealState.quote_followup_sent_at) return false;
  const lastCustomer = Date.parse(
    dealState.last_customer_message_at || dealState.updated_at || 0,
  );
  if (!Number.isFinite(lastCustomer) || lastCustomer <= 0) return false;
  return nowMs - lastCustomer >= quietMs;
}

/** Local-hour greeting for common West Africa / Ghana (+0/+1-ish). Keep simple. */
export function politeGreetingForTimezone(now = new Date(), timeZone = "Africa/Accra") {
  let hour = now.getUTCHours();
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).formatToParts(now);
    const h = parts.find((p) => p.type === "hour")?.value;
    if (h != null) hour = Number(h);
  } catch {
    /* keep UTC */
  }
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Constrained template — concern-first, no urgency. Used when LLM path off / dry-run preview.
 */
export function buildQuoteFollowupMessage(dealState, now = new Date()) {
  const greet = politeGreetingForTimezone(now);
  const part = dealState?.part_intent ? ` on the ${dealState.part_intent}` : "";
  return `${greet}! Just checking in — is there anything specific holding you back on the quote${part}, like price or shipping time?`;
}

export function awaitingQuoteFollowupReply(dealState) {
  return Boolean(dealState?.quote_followup_sent_at && !dealState?.quote_decline_reason);
}

export function stampQuoteDeclineReason(prev, reason, nowIso) {
  const cleaned = String(reason || "").trim().slice(0, 240);
  if (!cleaned) return {};
  if (prev?.quote_decline_reason) return {};
  return {
    quote_decline_reason: cleaned,
    quote_decline_reason_at: nowIso || new Date().toISOString(),
  };
}
