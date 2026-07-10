#!/usr/bin/env node
/**
 * Phase 2 outbound — Resend (preferred) or Cloudflare Email Sending.
 *
 *   RESEND_API_KEY=re_xxx node scripts/setup-email-outbound.mjs
 *   node scripts/setup-email-outbound.mjs re_xxx
 *
 * Steps: verify key → add domain asia-power.com → sync DNS → prod .env → test send
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ZONE_ID = 'd7380f191b0f11239f3c9209917bb6c3';
const DOMAIN = 'asia-power.com';
const REMOTE_ENV = '/root/.openclaw/workspace/inventory-site/.env';
const REMOTE_PY_ENV = '/root/.openclaw/workspace/AsiaPower/.env';

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
const resendKey = process.argv[2] || env.RESEND_API_KEY || '';
const cfToken = env.CLOUDFLARE_API_TOKEN || '';

async function resend(pathname, opts = {}) {
  const res = await fetch(`https://api.resend.com${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function cf(pathname, opts = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${cfToken}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  return res.json();
}

async function ensureResendDomain() {
  const list = await resend('/domains');
  let domain = (list.data?.data || []).find((d) => d.name === DOMAIN);
  if (!domain) {
    console.log('→ Resend 添加域名', DOMAIN);
    const created = await resend('/domains', { method: 'POST', body: JSON.stringify({ name: DOMAIN }) });
    if (created.status >= 400) {
      console.error('❌ 添加域名失败:', JSON.stringify(created.data));
      process.exit(1);
    }
    domain = created.data;
  } else {
    console.log('✅ Resend 域名已存在:', domain.name, domain.status);
  }

  const detail = await resend(`/domains/${domain.id}`);
  const records = detail.data?.records || [];
  if (!cfToken) {
    console.log('⚠️  无 CLOUDFLARE_API_TOKEN，请手动在 Cloudflare DNS 添加:');
    for (const r of records) console.log(' ', r.type, r.name, '→', r.value || r.content);
    return domain;
  }

  const existing = await cf(`/zones/${ZONE_ID}/dns_records?per_page=500`);
  let added = 0;
  for (const rec of records) {
    const type = (rec.type || '').toUpperCase();
    const content = rec.value || rec.content;
    const dup = (existing.result || []).find(
      (e) => e.type === type && e.name === rec.name && e.content === content,
    );
    if (dup) continue;
    const payload = { type, name: rec.name, content, ttl: 3600 };
    if (type === 'MX') payload.priority = rec.priority || 10;
    const created = await cf(`/zones/${ZONE_ID}/dns_records`, { method: 'POST', body: JSON.stringify(payload) });
    if (created.success) {
      console.log('  + DNS', type, rec.name);
      added++;
    }
  }
  console.log(added ? `✅ 已添加 ${added} 条 DNS` : '✅ DNS 记录已齐全');
  return domain;
}

function upsertRemoteEnv(key, value) {
  const script = `
ENV="${REMOTE_ENV}"
PY="${REMOTE_PY_ENV}"
upsert() {
  local F="$1" K="$2" V="$3"
  if grep -q "^$K=" "$F" 2>/dev/null; then
    sed -i "s|^$K=.*|$K=$V|" "$F"
  else
    echo "$K=$V" >> "$F"
  fi
}
upsert "$ENV" "${key}" "${value.replace(/"/g, '\\"')}"
upsert "$PY" "${key}" "${value.replace(/"/g, '\\"')}"
`;
  spawnSync('ssh', ['-o', 'BatchMode=yes', 'root@159.65.86.24', 'bash', '-s'], {
    input: script,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

async function testResendSend() {
  const r = await resend('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: `AsiaPower Sales <sales@${DOMAIN}>`,
      to: ['gooddlong@gmail.com'],
      subject: 'AsiaPower · sales@ 发信测试',
      text: 'Phase 2 outbound test — Resend configured.',
    }),
  });
  if (r.status >= 400) {
    console.log('⚠️  测试发送:', JSON.stringify(r.data));
    return false;
  }
  console.log('✅ 测试邮件已发送, id:', r.data.id);
  return true;
}

async function main() {
  if (!resendKey || !resendKey.startsWith('re_')) {
    console.log(`
子敬 · 邮件发信一键配置

您已在 Resend 登录后，请：
1. 浏览器打开 https://resend.com/api-keys → Create API Key
2. 复制 re_ 开头的 Key
3. 运行:
   node scripts/setup-email-outbound.mjs re_你的密钥

或在 Chrome 已登录时双击: docs/一键部署-子敬Resend发信.command
`);
    process.exit(1);
  }

  console.log('→ 验证 Resend Key...');
  const domains = await resend('/domains');
  if (domains.status === 401 || domains.status === 403) {
    const probe = await resend('/emails', {
      method: 'POST',
      body: JSON.stringify({
        from: `AsiaPower Sales <onboarding@resend.dev>`,
        to: ['gooddlong@gmail.com'],
        subject: 'AsiaPower Resend key probe',
        text: 'Key validation probe — ignore.',
      }),
    });
    if (probe.status === 401 || probe.status === 403) {
      console.error('❌ Resend Key 无效或无发信权限');
      process.exit(1);
    }
    console.log('✅ Resend Key 有效（发信权限）');
    if (domains.status === 403) {
      console.log('⚠️  Key 无域名管理权限 — 请在 Resend 控制台手动添加 asia-power.com');
    }
  } else {
    console.log('✅ Resend Key 有效');
  }

  if (domains.status === 200) {
    await ensureResendDomain();
  } else {
    console.log('→ 跳过自动 DNS（请确认 Resend 里 asia-power.com 已 Verified）');
  }
  console.log('→ 写入生产 .env ...');
  upsertRemoteEnv('RESEND_API_KEY', resendKey);
  upsertRemoteEnv('EMAIL_SEND_ENABLED', '1');
  upsertRemoteEnv('EMAIL_PROVIDER', 'resend');
  upsertRemoteEnv('EMAIL_FROM_SALES', `AsiaPower Sales <sales@${DOMAIN}>`);

  console.log('→ 同步发信代码到生产...');
  spawnSync('rsync', ['-av', `${ROOT}/server/lib/email-outbound.js`, 'root@159.65.86.24:/root/.openclaw/workspace/inventory-site/lib/'], { stdio: 'inherit' });
  spawnSync('rsync', ['-av', `${ROOT}/customer_gateway/email_outbound.py`, 'root@159.65.86.24:/root/.openclaw/workspace/AsiaPower/customer_gateway/'], { stdio: 'inherit' });

  spawnSync('ssh', ['-o', 'BatchMode=yes', 'root@159.65.86.24', 'systemctl restart inventory-site.service'], { stdio: 'inherit' });

  await testResendSend();
  console.log('\n✅ 配置完成。发送客户邮件:');
  console.log('   ssh ... python main.py "/email send draft-2026-07-03T1810TUTC-ffa5a9f2"');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
