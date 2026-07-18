/**
 * Pure helpers for +233 bridge: plate failure copy + human/bot outbound visibility.
 * Kept separate from bridge.mjs so unit tests do not boot the WhatsApp listener.
 */

const BOT_OUTBOUND_TTL_MS = 5 * 60 * 1000;
const BOT_OUTBOUND_MAX = 200;
const BOT_ECHO_TEXT_FALLBACK_MS = 20 * 1000;

/** @type {Map<string, number>} messageId -> expiresAt */
const recentBotOutboundIds = new Map();

/** @type {Map<string, { messageId: string|null, text: string, at: number }>} */
const recentBotByChat = new Map();

export function clearBotOutboundTracking() {
  recentBotOutboundIds.clear();
  recentBotByChat.clear();
}

export function rememberBotOutbound(messageId) {
  const id = String(messageId || "").trim();
  if (!id) return;
  const now = Date.now();
  recentBotOutboundIds.set(id, now + BOT_OUTBOUND_TTL_MS);
  for (const [k, exp] of recentBotOutboundIds) {
    if (exp < now) recentBotOutboundIds.delete(k);
  }
  while (recentBotOutboundIds.size > BOT_OUTBOUND_MAX) {
    const first = recentBotOutboundIds.keys().next().value;
    recentBotOutboundIds.delete(first);
  }
}

export function noteBotSend(chatE164, text, messageId) {
  rememberBotOutbound(messageId);
  const chat = String(chatE164 || "").trim();
  if (!chat) return;
  recentBotByChat.set(chat, {
    messageId: String(messageId || "").trim() || null,
    text: String(text || ""),
    at: Date.now(),
  });
}

export function isRecentBotOutboundId(messageId) {
  const id = String(messageId || "").trim();
  if (!id) return false;
  const exp = recentBotOutboundIds.get(id);
  if (!exp) return false;
  if (exp < Date.now()) {
    recentBotOutboundIds.delete(id);
    return false;
  }
  return true;
}

/**
 * True when this fromMe upsert is the bot's own send echo (drop it).
 * Primary: outbound messageId set. Fallback: same chat + same text within 20s
 * (in case Baileys echo id differs from sendText return — verify on live).
 */
export function isBotOutboundEcho(message) {
  if (!message?.fromMe) return false;
  if (isRecentBotOutboundId(message.messageId)) return true;
  const chat = String(message.fromPhoneE164 || "").trim();
  const last = recentBotByChat.get(chat);
  if (!last) return false;
  if (Date.now() - last.at > BOT_ECHO_TEXT_FALLBACK_MS) return false;
  if (last.messageId && message.messageId && last.messageId === message.messageId) return true;
  const incoming = String(message.text || "").trim();
  const sent = String(last.text || "").trim();
  return Boolean(incoming && sent && incoming === sent);
}

/** Human label for dealState.part_intent in customer-facing copy. */
export function partIntentLabel(intent) {
  const key = String(intent || "").trim().toLowerCase();
  const map = {
    half_cut: "half-cut",
    gearbox: "gearbox",
    engine: "engine",
    windscreen: "windscreen",
    headlight: "headlight",
    taillight: "taillight",
    mirror: "mirror",
    grille: "grille",
    bumper: "bumper",
    hood: "hood",
    fender: "fender",
    parts: "parts",
  };
  if (map[key]) return map[key];
  return key ? key.replace(/_/g, " ") : "parts";
}

/**
 * Deterministic part intent from customer text.
 * Engine/gearbox/half-cut first (inventory match); then body/accessory parts so
 * later photos are not answered with "couldn't read the plate".
 */
export function partIntentFromText(text) {
  const lower = String(text || "").toLowerCase();
  if (/\b(half[\s-]?cut|halfcut)\b/.test(lower)) return "half_cut";
  if (/\b(gear\s*box|gearbox|transmission)\b/.test(lower)) return "gearbox";
  if (/\b(engine|motor)\b/.test(lower)) return "engine";

  const bodyHits = [];
  if (/\b(windscreen|windshield)\b/.test(lower)) bodyHits.push("windscreen");
  if (/\b(head\s*lights?|headlamps?)\b/.test(lower)) bodyHits.push("headlight");
  if (/\b(tail\s*lights?|taillights?)\b/.test(lower)) bodyHits.push("taillight");
  if (
    /\b(side\s*mirror|driving\s*mirror|wing\s*mirror|rear[\s-]?view\s*mirror|mirrors?|r[eé]troviseurs?)\b/.test(
      lower,
    )
  ) {
    bodyHits.push("mirror");
  }
  if (/\b(grille|grill|front\s*grille)\b/.test(lower)) bodyHits.push("grille");
  if (/\b(bumper)\b/.test(lower)) bodyHits.push("bumper");
  if (/\b(bonnet|hood)\b/.test(lower)) bodyHits.push("hood");
  if (/\b(fender|mudguard)\b/.test(lower)) bodyHits.push("fender");
  if (/\b(door\s*panel|body\s*part|spare\s*parts?|auto\s*parts?)\b/.test(lower)) bodyHits.push("parts");
  if (bodyHits.length >= 2) return "parts";
  if (bodyHits.length === 1) return bodyHits[0];
  return null;
}

/** Anti-spam window for identical plate-failure asks (deterministic path, not LLM). */
export const PLATE_FAILURE_DEDUP_MS = 8 * 60 * 1000;
/** Within the window, send a different ask on this many consecutive failures. */
export const PLATE_FAILURE_ESCALATE_AT = 3;

/** Primary ask: nameplate/VIN sticker — not "photo was blurry". */
export function plateFailureAskCopy(kind = "primary") {
  if (kind === "escalate") {
    return (
      "Still no nameplate/VIN in these photos. Easiest is to type the chassis/VIN number here " +
      "(the letter-number string on the metal plate or sticker)."
    );
  }
  return (
    "Got your photo — I don't see a chassis nameplate/VIN sticker in it. " +
    "I need a photo of that metal plate or sticker with the letter-number code on the vehicle " +
    "(not a general shot of the car/engine). Or just type the VIN/frame number here."
  );
}

/**
 * Image OCR failed: pick copy from deal context.
 * - part_intent set → treat as accessory/part photo (not a plate ask)
 * - vin/engine already confirmed (Bug A) → don't ask to resend plate
 * - else → ask for nameplate/VIN photo (not "clearer" blur wording)
 *
 * Dedup: short-window silence so stacked photos don't spam the same line.
 * OCR still ran before this is called; success path is unaffected.
 *
 * @returns {{ reply: string|null, silence: boolean, dealPatch: object }}
 */
export function decidePlateFailureReply(mediaContext, dealState, nowMs = Date.now()) {
  const empty = { reply: null, silence: false, dealPatch: {} };
  if (mediaContext?.message_type !== "image") return empty;
  const status = mediaContext?.vin_decode?.status;
  if (status === "success") return empty;
  if (!status) return empty;

  const partIntent = String(dealState?.part_intent || "").trim();
  if (partIntent) {
    const label = partIntentLabel(partIntent);
    return {
      reply: `Got your photo — noted for your ${label} request. Anything else, or should we get you a price?`,
      silence: false,
      dealPatch: {},
    };
  }

  if (dealState?.vin || dealState?.engine_code) {
    const bits = [dealState.brand, dealState.model, dealState.year, dealState.engine_code]
      .filter(Boolean);
    return {
      reply: bits.length
        ? `No worries — we already have your vehicle confirmed (${bits.join(" / ")}). You don't need to resend the plate.`
        : "No worries — we already have your vehicle details confirmed from your earlier photo.",
      silence: false,
      dealPatch: {},
    };
  }

  const lastAt = Date.parse(String(dealState?.last_plate_failure_reply_at || ""));
  const withinWindow = Number.isFinite(lastAt) && nowMs - lastAt < PLATE_FAILURE_DEDUP_MS;
  const prevStreak = withinWindow ? Number(dealState?.plate_failure_streak || 0) : 0;
  const streak = prevStreak + 1;
  const lastKind = withinWindow ? String(dealState?.last_plate_failure_reply_kind || "") : "";

  // 1st in window → primary; 3rd → escalate once; other in-window failures → silence.
  let kind = null;
  if (!withinWindow || streak === 1) {
    kind = "primary";
  } else if (streak === PLATE_FAILURE_ESCALATE_AT && lastKind !== "escalate") {
    kind = "escalate";
  }

  if (!kind) {
    return {
      reply: null,
      silence: true,
      dealPatch: {
        plate_failure_streak: streak,
      },
    };
  }

  return {
    reply: plateFailureAskCopy(kind),
    silence: false,
    dealPatch: {
      last_plate_failure_reply_at: new Date(nowMs).toISOString(),
      plate_failure_streak: streak,
      last_plate_failure_reply_kind: kind,
    },
  };
}

/** @deprecated Prefer decidePlateFailureReply — kept for older call sites/tests. */
export function plateFailureReply(mediaContext, dealState, nowMs = Date.now()) {
  return decidePlateFailureReply(mediaContext, dealState, nowMs).reply;
}

/** Clear failure-ask streak after a successful plate/VIN decode. */
export function plateFailureResetPatch() {
  return {
    plate_failure_streak: 0,
    last_plate_failure_reply_at: null,
    last_plate_failure_reply_kind: null,
  };
}

/** Keep last N team (human) replies for prompt context. */
export function nextTeamReplies(prevTeamReplies, entry, max = 10) {
  const list = Array.isArray(prevTeamReplies) ? prevTeamReplies.slice() : [];
  list.push(entry);
  return list.slice(-max);
}

export function recentTeamRepliesForPrompt(dealState, max = 5) {
  const list = Array.isArray(dealState?.team_replies) ? dealState.team_replies : [];
  return list.slice(-max).map((r) => ({
    text: String(r?.text || "").slice(0, 500),
    at: r?.at || null,
  }));
}

/**
 * Classify a fromMe upsert for bridge routing.
 * @returns {'bot_echo'|'team_reply'|'not_from_me'}
 */
export function classifyFromMeMessage(message) {
  if (!message?.fromMe) return "not_from_me";
  if (isBotOutboundEcho(message)) return "bot_echo";
  return "team_reply";
}

/** Fields that mean the customer has clearly stated what they want. */
const PART_REQUEST_KEYS = ["part_intent", "vin", "engine_code"];

/**
 * Stamp part_first_requested_at once — first time part_intent / vin / engine_code
 * is written into deal_state. Data-only; no customer-facing use.
 */
export function withPartFirstRequestedAt(prev, patch, nowIso) {
  const base = { ...(patch || {}) };
  if (prev?.part_first_requested_at || base.part_first_requested_at) return base;
  const newlyClear = PART_REQUEST_KEYS.some((k) => {
    const incoming = base[k];
    if (incoming == null || incoming === "") return false;
    const before = prev?.[k];
    return before == null || before === "";
  });
  if (!newlyClear) return base;
  return { ...base, part_first_requested_at: nowIso || new Date().toISOString() };
}

/**
 * Rough signal that a human team reply contains a price or stock confirmation.
 * Intentionally imperfect — we only need samples for future lead-time metrics.
 */
export function looksLikeTeamPriceOrStockConfirm(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (/\$\s*\d|\bUSD\b|\bFOB\b|\bEXW\b|\bCIF\b|\bGHS\b|\bRMB\b|\bCNY\b/i.test(t)) return true;
  if (/\b\d{2,6}(?:\.\d+)?\s*(?:USD|usd|dollars?|GHS|RMB)\b/.test(t)) return true;
  if (/\b(in stock|available|we (?:have|can)\b|price(?:\s+is)?|quotation|quote)\b/i.test(t)) {
    return true;
  }
  if (/报价|有货|现货|美金|美元|单价/.test(t)) return true;
  return false;
}

/**
 * Stamp team_confirmed_at once when a human reply looks like price/stock confirm.
 * Also records confirmation_status / source_channel for inventory-source-model naming.
 */
export function withTeamConfirmedAt(prev, teamText, nowIso) {
  if (prev?.team_confirmed_at) return {};
  if (!looksLikeTeamPriceOrStockConfirm(teamText)) return {};
  const at = nowIso || new Date().toISOString();
  return {
    team_confirmed_at: at,
    confirmation_status: "team_quoted",
    source_channel: "whatsapp_team",
  };
}
