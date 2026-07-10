#!/usr/bin/env node
/**
 * One-shot: apply new Cloudflare token + deploy email worker + enable routing.
 * Token source (first match): argv[2], CF_SETUP_TOKEN env, or wrangler OAuth.
 *
 *   node scripts/apply-cloudflare-email-token.mjs cfut_xxxx
 *   CF_SETUP_TOKEN=cfut_xxx node scripts/apply-cloudflare-email-token.mjs
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const token = process.argv[2] || process.env.CF_SETUP_TOKEN || '';
if (!token) {
  console.log('用法: node scripts/apply-cloudflare-email-token.mjs <Cloudflare_API_Token>');
  console.log('Token 权限: Account Workers Scripts Edit + Zone Email Routing Rules Edit');
  process.exit(1);
}

const secretRes = spawnSync(
  'ssh',
  ['-o', 'BatchMode=yes', 'root@159.65.86.24',
    "grep '^EMAIL_INBOUND_SECRET=' /root/.openclaw/workspace/inventory-site/.env | cut -d= -f2-"],
  { encoding: 'utf8' },
);
const emailSecret = (secretRes.stdout || '').trim();
if (!emailSecret) {
  console.log('❌ 无法从生产读取 EMAIL_INBOUND_SECRET');
  process.exit(1);
}

console.log('→ 验证 Token...');
const verify = spawnSync('curl', ['-s', 'https://api.cloudflare.com/client/v4/user/tokens/verify',
  '-H', `Authorization: Bearer ${token}`], { encoding: 'utf8' });
if (!verify.stdout?.includes('"success":true')) {
  console.log('❌ Token 无效:', verify.stdout?.slice(0, 200));
  process.exit(1);
}
console.log('✅ Token 有效');

console.log('→ 全自动部署（不修改生产 Token，仅用本次 Token）...');
const setup = spawnSync('node', ['scripts/cloudflare-email-full-setup.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    CLOUDFLARE_API_TOKEN: token,
    EMAIL_INBOUND_SECRET: emailSecret,
  },
});
process.exit(setup.status || 0);
