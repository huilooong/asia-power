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
  '.git', '.venv', '.venv-*', '.venv-faces', '.venv-restore311', '.venv-restore', '.venv-logo', 'gfpgan', 'data', 'server', 'deploy', 'scripts',
  'uploads', 'node_modules', '.env', '.cursor', 'agent-transcripts', 'tmp',
  'sitemap.xml',
  'supplier-portal/upload-key.js',
  // OpenClaw agent/workspace private files — must never reach the public web root.
  // NOTE: 'guides' is a real public site section — do NOT exclude it.
  '.openclaw', 'memory', 'backups',
  'AGENTS.md', 'SOUL.md', 'MEMORY.md', 'USER.md', 'TOOLS.md', 'IDENTITY.md', 'HEARTBEAT.md', 'BOOTSTRAP.md',
  // Python backend source — server-side only, must NEVER be web-downloadable.
  // (line 35 rsyncs the tree into public/; the web root is static assets + node only.)
  'coo_core', 'customer_gateway', 'truth', 'config', 'agents', 'audit', 'integrations', 'core', 'tools', 'tests',
  '*.py', '*.pyc', '__pycache__', 'requirements.txt', 'pyproject.toml', '.venv*',
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
spawnSync('rsync', ['-av', `${ROOT}/deploy/inventory-site.service`, `${REMOTE}:/etc/systemd/system/inventory-site.service`], { stdio: 'inherit' });
spawnSync('rsync', ['-av', `${ROOT}/deploy/health-watch.sh`, `${REMOTE}:/usr/local/bin/asiapower-health-watch.sh`], { stdio: 'inherit' });

console.log('[deploy] syncing reminder + backup scripts');
fs.mkdirSync(path.join(ROOT, 'deploy', 'inventory-site-scripts'), { recursive: true });
spawnSync('rsync', ['-av', `${ROOT}/deploy/inventory-site-scripts/backup-inventory-site.sh`, `${SITE}/scripts/`], { stdio: 'inherit' });
spawnSync('rsync', ['-av',
  `${ROOT}/scripts/telegram-lead-reminder.js`,
  `${ROOT}/scripts/telegram-daily-report.js`,
  `${ROOT}/scripts/telegram-hourly-report.js`,
  `${ROOT}/scripts/telegram-memory-watch.js`,
  `${ROOT}/scripts/telegram-backup-alert.js`,
  `${ROOT}/scripts/telegram-whatsapp-inquiry-watch.js`,
  `${ROOT}/scripts/sync-data-backup-r2.mjs`,
  `${ROOT}/scripts/telegram-common.js`,
  `${ROOT}/scripts/fix-inventory-record.mjs`,
  `${ROOT}/scripts/fix-truck-listing-meta.mjs`,
  `${ROOT}/scripts/optimize-inventory-photos.mjs`,
  `${ROOT}/scripts/compress-inventory-videos.mjs`,
  `${ROOT}/scripts/fix-hc250081-lonking.mjs`,
  `${ROOT}/scripts/fix-hc250107-machinery.mjs`,
  `${SITE}/scripts/`,
], { stdio: 'inherit' });
spawnSync('rsync', ['-av', `${ROOT}/package.json`, `${ROOT}/package-lock.json`, `${SITE}/`], { stdio: 'inherit' });
spawnSync('rsync', ['-av', `${ROOT}/scripts/setup-r2-cors.mjs`, `${SITE}/scripts/`], { stdio: 'inherit' });

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
ensure_env() {
  KEY="$1"
  VAL="$2"
  if ! grep -q "^$KEY=" "$ENV" 2>/dev/null; then
    echo "$KEY=$VAL" >> "$ENV"
    echo "[deploy] set default $KEY=$VAL"
  fi
}
ensure_env MAX_CONCURRENT_SERVER_PHOTO_UPLOADS 40
ensure_env MAX_CONCURRENT_SERVER_VIDEO_UPLOADS 4
ensure_env SERVER_UPLOAD_MEMORY_BUDGET_MB 400
KEY=$(grep "^SUPPLIER_UPLOAD_KEY=" "$ENV" | cut -d= -f2-)
printf "// Temporary supplier upload gate. This is public to the browser; do not treat it as a supplier account credential.\\nwindow.SUPPLIER_UPLOAD_KEY='%s';\\n" "$KEY" > "$SITE/public/supplier-portal/upload-key.js"
chmod +x "$SITE/scripts/backup-inventory-site.sh" 2>/dev/null || true
if [ -x "$SITE/scripts/backup-inventory-site.sh" ]; then
  bash "$SITE/scripts/backup-inventory-site.sh" --data-only || echo "[deploy] pre-deploy data backup failed (non-fatal)"
fi
rm -rf "$SITE/public/.git" "$SITE/public/.venv" "$SITE/public/.venv-"* "$SITE/public/gfpgan" 2>/dev/null || true
node --check "$SITE/server.js"
chmod +x /usr/local/bin/asiapower-health-watch.sh 2>/dev/null || true
systemctl daemon-reload
nginx -t
# Let nginx serve static assets without proxying through Node
PUB="$SITE/public"
UP="$SITE/uploads/photos"
for DIR in /root /root/.openclaw /root/.openclaw/workspace "$SITE" "$PUB" "$PUB/css" "$PUB/js" "$PUB/assets" "$SITE/uploads" "$UP"; do
  [ -d "$DIR" ] && chmod o+x "$DIR" 2>/dev/null || true
done
[ -d "$PUB/css" ] && find "$PUB/css" "$PUB/js" "$PUB/assets" -type f -exec chmod o+r {} + 2>/dev/null || true
[ -d "$UP" ] && find "$UP" -type f -exec chmod o+r {} + 2>/dev/null || true
systemctl reload nginx
systemctl restart inventory-site.service
systemctl is-active nginx inventory-site.service
if [ -f "$SITE/scripts/fix-inventory-record.mjs" ]; then
  node "$SITE/scripts/fix-inventory-record.mjs" --root "$SITE" --stock HC250051 --engine EA211 && echo "[deploy] patched Audi Q3 engineCode -> EA211" || echo "[deploy] Q3 patch skipped (stock not found or already updated)"
  node "$SITE/scripts/fix-inventory-record.mjs" --root "$SITE" --stock HC250058 \
    --brand Isuzu --model "100P" --engine "4JB1" --transmission "MSB-5MT" --year 2013 \
    --category truck --condition "Truck Half Cut" --drivetrain "4x2" --origin "China (Qingling)" \
    --description "2013 Qingling Isuzu 100P light truck (庆铃五十铃100P) with 2.771L 4JB1 diesel (~98 hp) and 5-speed MSB-5MT manual. China-built light commercial — VIN prefix LWLDNA indicates Qingling Chongqing assembly. Ideal for engine, cab, chassis and driveline export." \
    --parts "Engine & turbo,MSB-5MT transmission,Cab/front clip,Front axle & steering,Radiator & intercooler,Front wiring harness" \
    && echo "[deploy] migrated HC250058 -> Qingling Isuzu 100P truck catalog" \
    || echo "[deploy] HC250058 truck patch skipped (not found or already updated)"
fi
if [ -f "$SITE/scripts/fix-truck-listing-meta.mjs" ]; then
  node "$SITE/scripts/fix-truck-listing-meta.mjs" --root "$SITE" && echo "[deploy] normalized truck/cab listing metadata" || echo "[deploy] truck/cab metadata fix skipped"
fi
if [ -f "$SITE/scripts/fix-hc250107-machinery.mjs" ]; then
  node "$SITE/scripts/fix-hc250107-machinery.mjs" --root "$SITE" && echo "[deploy] HC250107 -> machinery (mobile crane)" || echo "[deploy] HC250107 machinery patch skipped"
fi
if [ -f "$SITE/package.json" ]; then
  cd "$SITE" && npm install --omit=dev 2>/dev/null || npm install || echo "[deploy] npm install skipped"
fi
CRON_MARK="# asiapower-lead-reminder"
CRON_LINE="*/15 * * * * cd $SITE && /usr/bin/node scripts/telegram-lead-reminder.js >> /var/log/asiapower-lead-reminder.log 2>&1"
DAILY_MARK="# asiapower-daily-report"
DAILY_LINE="0 8 * * * cd $SITE && /usr/bin/node scripts/telegram-daily-report.js >> /var/log/asiapower-daily-report.log 2>&1"
HOURLY_MARK="# asiapower-hourly-report"
HOURLY_LINE="0 * * * * cd $SITE && /usr/bin/node scripts/telegram-hourly-report.js >> /var/log/asia-power-telegram-hourly.log 2>&1"
WHATSAPP_MARK="# asiapower-whatsapp-watch"
WHATSAPP_LINE="*/15 * * * * cd $SITE && /usr/bin/node scripts/telegram-whatsapp-inquiry-watch.js >> /var/log/asia-power-telegram-whatsapp.log 2>&1"
MEMORY_MARK="# asiapower-memory-watch"
MEMORY_LINE="*/5 * * * * cd $SITE && /usr/bin/node scripts/telegram-memory-watch.js >> /var/log/asiapower-memory-watch.log 2>&1"
HEALTH_MARK="# asiapower-health-watch"
HEALTH_LINE="*/2 * * * * /usr/local/bin/asiapower-health-watch.sh >> /var/log/asiapower-health-watch.log 2>&1"
BACKUP_MARK="# asiapower-daily-backup"
BACKUP_LINE="0 3 * * * cd $SITE && bash scripts/backup-inventory-site.sh >> /var/log/asiapower-backup.log 2>&1"
R2BACKUP_MARK="# asiapower-r2-data-backup"
R2BACKUP_LINE="15 3 * * * cd $SITE && /usr/bin/node scripts/sync-data-backup-r2.mjs --root $SITE >> /var/log/asiapower-r2-data-backup.log 2>&1"
(crontab -l 2>/dev/null \
  | grep -v 'telegram-lead-reminder.js' \
  | grep -v 'telegram-daily-report.js' \
  | grep -v 'telegram-hourly-report.js' \
  | grep -v 'telegram-memory-watch.js' \
  | grep -v 'telegram-whatsapp-inquiry-watch.js' \
  | grep -v 'backup-inventory-site.sh' \
  | grep -v 'sync-data-backup-r2.mjs' \
  | grep -v 'asiapower-health-watch' \
  | grep -v "$CRON_MARK" | grep -v "$DAILY_MARK" | grep -v "$HOURLY_MARK" | grep -v "$WHATSAPP_MARK" | grep -v "$MEMORY_MARK" | grep -v "$HEALTH_MARK" | grep -v "$BACKUP_MARK" | grep -v "$R2BACKUP_MARK"; \
  echo "$CRON_MARK"; echo "$CRON_LINE"; \
  echo "$DAILY_MARK"; echo "$DAILY_LINE"; \
  echo "$HOURLY_MARK"; echo "$HOURLY_LINE"; \
  echo "$WHATSAPP_MARK"; echo "$WHATSAPP_LINE"; \
  echo "$MEMORY_MARK"; echo "$MEMORY_LINE"; \
  echo "$HEALTH_MARK"; echo "$HEALTH_LINE"; \
  echo "$BACKUP_MARK"; echo "$BACKUP_LINE"; \
  echo "$R2BACKUP_MARK"; echo "$R2BACKUP_LINE") | crontab -
echo "[deploy] done"
if [ -n "$(grep '^CLOUDFLARE_API_TOKEN=' "$ENV" 2>/dev/null | cut -d= -f2-)" ] && [ -n "$(grep '^CLOUDFLARE_ACCOUNT_ID=' "$ENV" 2>/dev/null | cut -d= -f2-)" ]; then
  cd "$SITE" && INVENTORY_ENV_FILE="$ENV" /usr/bin/node scripts/setup-r2-cors.mjs || echo "[deploy] r2 cors setup skipped (non-fatal)"
fi
`;

console.log('[deploy] remote finalize');
const r = spawnSync('ssh', [REMOTE, remoteScript], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);

console.log('[deploy] critical path regression (upload + leads)');
const critical = spawnSync('node', [path.join(__dirname, 'test-critical-paths.mjs')], { stdio: 'inherit' });
if (critical.status !== 0) {
  console.error('[deploy] CRITICAL PATH CHECKS FAILED — fix upload/lead regressions before deploying');
  process.exit(critical.status ?? 1);
}

console.log('[deploy] verify production');
const verify = spawnSync('node', [path.join(__dirname, 'verify-production.mjs')], { stdio: 'inherit' });
if (verify.status !== 0) {
  console.error('[deploy] VERIFY FAILED — site may be unstyled. See deploy/SITE-HEALTH.md');
  process.exit(verify.status ?? 1);
}
process.exit(0);
