#!/usr/bin/env node
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const VIDEO = join(ROOT, 'docs/social-content/batch-001/videos/09-civic-qxb0353-2500.mp4');
const REPORT = join(ROOT, 'docs/agent-reports/tiktok-civic-whatsapp-notify.md');

const contacts = [
  { name: 'TikTok source customer', phone: '233595114450' },
  { name: 'Short-video related customer', phone: '233558195635' },
];

const detailUrl = 'https://asia-power.com/half-cuts/detail.html?slug=honda-civic-2008-half-cut-qxb0353';
const caption = `New arrival: Honda Civic QXB0353

Whole unit: USD 2,500
Tell us what parts you need — engine, gearbox, front clip, body parts. We dismantle according to your request.

Photos + details:
${detailUrl}

Reply "CIVIC" if you want today's photos and shipping quote.`;

function chatId(phone) {
  return phone.replace(/\D/g, '') + '@c.us';
}

function writeReport(rows) {
  mkdirSync(dirname(REPORT), { recursive: true });
  const lines = [
    '# TikTok Civic WhatsApp Notify',
    '',
    `Video: \`${VIDEO}\``,
    `Landing: ${detailUrl}`,
    '',
    '| Contact | Phone | Status | Error |',
    '|---|---:|---|---|',
    ...rows.map(r => `| ${r.name} | ${r.phone} | ${r.status} | ${r.error || ''} |`),
    '',
  ];
  writeFileSync(REPORT, lines.join('\n'), 'utf8');
}

if (!existsSync(VIDEO)) {
  console.error(`Missing video: ${VIDEO}`);
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: join(ROOT, '.wwebjs_auth') }),
  puppeteer: { headless: true, args: ['--no-sandbox'] },
});

client.on('ready', async () => {
  const media = MessageMedia.fromFilePath(VIDEO);
  const rows = [];
  for (const c of contacts) {
    try {
      await client.sendMessage(chatId(c.phone), media, { caption });
      rows.push({ ...c, status: 'sent' });
      console.log(`sent ${c.phone}`);
      await new Promise(resolve => setTimeout(resolve, 6000));
    } catch (err) {
      rows.push({ ...c, status: 'failed', error: err?.message || String(err) });
      console.log(`failed ${c.phone}: ${err?.message || err}`);
    }
  }
  writeReport(rows);
  await client.destroy();
  process.exit(rows.some(r => r.status === 'failed') ? 1 : 0);
});

client.on('qr', () => {
  console.error('WhatsApp session needs QR login; run scripts/whatsapp-blast.mjs once in Terminal to refresh session.');
});

client.on('auth_failure', () => {
  console.error('WhatsApp auth failure');
  process.exit(1);
});

client.initialize();
