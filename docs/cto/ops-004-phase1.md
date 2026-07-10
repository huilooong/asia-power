# OPS-004 Phase 1 — Done

Date: 2026-07-05 UTC  
Scope: **Infrastructure only** (no business pages / SEO / engine templates)

---

## Results

| Objective | Status | Evidence |
| --- | --- | --- |
| nginx drift eliminated | **Done** | `nginx -t` PASS; `sites-enabled` → symlink → `sites-available`; upload zone restored |
| Single deploy source of truth | **Done** | `deploy/nginx-asia-power.com` = prod verified vhost (`c852dc34`); rate-limit from `deploy/nginx-rate-limit.conf` |
| Prod → Local → Git | **Done** | Pulled active vhost + systemd unit into `deploy/`; `package.json` aligned |
| Missing artifacts committed | **Done** | `deploy/inventory-site.service`, `package.json`, `package-lock.json` |
| Remove blind public rsync | **Done** | Removed from `deploy-production.mjs` |
| Split deploy pipeline | **Done** | Targets: `nginx`, `api`, `engines`, `apsales`, `finalize` |

---

## Production changes applied

```bash
node scripts/deploy-production.mjs nginx root@159.65.86.24
```

| Check | Before | After |
| --- | --- | --- |
| `nginx -t` | FAIL (`asiapower_upload` missing) | **PASS** |
| `sites-enabled` | separate file (380 lines) | **symlink** → `sites-available` |
| `sites-available` md5 | `575ea847` (stale GitHub) | **`c852dc34`** (verified vhost) |
| `rate-limit.conf` md5 | `8e2894db` (no upload zone) | **`41fb41fc`** (upload zone defined) |

---

## Repo changes

| File | Change |
| --- | --- |
| `deploy/inventory-site.service` | **Added** (from production) |
| `deploy/nginx-asia-power.com` | **Replaced** with production `sites-enabled` copy |
| `package-lock.json` | **Added** (removed mistaken `package-lock.json/` directory) |
| `scripts/deploy-production.mjs` | **Split targets**; no full `public/` rsync |

---

## Deploy usage (new)

```bash
node scripts/deploy-production.mjs nginx      # nginx only
node scripts/deploy-production.mjs api        # server.js + lib + systemd
node scripts/deploy-production.mjs engines    # engines/*.html only
node scripts/deploy-production.mjs apsales    # AsiaPower growth scripts
node scripts/deploy-production.mjs finalize   # cron, upload-key, permissions
```

**Removed:** default full-tree rsync to `public/`.

---

## Not in Phase 1 (by design)

| Item | Reason |
| --- | --- |
| `deploy api` to production | Local `server.js` 70 KB ≠ verified prod 37 KB — separate API release |
| Public content commit to GitHub | Business scope — out of OPS-004 Phase 1 |
| `lib/` `--delete` deploy | Runs with `deploy api` when API release approved |

---

## Next step

Phase 2: merge API `server.js` + `lib/` cleanup, then `node scripts/deploy-production.mjs api`.
