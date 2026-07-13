'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const {
  createWhatsAppCloudWebhook,
  verifySignature,
  extractMessages,
  PARSER_VERSION,
} = require('../server/lib/whatsapp-cloud-webhook.js');

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

test('verifySignature accepts valid hmac', () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const secret = 'test-secret';
  const sig = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(verifySignature(body, sig, secret), true);
  assert.equal(verifySignature(body, 'sha256=deadbeef', secret), false);
  assert.equal(verifySignature(body, sig, ''), false);
});

test('GET challenge returns plain text', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apwa-'));
  process.env.WHATSAPP_CLOUD_VERIFY_TOKEN = 'verify-me';
  const handler = createWhatsAppCloudWebhook(root);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    await handler(req, res, url, json);
  });
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  const res = await fetch(
    `http://127.0.0.1:${port}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=CHALLENGE123`,
  );
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'CHALLENGE123');
  server.close();
});

test('POST invalid signature rejected; valid stores raw+normalized and dedupes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apwa-'));
  const secret = 'app-secret';
  process.env.WHATSAPP_CLOUD_APP_SECRET = secret;
  process.env.WHATSAPP_AUTONOMY_MODE = 'observe';
  const handler = createWhatsAppCloudWebhook(root);

  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: '123', display_phone_number: '8616638801930' },
              contacts: [{ wa_id: '15551234567', profile: { name: 'CEO' } }],
              messages: [
                {
                  from: '15551234567',
                  id: 'wamid.TEST001',
                  timestamp: '1710000000',
                  type: 'text',
                  text: { body: 'Hello' },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const raw = Buffer.from(JSON.stringify(payload));
  const badSig = 'sha256=00';
  const goodSig = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    await handler(req, res, url, json);
  });
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();

  const bad = await fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': badSig },
    body: raw,
  });
  assert.equal(bad.status, 403);

  const ok = await fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': goodSig },
    body: raw,
  });
  assert.equal(ok.status, 200);

  // wait async persist
  await new Promise((r) => setTimeout(r, 100));
  const normPath = path.join(root, 'data', 'whatsapp_cloud', 'normalized', 'wamid.TEST001.json');
  assert.equal(fs.existsSync(normPath), true);
  const norm = JSON.parse(fs.readFileSync(normPath, 'utf8'));
  assert.equal(norm.text, 'Hello');
  assert.equal(norm.wa_id, '15551234567');
  assert.equal(norm.parser_version, PARSER_VERSION);
  assert.ok(norm.raw_checksum);
  assert.ok(norm.raw_path);

  const ok2 = await fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': goodSig },
    body: raw,
  });
  assert.equal(ok2.status, 200);
  await new Promise((r) => setTimeout(r, 100));
  // still one normalized file
  const files = fs.readdirSync(path.join(root, 'data', 'whatsapp_cloud', 'normalized'));
  assert.equal(files.length, 1);

  const msgs = extractMessages(payload);
  assert.equal(msgs[0].text, 'Hello');
  server.close();
});
