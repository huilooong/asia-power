#!/usr/bin/env node
/**
 * Full Cloudflare Email Routing setup for inquiry@asia-power.com
 * Uses wrangler OAuth credentials OR CLOUDFLARE_API_TOKEN with Workers + Email Routing permissions.
 *
 * Usage:
 *   node scripts/cloudflare-email-full-setup.mjs
 *   EMAIL_INBOUND_SECRET=xxx node scripts/cloudflare-email-full-setup.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEPLOY = path.join(ROOT, 'deploy');

const ACCOUNT_ID = '48f9700232d51daf90f23262ade3bc26';
const ZONE_ID = 'd7380f191b0f11239f3c9209917bb6c3';
const WORKER_NAME = 'asiapower-email-inbound';
const ROUTE_ADDRESS = 'inquiry@asia-power.com';
const WEBHOOK = 'https://asia-power.com/api/email/inbound';

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
const secret = env.EMAIL_INBOUND_SECRET || '';

async function cf(token, pathname, opts = {}) {
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

function getWranglerOAuthToken() {
  const home = process.env.HOME || '';
  const candidates = [
    path.join(home, 'Library', 'Preferences', '.wrangler', 'config', 'default.toml'),
    path.join(home, '.config', '.wrangler', 'config', 'default.toml'),
  ];
  for (const cfg of candidates) {
    if (!fs.existsSync(cfg)) continue;
    const text = fs.readFileSync(cfg, 'utf8');
    const m = text.match(/oauth_token\s*=\s*"([^"]+)"/);
    if (m?.[1]) return m[1];
  }
  return '';
}

async function deployWithWrangler() {
  console.log('→ wrangler deploy...');
  execSync('npx --yes wrangler@4 deploy --config wrangler-email.toml', {
    cwd: DEPLOY,
    stdio: 'inherit',
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
  });
  if (secret) {
    console.log('→ wrangler secret put ASIAPOWER_EMAIL_SECRET...');
    execSync('npx --yes wrangler@4 secret put ASIAPOWER_EMAIL_SECRET --config wrangler-email.toml', {
      cwd: DEPLOY,
      input: secret,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
    });
  } else {
    console.log('⚠️  跳过 secret（未设 EMAIL_INBOUND_SECRET）');
  }
}

async function enableEmailRouting(token) {
  const status = await cf(token, `/zones/${ZONE_ID}/email/routing`);
  if (status.data.success && status.data.result?.enabled) {
    console.log('✅ Email Routing 已启用');
    return true;
  }
  console.log('→ 启用 Email Routing...');
  const en = await cf(token, `/zones/${ZONE_ID}/email/routing/enable`, { method: 'POST', body: '{}' });
  if (en.data.success) {
    console.log('✅ Email Routing 已开启', en.data.result?.status || '');
    return true;
  }
  console.log('❌ 启用失败:', JSON.stringify(en.data.errors || en.data));
  return false;
}

async function ensureRoutingRule(token) {
  const list = await cf(token, `/zones/${ZONE_ID}/email/routing/rules`);
  if (!list.data.success) {
    console.log('❌ 无法读取路由规则:', JSON.stringify(list.data.errors));
    return false;
  }
  const existing = (list.data.result || []).find(
    (r) => r.matchers?.some((m) => m.value === ROUTE_ADDRESS),
  );
  if (existing) {
    console.log('✅ 路由规则已存在:', ROUTE_ADDRESS);
    return true;
  }

  console.log('→ 创建路由规则', ROUTE_ADDRESS, '→ Worker', WORKER_NAME);
  const body = {
    name: 'AsiaPower inquiry to Worker',
    enabled: true,
    matchers: [{ type: 'literal', field: 'to', value: ROUTE_ADDRESS }],
    actions: [{ type: 'worker', value: [WORKER_NAME] }],
  };
  const created = await cf(token, `/zones/${ZONE_ID}/email/routing/rules`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (created.data.success) {
    console.log('✅ 路由规则已创建');
    return true;
  }
  console.log('❌ 创建路由失败:', JSON.stringify(created.data.errors || created.data));
  return false;
}

async function main() {
  console.log('AsiaPower · Cloudflare 邮件转发全自动配置\n');

  let token = env.CLOUDFLARE_API_TOKEN || getWranglerOAuthToken();
  if (!token) {
    console.log('❌ 无 API Token。请先运行: cd deploy && npx wrangler login');
    process.exit(1);
  }

  const verify = await cf(token, '/user/tokens/verify');
  if (!verify.data.success && !getWranglerOAuthToken()) {
    console.log('❌ Token 无效');
    process.exit(1);
  }
  console.log('✅ 认证 OK');

  try {
    await deployWithWrangler();
  } catch (e) {
    console.log('❌ wrangler deploy 失败:', e.message);
    process.exit(1);
  }

  if (!(await enableEmailRouting(token))) process.exit(1);
  if (!(await ensureRoutingRule(token))) process.exit(1);

  const mx = await cf(token, `/zones/${ZONE_ID}/dns_records?type=MX`);
  const mxCount = mx.data.result?.length || 0;
  console.log(`\n✅ 完成 · MX 记录 ${mxCount} 条`);
  console.log('测试: 发邮件到 inquiry@asia-power.com');
  console.log('验证: curl -s https://asia-power.com/api/email/health');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
