#!/usr/bin/env node
/** Probe Cloudflare Email Sending + write prod env if send succeeds. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACCT = '48f9700232d51daf90f23262ade3bc26';
const ZONE = 'd7380f191b0f11239f3c9209917bb6c3';

function wranglerToken() {
  const cfg = path.join(process.env.HOME, 'Library/Preferences/.wrangler/config/default.toml');
  if (!fs.existsSync(cfg)) return '';
  return fs.readFileSync(cfg, 'utf8').match(/oauth_token\s*=\s*"([^"]+)"/)?.[1] || '';
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN || wranglerToken();
  if (!token) {
    console.log('❌ 无 Cloudflare Token');
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  let r = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE}/email/sending/subdomains`, { headers });
  let data = await r.json();
  console.log('subdomains:', r.status, JSON.stringify(data.result || data.errors)?.slice(0, 300));

  if (!(data.result || []).some((d) => d.name === 'asia-power.com')) {
    r = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE}/email/sending/subdomains`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'asia-power.com' }),
    });
    data = await r.json();
    console.log('create:', r.status, JSON.stringify(data.result || data.errors)?.slice(0, 300));
  }

  r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/email/sending/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: 'gooddlong@gmail.com',
      from: 'sales@asia-power.com',
      subject: 'AsiaPower CF Email Sending test',
      text: 'Cloudflare outbound test',
    }),
  });
  data = await r.json();
  console.log('send:', r.status, JSON.stringify(data));

  if (!data.success) {
    console.log('\n❌ 发信未就绪。常见原因: Email Sending 未开通 / 需 Workers Paid');
    process.exit(1);
  }

  console.log('✅ Cloudflare 发信可用');
}

main();
