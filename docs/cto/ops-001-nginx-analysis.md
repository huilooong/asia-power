# OPS-001 — Nginx `asiapower_upload` Zone Analysis

Date: 2026-07-05 (UTC)

Task: OPS-001  
Scope: nginx configuration drift only  
Out of scope: business logic, SEO, engine pages  
Status: **analysis complete — awaiting approval before any fix**

---

## Executive Summary

Production nginx currently fails `nginx -t` with:

```text
nginx: [emerg] zero size shared memory zone "asiapower_upload"
```

The **active** vhost file (`/etc/nginx/sites-enabled/asia-power.com`) references a rate-limit zone named `asiapower_upload`, but the **active** zone definition file (`/etc/nginx/conf.d/asiapower-rate-limit.conf`) no longer defines that zone.

Nginx remains **running** because it has not successfully reloaded since the regression. Any future reload or restart will fail until the mismatch is resolved.

---

## Root Cause

### Primary cause (immediate trigger)

On **2026-07-05 03:28 UTC**, TASK-008 deploy (`origin/main @ 8536a1d5`) ran `scripts/deploy-production.mjs`, which:

1. **Overwrote** `/etc/nginx/conf.d/asiapower-rate-limit.conf` with the GitHub `main` version — **3 lines only** (API + login zones, **no** `asiapower_upload` zone).
2. **Overwrote** `/etc/nginx/sites-available/asia-power.com` with the same GitHub `main` version — upload routes use `asiapower_api`, **not** `asiapower_upload`.
3. **Did not update** `/etc/nginx/sites-enabled/asia-power.com` — nginx actually loads this file, not `sites-available`.
4. Remote finalize reached `nginx -t` → **failed** → `systemctl reload nginx` **never ran**.

Result: the file nginx **loads** still references `limit_req zone=asiapower_upload` (4 locations), but the zone **definition was deleted** from `conf.d`.

Nginx error semantics: referencing an undefined `limit_req_zone` produces `zero size shared memory zone "asiapower_upload"`.

### Structural cause (why drift was possible)

| Gap | Effect |
| --- | --- |
| `deploy-production.mjs` rsyncs only to `sites-available/`, not `sites-enabled/` | Production can run a different vhost than what deploy writes |
| `sites-enabled/asia-power.com` is a **regular file**, not a symlink | Manual or ad-hoc edits persist independently of deploy |
| Upload-zone nginx changes exist on **local `main`** but were **never pushed** to GitHub `origin/main` | Deploy from GitHub regresses rate-limit config while production vhost expects newer config |
| No post-deploy `nginx -t` gate before TASK-008 (deploy exited 1 but static files were already synced) | Broken nginx state left in place |

### Underlying cause (config version split)

Two nginx config versions exist in parallel:

| Version | Where | Upload rate limit |
| --- | --- | --- |
| **A — GitHub baseline** | `origin/main @ 8536a1d5` | Upload paths use `asiapower_api`; no dedicated upload zone |
| **B — Unpushed ops upgrade** | Local `main` commit `b59a44c5` (not on `origin/main`) | Dedicated `asiapower_upload` zone + vhost changes + WeCom callback + R2 resolver fixes |

Production **`sites-enabled`** matches **Version B** (updated 2026-07-02).  
Production **`rate-limit.conf`** was reset to **Version A** on 2026-07-05.

---

## Why Production Drifted from GitHub

### Timeline

| Date (UTC) | Event |
| --- | --- |
| 2026-06-30 | nginx last successfully started (`ActiveEnterTimestamp`) |
| 2026-07-01 | Server backup `asia-power.com.bak-wecom-202607011324` already contains `asiapower_upload` vhost refs |
| 2026-07-02 09:02 | `/etc/nginx/sites-enabled/asia-power.com` updated in place (380 lines, md5 `c852dc34…`) — **not** via deploy script symlink pattern |
| 2026-07-03 | Local commit `b59a44c5` adds upload zone + vhost changes to **local `main` only** — **not pushed** to GitHub |
| 2026-07-04 20:06 | `asiapower-trusted-upload-ips.map` updated (deploy finalize regenerates this when it runs) |
| 2026-07-05 03:28 | TASK-008 deploy from GitHub `8536a1d5` overwrites `sites-available` + `rate-limit.conf`; `sites-enabled` unchanged; `nginx -t` fails |

### Drift mechanisms

1. **Manual / partial production edits**  
   `sites-enabled` was updated directly on the server (Jul 2) with config aligned to unpushed local work — including upload zone references, WeCom callback, R2 `resolver` + variable `proxy_pass`, and `/api/half-cuts/submissions`.

2. **Unpushed repository commit**  
   Commit `b59a44c5` (`feat: sitemap, half-cuts SEO content…`) modified:
   - `deploy/nginx-rate-limit.conf` — added `asiapower_upload` zone + CF IP maps
   - `deploy/nginx-asia-power.com` — switched upload locations to `asiapower_upload`  
   Present on local `main` and `feature/apgrowth-audit-v01`, **absent from `origin/main`**.

3. **Deploy script blind spot**  
   ```text
   rsync → /etc/nginx/sites-available/asia-power.com   ✓
   rsync → /etc/nginx/conf.d/asiapower-rate-limit.conf ✓
   (nothing updates /etc/nginx/sites-enabled/asia-power.com)
   nginx includes: /etc/nginx/sites-enabled/*
   ```

4. **TASK-008 deploy source mismatch**  
   TASK-008 correctly deployed engine **static HTML** from GitHub `main`, but the same deploy pass also synced **older nginx configs** from GitHub, clobbering the upload zone definition while leaving the newer vhost active.

### Evidence summary

```text
md5 sites-enabled:  c852dc3432b24584e05a4cbbefd08360  (Jul  2 — active)
md5 sites-available: 575ea847b868a63814076ce946442cd2  (Jul  5 — not active)
rate-limit.conf:     216 bytes, 3 lines                 (Jul  5 — missing upload zone)
nginx -t:            FAIL
nginx process:       still active (stale in-memory config since Jun 30 reload path)
```

---

## Current Production Config

### Files nginx actually loads

| File | Role | State |
| --- | --- | --- |
| `/etc/nginx/sites-enabled/asia-power.com` | **Active vhost** | 380 lines, Jul 2, references `asiapower_upload` ×4 |
| `/etc/nginx/conf.d/asiapower-rate-limit.conf` | **Zone definitions** | 3 lines, Jul 5, **no** `asiapower_upload` |
| `/etc/nginx/conf.d/asiapower-trusted-upload-ips.map` | CEO IP bypass map for upload zone | Present (`154.161.36.176 ""`) |
| `/etc/nginx/sites-available/asia-power.com` | Deploy target (inactive) | 342 lines, Jul 5, uses `asiapower_api` for uploads |

### Active vhost — upload zone references

```nginx
location = /api/half-cuts/upload/presign {
    limit_req zone=asiapower_upload burst=60 nodelay;
    ...
}
location = /api/half-cuts/upload-token {
    limit_req zone=asiapower_upload burst=40 nodelay;
    ...
}
location ^~ /api/half-cuts/upload/ {
    limit_req zone=asiapower_upload burst=50 nodelay;
    ...
}
location = /api/half-cuts/submissions {
    limit_req zone=asiapower_upload burst=30 nodelay;
    ...
}
```

Also present in active vhost but **absent** from GitHub `sites-available` copy:

- `resolver 8.8.8.8 1.1.1.1 …` (R2 media proxy)
- `location = /wecom/callback` → `127.0.0.1:8791`
- Extended timeouts on `/api/half-cuts/state`

### Active rate-limit conf (broken)

```nginx
# AsiaPower — rate limit zones (include from nginx http { } via conf.d)
limit_req_zone $binary_remote_addr zone=asiapower_api:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=asiapower_login:10m rate=10r/m;
```

### `nginx -t` output (2026-07-05)

```text
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: [emerg] zero size shared memory zone "asiapower_upload"
nginx: configuration file /etc/nginx/nginx.conf test failed
```

---

## Repository Config

### GitHub `origin/main @ 8536a1d5` (deploy source for TASK-008)

**`deploy/nginx-rate-limit.conf`** — 3 lines, no upload zone:

```nginx
limit_req_zone $binary_remote_addr zone=asiapower_api:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=asiapower_login:10m rate=10r/m;
```

**`deploy/nginx-asia-power.com`** — upload paths use `asiapower_api`:

```nginx
location = /api/half-cuts/upload/presign {
    limit_req zone=asiapower_api burst=60 nodelay;
    ...
}
```

No `asiapower_upload` references. No `/wecom/callback`. No `/api/half-cuts/submissions`.

### Local `main` commit `b59a44c5` (NOT on GitHub)

**`deploy/nginx-rate-limit.conf`** — adds upload zone (matches production `sites-enabled` expectation):

```nginx
map $http_cf_connecting_ip $upload_client_ip { ... }
map $upload_client_ip $upload_rate_limit_key {
    default $binary_remote_addr;
    include /etc/nginx/conf.d/asiapower-trusted-upload-ips.map;
}
limit_req_zone $upload_rate_limit_key zone=asiapower_upload:10m rate=120r/m;
```

**`deploy/nginx-asia-power.com`** — upload paths use `asiapower_upload`; adds submissions + WeCom blocks.

```text
origin/main:  8536a1d5 — Version A (baseline)
local main:   a96730b9 — includes b59a44c5 — Version B (ops upgrade, unpushed)
```

### Deploy script behavior (`scripts/deploy-production.mjs`)

```javascript
rsync deploy/nginx-asia-power.com → /etc/nginx/sites-available/asia-power.com
rsync deploy/nginx-rate-limit.conf → /etc/nginx/conf.d/asiapower-rate-limit.conf
// remote: nginx -t && systemctl reload nginx
// does NOT touch sites-enabled
```

---

## Risk Assessment

| Risk | Severity | Current state |
| --- | --- | --- |
| **nginx reload/restart blocked** | **High** | `nginx -t` fails; config changes cannot be applied safely |
| **Silent config staleness** | **High** | Process running since Jun 30; operators may assume deploy updated nginx |
| **Future hard outage** | **High** | Server reboot or nginx crash → service may not come back up |
| **Upload rate-limit intent unclear** | Medium | Active vhost expects upload zone; zone undefined on disk — behavior depends on stale memory state |
| **QXB / supplier upload during incident** | Medium | Upload endpoints may lack intended rate-limit / CEO IP bypass until fixed |
| **WeCom callback routing** | Medium | Present only in `sites-enabled`; lost if someone copies `sites-available` → `sites-enabled` without review |
| **Repeat drift on next deploy** | **High** | Any deploy from GitHub `main` will re-clobber `rate-limit.conf` unless repo + deploy script are fixed |
| **Engine pages / SEO / business logic** | None | Not affected by this nginx issue directly |

---

## Recommended Fix

**Principle:** minimum change, no business/SEO/engine edits, restore nginx testability while preserving current production behavior.

### Recommended — Option 1 (minimal server hotfix, no repo change)

Restore the missing upload zone block in production `rate-limit.conf` only, matching local commit `b59a44c5` / current `sites-enabled` expectation.

**Proposed commands (DO NOT RUN until approved):**

```bash
# On server — backup first
cp /etc/nginx/conf.d/asiapower-rate-limit.conf \
   /etc/nginx/conf.d/asiapower-rate-limit.conf.bak-ops001-$(date -u +%Y%m%dT%H%M%SZ)

# Append upload zone block (14 lines from b59a44c5)
cat >> /etc/nginx/conf.d/asiapower-rate-limit.conf <<'EOF'

# Real client IP (Cloudflare CF-Connecting-IP or direct remote_addr)
map $http_cf_connecting_ip $upload_client_ip {
    ""      $remote_addr;
    default $http_cf_connecting_ip;
}

# Trusted CEO batch IPs → empty key (nginx skips rate-limit accounting)
map $upload_client_ip $upload_rate_limit_key {
    default $binary_remote_addr;
    include /etc/nginx/conf.d/asiapower-trusted-upload-ips.map;
}

limit_req_zone $upload_rate_limit_key zone=asiapower_upload:10m rate=120r/m;
EOF

nginx -t && systemctl reload nginx
```

**Why this is minimal:**

- Touches **one file** on the server.
- Does **not** change vhost, engine pages, SEO, or application code.
- Makes `nginx -t` pass while keeping the **currently active** `sites-enabled` behavior (upload limits, WeCom, R2 resolver fixes).
- `asiapower-trusted-upload-ips.map` already exists and is referenced.

**Follow-up (separate small ops commit — not part of immediate hotfix):**

1. Push nginx-only files from `b59a44c5` to GitHub `main` so repo matches production intent.
2. Update `deploy-production.mjs` to activate vhost after rsync, e.g.:

   ```bash
   cp /etc/nginx/sites-available/asia-power.com /etc/nginx/sites-enabled/asia-power.com
   # OR: ln -sf /etc/nginx/sites-available/asia-power.com /etc/nginx/sites-enabled/asia-power.com
   ```

   **Important:** only after GitHub contains Version B nginx files — otherwise next deploy will regress again.

### Alternative — Option 2 (align active vhost to GitHub, larger behavior change)

Copy GitHub baseline vhost into `sites-enabled`:

```bash
cp /etc/nginx/sites-available/asia-power.com /etc/nginx/sites-enabled/asia-power.com
nginx -t && systemctl reload nginx
```

**Pros:** Matches GitHub `8536a1d5`; passes `nginx -t` without adding upload zone.  
**Cons:** **Not recommended as minimal safe fix** — removes WeCom callback, submissions route, R2 resolver workaround, and upload-specific rate limits currently in production. Operational regression risk.

### Alternative — Option 3 (repo-first, then deploy)

1. Cherry-pick / merge nginx-only changes from `b59a44c5` to `origin/main`.
2. Fix deploy script `sites-enabled` sync.
3. Deploy from clean `origin/main`.

**Pros:** Permanent fix, eliminates drift class.  
**Cons:** Requires git commit + deploy approval; slightly larger change scope than Option 1 hotfix.

### Recommended path

| Step | Action | Approval |
| --- | --- | --- |
| 1 | **Option 1 hotfix** on server | **Awaiting CEO approval** |
| 2 | Push nginx-only alignment to GitHub + deploy script fix | Separate ops commit |
| 3 | Re-run `nginx -t` + `verify-production.mjs` after step 1 | Automatic |

---

## Rollback Plan

### If Option 1 hotfix is applied and causes problems

```bash
# Restore backed-up rate-limit conf
cp /etc/nginx/conf.d/asiapower-rate-limit.conf.bak-ops001-<timestamp> \
   /etc/nginx/conf.d/asiapower-rate-limit.conf

nginx -t && systemctl reload nginx
```

This returns to the **pre-hotfix broken state** (`nginx -t` fail, stale process) — use only if the appended block causes unexpected behavior and immediate revert is required before a better fix.

### If Option 2 (vhost rollback to GitHub) is applied and causes problems

```bash
# Restore Jul 2 active vhost
cp /etc/nginx/sites-enabled/asia-power.com \
   /etc/nginx/sites-enabled/asia-power.com.bak-ops001-before-option2  # taken before change

# Or restore from server backup copy:
cp /etc/nginx/sites-available/asia-power.com.bak-wecom-202607011324 \
   /etc/nginx/sites-enabled/asia-power.com

# Then apply Option 1 upload zone block if rate-limit still missing upload zone
nginx -t && systemctl reload nginx
```

### Full nginx rollback (worst case)

```bash
# Restore from known-good server backup file
cp /etc/nginx/sites-available/asia-power.com.bak-wecom-202607011324 \
   /etc/nginx/sites-enabled/asia-power.com

# Reconstruct rate-limit with upload zone (Option 1 append block)
nginx -t && systemctl reload nginx
```

Site static content rollback (if ever needed) is independent — see `deploy/SITE-HEALTH.md` and `deploy/inventory-site-scripts/RESTORE.md`.

---

## Verification Checklist (post-fix, after approval)

```bash
nginx -t                                    # must exit 0
systemctl is-active nginx                   # active
curl -sI https://asia-power.com/api/half-cuts/health | head -3
curl -sI https://asia-power.com/engines/g4fc.html | head -3   # TASK-008 page still 200
node scripts/verify-production.mjs          # from clean checkout
```

---

## Decision Required

**No fix has been applied.** OPS-001 is analysis-only until approved.

Recommended approval text:

```text
批准 OPS-001 Option 1（仅恢复 rate-limit.conf upload zone）
```

Optional follow-up approval (separate):

```text
批准 OPS-001 后续：推送 nginx 配置到 GitHub + 修复 deploy 脚本 sites-enabled 同步
```

---

## References

- TASK-008 deploy log: `docs/cto/task-008-deploy-execution.log`
- TASK-008 deploy final: `docs/cto/task-008-deploy-final.md`
- Local unpushed nginx commit: `b59a44c5`
- GitHub deploy baseline: `origin/main @ 8536a1d5`
- Deploy script: `scripts/deploy-production.mjs`
