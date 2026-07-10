# OPS — 详情页功能缺失（WhatsApp / 分享 / 询价）事故修复

**Task ID:** `ops-detail-cta-missing-incident`  
**Date:** 2026-07-10  
**Status:** **Production hotfixed**  
**Severity:** High — 详情页只剩「Contact Sourcing Team」，WhatsApp / Facebook / 询价条等看似「消失」

## 结论（先看这个）

| 项 | 内容 |
|----|------|
| 改了什么（近期） | 丢图修复改了详情预渲染 + `half-cut-detail.js` 强制拉全量图；零件借图只改列表；v4 tokens 只改样式 |
| 缺了什么 | 客户端重绘崩溃 → 卡在残缺预渲染：无 WhatsApp、无 Facebook 分享、无询价条；`?id=HC25xxxx` 整页空白 |
| 根因 | `half-cut-detail.js` 调用 `u.productImages()`，但 `HalfCutUtils` **未导出**该函数 → `TypeError` → 保留只有 Contact 的服务端预渲染 |
| 已修 | 导出 `productImages`；OG 图失败不挡 CTA；`?id=` 可用；预渲染也补上 WA/FB |

## Production deploy

| Item | Value |
|------|-------|
| Chrome Release | `REL-20260710094820-chrome-76489479` |
| API Release | `REL-20260710094704-api-76489479` |
| Backup (chrome) | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-094822.tar.gz` |
| Backup (api) | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-094707.tar.gz` |

## 近期相关改动（给 CEO）

| 改动项 | Release | 影响详情页？ | 说明 |
|--------|---------|--------------|------|
| 丢图修复 | `REL-20260710093446-api` + `REL-20260710093620-chrome` | 是（图库） | 预渲染改用全量 item；强制 fetch `/public/item`；图从 4→15 |
| 零件借图隐藏 | `REL-20260710093613-chrome` | **否**（列表） | 只改 engines 等**列表**不借半切图；详情页逻辑未改 |
| 详情 v4 色字 | 更早 chrome | 外观 | 字体/颜色；布局与按钮结构未删 |
| 本事故热修 | `REL-…094820-chrome` + `REL-…094704-api` | 是（CTA） | 修 JS 崩溃 + 预渲染补按钮 |

## 功能缺失清单（修复前 → 后）

| 功能 | 修复前 | 修复后 |
|------|--------|--------|
| 图库 | 15 张（丢图修复后已好） | 15 |
| 规格 / 价格 / CIF | 有（预渲染） | 有 |
| Contact Sourcing Team | 有 | 有 |
| WhatsApp | **无** | **有** |
| Share on Facebook | **无** | **有** |
| 询价条（Inquiry CTA） | **无** | **有** |
| 语言切换 | 顶栏有 | 有 |
| 视频 | 本条无视频数据 | 有视频才显示（正常） |
| `?id=HC250552` | **空白页** | **正常打开** |

## 证据

Puppeteer 现网（修复后）：

- `actions`: Contact Sourcing Team / Share on Facebook / WhatsApp  
- `photos`: 15  
- `errors`: 无 `[HalfCutDetail] render failed`  
- 修复前 console：`TypeError: u.productImages is not a function`（连续 3 次）

## 修复文件

| 文件 | 改动 |
|------|------|
| `js/half-cut-directory.js` | `HalfCutUtils` 导出 `productImages` |
| `js/half-cut-detail.js` | `?id=` 识别；OG 图 try/catch，不挡整页渲染 |
| `half-cuts\|trucks\|machinery/detail.html` | cache-bust `detail-cta-fix-v1` |
| `server/lib/half-cut-seo.js` | 预渲染 buy-box 补 Facebook + WhatsApp |
| `scripts/deploy-production.mjs` | chrome 校验含 productImages / id / cache-bust |

## 验证 URL

- https://asia-power.com/half-cuts/detail.html?slug=volkswagen-2011-cdl-half-cut-hc250552  
- https://asia-power.com/half-cuts/detail.html?id=HC250552  

## 规则（以后禁止）

- 详情页新增 `HalfCutUtils.xxx` 调用时，**必须同时导出**；否则整页 CTA 会静默回退到残缺预渲染  
- 服务端预渲染 buy-box **不得**只留 Contact；至少与客户端一致含 WhatsApp / 分享  
- 公开链接允许 `slug` / `stockId` / `id` 三种查询参数  
