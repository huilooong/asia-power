# OPS-002 Baseline Audit

Date: 2026-07-05 (UTC)

Task: OPS-002 — Local / GitHub / Production Baseline Audit  
Mode: **read-only** — no fix, no commit, no push, no deploy

---

## 1. Executive Summary

**结论：三方不一致。没有单一可信基线。**

| 环境 | 当前定位 | 一致性 |
| --- | --- | --- |
| **GitHub `origin/main`** | `8536a1d5` — TASK-008 引擎页已入库；nginx/server 为较旧 Version A | 与本地分支 **分叉** |
| **本地仓库** | `feature/apgrowth-audit-v01` 脏工作区；含未推送 commit + 大量未提交/未跟踪改动 | 与 GitHub **分叉**；与生产 **部分重叠** |
| **生产服务器** | TASK-008 引擎页已上线；Node `server.js` 对齐 GitHub；nginx **分裂**；`lib/` 为历史累积超集 | 与 GitHub **部分一致**；nginx **broken** |

**最关键的不一致：**

1. **nginx 三层版本并存** — `sites-enabled`（生产在用，Version B+）≠ `sites-available`（GitHub 8536a1d5，Version A）≠ `rate-limit.conf`（GitHub 8536a1d5，缺 upload zone）→ `nginx -t` **FAIL**。
2. **Git 分支分叉** — GitHub 有 cherry-pick 的 `8536a1d5`；本地有原始 `2254764d` + 未推送的 `b59a44c5` / `a96730b9`，**不是同一条历史线**。
3. **`lib/` 生产超集** — GitHub 22 个文件；生产 53 个；rsync 只增不删，长期累积。
4. **本地 Node 代码比生产新** — 本地 `deploy/inventory-site-server.js` 70 KB；生产/GitHub 37 KB；生产仍在跑旧 server。

**哪边最新（按领域）：**

| 领域 | 最新来源 |
| --- | --- |
| TASK-008 引擎静态页 | GitHub = 生产（已部署） |
| nginx 实际行为 | **生产 `sites-enabled`**（含 resolver/R2/WeCom/upload zone） |
| nginx 磁盘可测试性 | **损坏**（rate-limit 被 TASK-008 deploy 回退） |
| Node API / server | **GitHub 8536a1d5**（生产匹配）；本地有更大未部署改动 |
| server/lib | **生产**（超集）；GitHub 最少 |
| APSales / growth / email | **仅本地**（大量 untracked）；生产 AsiaPower workspace 有部分 |

---

## 2. Local Repository State

### 当前分支

```text
feature/apgrowth-audit-v01
HEAD: 2254764d feat(seo): add repeatable engine page generator
```

### 分支 HEAD 对照

| 分支 | Commit | 说明 |
| --- | --- | --- |
| `HEAD` (feature) | `2254764d` | 原始 TASK-008 commit |
| `main` (local) | `a96730b9` | 比 origin 多 2 个未推送 commit |
| `origin/main` (GitHub) | `8536a1d5` | cherry-pick 版 TASK-008 |
| `feature/apgrowth-audit-v01` | `2254764d` | 与 HEAD 相同 |

### git status 摘要

```text
## feature/apgrowth-audit-v01
Modified tracked:  168 files
Untracked (??):    188 files
```

### git log --oneline -10 (HEAD)

```text
2254764d feat(seo): add repeatable engine page generator
1e55b88f docs: add scripts risk index
a96730b9 feat: gearboxes/machinery content, hreflang, HSTS+CSP, minified CSS
b59a44c5 feat: sitemap, half-cuts SEO content, lazy loading, canonicals, sw v2
3c0fc225 feat: Apple 极简主题全站升级 + SEO 优化（og:image、JSON-LD、静态内容）
af77b949 feat(agents): three-kingdoms display names + name aliases/routing
5c6779e3 docs(tools): APCOO bot now launchd-managed + voice-note support
fb4f3490 feat(coo): voice-note transcription + launchd auto-start for APCOO bot
73d99c6c fix(coo): make missing knowledge-runtime optional so dispatch survives
76e15bea docs(tools): correct Telegram bot identities
```

### local `main` 与 `origin/main` 差异

**local main 有、GitHub 没有（未推送）：**

```text
a96730b9 feat: gearboxes/machinery content, hreflang, HSTS+CSP, minified CSS
b59a44c5 feat: sitemap, half-cuts SEO content, lazy loading, canonicals, sw v2
```

**GitHub 有、local main 没有：**

```text
8536a1d5 feat(seo): add repeatable engine page generator
```

→ 本地 `main` 与 GitHub `main` **已分叉**，TASK-008 在两边是 **不同 commit**。

### `feature/apgrowth-audit-v01` 与 `origin/main` 差异

**feature 有、GitHub 没有：**

```text
2254764d feat(seo): add repeatable engine page generator
1e55b88f docs: add scripts risk index
a96730b9 feat: gearboxes/machinery content, hreflang, HSTS+CSP, minified CSS
b59a44c5 feat: sitemap, half-cuts SEO content, lazy loading, canonicals, sw v2
```

**GitHub 有、feature 没有：**

```text
8536a1d5 feat(seo): add repeatable engine page generator
```

### 未提交 modified 文件（按目录统计 Top 15）

| 目录 | 文件数 |
| --- | ---: |
| `brands/` | 53 |
| `customer_gateway/` | 48 |
| `scripts/` | 46 |
| `docs/` | 26 |
| `js/` | 17 |
| `server/` | 16 |
| `reports/` | 16 |
| `tests/` | 13 |
| `engines/` | 13 |
| `.venv-faces/` | 13 |
| `data/` | 12 |
| `config/` | 9 |
| `sales_core/` | 8 |
| `deploy/` | 6 |
| `css/` | 4 |

完整 modified 列表见工作区 `git status`（168 条）。

### untracked 文件（188 条，代表性类别）

| 类别 | 示例 |
| --- | --- |
| APSales / growth | `customer_gateway/growth_autopilot.py`, `scripts/apsales-*.py`, `config/apsales_*.yaml` |
| Email 出站/入站 | `customer_gateway/email_*.py`, `server/lib/email-*.js`, `deploy/cloudflare-email-worker.js` |
| Admin UI | `admin/apsales-progress.html`, `js/admin-apsales-progress.js` |
| CTO 文档 | `docs/cto/task-008-*.md`, `docs/cto/ops-001-*.md` |
| 工具/缓存 | `node_modules/`, `__pycache__/`, `.cursor/` |
| 运行产物 | `reports/*.csv`, `work/chassis-blur-preview/` |

### 大文件 / 缓存 / venv 风险

| 路径 | 大小 | 风险 |
| --- | --- | --- |
| `.venv-faces/` | 1.3 GB | 已跟踪 `.pyc` 修改；曾导致 2.10 GiB push 失败 |
| `.venv-qxb/` | 919 MB | 不应进 git |
| `.venv/` | 212 MB | 不应进 git |
| `node_modules/` | untracked | 不应 commit |
| 大量 `__pycache__/` | — | 污染 status；推送风险 |

---

## 3. GitHub Origin Main State

### origin/main commit

```text
8536a1d50c098491846e373d38c09fbc22a28fef
8536a1d5 feat(seo): add repeatable engine page generator
```

### 最近 10 个 commit

```text
8536a1d5 feat(seo): add repeatable engine page generator
3c0fc225 feat: Apple 极简主题全站升级 + SEO 优化（og:image、JSON-LD、静态内容）
af77b949 feat(agents): three-kingdoms display names + name aliases/routing
5c6779e3 docs(tools): APCOO bot now launchd-managed + voice-note support
fb4f3490 feat(coo): voice-note transcription + launchd auto-start for APCOO bot
73d99c6c fix(coo): make missing knowledge-runtime optional so dispatch survives
76e15bea docs(tools): correct Telegram bot identities
290344c7 fix(deploy): exclude Python backend from public web root
b814ddf7 feat(coo): CEO-gated approval loop for L3/L4 intents
b2336cd4 fix(truth): widen BI guard + add timeout/CLI so data questions never hallucinate
```

### TASK-008 commit 是否存在

**是。** `8536a1d5` 在 `origin/main` 上，且为当前 HEAD。

- `engines/` HTML：**63** 个文件（含 50 个 Production-001 新 slug + 旧 slug + index）
- `scripts/generate-engine-pages.mjs`：存在

### GitHub 是否包含 nginx Version B

**否。**

| 检查项 | origin/main |
| --- | --- |
| `deploy/nginx-rate-limit.conf` 含 `asiapower_upload` | **0** |
| `deploy/nginx-asia-power.com` 含 `asiapower_upload` | **0** |
| `/wecom/callback` | **无** |
| `/api/half-cuts/submissions` | **无** |
| R2 `resolver` + variable `proxy_pass` | **无** |

GitHub 为 **Version A**（upload 走 `asiapower_api`）。

### GitHub 是否包含 deploy 脚本当前需要的文件

| 文件 | origin/main | deploy 脚本是否引用 |
| --- | --- | --- |
| `deploy/inventory-site-server.js` | **有** | 是 → `server.js` |
| `deploy/inventory-site.service` | **无** | 是 → systemd |
| `package.json` | **无** | 是 → 生产 npm install |
| `package-lock.json` | **无** | 是 |
| `scripts/setup-r2-cors.mjs` | **无** | 是 |
| `scripts/telegram-memory-watch.js` | **无** | 是 |
| `scripts/deploy-production.mjs` | **有**（205 行，较旧） | — |

→ 从 GitHub `8536a1d5` 跑完整 deploy **必然 rsync 失败/跳过** 多个文件；与 TASK-008 deploy 日志一致。

### GitHub `server/lib/` 文件数

**22** 个顶层条目（含 `vin/` 目录）。

---

## 4. Production Server State

路径根：`/root/.openclaw/workspace/inventory-site`

### public/

| 指标 | 值 |
| --- | ---: |
| 总文件数 | 1273 |
| HTML 文件数 | 404 |
| `engines/*.html` | **63** |
| 静态 `sitemap.xml` | **不存在**（动态 `/sitemap.xml` 由 Node 提供） |

TASK-008 引擎页（如 `g4fc.html`）**已存在**。

### lib/

| 指标 | 值 |
| --- | ---: |
| 文件数 | **53** |
| 对比 GitHub | +31 个额外文件（rsync 累积 + 历史手工部署） |

### server.js

| 项 | 值 |
| --- | --- |
| 路径 | `/root/.openclaw/workspace/inventory-site/server.js` |
| 大小 | 37,051 bytes |
| mtime | 2026-07-05 03:28 UTC |
| md5 | `7808eccad00d76210ec64fe930025a68` |
| 与 GitHub `8536a1d5` | **一致** |
| 与本地 feature `deploy/inventory-site-server.js` | **不一致**（本地 70,263 bytes） |

### nginx

| 文件 | 行数 | md5 | 状态 |
| --- | ---: | --- | --- |
| `sites-enabled/asia-power.com` (**active**) | 380 | `c852dc34…` | 含 upload zone / WeCom / resolver |
| `sites-available/asia-power.com` | 342 | `575ea847…` | = GitHub Version A |
| 两者一致？ | — | — | **否** |
| `conf.d/asiapower-rate-limit.conf` | 3 行 | `8e2894db…` | = GitHub；**无 upload zone** |

**`nginx -t`：FAIL**

```text
nginx: [emerg] zero size shared memory zone "asiapower_upload"
```

**nginx 进程：active**（自 2026-06-30 起未成功 reload）

### rate-limit.conf 摘要

```nginx
limit_req_zone $binary_remote_addr zone=asiapower_api:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=asiapower_login:10m rate=10r/m;
```

### systemd

| 项 | 值 |
| --- | --- |
| `/etc/systemd/system/inventory-site.service` | **存在**（587 bytes，2026-07-03） |
| 仓库中对应文件 | **不存在** |
| `inventory-site.service` 状态 | **active** |
| `nginx.service` 状态 | **active** |

### package.json（生产）

存在，md5 `c935eaca…`，与**本地** `package.json` 一致；**不在 GitHub**。

### deploy 脚本实际引用路径（生产 AsiaPower 工作区副本）

```text
/root/.openclaw/workspace/AsiaPower/scripts/deploy-production.mjs
→ rsync 到 root@159.65.86.24:/root/.openclaw/workspace/inventory-site/public/
→ server.js ← deploy/inventory-site-server.js
→ lib/ ← server/lib/
→ nginx → /etc/nginx/sites-available/asia-power.com  (不更新 sites-enabled)
```

---

## 5. Three-Way Diff

| File / Area | Local | GitHub | Production | Which looks newest | Risk |
| --- | --- | --- | --- | --- | --- |
| **nginx vhost (active)** | Version B (`d4e87170`); 372 行; upload+WeCom+submissions | Version A; 342 行; 无 upload zone | Version B+ (`c852dc34`); 380 行; +resolver/R2 变量 | **Production sites-enabled** | **P0** — 与 rate-limit 不匹配；`nginx -t` fail |
| **nginx sites-available** | Version B (uncommitted path same as main) | Version A = prod available | Version A (8536a1d5 deploy) | GitHub = prod available | Deploy 写了但 **不生效** |
| **rate-limit.conf** | Version B (696 B, upload zone) | Version A (216 B) | Version A (216 B) | **Local** (intended) | **P0** — 缺 zone 定义 |
| **deploy script** | 274 行 (+75 vs GitHub) | 205 行 | 旧副本在 prod AsiaPower workspace | **Local** | 引用缺失文件；不 sync sites-enabled |
| **systemd service** | **缺失** | **缺失** | **存在** (Jul 3) | **Production-only** | 下次 deploy 无法 reproducible |
| **package.json** | 存在 | **缺失** | 存在 (= local) | Local = Prod | GitHub deploy 不完整 |
| **server.js** | 70 KB (modified) | 37 KB | 37 KB (= GitHub) | **Local** (undeployed) | 生产跑旧 server；本地 API 改动未上线 |
| **lib/** | 41 files | 22 files | **53 files** (superset) | **Production** (accumulated) | 漂移；难以知何者生效 |
| **public/** | 脏；engines 63 | engines 63 | 1273 files; engines 63 | **Prod static** for engines | 大量非 git 路径 |
| **engines/** | 63 + 13 modified | 63 committed | 63 live, HTTP 200 | **GitHub = Prod** | TASK-008 **已对齐** |
| **sitemap** | dynamic `sitemap.js` (+1 line uncommitted) | dynamic; scans engines | dynamic; md5 = GitHub | GitHub = Prod | 静态 sitemap 故意不部署 |
| **half-cuts upload routes** | nginx B in git | nginx A (api zone) | nginx B+ in sites-enabled | **Production** | rate-limit 未跟上 |
| **WeCom callback** | in local nginx git | **absent** | in sites-enabled | **Prod = Local git** | 不在 GitHub |
| **R2 media resolver** | **absent** in local git | **absent** | in sites-enabled only | **Production-only** | 未回收进 git |
| **Search Console / sitemap logic** | local `sitemap.js` uncommitted diff | baseline | = GitHub md5 | GitHub = Prod | minor |
| **APSales growth** | extensive untracked | **absent** | partial on prod AsiaPower | **Local** | 范围外但占工作区 |
| **data/ uploads/** | excluded from deploy | excluded | 32M data + 25M uploads | **Production-only** | 正常运行时数据 |

### MD5 关键对照

| 文件 | Local | GitHub | Production |
| --- | --- | --- | --- |
| `nginx-asia-power.com` (repo/enabled) | `d4e87170` | `575ea847` (available) | enabled: `c852dc34` |
| `nginx-rate-limit.conf` | `41fb41fc` | `8e2894db` | `8e2894db` |
| `server.js` | `0426e13b` (local) | `7808ecc` | `7808ecc` |
| `sitemap.js` | `a5ab6592` | `f0f12666` | `f0f12666` |
| `package.json` | `c935eaca` | — | `c935eaca` |

---

## 6. Production-Only Changes

### 只存在于服务器、不在 GitHub 的内容

| 内容 | 位置 | 判断 |
| --- | --- | --- |
| **nginx `sites-enabled` 完整内容** | `/etc/nginx/sites-enabled/asia-power.com` | **有价值** — 实际生效配置；含 resolver/R2/WeCom/upload |
| **R2 resolver + variable proxy_pass** | sites-enabled 第 31–32, 191–208 行 | **有价值** — 修复 R2 媒体代理；**应回收进 GitHub** |
| **nginx 备份 5 份** | `/etc/nginx/sites-available/asia-power.com.bak-*` | 运维快照；可归档参考 |
| **`lib/` 额外 31+ 文件** | `inventory-site/lib/` | **混合** — 多数与本地 untracked 重叠；应清单化后选择性入库 |
| **`half-cut-api.js.bak-rate-limit-*`** | lib/ | **应废弃** |
| **`system-metrics.js`, `promote-approved-media.mjs` 等** | lib/ | 需人工判定；可能为一次性补丁 |
| **`package.json` + node_modules** | inventory-site 根 | **有价值** — deploy 依赖；**应入库** |
| **`inventory-site.service`** | `/etc/systemd/system/` | **有价值** — **应入库** |
| **`data/`, `uploads/`** | inventory-site | 运行时数据；**不应进 git** |
| **AsiaPower workspace growth 脚本** | `/root/.openclaw/workspace/AsiaPower/` | 来自历史 deploy；与本地 untracked 部分对应 |

### 回收建议

| 应回收进 GitHub | 应废弃 |
| --- | --- |
| sites-enabled 中 resolver/R2 段落 | `.bak` 备份文件（保留服务器即可） |
| systemd unit 文件 | lib 中 `.bak` 文件 |
| package.json | 陈旧 one-off patch（确认后删） |
| 经审计后的 lib 增量 | — |

---

## 7. Local-Only Changes

### 只存在于本地、未进 GitHub 的内容

#### 已 commit 但未 push

| Commit | 内容 | 建议 |
| --- | --- | --- |
| `b59a44c5` | nginx Version B、half-cuts SEO、sitemap、sw v2 | **应 cherry-pick**（nginx + SEO 基础设施） |
| `a96730b9` | gearboxes/machinery、hreflang、HSTS+CSP、minified CSS | **应 cherry-pick**（站点增强） |
| `2254764d` | 原始 TASK-008 | **勿重复** — GitHub 已有等价 `8536a1d5` |
| `1e55b88f` | docs risk index | 可选 cherry-pick |

#### 未提交 modified（168 文件）

代表性高价值区域：

- `deploy/inventory-site-server.js`, `server/lib/*` — Node API 增强（**比生产新**）
- `scripts/deploy-production.mjs` — 扩展 deploy（**比 GitHub 新**）
- `customer_gateway/*`, `sales_core/*` — APSales / 子敬 / email（**新功能，非 TASK-008**）
- `engines/*.html` (13 modified) — 旧 slug 页本地改动

#### untracked（188 文件）

- 整个 APSales growth / email / social 自动化栈
- CTO 文档、reports、work/ 预览
- `node_modules/`, `__pycache__/`

### 判断

| 类别 | cherry-pick? | 丢弃? |
| --- | --- | --- |
| nginx Version B (`b59a44c5`) | **是** | — |
| deploy + systemd + package.json 补齐 | **是** | — |
| server/lib 增量（email, prerender, chassis-blur） | **选择性是** | 需逐项 review |
| APSales growth 全栈 | 单独 TASK | 勿混入 recovery |
| `.venv*`, `__pycache__`, `node_modules` | — | **是**（gitignore） |
| 2254764d vs 8536a1d5 重复 TASK-008 | — | 用 GitHub 版为准 |

---

## 8. GitHub-Only Changes

### GitHub 有、生产尚未完全吸收的内容

| 内容 | 是否已部署 | 状态 |
| --- | --- | --- |
| TASK-008 50 引擎页 | **是** | 63 engines live, 50/50 HTTP 200 |
| `server.js` @ 8536a1d5 | **是** | md5 匹配 |
| `sitemap.js` @ 8536a1d5 | **是** | md5 匹配 |
| nginx Version A → `sites-available` | **是** | 写了但不 active |
| nginx Version A → `rate-limit.conf` | **是** | **造成 regression** |
| 旧版 deploy 脚本 (205 行) | 部分 | prod workspace 可能有旧副本 |

### GitHub 有、本地分支没有的内容

| 内容 | 说明 |
| --- | --- |
| `8536a1d5` | cherry-pick TASK-008；本地用 `2254764d` 代替 |

### 风险

| 项 | 风险 |
| --- | --- |
| 再次从 GitHub deploy | 会 **再次覆盖** rate-limit 为 Version A |
| GitHub 缺 package.json / systemd | 完整 deploy **不可复现** |
| GitHub nginx Version A | 与生产 active vhost **不兼容** |

---

## 9. Risk Ranking

### P0 — 立即处理

1. **`nginx -t` FAIL** — 无法安全 reload；重启即可能宕机。
2. **sites-enabled vs rate-limit 分裂** — upload zone 引用无定义（OPS-001 已分析）。
3. **deploy 从 GitHub 必然部分失败** — 缺 systemd/package.json/多个 scripts；且会加剧 nginx 漂移。

### P1 — 本周处理

4. **Git 三分叉** — `origin/main` / local main / feature 各走各路；TASK-008 双 commit。
5. **server.js 本地 vs 生产** — 本地 70 KB 改动未部署；行为未知差异。
6. **lib/ 生产超集 53 files** — 无权威清单；rollback 困难。
7. **sites-enabled 不随 deploy 更新** — 结构性漂移根因。

### P2 —  hygiene

8. **168 modified + 188 untracked** — 含 venv pyc、node_modules。
9. **生产 nginx 备份分散** — 5 个 `.bak` 文件无命名规范。
10. **AsiaPower workspace 与 inventory-site 双轨** — growth 脚本来源不清。

---

## 10. Recommended Recovery Plan

**不执行 — 仅方案。**

### 短期生产基线应取哪一边？

| 层 | 建议基线 | 理由 |
| --- | --- | --- |
| **静态引擎页** | GitHub `8536a1d5` (= 当前生产) | 已验证 50/50 live |
| **nginx 行为** | **生产 `sites-enabled` 内容** | 实际在跑；含 R2/WeCom/upload |
| **rate-limit** | **本地 `b59a44c5` 的 upload zone 块** | 修复 `nginx -t`；匹配 sites-enabled |
| **Node server** | **暂保持生产现网** (`8536a1d5` 37 KB) | 已稳定；本地 70 KB 需单独 review 再升 |
| **lib/** | **生产现网清单** | 冻结清单后再与 git 对齐 |

### 哪些服务器变更应回收进 GitHub？

1. `sites-enabled` 全文（或 merge 进 `deploy/nginx-asia-power.com`），**必须包含**：
   - resolver + R2 variable proxy（生产独有）
   - upload zone 路由（已在 local `b59a44c5`）
   - WeCom callback
2. `deploy/nginx-rate-limit.conf` Version B（local `b59a44c5`）
3. `/etc/systemd/system/inventory-site.service` → `deploy/inventory-site.service`
4. `package.json`（已在 local + prod）
5. 经审计的 `server/lib/` 增量（email, prerender, r2-storage 等）

### 哪些本地 commit 应 cherry-pick？

| 优先级 | Commit | 内容 |
| --- | --- | --- |
| 1 | `b59a44c5` | nginx B + SEO/sitemap 基础 |
| 2 | 生产 sites-enabled 独有段落 | resolver/R2（作为新 commit，非 cherry-pick） |
| 3 | `a96730b9` | hreflang/HSTS/gearboxes（与 TASK-009 边界需确认） |
| — | `2254764d` | **跳过** — 用 GitHub `8536a1d5` |
| — | APSales untracked 全栈 | **单独 TASK**，不混入 OPS recovery |

### 哪些内容应明确丢弃？

- `.venv*` / `__pycache__` / `node_modules` 的 git 跟踪
- `lib/half-cut-api.js.bak-*` on production
- 重复 TASK-008 commit `2254764d`（以 `8536a1d5` 为准）
- feature 脏工作区作为 deploy 源（已证实危险）

### 是否需要新建 clean branch 做 recovery？

**是。**

建议：

```text
ops/recovery-baseline-20260705
  ← fork from origin/main @ 8536a1d5
  ← cherry-pick b59a44c5 (nginx only, 或 split commit)
  ← add production-only resolver/R2 from sites-enabled
  ← add inventory-site.service + package.json from prod/local
  ← fix deploy-production.mjs: sync sites-enabled + fail if nginx -t fails
```

### 先修 nginx，还是先做 repo recovery？

**先修 nginx（OPS-001 Option 1）→ 再 repo recovery。**

| 顺序 | 动作 | 原因 |
| --- | --- | --- |
| **1** | 服务器 hotfix：恢复 `rate-limit.conf` upload zone | 解除 P0；5 分钟；不改 git |
| **2** | clean branch recovery | 把 prod/local/nginx 真相写回 GitHub |
| **3** | 扩展 deploy 脚本 | 防止再次 drift |
| **4** | 评审本地 70 KB server.js | 单独 deploy window |

---

## 11. Next Approved Action

**Recommended next action:**

Approve **OPS-001 Option 1** (restore `asiapower_upload` zone in production `rate-limit.conf` only), then create **`ops/recovery-baseline-20260705`** from `origin/main @ 8536a1d5` and open a **nginx-only PR** that merges:

- local `b59a44c5` rate-limit + vhost upload routes
- production-only `resolver` / R2 variable proxy from `sites-enabled`
- `deploy/inventory-site.service` + `package.json`
- deploy script fix to sync `sites-enabled` after `sites-available`

**Do not execute until approved.**

---

## Appendix A — Production lib files not in GitHub origin/main

```text
analytics-internal-ips.js
catalog-list-prerender.js
chassis-blur.js
cif-shipping.js
contact-redact.js
data-intake-log.js
email-mailbox.js
email-outbound.js
email-proxy.js
half-cut-api.js.bak-rate-limit-20260629-235133
half-cut-list-prerender.js
half-cut-title.js
half-cut-vehicle-title-i18n.js
inventory-catalog-seo.js
lead-context.js
machinery-brand-catalog.js
media-optimize.js
phone-utils.js
powertrain-catalog-memory.js
powertrain-labels.js
promote-approved-media.mjs
r2-storage.js
static-powertrain-catalog.js
system-metrics.js
truck-brand-catalog.js
```

## Appendix B — Local lib files not in GitHub origin/main

（与 Appendix A 高度重叠，除生产独有 backup/legacy 文件外）

## Appendix C — Audit commands used

```bash
git fetch origin main
git status / git log / git diff across branches
ssh root@159.65.86.24 — read-only file counts, md5, nginx -t, systemctl
md5 / diff of nginx, server.js, sitemap.js, package.json
comm diff of server/lib file lists
```

Audit completed: **2026-07-05 03:43 UTC**
