#!/usr/bin/env node
/**
 * Enable CEO Gmail copy for sales@ + inquiry@ inbound mail.
 * Worker still posts to /api/email/inbound, then forwards raw mail to Gmail.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CEO_GMAIL = process.env.ASIAPOWER_CEO_FORWARD_GMAIL || 'weylonhui@gmail.com';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'd7380f191b0f11239f3c9209917bb6c3';

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

async function cf(token, pathname, opts = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  return res.json();
}

async function ensureDestinationVerified(token, email) {
  const list = await cf(token, `/zones/${ZONE_ID}/email/routing/addresses`);
  const rows = list.result || [];
  const hit = rows.find((r) => (r.email || '').toLowerCase() === email.toLowerCase());
  if (hit?.verified) {
    console.log('✅ Gmail 目标地址已验证:', email);
    return true;
  }
  if (hit && !hit.verified) {
    console.log('⏸ Gmail 目标地址待验证:', email, '→ 请到 Gmail 点 Cloudflare 验证链接');
    return false;
  }
  const created = await cf(token, `/zones/${ZONE_ID}/email/routing/addresses`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  if (created.success) {
    console.log('📧 已发送验证邮件到', email, '→ 请打开 Gmail 点确认链接');
    return false;
  }
  console.log('❌ 无法添加转发目标:', created.errors?.[0]?.message || 'unknown');
  return false;
}

async function main() {
  const env = { ...loadEnv(path.join(ROOT, '.env')), ...process.env };
  const token = env.CLOUDFLARE_API_TOKEN || '';
  if (!token) {
    console.log('❌ 需要 CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }

  console.log('AsiaPower · sales/inquiry → CEO Gmail 转发\n');
  console.log('目标 Gmail:', CEO_GMAIL);

  await ensureDestinationVerified(token, CEO_GMAIL);

  const wrangler = spawnSync(
    'npx',
    ['wrangler', 'deploy', '--config', 'deploy/wrangler-email.toml'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CLOUDFLARE_API_TOKEN: token } },
  );
  if (wrangler.status !== 0) {
    console.log('\n⚠️ wrangler deploy 失败。可手动：Cloudflare → Email Workers → 粘贴 deploy/cloudflare-email-worker.js');
    process.exit(wrangler.status || 1);
  }

  console.log('\n✅ 已部署 Email Worker');
  console.log('   sales@ / inquiry@ → 系统收信 + 转发副本到', CEO_GMAIL);
  console.log('   测试：发一封邮件到 sales@asia-power.com，Gmail 应收到副本');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
