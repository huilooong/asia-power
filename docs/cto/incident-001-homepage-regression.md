# INCIDENT-001 — Homepage Content Regression

Date: 2026-07-05 (UTC)

Priority: **P0**  
Mode: **READ ONLY** — no file modified, no commit, no push, no deploy

---

## Executive Summary

The homepage hero text **did regress on production**.

| When | What |
| --- | --- |
| **Before rollback** (prod backup `20260705-030001` @ 03:00 UTC) | New **mission hero** copy live |
| **Rollback** (TASK-008 deploy @ **03:28:19 UTC**) | Old **“Find What You Need / Ship Worldwide”** copy restored |
| **Root cause** | `deploy-production.mjs` **rsync** from clean worktree `8536a1d5` overwrote `public/index.html` (and related files) with **GitHub `origin/main` content** |

The updated hero text **was never committed to Git**. It exists today in:

- **Local working tree** (uncommitted)
- **Production backup** taken 28 minutes before TASK-008 deploy

It does **not** exist on GitHub `origin/main`.

---

## 1. Which Homepage Files Changed?

### Files directly controlling hero text

| File | Role | Changed in incident? |
| --- | --- | --- |
| `index.html` | Hero HTML structure + English default strings | **Yes — reverted on prod** |
| `js/public-i18n.js` | `home.missionEyebrow` / `home.missionTitle` / `home.missionLead` i18n | **Yes — reverted on prod** |
| `css/ebay-layout.css` | `.ebay-banner-mission__*` layout/typography | **No — survived on prod** (see §6) |
| `assets/images/hero-composite-ship-truck-machinery.png` | Hero image (same file) | **No content change** — only `alt` text in HTML changed |

### Supporting homepage files also reverted in same deploy

| File | Regression |
| --- | --- |
| `index.html` script block | Reverted JS includes/cache-bust params (see §4) |
| `about.html` | Reverted expanded “audiences by role” section |
| `half-cuts/index.html` | Reverted hreflang/canonical/CSS version tweaks |

### Not involved

- `js/home-hub.js` — md5 unchanged (backup = prod)
- JSON templates — hero text is inline HTML + i18n JS, not JSON
- Image binary metadata — unchanged

---

## 2. Local vs GitHub vs Production — Current Version

### Hero copy (English)

| Environment | Hero version | Evidence |
| --- | --- | --- |
| **Local** (working tree) | **NEW mission hero** | `index.html` md5 `ffc42826…` |
| **GitHub `origin/main`** | **OLD shop hero** | `8536a1d5:index.html` md5 `f3344cef…` |
| **Production (live now)** | **OLD shop hero** | matches GitHub md5 `f3344cef…` |
| **Production backup 03:00 UTC** | **NEW mission hero** | md5 `ffc42826…` = Local |

**NEW text (Local + pre-rollback prod):**

```text
Eyebrow:  Circular economy · Global export
Title:    Give every reusable asset a second life.
Lead:     AsiaPower is building industry infrastructure that connects global
          suppliers, buyers, data and AI — starting from automotive parts trade.
          We welcome customers, suppliers and partners to build a more efficient,
          transparent and trusted circular economy together.
```

**OLD text (GitHub + current prod):**

```text
Title:    Find What You Need. Ship Worldwide.
Sub:      Half-cuts, engines & truck parts — video verified, EXW pricing.
CTA:      Shop now →
Alt img:  Half-cuts, engines and truck parts — shipped worldwide
```

### i18n (Chinese mission strings)

Present in **Local** `js/public-i18n.js` (uncommitted):

```text
home.missionEyebrow: 循环经济 · 全球出口
home.missionTitle:   让每一件可循环利用的资产，都拥有第二次生命。
home.missionLead:    AsiaPower 正在从汽车零部件贸易出发，建设连接全球供应商、
                     采购商、数据与人工智能的行业基础设施…
```

**GitHub + current prod:** these keys **absent** (`missionTitle` grep count = 0).

### CSS mismatch on production (secondary defect)

| File | State |
| --- | --- |
| `css/ebay-layout.css` on prod | **NEW** mission banner CSS present (md5 `8d65aa9…`, mtime **01:19 UTC**) |
| `index.html` on prod | **OLD** HTML without mission classes |

→ Production currently has **style without matching markup** (rsync asymmetry).

---

## 3. When Did the Regression Happen?

### Regression timestamp

```text
2026-07-05 03:28:19 UTC
```

Evidence:

- `public/index.html` mtime on server: `2026-07-05 03:28:19`
- TASK-008 deploy log: rsync started `03:28:16`, `index.html` in transfer list
- Pre-deploy backup `asia-power-data-20260705-032853` created during same deploy finalize

### Which deployment / commit caused it

| Item | Value |
| --- | --- |
| Deploy | TASK-008 production deploy |
| Command | `node scripts/deploy-production.mjs root@159.65.86.24` |
| Source | Clean worktree `/tmp/asiapower-task008-deploy` @ **`8536a1d5`** |
| Commit message | `feat(seo): add repeatable engine page generator` |
| Mechanism step | `[deploy] syncing static site → public/` (rsync) |

**Not caused by:** git checkout on server, manual vim on server, or Cloudflare cache alone.

### Timeline today (Jul 5, evidence-based)

```text
01:19 UTC  css/ebay-layout.css updated on production (mission CSS)
           → prior rsync from local unpushed work (file NOT in 8536a1d5 tree)

~before 03:00 UTC  production homepage already had NEW mission hero
           → proven by scheduled backup content

03:00 UTC  backup asia-power-backup-20260705-030001.tar.gz
           → captures NEW hero (md5 matches Local)

03:28 UTC  TASK-008 deploy rsync from GitHub 8536a1d5
           → overwrites index.html, public-i18n.js, about.html, …
           → OLD hero restored

03:29 UTC  Live validation confirmed engines 50/50 (TASK-008 goal met)
           → homepage regression side-effect unreported
```

---

## 4. All Files Reverted Together (Not Only Homepage)

### Confirmed regressions (prod backup 03:00 → prod after 03:28)

MD5 comparison: backup `asia-power-backup-20260705-030001` vs current production.

| File | Backup (expected) | Prod (current) | Regressed? |
| --- | --- | --- | --- |
| `public/index.html` | `ffc42826…` | `f3344cef…` | **YES** |
| `public/js/public-i18n.js` | `d6f5028c…` | `d953a969…` | **YES** |
| `public/about.html` | `6d9575bc…` | `50958af8…` | **YES** |
| `public/half-cuts/index.html` | `db7b70f5…` | `ca38c0c2…` | **YES** |
| `public/css/ebay-layout.css` | `8d65aa9f…` | `8d65aa9f…` | No |
| `public/js/home-hub.js` | `eb589afc…` | `eb589afc…` | No |

### Same deploy batch (03:28:19 UTC)

**240 files** under `public/` share deploy timestamp (rsync batch from `8536a1d5`).

Includes all TASK-008 engine pages (**forward fix**, not regression), plus sitewide static files reverted to GitHub baseline.

### `index.html` script/include regressions (same deploy)

Production reverted from backup state:

| Item | Before (backup) | After (prod) |
| --- | --- | --- |
| `public-i18n.js` included | **Yes** (`halfcuts-subtitle-v1`) | **Removed** |
| `path-utils.js` | `halfcuts-subtitle-v1` | `passenger-engines-v1` |
| `seo.js` | `p3-seo-v1` | `merchant-schema-v1` |
| `trust-copy.js` | absent | **restored** |
| `home-hub.js` | `used-car-swap-v1` | `passenger-engines-cheap-v1` |
| `half-cut-directory.js` | `used-car-filter-v2` | `passenger-engines-v1` |
| `half-cut-inventory-store.js` | `catalog-perf-v2` | `catalog-perf-v1` |
| `engine-directory.js` | absent | **restored** |
| `contact-redact.js` / `gallery-lightbox.js` | absent | **restored** |

### Forward fixes in same deploy (NOT regressions)

- 50 TASK-008 engine pages (`engines/g4fc.html` etc.) — were **404**, now **200**
- Intended TASK-008 scope; unrelated to homepage copy

---

## 5. Regression Table

| File | Current Version (Production) | Expected Version | Regression Source |
| --- | --- | --- | --- |
| `public/index.html` | OLD shop hero (`8536a1d5`) | NEW mission hero (Local / 03:00 backup) | TASK-008 rsync @ 03:28 from `8536a1d5` |
| `public/js/public-i18n.js` | GitHub baseline (no mission keys) | Local with `home.mission*` keys | TASK-008 rsync @ 03:28 |
| `public/css/ebay-layout.css` | NEW mission CSS (Local) | NEW mission CSS | **Not regressed** — absent from `8536a1d5` rsync source, old file kept |
| `public/about.html` | GitHub `8536a1d5` (no audiences block) | Local expanded about page | TASK-008 rsync @ 03:28 |
| `public/half-cuts/index.html` | GitHub `8536a1d5` | Local hreflang/canonical version | TASK-008 rsync @ 03:28 |
| `public/index.html` JS includes | GitHub `8536a1d5` script set | Local script set (see §4) | TASK-008 rsync @ 03:28 |
| Hero image PNG | unchanged binary | unchanged | N/A |
| `engines/*.html` (×50) | TASK-008 pages live | TASK-008 pages live | **No regression** — intentional deploy |

---

## 6. What Caused the Rollback?

| Mechanism | Verdict | Evidence |
| --- | --- | --- |
| **`deploy-production.mjs`** | **YES — primary cause** | Deploy log line 17–18; script runs rsync of repo → `public/` |
| **`rsync`** | **YES — direct mechanism** | `rsync -av` overwrites matching files; `index.html` in transfer list |
| **`git checkout` on server** | **NO** | No git ops in deploy script for `public/` |
| **Manual overwrite on server** | **NO** for rollback | mtime + content match Mac rsync from `8536a1d5` worktree (uid 501 pattern) |
| **Cloudflare cache** | **Not primary** | Live curl matches on-disk `index.html` content |

### Why CSS survived but HTML did not

`8536a1d5` worktree contains:

- `index.html` ✓ → **overwrote** production
- `js/public-i18n.js` ✓ → **overwrote** production
- `css/ebay-layout.css` ✗ **not in commit** → rsync did not replace; production kept 01:19 UTC file

This explains the **HTML/CSS split** on production after incident.

### How NEW content reached production before rollback

Not committed to git. Evidence chain:

1. Local working tree has NEW content (uncommitted `M index.html`, `M js/public-i18n.js`, `M css/ebay-layout.css`)
2. Production backup @ 03:00 matches Local md5 exactly for `index.html` and `public-i18n.js`
3. `css/ebay-layout.css` on prod updated 01:19 UTC — consistent with earlier **local rsync/deploy** of unpushed work

Exact command for pre-03:28 update: **not logged** — most consistent with **`deploy-production.mjs` rsync from dirty local tree** (same script, different source commit/tree).

---

## 7. Recover Exact Pre-Rollback Text

### English hero (complete)

**Eyebrow:**

```text
Circular economy · Global export
```

**Title:**

```text
Give every reusable asset a second life.
```

**Lead:**

```text
AsiaPower is building industry infrastructure that connects global suppliers, buyers, data and AI — starting from automotive parts trade. We welcome customers, suppliers and partners to build a more efficient, transparent and trusted circular economy together.
```

**Half-Cuts section subtitle (also reverted in index.html):**

```text
Custom dismantling · Parts on demand
```

### Chinese i18n (from `js/public-i18n.js`)

```text
home.missionEyebrow: 循环经济 · 全球出口

home.missionTitle: 让每一件可循环利用的资产，都拥有第二次生命。

home.missionLead: AsiaPower 正在从汽车零部件贸易出发，建设连接全球供应商、采购商、
数据与人工智能的行业基础设施。我们欢迎客户、供应商和合作伙伴，与我们一起推动更
高效、更透明、更可信的循环经济。
```

(French/Arabic strings also present in same file under `home.mission*`.)

### Where to recover from

| Source | Available? | Notes |
| --- | --- | --- |
| **Local working tree** | **YES — complete** | `index.html`, `js/public-i18n.js`, `css/ebay-layout.css` |
| **Production backup** | **YES — complete for HTML/JS** | `backups/scheduled/asia-power-backup-20260705-030001.tar.gz` → `./public/index.html`, `./public/js/public-i18n.js` |
| **Git history** | **NO** | `git log -S "Give every reusable asset"` on `index.html` → **empty**; never committed |
| **GitHub** | **NO** | Only OLD hero on `origin/main` |

### OLD text (what production shows now — for contrast)

```text
Find What You Need.
Ship Worldwide.

Half-cuts, engines & truck parts — video verified, EXW pricing.

Shop now →
```

---

## 8. Causal Chain (Why This Happened)

```text
1. CEO / team updated homepage hero locally (uncommitted)
2. Earlier Jul 5 deploy/rsync pushed Local public/ files to production
   → mission hero live by 03:00 UTC (proven by backup)
3. TASK-008 required deploy from clean origin/main @ 8536a1d5
4. deploy-production.mjs rsyncs ENTIRE public/ tree from that commit
5. 8536a1d5 contains OLD index.html + OLD public-i18n.js
6. rsync overwrites production → homepage regression
7. ebay-layout.css NOT in 8536a1d5 → survives → HTML/CSS mismatch
```

**Process gap:** TASK-008 deploy succeeded for engines but had **no guard** excluding unrelated public files or detecting homepage downgrade vs pre-deploy backup.

---

## 9. Recommended Next Actions (do not execute — read-only report)

1. Restore homepage from Local or `asia-power-backup-20260705-030001.tar.gz` (not from GitHub).
2. Commit homepage changes to git before next deploy.
3. Split deploy: engine-only rsync vs full-site rsync.
4. Add pre-deploy diff check against production backup for `index.html` / `public-i18n.js`.

---

## Evidence Index

| Artifact | Path |
| --- | --- |
| TASK-008 deploy log | `docs/cto/task-008-deploy-execution.log` |
| Pre-rollback prod backup | Server: `backups/scheduled/asia-power-backup-20260705-030001.tar.gz` |
| Local uncommitted diff | `git diff HEAD -- index.html js/public-i18n.js css/ebay-layout.css` |
| OPS baseline context | `docs/cto/ops-002a-root-cause.md` |

Investigation completed: **2026-07-05 UTC**
