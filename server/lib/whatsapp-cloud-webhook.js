'use strict';

/**
 * WhatsApp Cloud API Webhook
 * - observe: receive + store only
 * - sandbox: allowlisted CEO wa_id → APSales → Graph send
 * - live: all real inbound on +86 → APSales → Graph send (APWA-NIGHTSHIFT-001)
 * - off: emergency kill switch (receive may still persist depending on route)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { handleSandboxInbound } = require('./whatsapp-cloud-sandbox');
const { notifyInbound } = require('./whatsapp-cloud-telegram-monitor');

const PARSER_VERSION = 'apwa-002-sandbox-1.0.0';
const SCHEMA_VERSION = 'apwa-normalized-v1';

function env(...keys) {
  for (const key of keys) {
    const v = String(process.env[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function autonomyMode() {
  return env('WHATSAPP_AUTONOMY_MODE', 'WHATSAPP_CLOUD_AUTONOMY_MODE') || 'observe';
}

function readRawBody(req, limitBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('Webhook payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return false;
  if (!signatureHeader || !String(signatureHeader).startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return timingSafeEqualString(signatureHeader, expected);
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJsonAtomic(file, obj) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function appendJsonl(file, row) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8');
}

function safeId(id) {
  return String(id || '')
    .replace(/[^a-zA-Z0-9._=-]/g, '_')
    .slice(0, 200) || `anon-${Date.now()}`;
}

function extractMediaMeta(message) {
  const type = message.type;
  const node = message[type];
  if (!node || typeof node !== 'object') return null;
  if (['image', 'document', 'audio', 'video', 'sticker'].includes(type)) {
    return {
      id: node.id || '',
      mime_type: node.mime_type || '',
      sha256: node.sha256 || '',
      caption: node.caption || '',
      filename: node.filename || '',
      voice: Boolean(node.voice),
    };
  }
  if (type === 'location') {
    return {
      latitude: node.latitude,
      longitude: node.longitude,
      name: node.name || '',
      address: node.address || '',
    };
  }
  if (type === 'contacts') {
    return { contacts: message.contacts || node || [] };
  }
  if (type === 'interactive') {
    return {
      interactive_type: node.type || '',
      button_reply: node.button_reply || null,
      list_reply: node.list_reply || null,
      nfm_reply: node.nfm_reply || null,
    };
  }
  if (type === 'button') {
    return { button: node };
  }
  return null;
}

function normalizeMessage(message, value, checksum, rawRelPath) {
  const contactsByWaId = new Map((value.contacts || []).map((c) => [c.wa_id, c]));
  const contact = contactsByWaId.get(message.from) || {};
  const media = extractMediaMeta(message);
  let text = '';
  if (message.type === 'text') text = message.text?.body || '';
  else if (media?.caption) text = media.caption;
  else if (message.type === 'button') text = message.button?.text || '';
  else if (message.type === 'interactive') {
    text =
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      '';
  }

  return {
    schema_version: SCHEMA_VERSION,
    parser_version: PARSER_VERSION,
    channel: 'whatsapp_cloud',
    autonomy_mode: autonomyMode(),
    message_id: message.id || '',
    wa_id: message.from || '',
    profile_name: contact.profile?.name || '',
    phone_number_id: value.metadata?.phone_number_id || '',
    display_phone_number: value.metadata?.display_phone_number || '',
    timestamp: message.timestamp || '',
    message_type: message.type || 'unknown',
    text,
    media: media || undefined,
    raw_checksum: checksum,
    raw_path: rawRelPath,
    received_at: new Date().toISOString(),
  };
}

function normalizeStatus(status, value, checksum, rawRelPath) {
  return {
    schema_version: SCHEMA_VERSION,
    parser_version: PARSER_VERSION,
    channel: 'whatsapp_cloud',
    kind: 'status',
    message_id: status.id || '',
    recipient_id: status.recipient_id || '',
    status: status.status || '',
    timestamp: status.timestamp || '',
    conversation_id: status.conversation?.id || '',
    errors: status.errors || undefined,
    phone_number_id: value.metadata?.phone_number_id || '',
    raw_checksum: checksum,
    raw_path: rawRelPath,
    received_at: new Date().toISOString(),
  };
}

function walkEntries(payload, fn) {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      fn(change.value || {});
    }
  }
}

/** Legacy helpers kept for tests / callers */
function extractMessages(payload) {
  const messages = [];
  walkEntries(payload, (value) => {
    const contactsByWaId = new Map((value.contacts || []).map((c) => [c.wa_id, c]));
    for (const message of value.messages || []) {
      const contact = contactsByWaId.get(message.from) || {};
      messages.push({
        from: message.from,
        name: contact.profile?.name || '',
        id: message.id,
        timestamp: message.timestamp,
        type: message.type,
        text: message.text?.body || '',
        phoneNumberId: value.metadata?.phone_number_id || '',
        displayPhoneNumber: value.metadata?.display_phone_number || '',
      });
    }
  });
  return messages;
}

function extractStatuses(payload) {
  const statuses = [];
  walkEntries(payload, (value) => {
    for (const status of value.statuses || []) {
      statuses.push({
        id: status.id,
        recipientId: status.recipient_id,
        status: status.status,
        timestamp: status.timestamp,
        conversationId: status.conversation?.id || '',
        phoneNumberId: value.metadata?.phone_number_id || '',
      });
    }
  });
  return statuses;
}

function buildTelegramText(normalizedMessages, normalizedStatuses, mode) {
  try {
    if (normalizedMessages.length) {
      notifyInbound(normalizedMessages, mode || autonomyMode());
      return;
    }
    // Delivery receipts are noisy in live — only push in observe/off
    const modeLower = String(mode || autonomyMode() || '').toLowerCase();
    if ((modeLower === 'observe' || modeLower === 'off') && normalizedStatuses.length) {
      const { notifyAsync } = require('./telegram-notify');
      const summary = normalizedStatuses
        .slice(0, 5)
        .map((s) => `${s.status}:${String(s.recipient_id || '').slice(-4)}`)
        .join(', ');
      notifyAsync(`AsiaPower Cloud API status: ${summary}`);
    }
  } catch {
    /* telegram optional */
  }
}

function createWhatsAppCloudWebhook(rootDir) {
  const base = path.join(rootDir, 'data', 'whatsapp_cloud');
  const rawDir = path.join(base, 'raw');
  const normDir = path.join(base, 'normalized');
  const statusDir = path.join(base, 'statuses');
  const dedupDir = path.join(base, 'dedup');
  const failedDir = path.join(base, 'failed');
  const legacyEvents = path.join(rootDir, 'data', 'whatsapp-cloud-webhook-events.ndjson');

  function alreadySeen(messageId) {
    if (!messageId) return false;
    return fs.existsSync(path.join(dedupDir, `${safeId(messageId)}.seen`));
  }

  /**
   * P2 atomic inbound claim: create .seen with O_EXCL.
   * Returns true if THIS caller owns processing (first claim).
   * Returns false if already claimed (duplicate / concurrent).
   */
  function claimInboundOnce(messageId) {
    if (!messageId) return true; // no id — cannot dedup; process once per payload walk
    ensureDir(dedupDir);
    const p = path.join(dedupDir, `${safeId(messageId)}.seen`);
    try {
      const fd = fs.openSync(p, 'wx');
      fs.writeFileSync(fd, new Date().toISOString(), 'utf8');
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err && (err.code === 'EEXIST' || err.code === 'EPERM')) return false;
      // Fallback: if exists, treat as seen
      if (fs.existsSync(p)) return false;
      try {
        fs.writeFileSync(p, new Date().toISOString(), 'utf8');
        return true;
      } catch {
        return false;
      }
    }
  }

  function markSeen(messageId) {
    if (!messageId) return;
    claimInboundOnce(messageId);
  }

  function persistPayload(rawBody, payload, checksum) {
    const mode = autonomyMode();
    const eventId = `evt-${Date.now()}-${checksum.slice(0, 12)}`;
    const rawRel = path.join('data', 'whatsapp_cloud', 'raw', `${eventId}.json`);
    const rawAbs = path.join(rootDir, rawRel);

    // Immutable raw: never overwrite if exists
    if (!fs.existsSync(rawAbs)) {
      writeJsonAtomic(rawAbs, {
        received_at: new Date().toISOString(),
        raw_checksum: checksum,
        parser_version: PARSER_VERSION,
        autonomy_mode: mode,
        payload,
      });
    }

    const normalizedMessages = [];
    const normalizedStatuses = [];
    let duplicates = 0;

    walkEntries(payload, (value) => {
      for (const message of value.messages || []) {
        const mid = message.id || '';
        // P2: atomic claim replaces check-then-set race
        if (mid && !claimInboundOnce(mid)) {
          duplicates += 1;
          continue;
        }
        if (!mid && alreadySeen(mid)) {
          duplicates += 1;
          continue;
        }
        const normalized = normalizeMessage(message, value, checksum, rawRel);
        const out = path.join(normDir, `${safeId(mid || eventId)}.json`);
        if (!fs.existsSync(out)) writeJsonAtomic(out, normalized);
        normalizedMessages.push(normalized);
      }
      for (const status of value.statuses || []) {
        const normalized = normalizeStatus(status, value, checksum, rawRel);
        const sid = `${safeId(status.id)}-${safeId(status.status)}-${safeId(status.timestamp)}`;
        const out = path.join(statusDir, `${sid}.json`);
        if (!fs.existsSync(out)) writeJsonAtomic(out, normalized);
        normalizedStatuses.push(normalized);
      }
    });

    appendJsonl(legacyEvents, {
      receivedAt: new Date().toISOString(),
      object: payload.object || '',
      raw_checksum: checksum,
      parser_version: PARSER_VERSION,
      autonomy_mode: mode,
      messages: extractMessages(payload),
      statuses: extractStatuses(payload),
      normalized_message_ids: normalizedMessages.map((m) => m.message_id),
      duplicates,
      // Keep payload for backward compatibility (phase A); raw file is source of truth
      payload,
    });

    const modeLower = String(mode || '').toLowerCase();
    // CEO monitor (B 2026-07-14): inbound Telegram in all modes; status spam only observe/off
    buildTelegramText(normalizedMessages, normalizedStatuses, modeLower);

    return {
      messages: normalizedMessages.length,
      statuses: normalizedStatuses.length,
      duplicates,
      raw_checksum: checksum,
      mode: modeLower,
      normalizedMessages,
    };
  }

  async function runPostPersist(persistResult) {
    // APWA-NIGHTSHIFT-001: auto-reply path for sandbox (allowlist) and live (all inbound)
    if (!persistResult || !['sandbox', 'live'].includes(persistResult.mode)) return;
    for (const msg of persistResult.normalizedMessages || []) {
      try {
        await handleSandboxInbound(rootDir, msg);
      } catch (err) {
        appendJsonl(path.join(failedDir, 'sandbox.ndjson'), {
          at: new Date().toISOString(),
          error: String(err && err.message ? err.message : err).slice(0, 500),
          wa_suffix: String(msg.wa_id || '').slice(-4),
          message_id: msg.message_id || '',
        });
      }
    }
  }

  return async function handleWhatsAppCloudWebhook(req, res, url, json) {
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      const expected = env('WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_CLOUD_VERIFY_TOKEN');

      if (mode === 'subscribe' && expected && timingSafeEqualString(token, expected)) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(challenge || '');
        return;
      }
      return json(res, 403, { error: 'Webhook verification failed' });
    }

    if (req.method !== 'POST') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    let rawBody;
    try {
      rawBody = await readRawBody(req);
    } catch (err) {
      return json(res, 413, { error: err.message || 'Payload too large' });
    }

    const appSecret = env('WHATSAPP_APP_SECRET', 'WHATSAPP_CLOUD_APP_SECRET');
    const signature = req.headers['x-hub-signature-256'];
    if (!appSecret) {
      appendJsonl(path.join(failedDir, 'unsigned.ndjson'), {
        at: new Date().toISOString(),
        error: 'WHATSAPP_APP_SECRET missing',
        body_sha256: sha256Hex(rawBody),
      });
      return json(res, 403, { error: 'Webhook signature not configured' });
    }
    if (!verifySignature(rawBody, signature, appSecret)) {
      return json(res, 403, { error: 'Invalid webhook signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8') || '{}');
    } catch {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const checksum = sha256Hex(rawBody);

    // Fast ACK for Meta, then persist + optional sandbox reply
    json(res, 200, { ok: true, mode: autonomyMode(), queued: true });

    setImmediate(() => {
      Promise.resolve()
        .then(async () => {
          const result = persistPayload(rawBody, payload, checksum);
          await runPostPersist(result);
        })
        .catch((err) => {
          try {
            appendJsonl(path.join(failedDir, 'persist.ndjson'), {
              at: new Date().toISOString(),
              error: String(err && err.message ? err.message : err).slice(0, 500),
              raw_checksum: checksum,
            });
          } catch {
            /* last resort */
          }
        });
    });
  };
}

module.exports = {
  createWhatsAppCloudWebhook,
  extractMessages,
  extractStatuses,
  verifySignature,
  normalizeMessage,
  PARSER_VERSION,
  SCHEMA_VERSION,
};
