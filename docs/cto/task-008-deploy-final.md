# TASK-008 Deploy Final

Date: 2026-07-05 (UTC)

## Final Status

```text
TASK-008 CLOSED
```

All TASK-008 acceptance criteria are met on production.

## Deployment Summary

| Item | Value |
| --- | --- |
| Deploy source | clean git worktree @ `8536a1d5` |
| Deploy target | `root@159.65.86.24` |
| Deploy command | `node scripts/deploy-production.mjs root@159.65.86.24` |
| Worktree path | `/tmp/asiapower-task008-deploy` |
| Not deployed from | `feature/apgrowth-audit-v01` dirty worktree |
| Started | 2026-07-05 03:28:16 UTC |
| Finished validation | 2026-07-05 03:29:21 UTC |
| Business code modified | no |
| Commit / push | no |

## Pre-Deploy State

| Check | Result |
| --- | --- |
| `origin/main` | `8536a1d5` feat(seo): add repeatable engine page generator |
| Engine HTML files on `origin/main` | 63 |
| Production `public/engines/g4fc.html` | missing |
| Production engine HTML count | 13 |
| Live 50-page validation (pre) | 0/50 HTTP 200 |

## Deploy Execution

### Phase 0 — Preflight

- Fetched `origin/main` → confirmed `8536a1d5`.
- Confirmed TASK-008 engine pages exist on GitHub main.
- Confirmed production still on old engine batch (13 files, no `g4fc.html`).

### Phase 1 — Clean Worktree

```bash
DEPLOY_DIR=/tmp/asiapower-task008-deploy
rm -rf "$DEPLOY_DIR"
git worktree add --detach "$DEPLOY_DIR" 8536a1d5
```

Worktree HEAD verified: `8536a1d50c098491846e373d38c09fbc22a28fef`.

### Phase 2 — Production Deploy

Static sync **succeeded**:

- 268 files rsynced to `/root/.openclaw/workspace/inventory-site/public/`
- All 50 TASK-008 engine pages included (e.g. `engines/g4fc.html`)
- Production engine HTML count after sync: **63**
- Pre-deploy data backup created: `asia-power-data-20260705-032853.tar.gz`

Remote finalize **partially failed** (script exit code **1**):

| Step | Result |
| --- | --- |
| Static rsync → `public/` | OK |
| `server.js` + `lib/` sync | OK |
| `inventory-site.service` rsync | missing in commit `8536a1d5` (non-fatal rsync warning) |
| Several script files rsync | missing in commit `8536a1d5` (non-fatal rsync warnings) |
| Pre-deploy backup | OK |
| `nginx -t` | **FAILED** |
| `systemctl reload nginx` | not reached |
| `systemctl restart inventory-site` | not reached |
| Cloudflare cache purge | not reached |
| `test-critical-paths.mjs` | not reached (script exited early) |

**Nginx failure detail:**

```text
nginx: [emerg] zero size shared memory zone "asiapower_upload"
nginx: configuration file /etc/nginx/nginx.conf test failed
```

**Root cause:** commit `8536a1d5` ships a shorter `deploy/nginx-rate-limit.conf` (API/login zones only). Production `sites-enabled/asia-power.com` still references `limit_req zone=asiapower_upload`, but the upload zone definition was overwritten during deploy sync. Nginx remains **active** on the previously loaded config; site continued serving during/after deploy.

**Impact on TASK-008:** none for engine page delivery. Static HTML was already on disk before nginx test failed.

### Phase 3 — Post-Deploy Verification

Manual smoke test from deploy worktree:

```bash
node scripts/verify-production.mjs
```

Result: **all checks passed** (homepage, CSS, JS, API health, supplier upload, half-cuts).

## Live Validation (Post-Deploy)

| Criterion | Result |
| --- | --- |
| 50 Production-001 engine pages HTTP 200 | **50/50 PASS** |
| `https://asia-power.com/engines/` | 200 |
| `https://asia-power.com/sitemap.xml` | 200 |
| `sitemap.xml` contains `engines/g4fc.html` | yes |
| 404 on target 50 pages | **0** |

Detailed per-page results: `docs/cto/task-008-live-validation.md`

Raw execution log: `docs/cto/task-008-deploy-execution.log`

## Acceptance Criteria

| # | Criterion | Status |
| --- | --- | --- |
| 1 | 50 engine pages return HTTP 200 | **PASS** |
| 2 | `sitemap.xml` accessible | **PASS** |
| 3 | engines index accessible | **PASS** |
| 4 | no 404 on target 50 pages | **PASS** |
| 5 | deploy from clean `origin/main @ 8536a1d5` | **PASS** |
| 6 | no deploy from dirty feature worktree | **PASS** |
| 7 | no business code changes in this step | **PASS** |
| 8 | no TASK-009 scope entered | **PASS** |

## Known Follow-Up (Outside TASK-008 Close)

These items do **not** block TASK-008 closure but should be handled in a separate ops/deploy hygiene task:

1. **Nginx config drift** — reconcile `sites-enabled/asia-power.com` vs `sites-available/asia-power.com`, restore `asiapower_upload` zone in rate-limit conf or align vhost to commit `8536a1d5`.
2. **Deploy script completeness on `8536a1d5`** — several files referenced by `deploy-production.mjs` do not exist at this commit (`inventory-site.service`, `package.json`, some scripts). Full unified deploy finalize cannot complete cleanly from this commit alone.
3. **Worktree cleanup** (optional):

```bash
git -C /Users/longhui/Desktop/AsiaPower worktree remove /tmp/asiapower-task008-deploy --force
```

## Conclusion

```text
TASK-008 CLOSED
```

Reason: all TASK-008 production acceptance checks passed after deploy. The 50 Production-001 engine pages are live, indexable via dynamic sitemap, and return HTTP 200 with zero 404s on the target set.
