'use strict';

/**
 * Two Telegram lanes (CEO 2026-07-20):
 * - alerts (default): TELEGRAM_BOT_TOKEN → @weylonbot 孔明 — 待审核/线索/运维
 * - whatsapp: ASIAPOWER_TELEGRAM_* → @Asiapower86166_bot — Cloud WA 盯梢+报价 only
 */

const https = require('https');

let cachedAlerts = null;
let cachedWhatsApp = null;

function resetConfig() {
  cachedAlerts = null;
  cachedWhatsApp = null;
}

function envFirst(...keys) {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

/** Kongming / general ops alerts */
function alertsConfig() {
  if (cachedAlerts) return cachedAlerts;
  const token = envFirst('TELEGRAM_BOT_TOKEN');
  const chatId = envFirst('TELEGRAM_CHAT_ID', 'ASIAPOWER_TELEGRAM_CHAT_ID');
  cachedAlerts = {
    channel: 'alerts',
    enabled: Boolean(token && chatId),
    token,
    chatId,
  };
  return cachedAlerts;
}

/** WhatsApp Cloud monitor + quote bridge only */
function whatsappConfig() {
  if (cachedWhatsApp) return cachedWhatsApp;
  const token = envFirst('ASIAPOWER_TELEGRAM_BOT_TOKEN');
  const chatId = envFirst('ASIAPOWER_TELEGRAM_CHAT_ID', 'TELEGRAM_CHAT_ID');
  cachedWhatsApp = {
    channel: 'whatsapp',
    enabled: Boolean(token && chatId),
    token,
    chatId,
    dedicated: Boolean(token),
  };
  return cachedWhatsApp;
}

/** @deprecated alias — default lane is alerts (孔明), not WhatsApp */
function config() {
  return alertsConfig();
}

function resolveConfig(channel) {
  if (channel === 'whatsapp') return whatsappConfig();
  return alertsConfig();
}

function telegramApi(method, payload, options = {}) {
  const cfg = resolveConfig(options.channel || 'alerts');
  if (!cfg.token) {
    return Promise.resolve({ ok: false, skipped: true, reason: 'no_token', channel: cfg.channel });
  }
  const body = JSON.stringify(payload || {});
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${cfg.token}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(raw || '{}');
            if (res.statusCode >= 200 && res.statusCode < 300 && data.ok) {
              resolve({
                ok: true,
                data,
                messageId: data.result?.message_id,
                channel: cfg.channel,
              });
              return;
            }
            reject(new Error(data.description || `Telegram HTTP ${res.statusCode}`));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * @param {string} text
 * @param {{ chatId?: string|number, reply_markup?: object, channel?: 'alerts'|'whatsapp' }} [options]
 */
function sendTelegram(text, options = {}) {
  const channel = options.channel || 'alerts';
  const cfg = resolveConfig(channel);
  if (!cfg.enabled && options.chatId == null) {
    return Promise.resolve({ ok: false, skipped: true, channel });
  }
  if (!cfg.token) {
    return Promise.resolve({ ok: false, skipped: true, channel });
  }

  const payload = {
    chat_id: options.chatId != null ? options.chatId : cfg.chatId,
    text: String(text).slice(0, 3900),
    disable_web_page_preview: true,
  };
  if (options.reply_markup) payload.reply_markup = options.reply_markup;

  return telegramApi('sendMessage', payload, { channel });
}

function notify(text, options = {}) {
  const channel = options.channel || 'alerts';
  const cfg = resolveConfig(channel);
  if (!cfg.enabled && options.chatId == null) {
    const need = channel === 'whatsapp'
      ? 'ASIAPOWER_TELEGRAM_BOT_TOKEN / ASIAPOWER_TELEGRAM_CHAT_ID'
      : 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID';
    console.warn(`[telegram:${channel}] skipped: ${need} not configured`);
    return Promise.resolve({ ok: false, skipped: true, channel });
  }
  return sendTelegram(text, options).then((result) => {
    console.log(`[telegram:${channel}] sent`);
    return result;
  }).catch((err) => {
    console.error(`[telegram:${channel}] send failed:`, err.message);
    return { ok: false, error: err.message, channel };
  });
}

function notifyAsync(text, options = {}) {
  notify(text, options).catch((err) => {
    console.error('[telegram] async error:', err.message);
  });
}

function notifyWhatsApp(text, options = {}) {
  return notify(text, { ...options, channel: 'whatsapp' });
}

function notifyWhatsAppAsync(text, options = {}) {
  notifyWhatsApp(text, options).catch((err) => {
    console.error('[telegram:whatsapp] async error:', err.message);
  });
}

function isEnabled() {
  return alertsConfig().enabled;
}

function isWhatsAppEnabled() {
  return whatsappConfig().enabled;
}

async function answerCallbackQuery(callbackQueryId, opts = {}) {
  if (!callbackQueryId) return { ok: false, skipped: true };
  const channel = opts.channel || 'whatsapp';
  try {
    return await telegramApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: opts.text ? String(opts.text).slice(0, 200) : undefined,
      show_alert: Boolean(opts.show_alert),
    }, { channel });
  } catch (err) {
    console.error(`[telegram:${channel}] answerCallbackQuery failed:`, err.message);
    return { ok: false, error: err.message };
  }
}

async function editMessageText(text, opts = {}) {
  const channel = opts.channel || 'whatsapp';
  const cfg = resolveConfig(channel);
  const chatId = opts.chat_id != null ? opts.chat_id : cfg.chatId;
  if (!cfg.token || chatId == null || opts.message_id == null) {
    return { ok: false, skipped: true };
  }
  try {
    const payload = {
      chat_id: chatId,
      message_id: opts.message_id,
      text: String(text).slice(0, 3900),
      disable_web_page_preview: true,
    };
    if (opts.reply_markup !== undefined) payload.reply_markup = opts.reply_markup;
    else payload.reply_markup = { inline_keyboard: [] };
    return await telegramApi('editMessageText', payload, { channel });
  } catch (err) {
    console.error(`[telegram:${channel}] editMessageText failed:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * @param {{ buffer: Buffer, filename?: string, caption?: string, mimeType?: string, asDocument?: boolean, channel?: 'alerts'|'whatsapp' }} opts
 */
async function sendTelegramMedia(opts = {}) {
  const channel = opts.channel || 'alerts';
  const cfg = resolveConfig(channel);
  if (!cfg.enabled) {
    return { ok: false, skipped: true, channel };
  }
  const buffer = opts.buffer;
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    return { ok: false, error: 'empty_buffer' };
  }
  const mimeType = opts.mimeType || 'image/jpeg';
  const filename = opts.filename || 'media.bin';
  const caption = String(opts.caption || '').slice(0, 1024);
  const asDocument = Boolean(opts.asDocument) || !mimeType.startsWith('image/');
  const method = asDocument ? 'sendDocument' : 'sendPhoto';
  const field = asDocument ? 'document' : 'photo';

  const form = new FormData();
  form.append('chat_id', cfg.chatId);
  if (caption) form.append('caption', caption);
  form.append(field, new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(`https://api.telegram.org/bot${cfg.token}/${method}`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const err = new Error(data.description || `Telegram ${method} HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return {
    ok: true,
    data,
    method,
    messageId: data.result?.message_id,
    channel,
  };
}

function notifyMedia(opts = {}) {
  const channel = opts.channel || 'alerts';
  const cfg = resolveConfig(channel);
  if (!cfg.enabled) {
    return Promise.resolve({ ok: false, skipped: true, channel });
  }
  return sendTelegramMedia(opts).then((result) => {
    console.log(`[telegram:${channel}] ${result.method || 'media'} sent`);
    return result;
  }).catch((err) => {
    console.error(`[telegram:${channel}] media send failed:`, err.message);
    return { ok: false, error: err.message, channel };
  });
}

function notifyMediaAsync(opts) {
  notifyMedia(opts).catch((err) => {
    console.error('[telegram] media async error:', err.message);
  });
}

function notifyWhatsAppMedia(opts = {}) {
  return notifyMedia({ ...opts, channel: 'whatsapp' });
}

module.exports = {
  sendTelegram,
  notify,
  notifyAsync,
  notifyWhatsApp,
  notifyWhatsAppAsync,
  sendTelegramMedia,
  notifyMedia,
  notifyMediaAsync,
  notifyWhatsAppMedia,
  answerCallbackQuery,
  editMessageText,
  telegramApi,
  isEnabled,
  isWhatsAppEnabled,
  resetConfig,
  config,
  alertsConfig,
  whatsappConfig,
};
