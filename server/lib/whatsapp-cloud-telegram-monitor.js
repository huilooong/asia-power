'use strict';

/**
 * WhatsApp Cloud API → CEO Telegram monitor (option B, 2026-07-14)
 * - inbound/outbound: FULL original text (no summary clip) — CEO request 2026-07-14
 * - media: download Graph media → Telegram photo/document
 * - quote bridge: bind Telegram message_id → wa_id (reply-to only; no guessing)
 * Kill switch: WHATSAPP_TELEGRAM_MONITOR=off
 */

const {
  notifyWhatsApp,
  notifyWhatsAppAsync,
  notifyWhatsAppMedia,
  isWhatsAppEnabled,
} = require('./telegram-notify');

/** Telegram sendMessage hard limit is 4096; keep headroom for safety. */
const TG_TEXT_MAX = 3900;

let _rootDir = '';

function configureMonitor({ rootDir } = {}) {
  if (rootDir) _rootDir = String(rootDir);
}

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
  return isWhatsAppEnabled();
}

function quoteHintEnabled() {
  const flag = env('WHATSAPP_TELEGRAM_QUOTE', 'WHATSAPP_CLOUD_TELEGRAM_QUOTE').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') return false;
  return true;
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

function quoteFooter() {
  if (!quoteHintEnabled()) return '';
  return [
    '',
    '———',
    '回客户：回复本条，直接写要发给他的话（须点确认）',
    '报价简写：450 / 450 USD / EXW 450',
  ].join('\n');
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
    quoteFooter(),
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
    quoteFooter(),
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

function bindFromResult(result, binding) {
  if (!_rootDir || !result?.ok || !result.messageId) return;
  try {
    const { registerBinding } = require('./whatsapp-cloud-telegram-quote');
    registerBinding(_rootDir, result.messageId, binding);
  } catch {
    /* optional */
  }
}

function notifyFullText(text, binding) {
  const parts = chunkTelegramText(text);
  // Bind every chunk to the same customer — reply-to any chunk is safe.
  for (const part of parts) {
    notifyWhatsApp(part)
      .then((result) => bindFromResult(result, binding))
      .catch((err) => {
        console.error('[telegram-monitor] notify failed:', err && err.message ? err.message : err);
      });
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
    const result = await notifyWhatsAppMedia({
      buffer: file.buffer,
      filename: file.filename,
      mimeType: file.mimeType,
      caption,
      asDocument,
    });
    bindFromResult(result, {
      wa_id: msg.wa_id,
      profile_name: msg.profile_name || '',
      phone_number_id: msg.phone_number_id || '',
      inbound_snippet: inboundBody(msg),
      mode: mode || '',
      source: 'inbound_media',
    });
    if (overflow) {
      notifyFullText(
        [
          `📷 客户媒体说明原文 · ${mode || 'live'}`,
          `客户: ${maskWa(msg.wa_id)}`,
          '',
          overflow,
          quoteFooter(),
        ].join('\n'),
        {
          wa_id: msg.wa_id,
          profile_name: msg.profile_name || '',
          phone_number_id: msg.phone_number_id || '',
          inbound_snippet: overflow,
          mode: mode || '',
          source: 'inbound_media_caption',
        },
      );
    }
    return result;
  } catch (err) {
    notifyWhatsAppAsync(
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
    for (const msg of normalizedMessages.slice(0, 10)) {
      notifyFullText(formatInboundMessage(msg, mode), {
        wa_id: msg.wa_id,
        profile_name: msg.profile_name || '',
        phone_number_id: msg.phone_number_id || '',
        inbound_snippet: inboundBody(msg),
        mode: mode || '',
        source: 'inbound',
      });
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
    const p = payload || {};
    notifyFullText(formatOutboundLines(p), {
      wa_id: p.waId,
      profile_name: p.profileName || '',
      phone_number_id: p.phoneNumberId || '',
      inbound_snippet: fullText(p.inboundText) || `[${p.inboundType || 'media'}]`,
      mode: p.mode || '',
      source: 'outbound',
    });
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
        quoteFooter(),
      ].join('\n'),
      {
        wa_id: payload.waId,
        profile_name: payload.profileName || '',
        phone_number_id: payload.phoneNumberId || '',
        inbound_snippet: customer,
        mode: payload.mode || '',
        source: 'skip',
      },
    );
  } catch {
    /* optional */
  }
}

module.exports = {
  configureMonitor,
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
