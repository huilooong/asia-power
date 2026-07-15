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

/**
 * Bug A: if this photo failed OCR but deal already has a confirmed vehicle, don't ask to resend.
 */
export function plateFailureReply(mediaContext, dealState) {
  if (mediaContext?.message_type !== "image") return null;
  const status = mediaContext?.vin_decode?.status;
  if (status === "success") return null;
  if (!status) return null;

  if (dealState?.vin || dealState?.engine_code) {
    const bits = [dealState.brand, dealState.model, dealState.year, dealState.engine_code]
      .filter(Boolean);
    return bits.length
      ? `No worries — we already have your vehicle confirmed (${bits.join(" / ")}). You don't need to resend the plate.`
      : "No worries — we already have your vehicle details confirmed from your earlier photo.";
  }

  return "Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?";
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
