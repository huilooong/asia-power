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

function sendTelegram(text) {
  const cfg = config();
  if (!cfg.enabled) {
    return Promise.resolve({ ok: false, skipped: true });
  }

  const body = JSON.stringify({
    chat_id: cfg.chatId,
    text: String(text).slice(0, 3900),
    disable_web_page_preview: true,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${cfg.token}/sendMessage`,
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
              resolve({ ok: true, data });
              return;
            }
            reject(new Error(data.description || `Telegram HTTP ${res.statusCode}`));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function notify(text) {
  const cfg = config();
  if (!cfg.enabled) {
    console.warn('[telegram] skipped: ASIAPOWER_TELEGRAM_BOT_TOKEN or ASIAPOWER_TELEGRAM_CHAT_ID not configured');
    return Promise.resolve({ ok: false, skipped: true });
  }
  return sendTelegram(text).then((result) => {
    console.log('[telegram] sent');
    return result;
  }).catch((err) => {
    console.error('[telegram] send failed:', err.message);
    return { ok: false, error: err.message };
  });
}

function notifyAsync(text) {
  notify(text).catch((err) => {
    console.error('[telegram] async error:', err.message);
  });
}

function isEnabled() {
  return config().enabled;
}

module.exports = {
  sendTelegram,
  notify,
  notifyAsync,
  isEnabled,
  resetConfig,
};
