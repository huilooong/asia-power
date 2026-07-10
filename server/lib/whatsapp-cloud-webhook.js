'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { notifyAsync } = require('./telegram-notify');

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
  if (!appSecret) return true;
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return timingSafeEqualString(signatureHeader, expected);
}

function appendJsonl(file, row) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8');
}

function extractMessages(payload) {
  const messages = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const contactsByWaId = new Map((value.contacts || []).map((contact) => [contact.wa_id, contact]));
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
    }
  }
  return messages;
}

function extractStatuses(payload) {
  const statuses = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
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
    }
  }
  return statuses;
}

function buildTelegramText(messages, statuses) {
  if (messages.length) {
    const lines = ['AsiaPower Cloud API inbound message'];
    for (const msg of messages.slice(0, 5)) {
      const name = msg.name ? ` (${msg.name})` : '';
      const body = msg.text ? `: ${msg.text}` : ` [${msg.type}]`;
      lines.push(`- ${msg.from}${name}${body}`);
    }
    if (messages.length > 5) lines.push(`- ... ${messages.length - 5} more`);
    return lines.join('\n');
  }
  if (statuses.length) {
    const summary = statuses.slice(0, 5).map((s) => `${s.recipientId || s.id}: ${s.status}`).join('\n- ');
    return `AsiaPower Cloud API status update\n- ${summary}`;
  }
  return '';
}

function createWhatsAppCloudWebhook(rootDir) {
  const eventsFile = path.join(rootDir, 'data', 'whatsapp-cloud-webhook-events.ndjson');

  return async function handleWhatsAppCloudWebhook(req, res, url, json) {
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      const expected = String(process.env.WHATSAPP_CLOUD_VERIFY_TOKEN || '').trim();

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

    const rawBody = await readRawBody(req);
    const appSecret = String(process.env.WHATSAPP_CLOUD_APP_SECRET || '').trim();
    const signature = req.headers['x-hub-signature-256'];
    if (!verifySignature(rawBody, signature, appSecret)) {
      return json(res, 403, { error: 'Invalid webhook signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8') || '{}');
    } catch {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const messages = extractMessages(payload);
    const statuses = extractStatuses(payload);
    appendJsonl(eventsFile, {
      receivedAt: new Date().toISOString(),
      object: payload.object || '',
      messages,
      statuses,
      payload,
    });

    const telegramText = buildTelegramText(messages, statuses);
    if (telegramText) notifyAsync(telegramText);

    return json(res, 200, {
      ok: true,
      messages: messages.length,
      statuses: statuses.length,
    });
  };
}

module.exports = {
  createWhatsAppCloudWebhook,
  extractMessages,
  extractStatuses,
  verifySignature,
};
