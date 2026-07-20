'use strict';

const https = require('https');

let cached = null;

function resetConfig() {
  cached = null;
}

function config() {
  if (cached) return cached;
  const token = String(process.env.ASIAPOWER_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.ASIAPOWER_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '').trim();
  cached = {
    enabled: Boolean(token && chatId),
    token,
    chatId,
  };
  return cached;
}

function telegramApi(method, payload) {
  const cfg = config();
  if (!cfg.token) {
    return Promise.resolve({ ok: false, skipped: true, reason: 'no_token' });
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
 * @param {{ chatId?: string|number, reply_markup?: object }} [options]
 */
function sendTelegram(text, options = {}) {
  const cfg = config();
  if (!cfg.enabled && !options.chatId) {
    return Promise.resolve({ ok: false, skipped: true });
  }
  if (!cfg.token) {
    return Promise.resolve({ ok: false, skipped: true });
  }

  const payload = {
    chat_id: options.chatId != null ? options.chatId : cfg.chatId,
    text: String(text).slice(0, 3900),
    disable_web_page_preview: true,
  };
  if (options.reply_markup) payload.reply_markup = options.reply_markup;

  return telegramApi('sendMessage', payload);
}

function notify(text, options = {}) {
  const cfg = config();
  if (!cfg.enabled && options.chatId == null) {
    console.warn('[telegram] skipped: ASIAPOWER_TELEGRAM_BOT_TOKEN or ASIAPOWER_TELEGRAM_CHAT_ID not configured');
    return Promise.resolve({ ok: false, skipped: true });
  }
  return sendTelegram(text, options).then((result) => {
    console.log('[telegram] sent');
    return result;
  }).catch((err) => {
    console.error('[telegram] send failed:', err.message);
    return { ok: false, error: err.message };
  });
}

function notifyAsync(text, options = {}) {
  notify(text, options).catch((err) => {
    console.error('[telegram] async error:', err.message);
  });
}

function isEnabled() {
  return config().enabled;
}

async function answerCallbackQuery(callbackQueryId, opts = {}) {
  if (!callbackQueryId) return { ok: false, skipped: true };
  try {
    return await telegramApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: opts.text ? String(opts.text).slice(0, 200) : undefined,
      show_alert: Boolean(opts.show_alert),
    });
  } catch (err) {
    console.error('[telegram] answerCallbackQuery failed:', err.message);
    return { ok: false, error: err.message };
  }
}

async function editMessageText(text, opts = {}) {
  const cfg = config();
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
    return await telegramApi('editMessageText', payload);
  } catch (err) {
    console.error('[telegram] editMessageText failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Send a photo (or document fallback) to CEO Telegram.
 * @param {{ buffer: Buffer, filename?: string, caption?: string, mimeType?: string, asDocument?: boolean }} opts
 */
async function sendTelegramMedia(opts = {}) {
  const cfg = config();
  if (!cfg.enabled) {
    return { ok: false, skipped: true };
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
  };
}

function notifyMedia(opts) {
  const cfg = config();
  if (!cfg.enabled) {
    return Promise.resolve({ ok: false, skipped: true });
  }
  return sendTelegramMedia(opts).then((result) => {
    console.log(`[telegram] ${result.method || 'media'} sent`);
    return result;
  }).catch((err) => {
    console.error('[telegram] media send failed:', err.message);
    return { ok: false, error: err.message };
  });
}

function notifyMediaAsync(opts) {
  notifyMedia(opts).catch((err) => {
    console.error('[telegram] media async error:', err.message);
  });
}

module.exports = {
  sendTelegram,
  notify,
  notifyAsync,
  sendTelegramMedia,
  notifyMedia,
  notifyMediaAsync,
  answerCallbackQuery,
  editMessageText,
  telegramApi,
  isEnabled,
  resetConfig,
  config,
};
