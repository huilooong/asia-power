#!/usr/bin/env node
/**
 * Add Cloudflare Email Routing rules for all AsiaPower mailboxes.
 * sales@ + supplier@ → Worker (same as inquiry@)
 * weylon@ → forward to CEO Gmail (requires destination verified in Cloudflare)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZONE_ID = 'd7380f191b0f11239f3c9209917bb6c3';
const ACCOUNT_ID = '48f9700232d51daf90f23262ade3bc26';
const WORKER = 'asiapower-email-inbound';
const DOMAIN = 'asia-power.com';

const WORKER_ROUTES = [
  { address: `sales@${DOMAIN}`, name: 'AsiaPower sales → 子敬 Worker' },
  { address: `supplier@${DOMAIN}`, name: 'AsiaPower supplier → 子龙 Worker' },
];

const FORWARD_ROUTES = [
  { address: `weylon@${DOMAIN}`, name: 'CEO weylon → Gmail', forwardTo: 'weylonhui@gmail.com' },
];

function getToken() {
  const home = process.env.HOME || '';
  for (const cfg of [
    path.join(home, 'Library', 'Preferences', '.wrangler', 'config', 'default.toml'),
    path.join(home, '.config', '.wrangler', 'config', 'default.toml'),
  ]) {
    if (!fs.existsSync(cfg)) continue;
    const m = fs.readFileSync(cfg, 'utf8').match(/oauth_token\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return process.env.CLOUDFLARE_API_TOKEN || '';
}

async function cf(token, pathname, opts = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  return res.json();
}

async function ensureWorkerRule(token, address, name) {
  const list = await cf(token, `/zones/${ZONE_ID}/email/routing/rules`);
  const exists = (list.result || []).some((r) => r.matchers?.some((m) => m.value === address));
  if (exists) {
    console.log('✅', address, '(已有规则)');
    return;
  }
  const body = {
    name,
    enabled: true,
    matchers: [{ type: 'literal', field: 'to', value: address }],
    actions: [{ type: 'worker', value: [WORKER] }],
  };
  const created = await cf(token, `/zones/${ZONE_ID}/email/routing/rules`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  console.log(created.success ? '✅ 创建' : '❌ 失败', address, created.errors?.[0]?.message || '');
}

async function ensureForwardRule(token, address, name, forwardTo) {
  const list = await cf(token, `/zones/${ZONE_ID}/email/routing/rules`);
  const exists = (list.result || []).some((r) => r.matchers?.some((m) => m.value === address));
  if (exists) {
    console.log('✅', address, '(已有规则)');
    return;
  }
  const body = {
    name,
    enabled: true,
    matchers: [{ type: 'literal', field: 'to', value: address }],
    actions: [{ type: 'forward', value: [forwardTo] }],
  };
  const created = await cf(token, `/zones/${ZONE_ID}/email/routing/rules`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (created.success) {
    console.log('✅ 转发', address, '→', forwardTo);
    return;
  }
  console.log('❌ 转发失败', address, created.errors?.[0]?.message || '');
  console.log('   请在 Cloudflare → Email Routing → Destination addresses 验证', forwardTo);
}

async function main() {
  const token = getToken();
  if (!token) {
    console.log('❌ 需要 wrangler login 或 CLOUDFLARE_API_TOKEN');
    process.exit(1);
  }
  console.log('AsiaPower · 添加邮箱路由\n');
  for (const r of WORKER_ROUTES) {
    await ensureWorkerRule(token, r.address, r.name);
  }
  for (const r of FORWARD_ROUTES) {
    await ensureForwardRule(token, r.address, r.name, r.forwardTo);
  }
  console.log('\n完成。inquiry@ 规则应已存在；sales/supplier 走 Worker；weylon 转发 Gmail。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
