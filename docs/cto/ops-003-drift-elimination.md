# OPS-003 — Eliminate Configuration Drift

Date: 2026-07-05 (UTC)  
Priority: **P0**  
Mode: **Engineering analysis only** — no fixes applied  
Scope: Infrastructure consistency (excludes business copy / SEO / engine page content changes)

Related: [OPS-002 Baseline](./ops-002-baseline-audit.md) · [OPS-002A Root Cause](./ops-002a-root-cause.md) · [OPS-001 Nginx](./ops-001-nginx-analysis.md) · [INCIDENT-003 Restore](./incident-003-restore-report.md)

---

## 1. Executive Summary

**结论：`Production == Local == GitHub` 不成立，且短期内不可能自动成立。**

| Question | Answer |
| --- | --- |
| Are all three environments identical? | **No** |
| Is there a single trusted baseline today? | **No** — three partial truths coexist |
| Is public static content aligned after INCIDENT-003? | **Production == Local** (restored); **both ≠ GitHub `8536a1d5`** for marketing/UX files until committed |
| Is engineering infra aligned? | **No** — nginx split, `server.js`/`lib/` fork, missing repo artifacts, unpushed commits |
| Biggest active risk | **`nginx -t` FAIL** — reload/restart blocked; upload zone undefined |

This document classifies **every remaining drift category**, explains **why** it exists, and proposes **permanent** pipeline and repo changes. **No remediation was executed in OPS-003.**

---

## 2. Task 1 — Verification: Production == Local == GitHub

### 2.1 Git topology (root cause of all drift)

| Ref | Commit | Role |
| --- | --- | --- |
| **GitHub `origin/main`** | `8536a1d5` | What TASK-008 deployed from; oldest nginx/server baseline in this chain |
| **Local `main`** | `a96730b9` | **+2 unpushed commits** (`b59a44c5`, `a96730b9`) with nginx upload zone + public UX |
| **Local `feature/apgrowth-audit-v01` HEAD** | `2254764d` | TASK-008 original commit + **168 modified + 206 untracked** files |
| **Production Node** | `8536a1d5` `server.js` md5 | Active API entrypoint |
| **Production `public/`** | Post INCIDENT-003 | Matches **Local working tree**, not GitHub |

```text
origin/main (8536a1d5)  ←── TASK-008 deploy source
       ↑ cherry-pick fork (different SHA)
local main (a96730b9)   ←── unpushed nginx + UX commits
       ↑
feature/apgrowth-audit-v01 (2254764d + dirty tree)
       ↑
Production public/      ←── restored from backup = Local (Jul 5 04:13 UTC)
Production server.js    ←── still GitHub 8536a1d5
Production nginx        ←── hybrid (see §4)
```

**Branch divergence counts:**

| Comparison | Ahead (left) | Ahead (right) |
| --- | ---: | ---: |
| `origin/main` vs local `main` | 1 (`8536a1d5`) | 2 (`b59a44c5`, `a96730b9`) |
| `origin/main` vs feature HEAD | 1 | 4 |

Until Git history is reconciled and pushed, **three-way equality is impossible by definition.**

### 2.2 Post–INCIDENT-003 public static (out of fix scope, required for honesty)

After INCIDENT-003, **Production MD5 == Local MD5** for restored site content (verified on key paths). **GitHub `8536a1d5` remains stale** for the same paths.

Sample (engineering-adjacent public assets — not hero copy):

| File | Production | Local | GitHub `8536a1d5` | P=L? | L=G? |
| --- | --- | --- | --- | --- | --- |
| `js/config.js` | `7a7aeb56…` | same | `3ee26659…` | ✅ | ❌ |
| `css/styles.css` | `e7ec5fbd…` | same | `063ddb0f…` | ✅ | ❌ |
| `sw.js` | `ca32f476…` | same | `7bf18012…` | ✅ | ❌ |
| `robots.txt` | `a031a2a3…` | same | `d88915c9…` | ✅ | ❌ |

**Classification:** Expected transient state until a **content recovery commit** lands on `main`. Not engineering drift per se, but it **blocks** the global `P=L=G` goal.

### 2.3 Engineering-scoped files — summary

| Domain | Production | Local | GitHub | P=L=G? |
| --- | --- | --- | --- | --- |
| **`server.js`** | `7808ecca…` (37 KB) | `0426e13b…` (70 KB) | `7808ecca…` | ❌ (P=G, L ahead) |
| **`server/lib/`** | 52 files | 47 files | 27 files | ❌ |
| **`deploy/nginx-asia-power.com`** | `575ea847…` (sites-**available**) | `d4e87170…` | `575ea847…` | ❌ (3+ versions) |
| **nginx active vhost** | `c852dc34…` (sites-**enabled**) | — | — | ❌ (manual prod) |
| **`deploy/nginx-rate-limit.conf`** | `8e2894db…` (conf.d) | `41fb41fc…` | `8e2894db…` | ❌ (P=G, L ahead; breaks enabled vhost) |
| **`deploy/nginx-security.conf`** | `eac167b3…` | `eac167b3…` | `7411da27…` | ❌ (P=L≠G) |
| **`scripts/deploy-production.mjs`** | not on prod site | `e66b56dd…` | `10433aa0…` | ❌ (L≠G, not deployed) |
| **`package.json`** | `c935eaca…` | `c935eaca…` | *empty at 8536a1d5* | ❌ (P=L, not in GitHub) |
| **`inventory-site.service`** | `c350cc67…` on systemd | **missing from repo** | **missing** | ❌ |
| **`.env.example`** | in `public/` post-restore | `68a129e8…` | `142be563…` | ❌ (P=L≠G after restore) |

---

## 3. Task 2 — Remaining Differences by Classification

### 3.1 Classification legend

| Class | Meaning | Action in roadmap |
| --- | --- | --- |
| **Expected** | Should differ by design | Document + automate generation |
| **Runtime generated** | Created on server by app/deploy/cron | Exclude from Git; backup instead |
| **Environment specific** | Secrets / prod-only paths | Template + secret store; never rsync `.env` |
| **Configuration drift** | Should match Git but doesn't | **Eliminate** — repo + deploy fix |
| **Unknown** | Mechanism not fully proven | Investigate once; then reclassify |

### 3.2 Configuration drift (must eliminate)

| # | Item | P | L | G | Why it drifted |
| --- | --- | --- | --- | --- | --- |
| D1 | **Git branch fork** | partial 8536a1d5 | dirty + unpushed | 8536a1d5 | Cherry-pick vs feature branch; UX/nginx commits never pushed |
| D2 | **`server.js` size/content** | 37 KB | 70 KB | 37 KB | Local API work unpushed; prod never got local `deploy/inventory-site-server.js` |
| D3 | **`lib/` superset** | 52 | 47 | 27 | `rsync lib/` append-only; orphan modules; unpushed files |
| D4 | **nginx `sites-enabled` vs `sites-available`** | **different files** | local template | available=G | Deploy writes `sites-available` only; Jul 2 manual edit to `sites-enabled` |
| D5 | **nginx rate-limit vs enabled vhost** | zone **missing** | has `asiapower_upload` | no upload zone | TASK-008 overwrote conf.d; enabled vhost still references upload zone → **`nginx -t` FAIL** |
| D6 | **`inventory-site.service` missing from repo** | exists | **missing** | **missing** | Never committed; deploy script references non-existent path |
| D7 | **`package.json` missing from GitHub** | exists | exists | **missing** | Added locally/prod; never pushed to `origin/main` |
| D8 | **`deploy-production.mjs` evolves locally** | n/a | newer | older | Script not versioned on server; deploys from ad-hoc worktrees |
| D9 | **Full-tree `public/` rsync** | restored L | dirty L | stale G | Single rsync overwrites verified prod content (INCIDENT-001–003 root) |
| D10 | **`lib/` orphans** | 5 prod files not in L or G | — | — | Historical deploys (`machinery-brand-catalog.js`, etc.) |

### 3.3 Environment specific (keep separate from Git equality)

| # | Item | Notes |
| --- | --- | --- |
| E1 | **`/root/.openclaw/workspace/inventory-site/.env`** | 37 keys; secrets — must never be in Git |
| E2 | **`AsiaPower` workspace on prod** | Separate tree for APSales Python; synced by deploy finalize |
| E3 | **`/root/.openclaw/workspace/inventory-site/data/`** | Live JSON/DB state |
| E4 | **`uploads/`** | User media |
| E5 | **Trusted upload IP map** | Regenerated from `.env` on deploy (`asiapower-trusted-upload-ips.map`) |
| E6 | **Production `node_modules/`** | From `npm install` on server |

### 3.4 Runtime generated (exclude from P=L=G checks)

| # | Item | Producer |
| --- | --- | --- |
| R1 | `public/supplier-portal/upload-key.js` | Deploy finalize writes from `SUPPLIER_UPLOAD_KEY` |
| R2 | `backups/scheduled/*.tar.gz` | Cron 03:00 UTC |
| R3 | `public/sitemap.xml` | Deleted on deploy; regenerated by app/cron |
| R4 | Log files under `/var/log/asiapower-*` | cron scripts |
| R5 | Crontab entries | `deploy-production.mjs` finalize |
| R6 | `.bak-*` files under `lib/` | Manual hotfix backups on prod |

### 3.5 Expected (temporary or intentional)

| # | Item | Until when |
| --- | --- | --- |
| X1 | **Public marketing files P=L≠G** | Until recovery commit merges INCIDENT-003 content to `main` |
| X2 | **50 engine slug pages** | P=L=G at `8536a1d5` for those files only; coexists with legacy engine HTML |
| X3 | **Cloudflare cache lag** | Minutes after deploy unless purge runs |
| X4 | **Local untracked APSales modules** | Until merged or moved to separate repo |

### 3.6 Unknown → resolved recommendations

| # | Item | Status |
| --- | --- | --- |
| U1 | Exact operator of Jul 2 `sites-enabled` edit | **Partially unknown** — mtime + uid 501; likely manual rsync/vim from Mac |
| U2 | Whether all 5 prod-only `lib/` files are imported | **Needs import trace** — treat as drift until proven dead |

---

## 4. Task 3 — Deep Dive Outside `public/`

### 4.1 nginx (highest severity)

**Four files, four generations:**

| File on disk | md5 (short) | Lines | Upload zone refs | nginx includes |
| --- | --- | ---: | ---: | --- |
| **`sites-enabled/asia-power.com`** (ACTIVE) | `c852dc34` | 380 | **4× `asiapower_upload`** | ✅ loaded |
| **`sites-available/asia-power.com`** (deploy target) | `575ea847` | 342 | 0 | ❌ not loaded |
| **`conf.d/asiapower-rate-limit.conf`** | `8e2894db` | 3 | **0 zones defined** | ✅ loaded |
| **Local `deploy/nginx-asia-power.com`** | `d4e87170` | 372 | has upload zone | repo intent |
| **Local `deploy/nginx-rate-limit.conf`** | `41fb41fc` | — | defines `asiapower_upload` | repo intent |

**Current test:**

```text
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: [emerg] zero size shared memory zone "asiapower_upload"
nginx: configuration file /etc/nginx/nginx.conf test failed
```

**Why:** Deploy script (line 94–95) rsyncs **GitHub Version A** into `sites-available` + `conf.d`, but nginx loads **`sites-enabled` Version B+**. Process still running since **2026-06-30** — reload never succeeded after Jul 5 TASK-008.

**Classification:** **Configuration drift** (D4, D5) + **Expected** stale in-memory nginx until fixed.

### 4.2 `server.js`

| | Bytes | md5 | Notes |
| --- | ---: | --- | --- |
| Production | 37,051 | `7808ecca…` | Active |
| GitHub `8536a1d5` | 37,051 | `7808ecca…` | Match |
| Local `deploy/inventory-site-server.js` | 70,263 | `0426e13b…` | +33 KB unpushed API work |

**Why:** Production follows last successful **GitHub-based** deploy. Local continued API development (email, analytics, half-cut, VIN) without production deploy.

**Classification:** **Configuration drift** (D2).

### 4.3 `lib/` (52 production files)

| Bucket | Count | Meaning |
| --- | ---: | --- |
| Aligned all three | 13 | Safe baseline |
| Prod = GitHub, Local ahead | 14 | Local edits not deployed (or deployed then reverted on server.js alone) |
| Prod = Local, not in GitHub | 20 | Shared unpushed modules |
| Prod only, not in GitHub | 5 | Orphan / legacy |
| GitHub only, missing on prod | 0 | — |

**Prod-only files (investigate / merge or delete):**

- `machinery-brand-catalog.js`
- `powertrain-labels.js`
- `promote-approved-media.mjs`
- `static-powertrain-catalog.js`
- `system-metrics.js`

**Why:** `deploy-production.mjs` line 50: `rsync server/lib/ → prod lib/` **without `--delete`**. Older deploys accumulate files; shrinking `server.js` does not remove unused modules.

**Classification:** **Configuration drift** (D3, D10).

### 4.4 systemd

| | Production | Local repo | GitHub |
| --- | --- | --- | --- |
| `/etc/systemd/system/inventory-site.service` | **exists** md5 `c350cc67…` | **file missing** | **missing** |
| Deploy script reference | rsync line 51 | **path does not exist** → TASK-008 rsync error | — |

**Active unit highlights:** `MemoryMax=768M`, `EnvironmentFile=-.../.env`, `ASIAPOWER_ROOT=.../AsiaPower`.

**Why:** Unit was created manually or from an older uncommitted deploy artifact; never added to `deploy/`.

**Classification:** **Configuration drift** (D6).

### 4.5 Package files

| File | Production | Local | GitHub `8536a1d5` |
| --- | --- | --- | --- |
| `package.json` | present | **same md5** | **not in tree** |
| `package-lock.json` | likely present | local | not in tree |
| `node_modules/` | present | local dev | n/a |

**Why:** npm dependencies (`@aws-sdk/client-s3`, `sharp`) added for media/R2 on server; never committed to GitHub.

**Classification:** **Configuration drift** (D7) for Git; **Runtime generated** for `node_modules/`.

### 4.6 Deploy script & pipeline artifacts

**Local `scripts/deploy-production.mjs` vs GitHub:** materially different (post–TASK-008 hardening, APSales rsync, Cloudflare purge, crontab management).

**Not present on production server** as a canonical copy — deploys run from developer Mac/worktree.

**Dangerous default behavior:**

```javascript
// line 44-45: entire repo → public/ (minus excludes)
rsync(ROOT, `${SITE}/public/`);
```

This is the **proven mechanism** for INCIDENT-001–003 regressions.

**Classification:** **Configuration drift** (D8, D9).

### 4.7 Environment configuration

| Artifact | Class | Notes |
| --- | --- | --- |
| `.env` | Environment specific | Secrets — 37 keys on prod |
| `.env.example` | Drift after INCIDENT-003 | P=L≠G — template should be committed once |
| `public/supplier-portal/upload-key.js` | Runtime generated | 195 bytes; from deploy finalize |
| `asiapower-trusted-upload-ips.map` | Runtime generated | Last updated Jul 4 20:06 |

---

## 5. Task 4 — Why Each Drift Exists (Causal Chain)

| Drift | Root cause chain |
| --- | --- |
| **Branch fork** | TASK-008 cherry-picked to GitHub without merging local `main` commits → two incompatible histories |
| **Public regression** | Deploy required clean GitHub tree while prod held unpushed Local rsync → full `public/` overwrite |
| **nginx split** | (1) Deploy never updates `sites-enabled`; (2) manual prod edit Jul 2; (3) unpushed nginx commits only on Local |
| **rate-limit break** | TASK-008 synced GitHub Version A conf.d while enabled vhost expects Version B upload zone |
| **server.js frozen** | No Local deploy of 70 KB server since GitHub deploy; API work stays local |
| **lib/ bloat** | Append-only rsync + no import audit + no `--delete` |
| **Missing service/package in Git** | Deploy script grew faster than repo commits |
| **Prod AsiaPower workspace** | By design — Python autopilot lives adjacent to Node site |
| **P=L≠G public** | INCIDENT-003 restored prod from backup; GitHub never received that content |

---

## 6. Task 5 — Permanent Solution by Category

### 6.1 Configuration drift → eliminate

| ID | Permanent solution |
| --- | --- |
| D1 | **Reconcile Git:** merge feature + local `main` + INCIDENT-003 public recovery into one `main`; force-push only after CEO approval; tag `baseline-2026-07-05` |
| D2 | Deploy **`server.js` from Git only** after merge; add CI `node --check` + smoke tests |
| D3–D10 | **`lib/` rsync with `--delete`** after verifying `require()` graph; delete prod orphans; commit all 52 used modules |
| D4–D5 | **Single nginx truth:** commit Version B+ to `deploy/`; replace `sites-enabled` with **symlink** to `sites-available`; include upload zone in same PR |
| D6 | Add **`deploy/inventory-site.service`** to repo (copy from prod md5 `c350cc67…`) |
| D7 | Commit **`package.json` + lockfile**; document `npm install --omit=dev` in deploy |
| D8 | Tag deploy script versions; run deploy **only from CI or tagged release**, not dirty worktrees |
| D9 | **Remove blind full-site rsync** — see §7 |

### 6.2 Environment specific → formalize

| ID | Permanent solution |
| --- | --- |
| E1 | Keep `.env` on server only; maintain **`deploy/.env.production.template`** (keys, no values) in Git |
| E2 | Document **`AsiaPower` workspace** boundary in `deploy/ARCHITECTURE.md`; separate deploy job `deploy-apsales.mjs` |
| E3–E4 | Backups + R2 sync (already cron); never rsync `data/`/`uploads/` from laptop |
| E5 | Treat IP map as **generated**; source of truth = `.env` key + deploy script |

### 6.3 Runtime generated → automate & exclude

| ID | Permanent solution |
| --- | --- |
| R1 | Add `upload-key.js` to `.gitignore` on prod path; regenerate every deploy (already done) |
| R2–R6 | Manifest of generated paths excluded from drift checks in `scripts/verify-drift.mjs` |

### 6.4 Expected → time-bound

| ID | Permanent solution |
| --- | --- |
| X1 | **Recovery PR** for public content → closes P=L≠G for static site |
| X2 | Engine URL policy doc: legacy slugs vs generator slugs; sitemap generator owns canonical set |
| X3 | Require Cloudflare purge step (already in deploy finalize when tokens set) |

---

## 7. Task 6 — Deployment Pipeline Recommendations

**Goal:** Future deploys **cannot** overwrite verified production content or split nginx again.

### 7.1 Split deploy targets (replace monolith)

| Target | Paths | When |
| --- | --- | --- |
| `deploy --target=engines` | `engines/<slug>.html` only + sitemap regen | SEO generator releases |
| `deploy --target=api` | `server.js`, `server/lib/` | API changes |
| `deploy --target=nginx` | `deploy/nginx-*`, symlink enable, **`nginx -t` gate** | Infra changes |
| `deploy --target=static-manifest` | Explicit file list or hash manifest | UX/content after Git merge |
| `deploy --target=apsales` | `AsiaPower/` workspace paths | Growth automation |

**Remove** default `rsync(ROOT → public/)` or gate behind `--force-public-full` + CEO flag.

### 7.2 Pre-deploy gates (hard fail)

1. **`git status --porcelain` empty** OR explicit release tag
2. **`HEAD == origin/main`** (or approved release SHA)
3. **`node scripts/verify-drift.mjs --pre-deploy`** — engineering files match
4. **Fresh backup** (already in script — keep)
5. **`nginx -t` before any rsync** — move test **before** file copy (today it runs after static rsync)

### 7.3 Post-deploy gates (hard fail)

1. Existing `test-critical-paths.mjs`
2. `verify-production.mjs`
3. **New:** `verify-content-manifest.mjs` — hero hash, engine 50/50, no regression vs tagged manifest
4. **`nginx -t && reload`** only after all pass

### 7.4 nginx hardening

```text
sites-enabled/asia-power.com  →  symlink → sites-available/asia-power.com
deploy updates sites-available only
rate-limit.conf + vhost updated in same atomic commit
```

### 7.5 Content protection manifest

After INCIDENT-003 recovery commit:

```json
{
  "protected_hashes": {
    "index.html": "ffc428263bccf09630d07b27c082e7af",
    "js/public-i18n.js": "d6f5028c972e1011aba25c3f10e76bbc"
  }
}
```

Deploy aborts if rsync would change protected hashes unless `--override-content`.

### 7.6 Drift monitoring (ongoing)

Weekly cron or CI job:

```bash
node scripts/verify-drift.mjs --compare production,local,github
```

Report classes §3.1; alert on new **Configuration drift** rows.

---

## 8. Recommended Execution Order (Roadmap, Not OPS-003)

| Phase | Work | Closes |
| --- | --- | --- |
| **P0** | nginx symlink + upload zone commit + `nginx -t` fix | D4, D5, OPS-001 |
| **P0** | Commit `inventory-site.service`, `package.json`, recovery public content | D6, D7, X1 |
| **P1** | Merge API `server.js` + `lib/` cleanup with `--delete` deploy | D2, D3, D10 |
| **P1** | Refactor `deploy-production.mjs` targets + gates | D8, D9, §7 |
| **P2** | `verify-drift.mjs` + weekly report | Ongoing |

---

## 9. Artifacts

| File | Purpose |
| --- | --- |
| [`.ops003-engineering-drift.json`](./.ops003-engineering-drift.json) | Focus-path drift rows |
| [`.ops003-lib-drift.json`](./.ops003-lib-drift.json) | `lib/` comparison |
| [OPS-002 baseline](./ops-002-baseline-audit.md) | Pre-INCIDENT-003 three-way audit |
| [OPS-002A root cause](./ops-002a-root-cause.md) | Deploy/nginx failure mode analysis |

---

## 10. Status

| Item | Status |
| --- | --- |
| OPS-003 analysis | **Complete** |
| Drift elimination fixes | **Not started** (by design) |
| Production engineering state | **Unchanged** during this task |
| nginx `nginx -t` | **Still FAIL** (upload zone) |

**Bottom line:** Eliminating drift requires **one reconciled Git baseline** + **split, gated deploys** + **nginx symlink discipline**. Public content is **P=L** again after INCIDENT-003, but **GitHub remains stale** until a recovery merge — that merge is the first step of the engineering roadmap, not a separate incident.
