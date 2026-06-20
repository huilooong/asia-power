# Asia-Power Inventory Site — Restore Guide

Production root: `/root/.openclaw/workspace/inventory-site`

Scheduled backups: `/root/.openclaw/workspace/inventory-site/backups/scheduled/`

Archive format: `asia-power-backup-YYYYMMDD-HHMMSS.tar.gz`

Each archive contains:

- `server.js`
- `public/`
- `data/`
- `uploads/`
- `lib/`
- `nginx-asia-power.com`
- `BACKUP-MANIFEST.txt`

## 1. List available backups

```bash
ls -lh /root/.openclaw/workspace/inventory-site/backups/scheduled/
```

Pick the newest backup before the incident, or the latest good backup.

## 2. Stop the app (recommended before full restore)

```bash
systemctl stop inventory-site.service
```

## 3. Extract backup to a staging directory

```bash
BACKUP=/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-YYYYMMDD-HHMMSS.tar.gz
STAGE=/tmp/asia-power-restore-$(date +%s)
mkdir -p "$STAGE"
tar -xzf "$BACKUP" -C "$STAGE"
ls -la "$STAGE"
```

## 4. Restore files

```bash
SITE=/root/.openclaw/workspace/inventory-site

cp -a "$STAGE/server.js" "$SITE/server.js"
cp -a "$STAGE/public" "$SITE/"
cp -a "$STAGE/data" "$SITE/"
cp -a "$STAGE/uploads" "$SITE/"
cp -a "$STAGE/lib" "$SITE/"

node --check "$SITE/server.js"
```

## 5. Restore nginx config (if needed)

```bash
cp -a "$STAGE/nginx-asia-power.com" /etc/nginx/sites-available/asia-power.com
nginx -t
systemctl reload nginx
```

## 6. Start the app

```bash
systemctl start inventory-site.service
systemctl is-active inventory-site.service
```

## 7. Verify

```bash
curl -s https://asia-power.com/api/half-cuts/health
curl -sI https://asia-power.com/css/styles.css | head -8
curl -s https://asia-power.com/css/styles.css | head -1
```

CSS must return **200**, `Content-Type: text/css`, body starts with `/* AsiaPower`, size **> 80KB**.

From your laptop (recommended after every deploy):

```bash
node scripts/verify-production.mjs
```

If CSS returns 404 or a tiny HTML page, see **deploy/SITE-HEALTH.md** (「石器时代」recovery).

```bash
curl -sI https://asia-power.com/
curl -sI https://asia-power.com/half-cuts/
curl -sI https://asia-power.com/engines/
```

Check supplier upload and admin review if media/state restore was the goal.

## Partial restore

| Need | Restore only |
|------|----------------|
| Static site rollback | `public/` |
| Half-cut submissions / approved JSON | `data/` |
| Uploaded photos/videos | `uploads/` |
| API / upload routes | `server.js` + `lib/` |
| Upload size / proxy issue | `nginx-asia-power.com` |

After partial restore of `server.js`, always run:

```bash
node --check /root/.openclaw/workspace/inventory-site/server.js
systemctl restart inventory-site.service
```

## Notes

- Scheduled backups keep the **newest 14** archives.
- Manual pre-deploy backups may also exist under `backups/pre-*`.
- Do not extract directly over the live site without stopping the service first.
- Restoring `data/` and `uploads/` replaces current submissions and media.
