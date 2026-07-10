/**
 * AsiaPower WhatsApp Outreach Blaster
 * 扫码登录一次，自动发送所有待发联系人
 */
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 发送间隔（毫秒），避免被 WhatsApp 封号
const DELAY_MS = 8000;

const TEMPLATES = {
  'Engine importer': `👉 https://asia-power.com/engines/

Hi, we are AsiaPower — used engine exporter from China.
Browse our full engine catalog on our website above.
Search by model, check stock, and inquiry direct.

What engine do you need? We reply same day.`,

  'Auto dismantler': `👉 https://asia-power.com/half-cuts/

Hi, we are AsiaPower — half-cut and front-cut supplier from China.
Visit our website above to browse live half-cut stock with chassis photos.

Tell us the model and year — we send photos and price today.`,

  'Fleet maintenance company': `👉 https://asia-power.com/trucks/

Hi, we are AsiaPower — truck and commercial vehicle parts from China.
Visit our website above for engines, gearboxes, differentials and more.

Send us your vehicle models — FOB quote within 24h.`,

  'Commercial vehicle workshop': `👉 https://asia-power.com/trucks/

Hi, we are AsiaPower — truck parts exporter from China.
Visit our website above and browse what we carry.

Send us your parts list — we quote fast.`,

  'Used auto parts wholesaler': `👉 https://asia-power.com/contact.html

Hi, we are AsiaPower — wholesale used auto parts from China.
Visit our website above — weekly stock, mixed container, full export docs.

Contact us with your sourcing list and we reply same day.`,

  'Auto parts importer': `👉 https://asia-power.com/contact.html

Hi, we are AsiaPower — used auto parts exporter from China.
Visit our website above to see our full catalog: engines, gearboxes, half-cuts and more.

Tell us what you need — we quote same day.`,
};
const DEFAULT_MSG = `👉 https://asia-power.com

Hi, we are AsiaPower — used auto parts exporter from China.
Visit our website above to browse our full catalog.

Contact us with what you need — we reply same day.`;

function formatPhone(phone, country) {
  const p = phone.replace(/[\s\-().]/g, '');
  if (p.startsWith('+')) return p.replace('+', '') + '@c.us';
  const codes = { Nigeria: '234', Ghana: '233', Kenya: '254', UAE: '971', Tanzania: '255' };
  const code = codes[country] || '';
  const local = p.replace(/^0/, '');
  return `${code}${local}@c.us`;
}

// Load contacts from CSV
const csvPath = join(ROOT, 'runtime/apbd/2026-07-05/outreach_queue/outreach-queue.csv');
const csv = readFileSync(csvPath, 'utf8').trim().split('\n');
const headers = csv[0].split(',');
const idx = (h) => headers.indexOf(h);

const contacts = csv.slice(1)
  .map(line => {
    const cols = line.split(',');
    return {
      company: cols[idx('Company')],
      country: cols[idx('Country')],
      city: cols[idx('City')],
      phone: cols[idx('Public Phone')],
      type: cols[idx('Business Type')],
    };
  })
  .filter(c => c.phone && c.phone !== 'Not published');

// Priority: Nigeria, Ghana, Kenya, UAE, Tanzania
const ORDER = ['Nigeria', 'Ghana', 'Kenya', 'UAE', 'Tanzania'];
contacts.sort((a, b) => (ORDER.indexOf(a.country) || 99) - (ORDER.indexOf(b.country) || 99));

console.log(`\n📋 准备发送 ${contacts.length} 家联系人\n`);

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: join(ROOT, '.wwebjs_auth') }),
  puppeteer: { headless: true, args: ['--no-sandbox'] }
});

client.on('qr', qr => {
  console.log('\n📱 请用手机 WhatsApp 扫描以下二维码登录：\n');
  qrcode.generate(qr, { small: true });
  console.log('\n扫码完成后将自动开始发送...\n');
});

client.on('ready', async () => {
  console.log('✅ WhatsApp 登录成功，开始发送...\n');

  let sent = 0, failed = 0;

  for (const c of contacts) {
    const chatId = formatPhone(c.phone, c.country);
    const msg = TEMPLATES[c.type] || DEFAULT_MSG;

    try {
      await client.sendMessage(chatId, msg);
      sent++;
      console.log(`✅ [${sent}/${contacts.length}] ${c.company} (${c.country}) → 已发送`);
    } catch (e) {
      failed++;
      console.log(`❌ [${c.company}] 发送失败: ${e.message}`);
    }

    if (sent + failed < contacts.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n🏁 发送完成！成功 ${sent} 家，失败 ${failed} 家`);
  await client.destroy();
  process.exit(0);
});

client.on('auth_failure', () => {
  console.error('❌ 登录失败，请重试');
  process.exit(1);
});

client.initialize();
