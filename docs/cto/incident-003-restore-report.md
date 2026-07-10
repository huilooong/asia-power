# INCIDENT-003 — Restore Pre-Rollback Production

Date: 2026-07-05 (UTC)  
Priority: **P0**  
Status: **COMPLETE**

Related: [INCIDENT-002](./incident-002-mass-regression.md) · [INCIDENT-001](./incident-001-homepage-regression.md)

---

## Executive Summary

| Step | Result |
| --- | --- |
| Fresh backup before restore | **Done** — `asia-power-backup-20260705-041229.tar.gz` (489 MB) |
| Restore `public/` from pre-rollback backup | **Done** — `asia-power-backup-20260705-030001.tar.gz` |
| Re-deploy 50 TASK-008 engine pages | **Done** — 63 engine HTML total on disk |
| Live verification (from production server) | **61/61 HTTP 200** |
| nginx / systemd / `server.js` / `lib/` | **Not modified** |

Production `public/` is restored to the **03:00 UTC pre-rollback state**, with **50 new engine pages** re-added afterward.

---

## 1. Fresh Backup (Step 1)

| Item | Value |
| --- | --- |
| Command | `/root/.openclaw/workspace/inventory-site/scripts/backup-inventory-site.sh` |
| Started | 2026-07-05 04:12:29 UTC |
| Archive | `backups/scheduled/asia-power-backup-20260705-041229.tar.gz` |
| Size | 489 MB |
| Purpose | Rollback point if restore went wrong |

---

## 2. Restore `public/` (Step 2)

| Item | Value |
| --- | --- |
| Source | `backups/scheduled/asia-power-backup-20260705-030001.tar.gz` |
| Method | Extract to `/tmp/incident003-restore-*`, then `rsync -a --delete` → `public/` |
| Scope | **`public/` only** — no `server.js`, `lib/`, `data/`, nginx |
| Engine pages before | 63 |
| Engine pages after restore | 13 (expected — 50 new slug pages absent from 03:00 backup) |

### Key file MD5 after restore (matches Local + pre-rollback backup)

| File | MD5 |
| --- | --- |
| `index.html` | `ffc428263bccf09630d07b27c082e7af` |
| `js/public-i18n.js` | `d6f5028c972e1011aba25c3f10e76bbc` |
| `about.html` | `6d9575bc4b560bc6ab3e2e6a09f60ae7` |
| `brands/toyota.html` | `4f9d5bfd1136d38f265ea20446878116` |
| `half-cuts/index.html` | `db7b70f50b865cb5a203fd87d2434366` |
| `gearboxes/index.html` | `fa3bfae2a28bb53a0fe730db886ccd15` |
| `trucks/index.html` | `7be140fd47d1cd3286025fc51e0fedbc` |
| `css/styles.css` | 173,352 bytes |
| `css/ebay-layout.css` | present |

---

## 3. Re-deploy 50 Engine Pages (Steps 3–4)

50 slug-style pages from `origin/main @ 8536a1d5` (not in 03:00 backup) were rsync'd from Local Mac:

```bash
rsync -av --files-from=incident003-engine-redeploy-list.txt engines/ \
  root@159.65.86.24:/root/.openclaw/workspace/inventory-site/public/engines/
```

**Note:** First rsync attempt used wrong `--relative` path and placed 50 files under `public/` root; those stray files were removed and correct `public/engines/` copy confirmed.

| Item | Value |
| --- | --- |
| Files deployed | 50 (list in `/tmp/incident003-engine-redeploy-list.txt`) |
| Final engine HTML count | **63** (13 legacy + 50 new slug pages) |
| Source commit | `8536a1d5` (via Local working tree, MD5 verified) |

---

## 4. Verification (Step 5)

All checks run **from production server** via `curl -L https://asia-power.com/...` (external curl from laptop returned 403 — Cloudflare/bot filter; not a site failure).

### Content checks

| Check | Result |
| --- | --- |
| Homepage mission hero text | **PASS** — “Give every reusable asset a second life.” in HTML |
| `about.html` | HTTP **200** |
| `contact.html` | HTTP **200** |
| `brands/toyota.html` | HTTP **200** |
| `half-cuts/` | HTTP **200** |
| `gearboxes/` | HTTP **200** |
| `trucks/` | HTTP **200** |
| `css/styles.css` | HTTP **200** |
| `js/public-i18n.js` | HTTP **200** |
| `engines/` index | HTTP **200** |

### 50 engine pages — all HTTP 200

`1az-fe.html`, `1gr-fe.html`, `1jz-ge.html`, `1kd-ftv.html`, `1nz-fe.html`, `1zr-fe.html`, `1zz-fe.html`, `2az-fe.html`, `2gr-fe.html`, `2kd-ftv.html`, `2nz-fe.html`, `2tr-fe.html`, `2zr-fe.html`, `3zr-fe.html`, `3zz-fe.html`, `4b11.html`, `4b12.html`, `4jb1.html`, `651-955.html`, `g4ed.html`, `g4fc.html`, `g4fg.html`, `g4gc.html`, `g4ka.html`, `g4kc.html`, `g4kd.html`, `g4ke.html`, `g4kj.html`, `g4na.html`, `g6ba.html`, `hr15de.html`, `hr16de.html`, `k10b.html`, `k20a.html`, `k24a.html`, `k24a8.html`, `k24z4.html`, `l13z.html`, `l15a.html`, `l15a1.html`, `l15a7.html`, `m16a.html`, `m271-951.html`, `m272-967.html`, `mr20de.html`, `qr25de.html`, `r18a.html`, `r18a1.html`, `r18a2.html`, `r20a3.html`

**Summary:** 11 core URLs + 50 engine pages = **61/61 PASS**

---

## 5. Out-of-Scope Items (Not Touched)

| Component | Touched in INCIDENT-003? | Notes |
| --- | --- | --- |
| nginx config | **No** | OPS-001 rate-limit issue remains open |
| systemd / `inventory-site.service` | **No** | Service stayed `active` throughout |
| `server.js` | **No** | MD5 `7808eccad00d76210ec64fe930025a68` unchanged |
| `lib/` | **No** | Not restored from backup archive |

---

## 6. Rollback of This Restore (If Needed)

To undo INCIDENT-003 and return to post-TASK-008 state:

```bash
# On production — only if needed
STAGE=/tmp/incident003-undo-$$
mkdir -p "$STAGE"
tar -xzf /root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260705-041229.tar.gz -C "$STAGE"
rsync -a --delete "$STAGE/public/" /root/.openclaw/workspace/inventory-site/public/
```

---

## 7. Recommended Follow-ups

1. **Commit** restored public content to GitHub so future deploys do not re-regress.
2. **OPS-001** — fix nginx `rate-limit.conf` / upload zone (separate task).
3. **Split deploy script** — engine-only rsync vs full-site rsync.
4. Run `node scripts/verify-production.mjs` from a network path that bypasses Cloudflare 403 if available.

---

## 8. Status

| Task | Status |
| --- | --- |
| INCIDENT-003 restore | **CLOSED — SUCCESS** |
| Production public content | Restored to pre-03:28 state + 50 engine pages |
| nginx OPS-001 | Open (unchanged) |
