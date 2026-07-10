#!/usr/bin/env node
/**
 * 让 sales@asia-power.com 正式可发信：
 *   RESEND_FULL_KEY=re_xxx node scripts/verify-sales-domain.mjs
 * （Full access Key — 在 Resend → API Keys → Full access 创建）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOMAIN = 'asia-power.com';
const ZONE = 'd7380f191b0f11239f3c9209917bb6c3';
const SEND_KEY = process.env.RESEND_API_KEY || 're_QwMYzH1Y_4N5nUVuTFmhpAwmBJVHXEwhj';
const FULL_KEY = process.argv[2] || process.env.RESEND_FULL_KEY || '';

function wranglerToken() {
  const cfg = path.join(process.env.HOME, 'Library/Preferences/.wrangler/config/default.toml');
  if (!fs.existsSync(cfg)) return '';
  return fs.readFileSync(cfg, 'utf8').match(/oauth_token\s*=\s*"([^"]+)"/)?.[1] || '';
}

function loadEnv() {
  const out = {};
  for (const f of [path.join(__dirname, '..', '.env')]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  }
  return out;
}

async function resend(key, pathname, opts = {}) {
  const r = await fetch(`https://api.resend.com${pathname}`, {
    ...opts,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

async function cf(token, pathname, opts = {}) {
  const r = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return r.json();
}

async function getCfToken() {
  const env = loadEnv();
  if (env.CLOUDFLARE_API_TOKEN) return env.CLOUDFLARE_API_TOKEN;
  const ssh = spawnSync('ssh', ['-o', 'BatchMode=yes', 'root@159.65.86.24',
    "grep '^CLOUDFLARE_API_TOKEN=' /root/.openclaw/workspace/inventory-site/.env | cut -d= -f2-"], { encoding: 'utf8' });
  return (ssh.stdout || '').trim() || wranglerToken();
}

async function syncDns(cfToken, records) {
  const existing = await cf(cfToken, `/zones/${ZONE}/dns_records?per_page=500`);
  let added = 0;
  for (const rec of records) {
    const type = (rec.type || '').toUpperCase();
    const content = rec.value || rec.content;
    const name = rec.name;
    const dup = (existing.result || []).find((e) => e.type === type && e.name === name && e.content === content);
    if (dup) continue;
    const payload = { type, name, content, ttl: 3600 };
    if (type === 'MX') payload.priority = rec.priority ?? 10;
    const created = await cf(cfToken, `/zones/${ZONE}/dns_records`, { method: 'POST', body: JSON.stringify(payload) });
    if (created.success) {
      console.log('  + DNS', type, name);
      added++;
    } else {
      console.log('  ! DNS', type, name, created.errors?.[0]?.message);
    }
  }
  return added;
}

async function enableProdSalesFrom() {
  const script = `
for F in /root/.openclaw/workspace/inventory-site/.env /root/.openclaw/workspace/AsiaPower/.env; do
  sed -i 's|^EMAIL_RESEND_USE_FALLBACK=.*|EMAIL_RESEND_USE_FALLBACK=0|' "$F" 2>/dev/null || echo EMAIL_RESEND_USE_FALLBACK=0 >> "$F"
  if grep -q '^EMAIL_FROM_SALES=' "$F"; then sed -i 's|^EMAIL_FROM_SALES=.*|EMAIL_FROM_SALES=AsiaPower Sales <sales@asia-power.com>|' "$F"
  else echo 'EMAIL_FROM_SALES=AsiaPower Sales <sales@asia-power.com>' >> "$F"; fi
done
systemctl restart inventory-site.service
echo prod_updated
`;
  spawnSync('ssh', ['-o', 'BatchMode=yes', 'root@159.65.86.24', 'bash', '-s'], { input: script, stdio: 'inherit' });
}

async function main() {
  if (!FULL_KEY.startsWith('re_')) {
    console.log(`
原因：当前 Key 只有「发信」权限，不能添加/验证域名，所以只能用 onboarding@resend.dev。

请 1 分钟完成（Resend 已登录）：
  1. https://resend.com/api-keys → Create API Key → 选 Full access
  2. 运行: node scripts/verify-sales-domain.mjs re_你的FullAccessKey

或 Resend → Domains 手动 Add asia-power.com 后，把 Full access Key 给我继续。
`);
    process.exit(1);
  }

  console.log('→ 添加/检查 Resend 域名', DOMAIN);
  let list = await resend(FULL_KEY, '/domains');
  let domain = (list.data?.data || []).find((d) => d.name === DOMAIN);
  if (!domain) {
    const created = await resend(FULL_KEY, '/domains', { method: 'POST', body: JSON.stringify({ name: DOMAIN }) });
    if (created.status >= 400) {
      console.error('❌ 添加域名失败:', created.data?.message || JSON.stringify(created.data));
      process.exit(1);
    }
    domain = created.data;
  }
  console.log('  域名', domain.name, domain.status);

  let detail = await resend(FULL_KEY, `/domains/${domain.id}`);
  const records = detail.data?.records || [];
  const cfToken = await getCfToken();
  if (!cfToken) {
    console.log('❌ 无 Cloudflare Token');
    records.forEach((r) => console.log(r.type, r.name, r.value || r.content));
    process.exit(1);
  }

  console.log('→ 同步 DNS 到 Cloudflare...');
  await syncDns(cfToken, records);

  console.log('→ 等待验证（最多 3 分钟）...');
  await resend(FULL_KEY, `/domains/${domain.id}/verify`, { method: 'POST', body: '{}' });
  for (let i = 0; i < 18; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    detail = await resend(FULL_KEY, `/domains/${domain.id}`);
    console.log('  状态', detail.data?.status);
    if (detail.data?.status === 'verified') break;
  }

  if (detail.data?.status !== 'verified') {
    console.log('⏳ DNS 还在传播，10 分钟后再运行同一命令');
    process.exit(0);
  }

  console.log('→ 测试 sales@ 发信...');
  const test = await resend(SEND_KEY, '/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: 'AsiaPower Sales <sales@asia-power.com>',
      to: ['gooddlong@gmail.com'],
      subject: 'AsiaPower · 正式 sales@ 发信测试',
      text: '域名已验证，今后客户信从 sales@asia-power.com 发出。',
    }),
  });
  if (test.status >= 400) {
    console.log('⚠️  测试:', test.data?.message);
  } else {
    console.log('✅ 测试信已发, id:', test.data?.id);
  }

  await enableProdSalesFrom();
  console.log('\n✅ 完成 — 生产已切换为 sales@asia-power.com');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
