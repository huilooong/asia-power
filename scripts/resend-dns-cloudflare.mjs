#!/usr/bin/env node
/**
 * After adding asia-power.com in Resend dashboard, paste DNS records here or pass via env,
 * then run with Cloudflare token to auto-add records.
 *
 * Usage:
 *   RESEND_API_KEY=re_xxx node scripts/resend-dns-cloudflare.mjs
 *   # fetches domain DNS from Resend API and adds missing records to Cloudflare
 *
 * Requires in inventory-site .env (or env):
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID (or CLOUDFLARE_ACCOUNT_ID + zone lookup)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const siteEnv = loadEnvFile(path.join(ROOT, '.env'));
const invEnv = loadEnvFile('/root/.openclaw/workspace/inventory-site/.env');
const env = { ...siteEnv, ...invEnv, ...process.env };

const RESEND_KEY = env.RESEND_API_KEY;
const CF_TOKEN = env.CLOUDFLARE_API_TOKEN;
const ZONE_ID = env.CLOUDFLARE_ZONE_ID || 'd7380f191b0f11239f3c9209917bb6c3';
const DOMAIN = env.EMAIL_PROXY_DOMAIN || 'asia-power.com';

async function cf(method, endpoint, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(JSON.stringify(data.errors || data));
  }
  return data.result;
}

async function main() {
  if (!RESEND_KEY) {
    console.log(`
Resend Phase 2 — CEO 3 步

1) 打开 https://resend.com → Sign up → Domains → Add ${DOMAIN}
2) API Keys → Create → 复制 re_xxx
3) 在生产服务器两个 .env 都加上（或只加 inventory-site/.env 若 Python 从那里读）:
   RESEND_API_KEY=re_xxx
   EMAIL_SEND_ENABLED=1

然后在本机或服务器运行:
   RESEND_API_KEY=re_xxx CLOUDFLARE_API_TOKEN=xxx node scripts/resend-dns-cloudflare.mjs

发信测试:
   python main.py "/email send draft-2026-07-03T1810TUTC-ffa5a9f2"
`);
    process.exit(0);
  }

  if (!CF_TOKEN) {
    console.error('Need CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }

  const domainsRes = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  const domains = await domainsRes.json();
  const domain = (domains.data || []).find((d) => d.name === DOMAIN);
  if (!domain) {
    console.error(`Domain ${DOMAIN} not found in Resend. Add it in dashboard first.`);
    process.exit(1);
  }

  const detailRes = await fetch(`https://api.resend.com/domains/${domain.id}`, {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  });
  const detail = await detailRes.json();
  const records = detail.records || [];
  console.log(`[resend] ${DOMAIN} status: ${detail.status}, ${records.length} DNS records`);

  const existing = await cf('GET', `/zones/${ZONE_ID}/dns_records?per_page=500`);
  let added = 0;
  for (const rec of records) {
    const type = rec.type?.toUpperCase();
    const name = rec.name === DOMAIN ? DOMAIN : rec.name;
    const dup = existing.find(
      (e) => e.type === type && e.name === name && (e.content === rec.value || e.content === rec.content)
    );
    if (dup) {
      console.log(`  skip (exists): ${type} ${name}`);
      continue;
    }
    const payload = {
      type,
      name: rec.name,
      content: rec.value || rec.content,
      ttl: 3600,
    };
    if (type === 'MX') payload.priority = rec.priority || 10;
    await cf('POST', `/zones/${ZONE_ID}/dns_records`, payload);
    console.log(`  + added: ${type} ${rec.name}`);
    added++;
  }
  console.log(`Done. Added ${added} record(s). Wait for Resend domain Verified, then EMAIL_SEND_ENABLED=1`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
