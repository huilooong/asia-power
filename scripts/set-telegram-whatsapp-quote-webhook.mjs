#!/usr/bin/env node
/**
 * Register Telegram webhook for WhatsApp Cloud quote bridge
 * (dedicated @Asiapower86166_bot via ASIAPOWER_TELEGRAM_BOT_TOKEN — not @weylonbot).
 *
 * Usage (on prod or with prod env loaded):
 *   node scripts/set-telegram-whatsapp-quote-webhook.mjs
 *   node scripts/set-telegram-whatsapp-quote-webhook.mjs --delete
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(k in process.env) || !String(process.env[k] || '').trim()) {
      process.env[k] = v;
    }
  }
}

loadEnvFile(path.join(ROOT, '.env'));
if (process.env.INVENTORY_SITE_ENV) {
  loadEnvFile(process.env.INVENTORY_SITE_ENV);
}

const token = String(
  process.env.ASIAPOWER_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
).trim();
const secret = String(
  process.env.TELEGRAM_WEBHOOK_SECRET || process.env.WHATSAPP_TELEGRAM_WEBHOOK_SECRET || '',
).trim();
const baseUrl = String(process.env.PUBLIC_BASE_URL || 'https://asia-power.com').replace(/\/$/, '');
const webhookUrl = `${baseUrl}/api/telegram/whatsapp-quote`;
const del = process.argv.includes('--delete');

if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN / ASIAPOWER_TELEGRAM_BOT_TOKEN');
  process.exit(2);
}

async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `${method} HTTP ${res.status}`);
  }
  return data;
}

if (del) {
  const r = await api('deleteWebhook', { drop_pending_updates: false });
  console.log('deleteWebhook ok', r.result);
  process.exit(0);
}

if (!secret) {
  console.error('Missing TELEGRAM_WEBHOOK_SECRET — refuse to set open webhook');
  process.exit(2);
}

const r = await api('setWebhook', {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ['message', 'edited_message', 'callback_query'],
  drop_pending_updates: false,
});
console.log('setWebhook ok', { url: webhookUrl, result: r.result });
const info = await api('getWebhookInfo', {});
console.log('getWebhookInfo', info.result);
