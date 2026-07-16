#!/usr/bin/env node
/**
 * Production deploy — split targets + Release Manager (OPS-004 / OPS-005).
 *
 * Usage:
 *   node scripts/deploy-production.mjs <target> [--yes] [--allow-dirty] [user@host]
 *
 * Gate (CEO 2026-07-10): commit → push GitHub → then this script.
 * Default rejects dirty tree and unpushed HEAD.
 * Emergency only: DEPLOY_ALLOW_DIRTY=1 + --allow-dirty; DEPLOY_ALLOW_UNPUSHED=1 (both logged).
 *
 * Targets: nginx | api | engines | apsales | apsales-openclaw | finalize
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TARGET_REMOTE_PATHS,
  buildReleaseRecord,
  generateReleaseId,
  printDeploymentSummary,
  runPostDeployValidation,
  runPreDeployValidation,
  snapshotRemotePaths,
  writeReleaseJson,
  pruneReleaseDirsSafe,
  pruneRemoteReleaseDirsSafe,
} from './lib/release-manager.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((a) => a.startsWith('--')));
const args = rawArgs.filter((a) => !a.startsWith('--'));
const targetArg = args.find((a) => !a.includes('@')) || 'help';
const REMOTE = args.find((a) => a.includes('@')) || 'root@159.65.86.24';
const YES = flags.has('--yes');
const ALLOW_DIRTY = flags.has('--allow-dirty');
const SITE = `${REMOTE}:/root/.openclaw/workspace/inventory-site`;
const AP = `${REMOTE}:/root/.openclaw/workspace/AsiaPower`;
const BASE_URL = process.env.SITE_URL || 'https://asia-power.com';

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { stdio: 'inherit', ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function rsync(local, remote, extra = []) {
  run('rsync', ['-av', ...extra, local, remote]);
}

function ssh(script) {
  // bash -s stdin avoids rare hang/fail when long validation argv follows rsync bursts
  spawnSync('sleep', ['1']);
  const r = spawnSync(
    'ssh',
    ['-o', 'ConnectTimeout=20', '-o', 'BatchMode=yes', REMOTE, 'bash', '-s'],
    { input: script, encoding: 'utf8' },
  );
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function deployNginx() {
  console.log('[deploy:nginx] syncing rate-limit + vhost templates');
  rsync(`${ROOT}/deploy/nginx-rate-limit.conf`, `${REMOTE}:/etc/nginx/conf.d/asiapower-rate-limit.conf`);
  rsync(`${ROOT}/deploy/nginx-asia-power.com`, `${REMOTE}:/etc/nginx/sites-available/asia-power.com`);
  if (fs.existsSync(path.join(ROOT, 'deploy/nginx-security.conf'))) {
    rsync(`${ROOT}/deploy/nginx-security.conf`, `${REMOTE}:/etc/nginx/conf.d/asiapower-security.conf`);
  }
  rsync(`${ROOT}/deploy/asiapower-trusted-upload-ips.map.example`, `${SITE}/deploy/`);
  console.log('[deploy:nginx] activate sites-available → sites-enabled (symlink)');
  ssh(`
set -e
ln -sfn /etc/nginx/sites-available/asia-power.com /etc/nginx/sites-enabled/asia-power.com
nginx -t
systemctl reload nginx
echo "[deploy:nginx] nginx reloaded OK"
`);
}

function deployApi() {
  console.log('[deploy:api] syncing server.js + lib/ (merge, no --delete)');
  rsync(`${ROOT}/deploy/inventory-site-server.js`, `${SITE}/server.js`);
  // Do NOT use --delete: production lib/ may contain hotfix-only modules; deleting breaks approve/normalize.
  run('rsync', ['-av', `${ROOT}/server/lib/`, `${SITE}/lib/`]);
  rsync(`${ROOT}/deploy/inventory-site.service`, `${REMOTE}:/etc/systemd/system/inventory-site.service`);
  rsync(`${ROOT}/deploy/health-watch.sh`, `${REMOTE}:/usr/local/bin/asiapower-health-watch.sh`);
  if (fs.existsSync(path.join(ROOT, 'package-lock.json'))) {
    rsync(`${ROOT}/package.json`, `${SITE}/package.json`);
    rsync(`${ROOT}/package-lock.json`, `${SITE}/package-lock.json`);
  } else {
    rsync(`${ROOT}/package.json`, `${SITE}/package.json`);
  }
  ssh(`
set -e
for f in machinery-brand-catalog.js powertrain-catalog-memory.js powertrain-labels.js static-powertrain-catalog.js; do
  test -f /root/.openclaw/workspace/inventory-site/lib/"$f" || { echo "missing lib/$f"; exit 1; }
done
node --check /root/.openclaw/workspace/inventory-site/server.js
grep -q "pwa-install.js" /root/.openclaw/workspace/inventory-site/server.js
grep -q "pwa-app-shell.js" /root/.openclaw/workspace/inventory-site/server.js
systemctl daemon-reload
chmod +x /usr/local/bin/asiapower-health-watch.sh 2>/dev/null || true
if [ -f /root/.openclaw/workspace/inventory-site/package.json ]; then
  cd /root/.openclaw/workspace/inventory-site && npm install --omit=dev 2>/dev/null || npm install || true
fi
systemctl restart inventory-site.service
systemctl is-active inventory-site.service
echo "[deploy:api] inventory-site restarted OK"
`);
}

function deployEngines() {
  console.log('[deploy:engines] syncing engines/*.html only');
  run('rsync', ['-av', '--include=*.html', '--exclude=*', `${ROOT}/engines/`, `${SITE}/public/engines/`]);
  // P0/P1 privacy gate: this internal template preview must never be public.
  // The engines target snapshots the whole remote directory before this removal.
  ssh(`
set -e
rm -f /root/.openclaw/workspace/inventory-site/public/engines/g4kd-v2.html
rm -f /root/.openclaw/workspace/inventory-site/public/sitemap.xml
echo "[deploy:engines] removed public preview and stale sitemap"
`);
}

/** Homepage only — v4-hybrid (does NOT rsync full public/) */
function deployHome() {
  console.log('[deploy:home] syncing v4-hybrid homepage files only');
  const pub = `${SITE}/public`;
  rsync(`${ROOT}/index.html`, `${pub}/index.html`);
  rsync(`${ROOT}/css/home-v4-hybrid.css`, `${pub}/css/home-v4-hybrid.css`);
  rsync(`${ROOT}/css/styles.css`, `${pub}/css/styles.css`);
  rsync(`${ROOT}/js/home-v4-hybrid.js`, `${pub}/js/home-v4-hybrid.js`);
  rsync(`${ROOT}/js/engine-directory.js`, `${pub}/js/engine-directory.js`);
  rsync(`${ROOT}/js/engine-card-label.js`, `${pub}/js/engine-card-label.js`);
  rsync(`${ROOT}/js/components.js`, `${pub}/js/components.js`);
  rsync(`${ROOT}/js/public-i18n.js`, `${pub}/js/public-i18n.js`);
  rsync(`${ROOT}/js/path-utils.js`, `${pub}/js/path-utils.js`);
  rsync(`${ROOT}/js/pwa-install.js`, `${pub}/js/pwa-install.js`);
  rsync(`${ROOT}/js/pwa-app-shell.js`, `${pub}/js/pwa-app-shell.js`);
  rsync(`${ROOT}/css/pwa-install.css`, `${pub}/css/pwa-install.css`);
  rsync(`${ROOT}/css/pwa-app-shell.css`, `${pub}/css/pwa-app-shell.css`);
  rsync(`${ROOT}/sw.js`, `${pub}/sw.js`);
  rsync(`${ROOT}/manifest.json`, `${pub}/manifest.json`);
  rsync(`${ROOT}/app.html`, `${pub}/app.html`);
  rsync(`${ROOT}/assets/home-v4-inventory-snapshot.json`, `${pub}/assets/home-v4-inventory-snapshot.json`);
  ssh(`
set -e
PUB=/root/.openclaw/workspace/inventory-site/public
test -f "$PUB/index.html"
test -f "$PUB/css/home-v4-hybrid.css"
test -f "$PUB/css/styles.css"
test -f "$PUB/css/pwa-install.css"
test -f "$PUB/css/pwa-app-shell.css"
test -f "$PUB/js/home-v4-hybrid.js"
test -f "$PUB/js/engine-card-label.js"
test -f "$PUB/js/public-i18n.js"
test -f "$PUB/js/pwa-install.js"
test -f "$PUB/js/pwa-app-shell.js"
test -f "$PUB/js/components.js"
test -f "$PUB/manifest.json"
test -f "$PUB/app.html"
test -f "$PUB/assets/home-v4-inventory-snapshot.json"
grep -q 'page-home-v4-hybrid' "$PUB/index.html"
grep -q 'home-v4-hybrid' "$PUB/index.html"
grep -q 'engine-card-label.js' "$PUB/index.html"
grep -q 'formatHalfCutVehicleTitle' "$PUB/js/home-v4-hybrid.js"
grep -q 'home-scroll-v5' "$PUB/index.html"
grep -E -q 'lang-sync-v2|auth-nav-once-v2' "$PUB/index.html"
grep -q 'lang-sync-v2' "$PUB/css/styles.css"
grep -q 'home.v4.hero.title' "$PUB/index.html"
grep -q 'data-ap-auth-slot' "$PUB/index.html"
grep -q 'auth-nav-once-v2' "$PUB/index.html"
grep -q 'nav-list-direct-v1' "$PUB/index.html"
grep -q 'href="/half-cuts/"' "$PUB/index.html"
grep -q 'href="/engines/"' "$PUB/index.html"
grep -q 'href="/trucks/"' "$PUB/index.html"
grep -q 'href="/machinery/"' "$PUB/index.html"
grep -q 'href="/half-cuts/?cat=used-cars"' "$PUB/index.html"
grep -q 'nav-list-direct-v1' "$PUB/js/home-v4-hybrid.js"
grep -q 'pwa-app-v6b' "$PUB/index.html"
grep -q "CACHE_VERSION = 'pwa-app-v6b'" "$PUB/sw.js"
grep -q 'obsoleteCacheKeys' "$PUB/sw.js"
! grep -q "startsWith('apapp-001-')" "$PUB/sw.js"
grep -q 'SHELL_ENABLED = false' "$PUB/js/pwa-app-shell.js"
grep -q 'scroll-snap-type: x proximity' "$PUB/css/home-v4-hybrid.css"
grep -q 'touch-action: pan-x pan-y' "$PUB/css/home-v4-hybrid.css"
grep -q 'AsiaPowerAppShell' "$PUB/js/pwa-app-shell.js"
grep -q 'ap-app-tabbar' "$PUB/css/pwa-app-shell.css"
grep -q 'touch-action: pan-x pan-y' "$PUB/css/pwa-app-shell.css"
grep -q 'overscroll-behavior-y: none' "$PUB/css/pwa-app-shell.css" && exit 1 || true
grep -q 'html:not(.ap-app)' "$PUB/css/pwa-app-shell.css"
grep -q 'ap-app-shell' "$PUB/js/pwa-app-shell.js"
grep -q 'ensurePwaAppShellAssets' "$PUB/js/components.js"
grep -q '"display": "browser"' "$PUB/manifest.json"
grep -q 'unlockPageScroll' "$PUB/js/pwa-install.js"
echo "[deploy:home] files OK on remote"
`);
}

/** Category-filter hot path — preserves production HTML drift, updates only script cache keys. */
function deployCategories() {
  console.log('[deploy:categories] syncing category logic and patching cache keys');
  const pub = `${SITE}/public`;
  rsync(`${ROOT}/js/half-cut-directory.js`, `${pub}/js/half-cut-directory.js`);
  rsync(`${ROOT}/js/ebay-catalog-hub.js`, `${pub}/js/ebay-catalog-hub.js`);
  rsync(`${ROOT}/js/home-v4-hybrid.js`, `${pub}/js/home-v4-hybrid.js`);
  ssh(`
set -e
python3 - <<'PY'
from pathlib import Path
import re

pub = Path('/root/.openclaw/workspace/inventory-site/public')
catalog_pages = [
    pub / 'half-cuts/index.html',
    pub / 'engines/index.html',
    pub / 'gearboxes/index.html',
    pub / 'front-cuts/index.html',
    pub / 'chassis-parts/index.html',
]
for page in catalog_pages:
    text = page.read_text()
    text = re.sub(r'half-cut-directory\\.js\\?v=[^"\\']+', 'half-cut-directory.js?v=category-filter-v4', text)
    text = re.sub(r'ebay-catalog-hub\\.js\\?v=[^"\\']+', 'ebay-catalog-hub.js?v=category-filter-v4', text)
    page.write_text(text)

home = pub / 'index.html'
text = home.read_text()
text = re.sub(r'home-v4-hybrid\\.js\\?v=[^"\\']+', 'home-v4-hybrid.js?v=category-filter-v4', text)
home.write_text(text)
PY
grep -q 'matchesInventoryCategory' /root/.openclaw/workspace/inventory-site/public/js/half-cut-directory.js
grep -q 'hasChassisCatalogEvidence' /root/.openclaw/workspace/inventory-site/public/js/half-cut-directory.js
grep -q 'Search may widen fields, never categories' /root/.openclaw/workspace/inventory-site/public/js/ebay-catalog-hub.js
grep -q 'category-filter-v4' /root/.openclaw/workspace/inventory-site/public/index.html
for page in half-cuts engines gearboxes front-cuts chassis-parts; do
  grep -q 'half-cut-directory.js?v=category-filter-v4' "/root/.openclaw/workspace/inventory-site/public/$page/index.html"
  grep -q 'ebay-catalog-hub.js?v=category-filter-v4' "/root/.openclaw/workspace/inventory-site/public/$page/index.html"
done
echo "[deploy:categories] category filters OK on remote"
`);
}

/** Login / register / buyer+supplier portals (does NOT rsync full public/) */
function deployPortal() {
  console.log('[deploy:portal] syncing login + portal pages');
  const pub = `${SITE}/public`;
  ssh('mkdir -p /root/.openclaw/workspace/inventory-site/public/login /root/.openclaw/workspace/inventory-site/public/buyer-portal /root/.openclaw/workspace/inventory-site/public/supplier-portal /root/.openclaw/workspace/inventory-site/public/css /root/.openclaw/workspace/inventory-site/public/js');
  rsync(`${ROOT}/login/index.html`, `${pub}/login/index.html`);
  rsync(`${ROOT}/css/login.css`, `${pub}/css/login.css`);
  rsync(`${ROOT}/css/portal-app.css`, `${pub}/css/portal-app.css`);
  rsync(`${ROOT}/js/login.js`, `${pub}/js/login.js`);
  rsync(`${ROOT}/js/buyer-portal.js`, `${pub}/js/buyer-portal.js`);
  rsync(`${ROOT}/js/supplier-dashboard.js`, `${pub}/js/supplier-dashboard.js`);
  rsync(`${ROOT}/js/v4-portal-shell.js`, `${pub}/js/v4-portal-shell.js`);
  rsync(`${ROOT}/js/main.js`, `${pub}/js/main.js`);
  rsync(`${ROOT}/js/public-i18n.js`, `${pub}/js/public-i18n.js`);
  rsync(`${ROOT}/buyer-portal/index.html`, `${pub}/buyer-portal/index.html`);
  rsync(`${ROOT}/supplier-portal/dashboard.html`, `${pub}/supplier-portal/dashboard.html`);
  rsync(`${ROOT}/supplier-portal.html`, `${pub}/supplier-portal.html`);
  ssh(`
set -e
PUB=/root/.openclaw/workspace/inventory-site/public
test -f "$PUB/login/index.html"
test -f "$PUB/js/login.js"
test -f "$PUB/css/login.css"
test -f "$PUB/css/portal-app.css"
test -f "$PUB/buyer-portal/index.html"
test -f "$PUB/supplier-portal/dashboard.html"
test -f "$PUB/supplier-portal.html"
grep -q 'data-ap-auth-slot' "$PUB/js/v4-portal-shell.js"
grep -E -q 'AsiaPowerAuthNav|data-ap-account' "$PUB/js/v4-portal-shell.js"
grep -q 'supplier-register-box' "$PUB/login/index.html"
grep -q 'buyer-password-box' "$PUB/login/index.html"
grep -q 'supplier-password-box' "$PUB/login/index.html"
grep -q '/api/auth/phone/password/login' "$PUB/js/login.js"
grep -q '/api/supplier/register' "$PUB/js/login.js"
grep -q 'mode=register' "$PUB/supplier-portal.html"
echo "[deploy:portal] files OK on remote"
`);
}

/** Public chrome + catalog listing shells (v4 listing cards / sidebar). Includes about/contact/brands for shared topbar chrome. */
function deployChrome() {
  console.log('[deploy:chrome] syncing listing chrome + catalog shells + static chrome pages');
  const pub = `${SITE}/public`;
  ssh('mkdir -p /root/.openclaw/workspace/inventory-site/public/css /root/.openclaw/workspace/inventory-site/public/js /root/.openclaw/workspace/inventory-site/public/half-cuts /root/.openclaw/workspace/inventory-site/public/trucks /root/.openclaw/workspace/inventory-site/public/machinery /root/.openclaw/workspace/inventory-site/public/engines /root/.openclaw/workspace/inventory-site/public/gearboxes /root/.openclaw/workspace/inventory-site/public/front-cuts /root/.openclaw/workspace/inventory-site/public/chassis-parts');
  // Shared listing assets
  rsync(`${ROOT}/js/components.js`, `${pub}/js/components.js`);
  rsync(`${ROOT}/js/config.js`, `${pub}/js/config.js`);
  rsync(`${ROOT}/js/main.js`, `${pub}/js/main.js`);
  rsync(`${ROOT}/js/public-i18n.js`, `${pub}/js/public-i18n.js`);
  rsync(`${ROOT}/js/path-utils.js`, `${pub}/js/path-utils.js`);
  rsync(`${ROOT}/js/ebay-layout.js`, `${pub}/js/ebay-layout.js`);
  rsync(`${ROOT}/js/ebay-categories.js`, `${pub}/js/ebay-categories.js`);
  rsync(`${ROOT}/js/half-cut-directory.js`, `${pub}/js/half-cut-directory.js`);
  rsync(`${ROOT}/js/half-cut-vin.js`, `${pub}/js/half-cut-vin.js`);
  rsync(`${ROOT}/js/half-cut-inventory-layer.js`, `${pub}/js/half-cut-inventory-layer.js`);
  rsync(`${ROOT}/js/half-cut-media-api.js`, `${pub}/js/half-cut-media-api.js`);
  rsync(`${ROOT}/js/half-cut-inventory-store.js`, `${pub}/js/half-cut-inventory-store.js`);
  rsync(`${ROOT}/js/catalog-search-aliases.js`, `${pub}/js/catalog-search-aliases.js`);
  rsync(`${ROOT}/js/ebay-catalog-hub.js`, `${pub}/js/ebay-catalog-hub.js`);
  rsync(`${ROOT}/js/half-cut-catalog.js`, `${pub}/js/half-cut-catalog.js`);
  rsync(`${ROOT}/js/home-hub.js`, `${pub}/js/home-hub.js`);
  rsync(`${ROOT}/js/engine-directory.js`, `${pub}/js/engine-directory.js`);
  rsync(`${ROOT}/js/engine-card-label.js`, `${pub}/js/engine-card-label.js`);
  rsync(`${ROOT}/js/engine-catalog.js`, `${pub}/js/engine-catalog.js`);
  rsync(`${ROOT}/js/engine-detail.js`, `${pub}/js/engine-detail.js`);
  rsync(`${ROOT}/js/brand-page.js`, `${pub}/js/brand-page.js`);
  rsync(`${ROOT}/css/ebay-layout.css`, `${pub}/css/ebay-layout.css`);
  rsync(`${ROOT}/css/styles.css`, `${pub}/css/styles.css`);
  rsync(`${ROOT}/css/login.css`, `${pub}/css/login.css`);
  // Parts catalog placeholders (category marketing + brand SVG) — display only
  ssh('mkdir -p /root/.openclaw/workspace/inventory-site/public/assets/images');
  rsync(`${ROOT}/assets/images/parts-placeholder.svg`, `${pub}/assets/images/parts-placeholder.svg`);
  rsync(
    `${ROOT}/assets/images/ford-asiapower-powertrain-placeholder.svg`,
    `${pub}/assets/images/ford-asiapower-powertrain-placeholder.svg`
  );
  rsync(
    `${ROOT}/assets/images/ford-asiapower-powertrain-placeholder.png`,
    `${pub}/assets/images/ford-asiapower-powertrain-placeholder.png`
  );
  // Detail shells (chrome header cache-bust)
  rsync(`${ROOT}/half-cuts/detail.html`, `${pub}/half-cuts/detail.html`);
  rsync(`${ROOT}/trucks/detail.html`, `${pub}/trucks/detail.html`);
  rsync(`${ROOT}/machinery/detail.html`, `${pub}/machinery/detail.html`);
  // Detail page must always upgrade truncated catalog photos → full album
  rsync(`${ROOT}/js/half-cut-detail.js`, `${pub}/js/half-cut-detail.js`);
  // Catalog indexes + static chrome (about/contact/countries/brands). engines/*.html SEO → deploy engines.
  for (const rel of [
    'half-cuts/index.html',
    'trucks/index.html',
    'machinery/index.html',
    'engines/index.html',
    'gearboxes/index.html',
    'front-cuts/index.html',
    'chassis-parts/index.html',
    'about.html',
    'contact.html',
    'privacy.html',
    'brands.html',
    'app.html',
    'ghana.html',
    'nigeria.html',
    'kenya.html',
  ]) {
    rsync(`${ROOT}/${rel}`, `${pub}/${rel}`);
  }
  ssh('mkdir -p /root/.openclaw/workspace/inventory-site/public/brands');
  run('rsync', ['-av', '--include=*.html', '--exclude=*', `${ROOT}/brands/`, `${pub}/brands/`]);
  ssh(`
set -e
PUB=/root/.openclaw/workspace/inventory-site/public
test -f "$PUB/js/components.js"
test -f "$PUB/js/config.js"
test -f "$PUB/js/main.js"
test -f "$PUB/js/public-i18n.js"
test -f "$PUB/js/ebay-layout.js"
test -f "$PUB/js/half-cut-directory.js"
test -f "$PUB/js/ebay-catalog-hub.js"
test -f "$PUB/js/half-cut-detail.js"
test -f "$PUB/css/ebay-layout.css"
test -f "$PUB/css/styles.css"
test -f "$PUB/about.html"
test -f "$PUB/contact.html"
test -f "$PUB/kenya.html"
test -f "$PUB/brands.html"
test -f "$PUB/brands/toyota.html"
test -f "$PUB/app.html"
grep -q 'AsiaPowerAuthNav' "$PUB/js/components.js"
grep -q 'getBrandsWithPublicStock' "$PUB/js/main.js"
grep -q 'Current public stock' "$PUB/js/config.js"
grep -q 'auth-nav-once-v2' "$PUB/js/components.js"
grep -q 'about-type-v2' "$PUB/js/components.js"
grep -q 'about-type-v2' "$PUB/js/components.js"
grep -q 'data-ap-auth-slot' "$PUB/js/components.js"
! grep -q 'ebay-header__actions' "$PUB/js/components.js"
grep -q 'integrity-audit-v1' "$PUB/js/components.js"
grep -q 'parts-photo-v2' "$PUB/js/components.js"
grep -q 'parts-placeholder-v1' "$PUB/js/components.js"
grep -q 'partsCatalogPlaceholderSrc' "$PUB/js/half-cut-directory.js"
grep -q 'Explicit dedicated signals win' "$PUB/js/half-cut-directory.js"
grep -q 'isDedicatedPartListing' "$PUB/js/half-cut-directory.js"
grep -q 'catalog-search-v1 / stock-id-search-v1' "$PUB/js/ebay-catalog-hub.js"
grep -q 'parts-parallel-v1' "$PUB/js/components.js"
grep -q 'stock-id-search-v1' "$PUB/js/components.js"
grep -q 'stock-id-search-v1' "$PUB/js/half-cut-directory.js"
grep -q 'stock-id-search-v1' "$PUB/js/ebay-catalog-hub.js"
grep -q 'catalog-search-v1' "$PUB/js/components.js"
grep -q 'catalog-search-v1' "$PUB/js/half-cut-directory.js"
grep -q 'matchesCatalogSearch' "$PUB/js/half-cut-directory.js"
grep -q 'mergeCatalogSearchHitsIntoInventory' "$PUB/js/half-cut-directory.js"
grep -q 'matchesCatalogSearch' "$PUB/js/ebay-catalog-hub.js"
grep -q 'AsiaPowerCatalogSearchAliases' "$PUB/js/catalog-search-aliases.js"
grep -q 'isStockIdQuery' "$PUB/js/half-cut-catalog.js"
grep -q 'mergeStockIdHitsIntoInventory' "$PUB/js/half-cut-directory.js"
grep -q 'isStockIdQuery' "$PUB/js/half-cut-directory.js"
grep -q 'dedicated-price-v1' "$PUB/js/components.js"
grep -q 'formatCatalogPartPrice' "$PUB/js/half-cut-directory.js"
grep -q 'catalogPartPriceAmount' "$PUB/js/half-cut-directory.js"
grep -q 'formatCatalogPartPrice' "$PUB/js/ebay-catalog-hub.js"
grep -E -q 'half-cut-directory\\.js\\?v=(category-filter-v1|category-filter-v3|category-filter-v4|parts-parallel-v1|stock-id-search-v1|stock-id-search-v2|dedicated-price-v1|catalog-search-v1|catalog-search-v2|vehicle-engine-001c)' "$PUB/half-cuts/index.html"
grep -E -q 'ebay-catalog-hub\\.js\\?v=(category-filter-v1|category-filter-v3|category-filter-v4|parts-parallel-v1|stock-id-search-v1|stock-id-search-v2|dedicated-price-v1|catalog-search-v1|catalog-search-v2|vehicle-engine-001c)' "$PUB/half-cuts/index.html"
grep -E -q 'half-cut-directory\\.js\\?v=(category-filter-v1|category-filter-v3|category-filter-v4|stock-id-search-v2|dedicated-price-v1|catalog-search-v1|catalog-search-v2|vehicle-engine-001c)' "$PUB/gearboxes/index.html"
grep -E -q 'ebay-catalog-hub\\.js\\?v=(category-filter-v1|category-filter-v3|category-filter-v4|stock-id-search-v2|dedicated-price-v1|catalog-search-v1|catalog-search-v2|vehicle-engine-001c)' "$PUB/gearboxes/index.html"
grep -E -q 'catalog-search-v1|catalog-search-v2|stock-id-search-v[12]|vehicle-engine-001c' "$PUB/half-cuts/index.html"
grep -q 'catalog-search-aliases.js' "$PUB/half-cuts/index.html"
grep -q 'engine-card-label.js' "$PUB/half-cuts/index.html"
grep -q 'listingVehiclePrimaryTitle' "$PUB/js/half-cut-directory.js"
grep -q 'resolveDisplacementFuelTraceable' "$PUB/js/engine-card-label.js"
grep -q 'parseStructuredApplications' "$PUB/js/engine-card-label.js"
test -f "$PUB/js/engine-card-label.js"
test -f "$PUB/js/engine-directory.js"
grep -q 'hc.exwBadge' "$PUB/js/public-i18n.js"
grep -q 'ebay-sidebar__brands' "$PUB/js/ebay-layout.js"
grep -q 'exwBadgeHtml' "$PUB/js/half-cut-directory.js"
grep -q 'productImages,' "$PUB/js/half-cut-directory.js"
grep -q 'fetchPublicItemBySlug' "$PUB/js/half-cut-detail.js"
grep -q "params.get('id')" "$PUB/js/half-cut-detail.js"
grep -E -q 'vehicle-engine-001c|parts-parallel-v1|stock-id-search-v2|catalog-search-v2|youtube-embed-v1' "$PUB/half-cuts/detail.html"
grep -q 'youtube-embed-v1' "$PUB/half-cuts/detail.html"
grep -q 'youtubeVideoId' "$PUB/js/half-cut-directory.js"
grep -q 'youtube.com/embed' "$PUB/js/half-cut-directory.js"
grep -q 'engine-card-label.js' "$PUB/half-cuts/detail.html"
grep -q 'formatHalfCutDetailH1' "$PUB/js/half-cut-detail.js"
grep -q 'ebay-sidebar--v4' "$PUB/css/ebay-layout.css"
grep -qF -- '--ebay-list-photo-w: 200px' "$PUB/css/ebay-layout.css"
grep -q 'photo--parts-ph' "$PUB/css/ebay-layout.css"
grep -q 'about-type-v2' "$PUB/css/ebay-layout.css"
grep -qF -- '--about-ink' "$PUB/css/ebay-layout.css"
grep -qF -- '--about-muted' "$PUB/css/ebay-layout.css"
grep -q 'about-type-v2' "$PUB/about.html"
grep -q 'about-type-v2' "$PUB/contact.html"
grep -q 'ebay-contact-section' "$PUB/css/ebay-layout.css"
grep -q 'max-width: 920px' "$PUB/css/ebay-layout.css"
grep -q 'about-type-v2' "$PUB/kenya.html"
grep -q 'about-type-v2' "$PUB/brands/toyota.html"
grep -q 'brand-stock-directory-v2' "$PUB/brands.html"
grep -q 'half-cut-inventory-store.js' "$PUB/brands.html"
grep -q 'hydrateBrandDirectoryFromPublicStock' "$PUB/js/main.js"
grep -q 'site-consistency-v2' "$PUB/js/components.js"
grep -q 'ap-listing-photo--fit-contain .ap-listing-photo__img' "$PUB/css/ebay-layout.css"
grep -q 'object-fit: contain' "$PUB/css/ebay-layout.css"
grep -q 'about-type-v2' "$PUB/half-cuts/index.html"
grep -E -q 'catalog-search-v1|catalog-search-v2|stock-id-search-v[12]' "$PUB/half-cuts/index.html"
grep -q 'about-type-v2' "$PUB/engines/index.html"
grep -E -q 'catalog-search-v1|catalog-search-v2|stock-id-search-v[12]|dedicated-price-v1' "$PUB/engines/index.html"
test -f "$PUB/assets/images/parts-placeholder.svg"
test -f "$PUB/assets/images/ford-asiapower-powertrain-placeholder.svg"
test -f "$PUB/assets/images/ford-asiapower-powertrain-placeholder.png"
echo "[deploy:chrome] listing + static chrome OK on remote"
`);
}

/** Admin IA reorg — inventory / leads / analytics / growth (does NOT touch public homepage) */
function deployAdmin() {
  console.log('[deploy:admin] syncing admin IA reorg pages + helpers (no index.html)');
  const pub = `${SITE}/public`;
  ssh('mkdir -p /root/.openclaw/workspace/inventory-site/public/admin /root/.openclaw/workspace/inventory-site/public/css /root/.openclaw/workspace/inventory-site/public/js');
  rsync(`${ROOT}/css/admin-v4.css`, `${pub}/css/admin-v4.css`);
  rsync(`${ROOT}/js/components.js`, `${pub}/js/components.js`);
  rsync(`${ROOT}/js/admin-common.js`, `${pub}/js/admin-common.js`);
  rsync(`${ROOT}/js/admin-inventory.js`, `${pub}/js/admin-inventory.js`);
  rsync(`${ROOT}/js/admin-inventory-hub.js`, `${pub}/js/admin-inventory-hub.js`);
  rsync(`${ROOT}/js/admin-analytics.js`, `${pub}/js/admin-analytics.js`);
  rsync(`${ROOT}/js/admin-leads.js`, `${pub}/js/admin-leads.js`);
  rsync(`${ROOT}/js/admin-apsales-progress.js`, `${pub}/js/admin-apsales-progress.js`);
  rsync(`${ROOT}/admin/inventory.html`, `${pub}/admin/inventory.html`);
  rsync(`${ROOT}/admin/analytics.html`, `${pub}/admin/analytics.html`);
  rsync(`${ROOT}/admin/leads.html`, `${pub}/admin/leads.html`);
  rsync(`${ROOT}/admin/apsales-progress.html`, `${pub}/admin/apsales-progress.html`);
  ssh(`
set -e
PUB=/root/.openclaw/workspace/inventory-site/public
test -f "$PUB/css/admin-v4.css"
test -f "$PUB/js/admin-common.js"
test -f "$PUB/js/admin-analytics.js"
test -f "$PUB/js/admin-inventory-hub.js"
test -f "$PUB/admin/inventory.html"
test -f "$PUB/admin/analytics.html"
test -f "$PUB/admin/leads.html"
test -f "$PUB/admin/apsales-progress.html"
# IA markers
grep -q 'admin-ia-reorg-v1' "$PUB/admin/inventory.html"
grep -q 'admin-ia-reorg-v1' "$PUB/admin/analytics.html"
grep -q 'data-admin-ia="analytics-only-v1"' "$PUB/js/admin-analytics.js" || grep -q 'analytics-only-v1' "$PUB/js/admin-analytics.js"
grep -q '访问统计' "$PUB/js/components.js"
grep -q 'apsales-progress.html' "$PUB/js/components.js"
grep -q 'data-admin-google-login' "$PUB/js/admin-common.js"
# Must NOT have embedded inventory review tabs on analytics page scripts list
! grep -q 'admin-inventory-hub' "$PUB/admin/analytics.html"
# Homepage must remain untouched by this target (sanity: index still exists, we did not rsync it)
test -f "$PUB/index.html"
echo "[deploy:admin] files OK on remote (homepage not in this rsync set)"
`);
}

function deployApsales() {
  console.log('[deploy:apsales] syncing growth autopilot scripts');
  run('rsync', ['-av',
    `${ROOT}/scripts/apsales-growth-autopilot.py`,
    `${ROOT}/scripts/apsales-social-reply-watch.py`,
    `${ROOT}/scripts/apsales-record-distribution-action.py`,
    `${ROOT}/scripts/apsales-distribution-daily-digest.py`,
    `${ROOT}/scripts/apsales-maps-leads-run.py`,
    `${AP}/scripts/`,
  ]);
  run('rsync', ['-av',
    `${ROOT}/customer_gateway/growth_autopilot.py`,
    `${ROOT}/customer_gateway/outreach_engine.py`,
    `${ROOT}/customer_gateway/distribution_progress.py`,
    `${ROOT}/customer_gateway/maps_prospect.py`,
    `${AP}/customer_gateway/`,
  ]);
  // sales_core/ had no deploy target at all — files were drifting in via ad-hoc
  // manual syncs with no git record (found 2026-07-16 audit: apsales_handler.py
  // was live but never committed; enquiry_context.py was committed but never
  // deployed, missing the LIVE-RULES.md addon wiring in production).
  run('rsync', ['-av', '--exclude', '__pycache__',
    `${ROOT}/sales_core/`,
    `${AP}/sales_core/`,
  ]);
  // Track B 2026-07-15: unified Maps markets YAML + lead_finder (stops dual Places burn)
  run('rsync', ['-av',
    `${ROOT}/config/apbd_lead_markets.yaml`,
    `${ROOT}/config/apsales_maps_prospect.yaml`,
    `${AP}/config/`,
  ]);
  run('rsync', ['-av', '--exclude', '__pycache__',
    `${ROOT}/agents/apbd/`,
    `${AP}/agents/apbd/`,
  ]);
  run('rsync', ['-av',
    `${ROOT}/sales_coach/`,
    `${AP}/sales_coach/`,
  ]);
  // Zijing LIVE-RULES.md had no deploy target at all — edits never reached prod despite the
  // hot-reload (mtime-cache) design in bridge.mjs / zijing_reply_context.py. Fixes that gap.
  run('rsync', ['-av',
    `${ROOT}/docs/zijing-training/LIVE-RULES.md`,
    `${AP}/docs/zijing-training/LIVE-RULES.md`,
  ]);
}

function deployApsalesOpenClaw() {
  console.log('[deploy:apsales-openclaw] syncing Gateway sales bridge + media/VIN adapters');
  rsync(
    `${ROOT}/deploy/apsales-live-draft/bridge.mjs`,
    `${REMOTE}:/root/.openclaw/extensions/apsales-live-draft/bridge.mjs.next`,
  );
  rsync(
    `${ROOT}/deploy/apsales-live-draft/apsales-whatsapp-session.mjs`,
    `${REMOTE}:/root/.openclaw/extensions/apsales-live-draft/apsales-whatsapp-session.mjs.next`,
  );
  rsync(
    `${ROOT}/deploy/apsales-live-draft/evidence-hook.mjs`,
    `${REMOTE}:/root/.openclaw/extensions/apsales-live-draft/evidence-hook.mjs`,
  );
  rsync(
    `${ROOT}/deploy/apsales-live-draft/apsales-human-visibility.mjs`,
    `${REMOTE}:/root/.openclaw/extensions/apsales-live-draft/apsales-human-visibility.mjs`,
  );
  rsync(
    `${ROOT}/deploy/apsales-live-draft/apsales-parse-agent-reply.mjs`,
    `${REMOTE}:/root/.openclaw/extensions/apsales-live-draft/apsales-parse-agent-reply.mjs`,
  );
  rsync(
    `${ROOT}/deploy/apsales-live-draft/ghana-staff-handoff.mjs`,
    `${REMOTE}:/root/.openclaw/extensions/apsales-live-draft/ghana-staff-handoff.mjs`,
  );
  rsync(
    `${ROOT}/server/lib/asiapower-evidence.js`,
    `${REMOTE}:/root/.openclaw/workspace/AsiaPower/server/lib/asiapower-evidence.js`,
  );
  // Phase 1c: +233 bridge retainOrDiscardPhoto (same module as +86 Cloud API)
  rsync(
    `${ROOT}/server/lib/customer-photo-archive.js`,
    `${REMOTE}:/root/.openclaw/workspace/AsiaPower/server/lib/customer-photo-archive.js`,
  );
  rsync(
    `${ROOT}/server/lib/media-optimize.js`,
    `${REMOTE}:/root/.openclaw/workspace/AsiaPower/server/lib/media-optimize.js`,
  );
  rsync(
    `${ROOT}/scripts/apsales-media-vin-ocr.py`,
    `${REMOTE}:/root/.openclaw/workspace/AsiaPower/scripts/apsales-media-vin-ocr.py`,
  );
  rsync(
    `${ROOT}/scripts/apsales-media-vin-intelligence.py`,
    `${REMOTE}:/root/.openclaw/workspace/AsiaPower/scripts/apsales-media-vin-intelligence.py`,
  );
  rsync(
    `${ROOT}/scripts/apsales-media-stt.py`,
    `${REMOTE}:/root/.openclaw/workspace/AsiaPower/scripts/apsales-media-stt.py`,
  );
  ssh(`
set -euo pipefail
BRIDGE_DIR=/root/.openclaw/extensions/apsales-live-draft
BRIDGE=\$BRIDGE_DIR/bridge.mjs
SESSION=\$BRIDGE_DIR/apsales-whatsapp-session.mjs
NEXT=\${BRIDGE}.next
SESSION_NEXT=\${SESSION}.next
BACKUP=/root/.openclaw/releases/apsales-openclaw-\$(date -u +%Y%m%dT%H%M%SZ)
test -s "$NEXT"
test -s "$SESSION_NEXT"
CHECK=\$(mktemp /tmp/apsales-bridge-check-XXXXXX.mjs)
SESSION_CHECK=\$(mktemp /tmp/apsales-session-check-XXXXXX.mjs)
cp "$NEXT" "$CHECK"
cp "$SESSION_NEXT" "$SESSION_CHECK"
/usr/bin/node --check "$CHECK"
/usr/bin/node --check "$SESSION_CHECK"
rm -f "$CHECK" "$SESSION_CHECK"
mkdir -p "$BACKUP" /etc/systemd/system/apsales-whatsapp-bridge.service.d
cp -a "$BRIDGE" "$BACKUP/bridge.mjs"
if [ -f "$SESSION" ]; then cp -a "$SESSION" "$BACKUP/apsales-whatsapp-session.mjs"; fi
if [ -f /etc/systemd/system/apsales-whatsapp-bridge.service.d/openclaw-sales-agent.conf ]; then
  cp -a /etc/systemd/system/apsales-whatsapp-bridge.service.d/openclaw-sales-agent.conf "$BACKUP/openclaw-sales-agent.conf"
fi
# OCR: google Vision free tier (CEO 2026-07-14); STT stays none until vendor key.
# EnvironmentFile loads GOOGLE_PLACES_API_KEY / APSALES_GOOGLE_VISION_API_KEY from AsiaPower .env
cat > /etc/systemd/system/apsales-whatsapp-bridge.service.d/openclaw-sales-agent.conf <<'EOF'
[Service]
Environment=APSALES_REPLY_BRAIN=openclaw
Environment=APSALES_OPENCLAW_AGENT=sales-agent
Environment=APSALES_OPENCLAW_TIMEOUT_SECONDS=90
Environment=APSALES_MEDIA_VIN_ENABLED=true
Environment=APSALES_MEDIA_MAX_BYTES=8388608
Environment=APSALES_VOICE_STT_ENABLED=true
Environment=APSALES_AUDIO_MAX_BYTES=8388608
Environment=APSALES_OCR_PROVIDER=google
Environment=APSALES_STT_PROVIDER=google
EnvironmentFile=-/root/.openclaw/workspace/AsiaPower/.env
EOF
mv "$SESSION_NEXT" "$SESSION"
mv "$NEXT" "$BRIDGE"
systemctl daemon-reload
systemctl restart apsales-whatsapp-bridge.service
sleep 2
systemctl is-active --quiet apsales-whatsapp-bridge.service
systemctl show apsales-whatsapp-bridge.service -p Environment --no-pager
echo "[deploy:apsales-openclaw] backup=$BACKUP"
`);
}

function deployFinalize() {
  rsync(`${ROOT}/deploy/inventory-site-scripts/backup-inventory-site.sh`, `${SITE}/scripts/`);
  const finalizeScripts = [
    `${ROOT}/scripts/telegram-lead-reminder.js`,
    `${ROOT}/scripts/telegram-daily-report.js`,
    `${ROOT}/scripts/telegram-hourly-report.js`,
    `${ROOT}/scripts/telegram-memory-watch.js`,
    `${ROOT}/scripts/telegram-backup-alert.js`,
    `${ROOT}/scripts/telegram-whatsapp-inquiry-watch.js`,
    `${ROOT}/scripts/sync-data-backup-r2.mjs`,
    `${ROOT}/scripts/telegram-common.js`,
    `${ROOT}/scripts/fix-inventory-record.mjs`,
    `${ROOT}/scripts/backfill-complete-halfcut-categories-2026-07-12.mjs`,
    `${ROOT}/scripts/fix-truck-listing-meta.mjs`,
    `${ROOT}/scripts/optimize-inventory-photos.mjs`,
    `${ROOT}/scripts/compress-inventory-videos.mjs`,
    `${ROOT}/scripts/fix-hc250081-lonking.mjs`,
    `${ROOT}/scripts/fix-hc250107-machinery.mjs`,
  ].filter((file) => fs.existsSync(file));
  run('rsync', ['-av', ...finalizeScripts, `${SITE}/scripts/`]);
  const setupR2Cors = `${ROOT}/scripts/setup-r2-cors.mjs`;
  if (fs.existsSync(setupR2Cors)) rsync(setupR2Cors, `${SITE}/scripts/`);

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
GEO=/etc/nginx/conf.d/asiapower-trusted-upload-ips.map
echo "# Auto-generated — empty key exempts IP from upload nginx rate limit" > "$GEO"
IPS=$(grep "^TRUSTED_SUPPLIER_UPLOAD_IPS=" "$ENV" 2>/dev/null | cut -d= -f2- | tr ',' ' ')
for ip in $IPS; do
  ip=$(echo "$ip" | xargs)
  [ -n "$ip" ] && printf '%s "";\n' "$ip" >> "$GEO"
done
KEY=$(grep "^SUPPLIER_UPLOAD_KEY=" "$ENV" | cut -d= -f2-)
printf "// Temporary supplier upload gate. This is public to the browser; do not treat it as a supplier account credential.\\nwindow.SUPPLIER_UPLOAD_KEY='%s';\\n" "$KEY" > "$SITE/public/supplier-portal/upload-key.js"
chmod +x "$SITE/scripts/backup-inventory-site.sh" 2>/dev/null || true
rm -rf "$SITE/public/.git" "$SITE/public/.venv" "$SITE/public/.venv-"* "$SITE/public/gfpgan" 2>/dev/null || true
PUB="$SITE/public"
UP="$SITE/uploads/photos"
for DIR in /root /root/.openclaw /root/.openclaw/workspace "$SITE" "$PUB" "$PUB/css" "$PUB/js" "$PUB/assets" "$SITE/uploads" "$UP"; do
  [ -d "$DIR" ] && chmod o+x "$DIR" 2>/dev/null || true
done
[ -d "$PUB/css" ] && find "$PUB/css" "$PUB/js" "$PUB/assets" -type f -exec chmod o+r {} + 2>/dev/null || true
[ -d "$UP" ] && find "$UP" -type f -exec chmod o+r {} + 2>/dev/null || true
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
GROWTH_MARK="# asiapower-apsales-growth"
GROWTH_LINE="0 9,14,19 * * * cd /root/.openclaw/workspace/AsiaPower && .venv/bin/python3 scripts/apsales-growth-autopilot.py >> /var/log/asiapower-apsales-growth.log 2>&1"
(crontab -l 2>/dev/null \\
  | grep -v 'telegram-lead-reminder.js' \\
  | grep -v 'telegram-daily-report.js' \\
  | grep -v 'telegram-hourly-report.js' \\
  | grep -v 'telegram-memory-watch.js' \\
  | grep -v 'telegram-whatsapp-inquiry-watch.js' \\
  | grep -v 'apsales-growth-autopilot.py' \\
  | grep -v 'backup-inventory-site.sh' \\
  | grep -v 'sync-data-backup-r2.mjs' \\
  | grep -v 'asiapower-health-watch' \\
  | grep -v "$CRON_MARK" | grep -v "$DAILY_MARK" | grep -v "$HOURLY_MARK" | grep -v "$WHATSAPP_MARK" | grep -v "$MEMORY_MARK" | grep -v "$HEALTH_MARK" | grep -v "$BACKUP_MARK" | grep -v "$R2BACKUP_MARK" | grep -v "$GROWTH_MARK"; \\
  echo "$CRON_MARK"; echo "$CRON_LINE"; \\
  echo "$DAILY_MARK"; echo "$DAILY_LINE"; \\
  echo "$HOURLY_MARK"; echo "$HOURLY_LINE"; \\
  echo "$WHATSAPP_MARK"; echo "$WHATSAPP_LINE"; \\
  echo "$MEMORY_MARK"; echo "$MEMORY_LINE"; \\
  echo "$HEALTH_MARK"; echo "$HEALTH_LINE"; \\
  echo "$BACKUP_MARK"; echo "$BACKUP_LINE"; \\
  echo "$R2BACKUP_MARK"; echo "$R2BACKUP_LINE"; \\
  echo "$GROWTH_MARK"; echo "$GROWTH_LINE") | crontab -
PYENV=/root/.openclaw/workspace/AsiaPower/.env
if grep -q '^APSALES_GROWTH_AUTOPILOT=' "$PYENV" 2>/dev/null; then
  sed -i 's/^APSALES_GROWTH_AUTOPILOT=.*/APSALES_GROWTH_AUTOPILOT=1/' "$PYENV"
else
  echo 'APSALES_GROWTH_AUTOPILOT=1' >> "$PYENV"
fi
if ! grep -q '^INVENTORY_SITE_ROOT=' "$PYENV" 2>/dev/null; then
  echo "INVENTORY_SITE_ROOT=$SITE" >> "$PYENV"
fi
echo "[deploy:finalize] done"
`;
  ssh(remoteScript);
}

function printHelp() {
  console.log(`AsiaPower deploy (Release Manager enabled):
  node scripts/deploy-production.mjs <target> [--yes] [--allow-dirty] [user@host]

  nginx | api | engines | apsales | apsales-openclaw | finalize | home | portal | chrome | categories | admin

  REQUIRED: commit → push GitHub → then deploy (CEO red line 2026-07-10)
  Pre-deploy:  git clean, HEAD on origin, backup, target confirmation
  Post-deploy: nginx -t, critical URLs, OPS-003 public parser validation, release.json

  Emergency only (logged): DEPLOY_ALLOW_DIRTY=1 + --allow-dirty
                           DEPLOY_ALLOW_UNPUSHED=1

  Restore:     RESTORE_CONFIRM=<ID> node scripts/release-restore.mjs <ID>`);
}

const targets = {
  nginx: deployNginx,
  api: deployApi,
  engines: deployEngines,
  apsales: deployApsales,
  'apsales-openclaw': deployApsalesOpenClaw,
  finalize: deployFinalize,
  home: deployHome,
  portal: deployPortal,
  chrome: deployChrome,
  categories: deployCategories,
  admin: deployAdmin,
};

async function main() {
  if (!targets[targetArg]) {
    printHelp();
    process.exit(targetArg === 'help' ? 0 : 1);
  }

  const gitShort = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim() || '0000000';
  const releaseId = generateReleaseId(targetArg, gitShort);
  const timestamp = new Date().toISOString();

  console.log(`[release] ID=${releaseId}`);
  console.log(`[deploy] target=${targetArg} remote=${REMOTE}`);

  const pre = runPreDeployValidation({
    root: ROOT,
    target: targetArg,
    remote: REMOTE,
    allowDirty: ALLOW_DIRTY,
    yes: YES,
    releaseId,
  });

  for (const c of pre.checks) {
    console.log(`[pre] ${c.status.toUpperCase()} ${c.name}: ${c.detail}`);
  }
  if (pre.status === 'fail') {
    console.error('[release] pre-deploy validation FAILED');
    process.exit(1);
  }

  const snapOk = snapshotRemotePaths({
    remote: REMOTE,
    releaseId,
    paths: TARGET_REMOTE_PATHS[targetArg] || [],
  });
  console.log(`[release] snapshot ${snapOk ? 'OK' : 'WARN'} → releases/${releaseId}/snapshots/`);

  targets[targetArg]();

  const post = await runPostDeployValidation({
    root: ROOT,
    target: targetArg,
    remote: REMOTE,
    baseUrl: BASE_URL,
    releaseId,
  });

  for (const c of post.checks) {
    console.log(`[post] ${c.status.toUpperCase()} ${c.name}: ${c.detail}`);
  }

  const localReleaseDir = path.join(ROOT, 'releases', releaseId);
  const localReleaseJson = path.join(localReleaseDir, 'release.json');
  const release = buildReleaseRecord({
    releaseId,
    git: pre.git,
    target: targetArg,
    remote: REMOTE,
    timestamp,
    changedFiles: pre.changed_files,
    pre,
    post,
    backupPath: pre.backup_path,
    backupMode: pre.backup_mode,
    localReleaseJson,
  });

  writeReleaseJson({ remote: REMOTE, release, localDir: localReleaseDir });
  printDeploymentSummary(release);

  // Keep newest N REL-* snapshots (local + remote). Never fail the deploy for prune errors.
  pruneReleaseDirsSafe(path.join(ROOT, 'releases'));
  pruneRemoteReleaseDirsSafe({ remote: REMOTE });

  if (post.status === 'fail') {
    console.error('[release] post-deploy validation FAILED — consider restore');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[deploy] FAILED:', err.message);
  process.exit(1);
});
