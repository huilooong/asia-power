'use strict';

/**
 * WhatsApp Cloud API → CEO Telegram monitor (option B, 2026-07-14)
 * - inbound/outbound: FULL original text (no summary clip) — CEO request 2026-07-14
 * - media: download Graph media → Telegram photo/document
 * Kill switch: WHATSAPP_TELEGRAM_MONITOR=off
 */

const { notifyAsync, isEnabled } = require('./telegram-notify');

/** Telegram sendMessage hard limit is 4096; keep headroom for safety. */
const TG_TEXT_MAX = 3900;

function env(...keys) {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function monitorEnabled() {
  const flag = env('WHATSAPP_TELEGRAM_MONITOR', 'WHATSAPP_CLOUD_TELEGRAM_MONITOR').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') return false;
  return isEnabled();
}

function maskWa(waId) {
  const digits = String(waId || '').replace(/\D/g, '');
  if (!digits) return '????';
  return digits.length > 4 ? `…${digits.slice(-4)}` : digits;
}

/** Short labels only (names) — never used to truncate customer/reply body. */
function clipLabel(text, max = 40) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Preserve original wording; only trim outer whitespace. */
function fullText(text) {
  return String(text || '').trim();
}

function inboundBody(msg) {
  const text = fullText(msg.text || msg.body || msg.media?.caption || '');
  if (text) return text;
  const t = String(msg.message_type || msg.type || 'media').trim() || 'media';
  return `[${t}]`;
}

/**
 * One Telegram message per inbound — full customer text.
 * Returns string or string[] if over Telegram limit.
 */
function formatInboundMessage(msg, mode) {
  const name = msg.profile_name ? ` (${clipLabel(msg.profile_name, 40)})` : '';
  const body = inboundBody(msg);
  return [
    `📲 WhatsApp 客户原文 · ${mode || 'unknown'}`,
    `客户: ${maskWa(msg.wa_id)}${name}`,
    `类型: ${msg.message_type || 'text'}`,
    '',
    body,
  ].join('\n');
}

/** @deprecated kept for tests — prefer formatInboundMessage */
function formatInboundLines(normalizedMessages, mode) {
  return (normalizedMessages || [])
    .slice(0, 5)
    .map((msg) => formatInboundMessage(msg, mode))
    .join('\n\n---\n\n');
}

function formatOutboundLines({
  mode,
  decision,
  waId,
  profileName,
  inboundType,
  inboundText,
  replyText,
  sent,
  riskBlocked,
}) {
  const name = profileName ? ` (${clipLabel(profileName, 40)})` : '';
  const status = sent ? '发送成功' : '发送失败';
  const risk = riskBlocked ? ' · 风控改写' : '';
  const customer = fullText(inboundText) || `[${inboundType || 'media'}]`;
  const reply = fullText(replyText) || '(空)';
  return [
    `🤖 子敬原文回复 · ${mode || 'unknown'} · ${decision || 'reply'}${risk}`,
    `客户: ${maskWa(waId)}${name}`,
    `结果: ${status}`,
    '',
    '—— 客户原文 ——',
    customer,
    '',
    '—— 子敬原文 ——',
    reply,
  ].join('\n');
}

function mediaCaption(msg, mode) {
  const name = msg.profile_name ? ` (${clipLabel(msg.profile_name, 40)})` : '';
  // Telegram caption max 1024 — put overflow in a follow-up text message
  const cap = fullText(msg.media?.caption || msg.text || '');
  const header = [
    `📷 WhatsApp 客户${msg.message_type || 'media'} · ${mode || 'live'}`,
    `客户: ${maskWa(msg.wa_id)}${name}`,
  ].join('\n');
  if (!cap) return { caption: header, overflow: '' };
  const combined = `${header}\n\n${cap}`;
  if (combined.length <= 1024) return { caption: combined, overflow: '' };
  return { caption: `${header}\n\n(说明见下条全文)`, overflow: cap };
}

function shouldForwardMedia(msg) {
  const t = String(msg.message_type || '').toLowerCase();
  if (!['image', 'video', 'audio', 'document', 'sticker'].includes(t)) return false;
  const id = msg.media?.id || '';
  return Boolean(id);
}

function chunkTelegramText(text, max = TG_TEXT_MAX) {
  const s = String(text || '');
  if (s.length <= max) return [s];
  const parts = [];
  let i = 0;
  let n = 1;
  const totalHint = Math.ceil(s.length / max);
  while (i < s.length) {
    const room = max - (totalHint > 1 ? 20 : 0);
    const chunk = s.slice(i, i + room);
    parts.push(totalHint > 1 ? `(${n}/${totalHint})\n${chunk}` : chunk);
    i += room;
    n += 1;
  }
  return parts;
}

function notifyFullText(text) {
  for (const part of chunkTelegramText(text)) {
    notifyAsync(part);
  }
}

async function forwardInboundMedia(msg, mode) {
  if (!shouldForwardMedia(msg)) return { skipped: true };
  try {
    const { downloadWhatsAppMedia } = require('./whatsapp-cloud-media');
    const file = await downloadWhatsAppMedia(msg.media.id);
    const asDocument = !String(file.mimeType || '').startsWith('image/')
      || String(msg.message_type || '') === 'document';
    const { caption, overflow } = mediaCaption(msg, mode);
    const { notifyMedia } = require('./telegram-notify');
    const result = await notifyMedia({
      buffer: file.buffer,
      filename: file.filename,
      mimeType: file.mimeType,
      caption,
      asDocument,
    });
    if (overflow) {
      notifyFullText(
        [
          `📷 客户媒体说明原文 · ${mode || 'live'}`,
          `客户: ${maskWa(msg.wa_id)}`,
          '',
          overflow,
        ].join('\n'),
      );
    }
    return result;
  } catch (err) {
    notifyAsync(
      [
        `⚠️ WhatsApp 媒体转发失败 · ${mode || 'live'}`,
        `客户: ${maskWa(msg.wa_id)}`,
        `类型: ${msg.message_type || 'media'}`,
        `原因: ${String(err && err.message ? err.message : err).slice(0, 200)}`,
      ].join('\n'),
    );
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function notifyInbound(normalizedMessages, mode) {
  if (!monitorEnabled() || !normalizedMessages || !normalizedMessages.length) return;
  try {
    // One full-text Telegram per customer message (no summary)
    for (const msg of normalizedMessages.slice(0, 10)) {
      notifyFullText(formatInboundMessage(msg, mode));
    }
    const mediaMsgs = normalizedMessages.filter(shouldForwardMedia).slice(0, 8);
    for (const msg of mediaMsgs) {
      setImmediate(() => {
        forwardInboundMedia(msg, mode).catch(() => {});
      });
    }
  } catch {
    /* optional */
  }
}

function notifyOutbound(payload) {
  if (!monitorEnabled()) return;
  try {
    notifyFullText(formatOutboundLines(payload || {}));
  } catch {
    /* optional */
  }
}

function notifySkip(payload) {
  if (!monitorEnabled()) return;
  const reason = String((payload && payload.reason) || 'skipped');
  const interesting = new Set([
    'NO_ACCESS_TOKEN',
    'missing_wa_id',
    'autonomy_off',
    'observe_mode',
  ]);
  if (!interesting.has(reason) && !String(reason).startsWith('mode_')) return;
  try {
    const name = payload.profileName ? ` (${clipLabel(payload.profileName, 40)})` : '';
    const customer = fullText(payload.inboundText) || `[${payload.inboundType || 'media'}]`;
    notifyFullText(
      [
        `⚠️ WhatsApp 未自动回复 · ${payload.mode || 'unknown'}`,
        `客户: ${maskWa(payload.waId)}${name}`,
        `原因: ${reason}`,
        '',
        '—— 客户原文 ——',
        customer,
      ].join('\n'),
    );
  } catch {
    /* optional */
  }
}

module.exports = {
  monitorEnabled,
  maskWa,
  clip: clipLabel,
  clipLabel,
  fullText,
  formatInboundMessage,
  formatInboundLines,
  formatOutboundLines,
  mediaCaption,
  shouldForwardMedia,
  forwardInboundMedia,
  chunkTelegramText,
  notifyInbound,
  notifyOutbound,
  notifySkip,
};
