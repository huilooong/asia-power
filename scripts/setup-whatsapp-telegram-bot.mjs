#!/usr/bin/env node
/**
 * Switch WhatsApp Cloud monitor + quote bridge to a DEDICATED Telegram bot.
 * Does NOT touch OpenClaw @weylonbot (Kongming).
 *
 * Usage (on prod or with SITE_ENV):
 *   node scripts/setup-whatsapp-telegram-bot.mjs --token '123:ABC' --chat-id 8918522756
 *
 * Or interactive env:
 *   WA_TG_BOT_TOKEN=... WA_TG_CHAT_ID=8918522756 node scripts/setup-whatsapp-telegram-bot.mjs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE_ENV = process.env.INVENTORY_SITE_ENV
  || '/root/.openclaw/workspace/inventory-site/.env';

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return String(process.argv[i + 1]).trim();
  return fallback;
}

const token = arg('--token', process.env.WA_TG_BOT_TOKEN || '');
const chatId = arg('--chat-id', process.env.WA_TG_CHAT_ID || process.env.ASIAPOWER_TELEGRAM_CHAT_ID || '8918522756');
const baseUrl = arg('--base-url', process.env.PUBLIC_BASE_URL || 'https://asia-power.com').replace(/\/$/, '');
const dry = process.argv.includes('--dry-run');

if (!token || !token.includes(':')) {
  console.error('Missing bot token. Pass --token or WA_TG_BOT_TOKEN');
  process.exit(2);
}
if (!chatId) {
  console.error('Missing chat id. Pass --chat-id');
  process.exit(2);
}

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `${method} HTTP ${res.status}`);
  }
  return data.result;
}

function upsertEnv(file, pairs) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (text && !text.endsWith('\n')) text += '\n';
  for (const [key, value] of Object.entries(pairs)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(text)) text = text.replace(re, line);
    else text += `${line}\n`;
  }
  if (dry) {
    console.log('[dry-run] would write', file, pairs);
    return;
  }
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

const me = await tg('getMe');
console.log('bot', `@${me.username}`, me.first_name, me.id);

const secret = crypto.randomBytes(24).toString('hex');
const webhookUrl = `${baseUrl}/api/telegram/whatsapp-quote`;

if (!dry) {
  await tg('setWebhook', {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['message', 'edited_message', 'callback_query'],
    drop_pending_updates: false,
  });
  const info = await tg('getWebhookInfo');
  console.log('webhook', info.url, 'pending', info.pending_update_count);
}

upsertEnv(SITE_ENV, {
  ASIAPOWER_TELEGRAM_BOT_TOKEN: token,
  ASIAPOWER_TELEGRAM_CHAT_ID: String(chatId),
  // Keep legacy TELEGRAM_* for other scripts, but notify prefers ASIAPOWER_*
  TELEGRAM_WEBHOOK_SECRET: secret,
  WHATSAPP_TELEGRAM_QUOTE: 'on',
  WHATSAPP_TELEGRAM_MONITOR: 'on',
});

console.log('env updated:', SITE_ENV);
console.log('IMPORTANT: OpenClaw @weylonbot token file was NOT changed.');
console.log('Next: systemctl restart inventory-site.service');
console.log('CEO must open the new bot and press Start / send /start once.');

if (!dry) {
  // Probe send to CEO chat (fails if CEO has not /start yet)
  try {
    const body = {
      chat_id: chatId,
      text: [
        `✅ AsiaPower WhatsApp 专用 Bot 已接通：@${me.username}`,
        '',
        '以后 Cloud(+86) 盯梢与报价确认都走这个号。',
        '孔明 @weylonbot 不受影响。',
        '',
        '试报价：等下一条客户盯梢 → 回复那条写价格 → 点确认发送。',
      ].join('\n'),
      disable_web_page_preview: true,
    };
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn('test message failed (open bot and /start first):', data.description);
    } else {
      console.log('test message sent to', chatId, 'message_id', data.result?.message_id);
    }
  } catch (err) {
    console.warn('test message error:', err.message);
  }
}
