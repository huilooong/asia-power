# AsiaPower Site Health & Recovery

Prevent and recover from the **「石器时代」** incident — pages load without CSS (plain HTML).

## What went wrong (2026-06-20)

1. Nginx was configured to serve `/css/` and `/js/` directly from `/root/.openclaw/workspace/inventory-site/public`.
2. Nginx runs as `www-data` and **cannot read** files under `/root/` → **404** for all CSS/JS.
3. Those 404 responses included **`Cache-Control: max-age=604800`** (7 days).
4. Browsers cached the tiny HTML error page **as styles.css** → entire site looked unstyled until cache bust.

## Golden rules (do not break)

| Rule | Why |
|------|-----|
| **Do not** nginx `root` + `try_files` for static assets under `/root/` | Permission 404 + accidental long cache |
| **Do not** set long `Cache-Control` on nginx 404/error pages | Browsers treat errors as real CSS |
| **Always** run `node scripts/test-critical-paths.mjs` before deploy | Catches upload/lead regressions (gallery, cab VIN, silent forms) |
| **Always** run `node scripts/verify-production.mjs` after deploy | Catches broken CSS before users do |
| **Always** bump `styles.css?v=` when forcing cache refresh | See `scripts/bump-css-cache.mjs` |
| Keep gzip on proxied responses (`gzip_proxied any`) | CSS ~128KB → ~21KB |
| Public pages use `#site-header` / `#site-footer` from `js/components.js` only | **No top bar** — `#site-topbar` stays empty; do not add contact info to page HTML headers |

Current production pattern: **all requests → Node on :8080**; Node serves static files with correct MIME and cache headers.

## After every deploy

```bash
node scripts/deploy-production.mjs
# deploy script runs verify automatically

# Or manually:
node scripts/verify-production.mjs
node scripts/verify-production.mjs https://asia-power.com
```

Deploy **must fail** if verify fails — do not leave production in a broken state.

## Emergency: site looks unstyled again

### 1. Confirm CSS is broken

```bash
curl -sI https://asia-power.com/css/styles.css | head -5
curl -s https://asia-power.com/css/styles.css | head -3
```

Healthy: `HTTP/1.1 200`, `Content-Type: text/css`, body starts with `/* AsiaPower`, size **> 80KB**.

Broken: `404`, `Content-Length: 162`, or HTML `<html>` in body.

### 2. Fix nginx (if recently changed)

Restore proxy-only config from repo:

```bash
# On server
cp /etc/nginx/sites-available/asia-power.com /etc/nginx/sites-available/asia-power.com.bak
# redeploy from laptop:
node scripts/deploy-production.mjs
```

**Never** re-add static `location ^~ /css/` blocks without moving `public/` to `/var/www/` and granting nginx read access.

### 3. Force users off bad cache

```bash
node scripts/bump-css-cache.mjs
node scripts/deploy-production.mjs
```

Tell users: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows).

### 4. Full rollback

See [inventory-site-scripts/RESTORE.md](./inventory-site-scripts/RESTORE.md) — restore latest scheduled backup, then verify.

## Scheduled backups

Server: `/root/.openclaw/workspace/inventory-site/backups/scheduled/`  
Script: `deploy/inventory-site-scripts/backup-inventory-site.sh`

Keeps newest **14** daily archives (site + data + uploads + nginx).

## Stable baseline (git)

Tag/commit after verified deploy:

```bash
node scripts/verify-production.mjs && git tag -a site-stable-YYYYMMDD -m "Verified production baseline"
```

Reference commit message style: `Stable production baseline — gallery, supplier upload, market stats, deploy verify`.

## Critical paths: upload & lead capture

These two flows generate inventory and enquiries. Regressions here are **P0** — treat like CSS outages.

| Incident | Cause | Guard |
|----------|--------|--------|
| Mobile upload opens camera only | `capture=` on `<input type="file">` | `test-critical-paths.mjs` |
| Cab supplier stuck on step 1 | VIN required before listing-type choice | `test-critical-paths.mjs` |
| Enquiry submits with no feedback | Modal not on `body`, or `SiteFeedback` missing | `test-critical-paths.mjs` |
| Server rejects valid cab upload | Client/server validation drift | sandbox test in `test-critical-paths.mjs` |

### Before deploy

```bash
node scripts/test-critical-paths.mjs
```

`deploy-production.mjs` runs this automatically and **aborts** if it fails.

### Upload rules (do not break)

- **Never** add `capture=` to photo file inputs — suppliers must pick from gallery.
- Truck **driver cab**: listing type on **step 1**; VIN and engine optional; client + server must agree (`isTruckCab` / `truckPartType === 'cab'`).
- Upload success/failure must use `showUploadModal` / `SiteFeedback` — no silent submits.

### Lead capture rules (do not break)

- Half-cut / catalog / contact leads: `preventDefault` → `SiteFeedback.promptContact` → POST API → success/error modal.
- Contact form: `novalidate` + custom validation + `presentFeedback` on success and error.
- `site-feedback.js` modals must append to `document.body` with `position:fixed`.
