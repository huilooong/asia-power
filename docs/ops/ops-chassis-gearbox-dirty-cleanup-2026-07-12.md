# OPS · 底盘空页修复 + 套装变速箱镜像 + 三端脏区清理

**日期：** 2026-07-12  
**状态：** 已完成现网验证  
**Release：** `REL-20260712160052-categories-64133ee16`  
**Commit：** `64133ee16`（已 push `origin/chore/backfill-2026-07-10-prod`）

## 结论

| 项 | 结果 |
|---|---|
| 底盘页 | **成功**：由 0 → **1 results**，浏览器可见 HC250488 |
| 变速箱镜像 | **成功**：新增 HC250567–HC250570；福特变速箱 5 → **9**；全站变速箱 427 → **431** |
| 发动机套装 | **保留**：HC250556/557/558/561 仍在发动机类目 |
| 纯发动机 | **未伪装**：HC250559/560/562/563/564 未进变速箱 |
| 三端脏区 | **已扫描并清理安全项**；大块未跟踪内容保留待 CEO 决定 |
| 下一步 | 可选：是否永久删除 quarantine；是否合并/清理本地 `claude/*` worktree |

## 一、先看再改（取证）

### 改前

| URL | 证据 | 数字 |
|---|---|---:|
| https://asia-power.com/chassis-parts/ | `docs/ops/evidence/chassis-before-ceo-task-20260712.png` | **0 results** |
| https://asia-power.com/gearboxes/?brand=ford | `docs/ops/evidence/gearboxes-ford-before-ceo-task-20260712.png` | **5 results**（含 HC250565） |

### 根因（有 URL/数字）

1. **底盘空页不是 HC250488 丢了。** 公开 API 仍有该条（`passengerPartType=front`，`includedParts` 含 “remaining rear/chassis portion”）。
2. 生产磁盘上的 `half-cut-directory.js` 已含 `hasChassisCatalogEvidence()`，但目录 HTML 仍挂 `?v=category-filter-v1`。
3. Cloudflare 对 `https://asia-power.com/js/half-cut-directory.js?v=category-filter-v1` 返回 **immutable HIT**，内容仍是旧规则：

```js
if (category === 'chassis') return partType === 'chassis';
```

因此 front + 底盘证据的 HC250488 被挡掉。  
首页曾被 patch 成 v2，但后续 chrome 发布用本地仍写 v1 的 HTML 覆盖了目录页，缓存键回退。

## 二、底盘修复

| 动作 | 说明 |
|---|---|
| 缓存键 | 全目录 + 首页升到 `category-filter-v3` |
| Release Manager | `categories` 目标；干净 worktree；**未用** `--allow-dirty` |
| 备份 | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260712-160054.tar.gz` |
| 回滚 | `RESTORE_CONFIRM=REL-20260712160052-categories-64133ee16 node scripts/release-restore.mjs REL-20260712160052-categories-64133ee16` |

### 改后验证

| 检查 | 结果 |
|---|---|
| CDN `?v=category-filter-v3` | 含 `hasChassisCatalogEvidence`；`cf-cache-status=HIT`，`age: 0` |
| `node scripts/verify-category-filter.mjs` | 通过；chassis=1（仅 HC250488） |
| 浏览器截图 | `docs/ops/evidence/chassis-after-fix-20260712.png` → **1 results / HC250488** |

## 三、套装变速箱镜像挂牌

规则（CEO）：成套动力总成 = 发动机类目挂套装 + 变速箱类目再挂对应变速箱。

| 新 stockId | 镜像自 | 型号 | 挡位 | 数量 | 价格 | 类目 |
|---|---|---|---|---:|---:|---|
| HC250567 | HC250556 | CAF372WQ 1.0T | Manual | 24 | USD 441 | transmission only |
| HC250568 | HC250557 | CAF384Q 1.5L | Automatic | 47 | USD 441 | transmission only |
| HC250569 | HC250558 | CAF384Q 1.5L | Manual | 18 | USD 441 | transmission only |
| HC250570 | HC250561 | CAF488WQ 2.0T | Automatic | 17 | USD 441 | transmission only |

保留：HC250565（独立自动变速箱 33 台）。  
未镜像：HC250559/560/562/563/564（纯发动机）。

| 项 | 路径/结果 |
|---|---|
| 脚本 | `scripts/mirror-ford-kit-transmissions-2026-07-12.mjs` |
| 生产备份 | `data/backups/ford-kit-transmission-mirror-2026-07-12T15-59-02-608Z/` |
| 照片 | Ford×AsiaPower 双品牌占位图 |
| 卖点 | Low mileage · nearly new condition |
| 福特变速箱页 | 5 → **9 results** |
| 全站变速箱 | 427 → **431** |
| 截图 | `docs/ops/evidence/gearboxes-ford-after-mirror-20260712.png` |
| 单条搜索 | `docs/ops/evidence/gearboxes-kit-mirrors-search-20260712.png`（HC250567） |

类目互斥回归：套装仍仅 engine；镜像仅 gearboxes；均不进 halfcuts/frontcuts/chassis。

## 四、三端脏区：清单 → 已清理 / 保留 / 需 CEO 决定

### A. 生产服务器 `root@159.65.86.24`

| 发现 | 处理 |
|---|---|
| `public-old-2026-06-16-1711`（旧站点树） | **已隔离** → quarantine |
| `tmp-half-cut-api.js`、`server.js.bak-20260617123521`、`Users/` | **已隔离** |
| 重复全量备份 `…160001`、`…152643`（失败/近重复门禁备份） | **已隔离**（保留成功备份 `…160054`） |
| `tmp/video-compress`（54M 旧压缩草稿） | **已隔离** |
| `data/*.json.bak`、业务 `data/backups/*`、Release snapshots | **保留**（回滚需要） |
| nginx | **正常**（`nginx -t` ok；sites-enabled 仅 asia-power.com + default） |
| 业务库存 JSON | **未删** |

隔离目录（可恢复）：  
`/root/.openclaw/workspace/inventory-site/backups/quarantine-dirty-cleanup-20260712T160353Z/`

**需 CEO 决定：** quarantine 满约 1.1G 后是否永久删除；今日其余全量 tar（约 3×500MB+）是否只留最近 2 份。

### B. GitHub

| 检查 | 结果 |
|---|---|
| 本任务 commit | `64133ee16` 已 push |
| 远端分支 | `main`、`chore/backfill-2026-07-10-prod`、`fix/public-sales-email-20260712` |
| 本任务密钥 | HEAD 无硬编码密钥；命中仅为 deploy 脚本对环境变量名的检查 |
| 未合并垃圾远端分支 | **无明显垃圾远端**；无 open PR |
| 本地临时 deploy 分支 | **已删**（见下） |

**需 CEO 决定：** 是否保留/合并远端 `fix/public-sales-email-20260712`。

### C. 本地仓库

| 类别 | 处理 |
|---|---|
| 过期 `/tmp/asiapower-*` worktree（约 11 个） | **已 remove + prune** |
| 本地 deploy/codex 临时分支 | **已删** |
| 当前仍有 worktree | 主仓 + `.claude/worktrees/nostalgic-kalam-c979ec`（**保留，需 CEO 决定**） |
| 本任务相关已提交 | cache key / mirror script / verify |
| 其余脏区 | **未乱删**（见分类） |

本地脏区分类（未提交，约 145 modified + 102 untracked）：

| 类型 | 示例 | 建议 |
|---|---|---|
| 应后续单独提交 | `js/login.js`、`css/login.css`、供应商注册反馈等 | 按任务分批 commit |
| 应保留说明/证据 | `docs/ops/*`、今日 evidence 截图、MEMORY | 保留；本报告一并入库 |
| 明确可清理但未动 | `tmp/photo-compress-samples`（11M）、本地 `node_modules/`（若可重建） | 可清；未自动删 |
| 大块未跟踪（需 CEO） | `docs/social-content/` 174M、`docs/tiktok/` 31M、`data/qxb-*` 样本图 | **勿自动删** |
| 字典/品牌页大批改动 | `brands/*.html`、`engines/*.html`、`data/knowledge-base/*dictionary*` | 另开任务核对后再提交 |

## 五、交付路径

```text
docs/ops/ops-chassis-gearbox-dirty-cleanup-2026-07-12.md
docs/ops/evidence/chassis-before-ceo-task-20260712.png
docs/ops/evidence/chassis-after-fix-20260712.png
docs/ops/evidence/gearboxes-ford-before-ceo-task-20260712.png
docs/ops/evidence/gearboxes-ford-after-mirror-20260712.png
docs/ops/evidence/gearboxes-kit-mirrors-search-20260712.png
scripts/mirror-ford-kit-transmissions-2026-07-12.mjs
```

绝对工作区：`/Users/longhui/Desktop/AsiaPower`

## Files Added/Modified

- Added `scripts/mirror-ford-kit-transmissions-2026-07-12.mjs`
- Modified catalog HTML cache keys → `category-filter-v3`
- Modified `scripts/deploy-production.mjs`、`scripts/verify-category-filter.mjs`
- Production data: +4 transmission mirrors（有备份）
- Docs/memory：本报告与当日流水

## Validation 摘要

| 成功 | 失败 | 下一步 |
|---|---|---|
| 底盘 1 条可见 | 无阻断失败 | CEO 是否永久删 quarantine |
| 镜像 4 条 + HC250565 在变速箱 | — | 大块本地未跟踪内容是否归档 |
| Release + push 合规 | 首次脏树门禁失败（预期），改干净 worktree 后通过 | 可选清理远端 sales-email 分支 |
