#!/usr/bin/env node
/**
 * Deploy static site + API to production.
 * Usage: node scripts/deploy-production.mjs [user@host]
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REMOTE = process.argv[2] || 'root@159.65.86.24';
const SITE = `${REMOTE}:/root/.openclaw/workspace/inventory-site`;

const EXCLUDES = [
  '.git', '.venv', '.venv-logo', 'data', 'server', 'deploy', 'scripts',
  'uploads', 'node_modules', '.env', '.cursor', 'agent-transcripts',
  'sitemap.xml',
  'supplier-portal/upload-key.js',
];

function rsync(local, remote, extra = []) {
  const args = ['-av', ...EXCLUDES.flatMap((e) => ['--exclude', e]), ...extra, `${local}/`, remote];
  const r = spawnSync('rsync', args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('[deploy] syncing static site → public/');
rsync(ROOT, `${SITE}/public/`);

console.log('[deploy] syncing server.js + lib/');
spawnSync('rsync', ['-av', `${ROOT}/deploy/inventory-site-server.js`, `${SITE}/server.js`], { stdio: 'inherit' });
spawnSync('rsync', ['-av', `${ROOT}/server/lib/`, `${SITE}/lib/`], { stdio: 'inherit' });

console.log('[deploy] syncing reminder scripts');
fs.mkdirSync(path.join(ROOT, 'deploy', 'inventory-site-scripts'), { recursive: true });
spawnSync('rsync', ['-av', `${ROOT}/scripts/telegram-lead-reminder.js`, `${ROOT}/scripts/telegram-daily-report.js`, `${ROOT}/scripts/telegram-common.js`, `${SITE}/scripts/`], { stdio: 'inherit' });

console.log('[deploy] syncing nginx config');
spawnSync('rsync', ['-av', `${ROOT}/deploy/nginx-asia-power.com`, `${REMOTE}:/etc/nginx/sites-available/asia-power.com`], { stdio: 'inherit' });
spawnSync('rsync', ['-av', `${ROOT}/deploy/nginx-rate-limit.conf`, `${REMOTE}:/etc/nginx/conf.d/asiapower-rate-limit.conf`], { stdio: 'inherit' });

const remoteScript = `
set -e
ENV=/root/.openclaw/workspace/inventory-site/.env
SITE=/root/.openclaw/workspace/inventory-site
if ! grep -q "^SUPPLIER_UPLOAD_KEY=" "$ENV" 2>/dev/null || grep -q "^SUPPLIER_UPLOAD_KEY=$" "$ENV" 2>/dev/null; then
  KEY=$(openssl rand -hex 24)
  if grep -q "^SUPPLIER_UPLOAD_KEY=" "$ENV" 2>/dev/null; then
    sed -i "s|^SUPPLIER_UPLOAD_KEY=.*|SUPPLIER_UPLOAD_KEY=$KEY|" "$ENV"
  else
    echo "SUPPLIER_UPLOAD_KEY=$KEY" >> "$ENV"
  fi
  echo "[deploy] generated SUPPLIER_UPLOAD_KEY"
fi
if ! grep -q "^MEDIA_ACCESS_SECRET=" "$ENV" 2>/dev/null || grep -q "^MEDIA_ACCESS_SECRET=$" "$ENV" 2>/dev/null; then
  MEDIA=$(openssl rand -hex 24)
  if grep -q "^MEDIA_ACCESS_SECRET=" "$ENV" 2>/dev/null; then
    sed -i "s|^MEDIA_ACCESS_SECRET=.*|MEDIA_ACCESS_SECRET=$MEDIA|" "$ENV"
  else
    echo "MEDIA_ACCESS_SECRET=$MEDIA" >> "$ENV"
  fi
  echo "[deploy] generated MEDIA_ACCESS_SECRET"
fi
KEY=$(grep "^SUPPLIER_UPLOAD_KEY=" "$ENV" | cut -d= -f2-)
printf "window.SUPPLIER_UPLOAD_KEY='%s';\\n" "$KEY" > "$SITE/public/supplier-portal/upload-key.js"
rm -rf "$SITE/public/.git" "$SITE/public/.venv" "$SITE/public/.venv-logo" 2>/dev/null || true
node --check "$SITE/server.js"
nginx -t
systemctl reload nginx
systemctl restart inventory-site.service
systemctl is-active nginx inventory-site.service
CRON_MARK="# asiapower-lead-reminder"
CRON_LINE="*/15 * * * * cd $SITE && /usr/bin/node scripts/telegram-lead-reminder.js >> /var/log/asiapower-lead-reminder.log 2>&1"
DAILY_MARK="# asiapower-daily-report"
DAILY_LINE="0 8 * * * cd $SITE && /usr/bin/node scripts/telegram-daily-report.js >> /var/log/asiapower-daily-report.log 2>&1"
(crontab -l 2>/dev/null | grep -v "$CRON_MARK" | grep -v "$DAILY_MARK"; echo "$CRON_MARK"; echo "$CRON_LINE"; echo "$DAILY_MARK"; echo "$DAILY_LINE") | crontab -
echo "[deploy] done"
`;

console.log('[deploy] remote finalize');
const r = spawnSync('ssh', [REMOTE, remoteScript], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

console.log('[deploy] verify production');
const verify = spawnSync('node', [path.join(__dirname, 'verify-production.mjs')], { stdio: 'inherit' });
if (verify.status !== 0) {
  console.error('[deploy] VERIFY FAILED — site may be unstyled. See deploy/SITE-HEALTH.md');
  process.exit(verify.status ?? 1);
}
process.exit(0);
