#!/usr/bin/env node
/**
 * Cloudflare Email Worker setup helper (子敬 inquiry@ → /api/email/inbound)
 *
 * Requires API token with:
 *   - Zone → Email Routing Rules → Edit
 *   - Account → Workers Scripts → Edit
 *   - Account → Workers Routes → Edit
 *
 * Usage:
 *   node scripts/setup-cloudflare-email-worker.mjs
 *   node scripts/setup-cloudflare-email-worker.mjs --verify-only
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = { ...loadEnv(path.join(ROOT, '.env')), ...process.env };
const token = env.CLOUDFLARE_API_TOKEN || '';
const zoneId = env.CLOUDFLARE_ZONE_ID || '';
const accountId = env.CLOUDFLARE_ACCOUNT_ID || '';
const secret = env.EMAIL_INBOUND_SECRET || '';

async function cf(pathname, opts = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function main() {
  const verifyOnly = process.argv.includes('--verify-only');
  console.log('AsiaPower · Cloudflare Email Worker 配置检查\n');

  if (!token || !zoneId || !accountId) {
    console.log('❌ 缺少 CLOUDFLARE_API_TOKEN / ZONE_ID / ACCOUNT_ID');
    process.exit(1);
  }
  if (!secret) {
    console.log('❌ 缺少 EMAIL_INBOUND_SECRET（生产 .env 已设则可忽略）');
  }

  const verify = await cf('/user/tokens/verify');
  console.log(verify.data.success ? '✅ API Token 有效' : '❌ API Token 无效');

  const routing = await cf(`/zones/${zoneId}/email/routing`);
  if (routing.data.success) {
    console.log('✅ Email Routing API 可访问');
    console.log('   enabled:', routing.data.result?.enabled);
  } else {
    console.log('❌ Email Routing API 无权限（需在 Cloudflare 创建新 Token）');
    console.log('   权限: Zone Email Routing Rules Edit + Account Workers Scripts Edit');
    console.log('   或手动: https://dash.cloudflare.com → asia-power.com → Email → Routing');
  }

  const workers = await cf(`/accounts/${accountId}/workers/scripts`);
  if (workers.data.success) {
    console.log('✅ Workers API 可访问');
  } else {
    console.log('❌ Workers API 无权限');
  }

  const health = await fetch('https://asia-power.com/api/email/health').then((r) => r.json()).catch(() => null);
  if (health?.ok) {
    console.log(`✅ 生产 webhook 在线 pending=${health.pendingApsales}`);
  } else {
    console.log('❌ /api/email/health 不可达');
  }

  if (verifyOnly) return;

  console.log('\n--- 手动步骤（Token 无 Email 权限时）---');
  console.log('1. Cloudflare → Email → Email Routing → Enable');
  console.log('2. Email Workers → 创建 Worker，粘贴 deploy/cloudflare-email-worker.js');
  console.log('3. Worker 变量:');
  console.log('   ASIAPOWER_EMAIL_WEBHOOK=https://asia-power.com/api/email/inbound');
  console.log('   ASIAPOWER_EMAIL_SECRET=(与生产 EMAIL_INBOUND_SECRET 相同)');
  console.log('4. Routing rule: inquiry@asia-power.com → 该 Worker');
  console.log('5. 发测试信到 inquiry@asia-power.com');
  console.log('6. 生产: cd AsiaPower && python main.py "/email list"');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
