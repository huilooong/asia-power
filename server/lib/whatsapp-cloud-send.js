'use strict';

/**
 * WhatsApp Cloud API outbound (Graph).
 * Tokens never logged.
 */

const GRAPH_VERSION_DEFAULT = 'v21.0';

function env(...keys) {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function graphVersion() {
  return env('WHATSAPP_GRAPH_API_VERSION', 'WHATSAPP_CLOUD_GRAPH_API_VERSION') || GRAPH_VERSION_DEFAULT;
}

function accessToken() {
  return env('WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_CLOUD_ACCESS_TOKEN');
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function graphPost(phoneNumberId, body, { retries = 3 } = {}) {
  const token = accessToken();
  if (!token) {
    const err = new Error('WHATSAPP_ACCESS_TOKEN not configured');
    err.code = 'NO_TOKEN';
    throw err;
  }
  if (!phoneNumberId) {
    const err = new Error('phone_number_id required');
    err.code = 'NO_PHONE_ID';
    throw err;
  }

  const url = `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(phoneNumberId)}/messages`;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 500) };
      }
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        lastErr = new Error(`Graph ${res.status}`);
        lastErr.status = res.status;
        lastErr.data = data;
        if (attempt < retries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw lastErr;
      }
      if (!res.ok) {
        const err = new Error(`Graph ${res.status}`);
        err.status = res.status;
        err.data = data;
        err.retryable = false;
        throw err;
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (err.retryable === false) throw err;
      if (attempt >= retries) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw lastErr;
}

async function sendText({ phoneNumberId, to, text, previewUrl = false }) {
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: String(to).replace(/\D/g, ''),
    type: 'text',
    text: { preview_url: Boolean(previewUrl), body: String(text || '').slice(0, 4096) },
  };
  const result = await graphPost(phoneNumberId, body);
  return {
    ok: true,
    messageId: result?.messages?.[0]?.id || '',
    result,
  };
}

async function markAsRead({ phoneNumberId, messageId }) {
  if (!messageId) return { ok: false, skipped: true };
  const body = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };
  try {
    const result = await graphPost(phoneNumberId, body, { retries: 1 });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  sendText,
  markAsRead,
  accessToken,
  graphVersion,
};
