# OPS · 公开列表页对齐 v4 + 截图商品卡

**Status:** 已上线生产 · 验证通过  
**Date:** 2026-07-10  
**Task ID:** `v4-listing-sync`  
**Release ID:** `REL-20260710084449-chrome-76489479`

## 结论

| 项 | 结果 |
|----|------|
| 顶部 | 沿用现有 v4 浅色页头（`page-hero--catalog-v4`）+ chrome |
| 左边选区 | 截图风：图标分类、选中浅灰底、Brand checkbox + 数量 |
| 商品卡 | **强制同步截图**：左图右文、库存号、规格标签、出厂价、WA+获取报价 |
| 预览 | `docs/previews/v4-listing-sync/listing-v4-preview.html` |
| 生产 | **已部署** · CEO 批准「可以上线,做好测试」 |

## 列表页 URL（现网 / 本地）

| 页面 | URL |
|------|-----|
| 半截车目录 | https://asia-power.com/half-cuts/ |
| 引擎目录 | https://asia-power.com/engines/ |
| 变速箱 | https://asia-power.com/gearboxes/ |
| 卡车 | https://asia-power.com/trucks/ |
| 工程机械 | https://asia-power.com/machinery/ |
| 前截 | https://asia-power.com/front-cuts/ |
| 底盘件 | https://asia-power.com/chassis-parts/ |

## 改前 / 改后差异

| 区域 | 改前 | 改后（现网） |
|------|------|-------------|
| 标题区 | 深蓝横幅 → 已改浅色 v4 | 保持 v4 |
| 左边选区 | 纯文字链接 | 图标 + 选中浅灰圆角底 + Brand checkbox 行 |
| 商品卡 | 扁平列表行（无标签/无 CTA） | 白底大圆角卡：库存号、规格标签、出厂价、WhatsApp + 获取报价 |
| 出厂价徽章 | 灰蓝 EXW | 黄色「出厂价」(中文) / EXW (英文) |

## 交付物

```text
docs/previews/v4-listing-sync/
  listing-v4-preview.html
  prod-half-cuts-desktop.png
  prod-half-cuts-mobile.png
  prod-half-cuts-mobile-tall.png
  prod-engines-desktop.png
  prod-gearboxes-desktop.png
docs/ops/ops-v4-listing-sync.md
releases/REL-20260710084449-chrome-76489479/release.json
```

## 本次部署文件（仅 listing，未带 upload/about）

| 文件 | 说明 |
|------|------|
| `css/ebay-layout.css` | v4 商品卡 + 侧栏样式 |
| `js/half-cut-directory.js` | 列表行 HTML：标签 / 出厂价 / CTA |
| `js/ebay-catalog-hub.js` | 配件行同卡风；侧栏 Brand 同步 |
| `js/ebay-layout.js` | 侧栏图标 + Brand 区块 |
| `js/public-i18n.js` | `hc.exwBadge` / `hc.customDismantleShort` |
| `js/components.js` | cache `v4-listing-card-v1` |
| `half-cuts/` `engines/` `gearboxes/` `trucks/` `machinery/` `front-cuts/` `chassis-parts/` index | cache-bust |
| `half-cuts/` `trucks/` `machinery/` detail | chrome cache-bust |

**刻意未部署：** `supplier-portal.html`、`about.html`、国家页、`engines/*.html` SEO 单页（超出本次 listing 批准范围）。

`scripts/deploy-production.mjs` 的 `chrome` 目标已收窄为上述 listing 文件集。

## 上线记录

```bash
node scripts/deploy-production.mjs chrome --allow-dirty --yes
```

| 项 | 值 |
|----|-----|
| Release ID | `REL-20260710084449-chrome-76489479` |
| 备份 | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-084452.tar.gz` |
| 快照 | `/root/.openclaw/workspace/inventory-site/releases/REL-20260710084449-chrome-76489479/snapshots` |
| 本地 release.json | `releases/REL-20260710084449-chrome-76489479/release.json` |
| 服务 | nginx + inventory-site = active |

## 现网验证（2026-07-10）

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `/half-cuts/` 打开 | 成功 HTTP 200 | curl + 截图 |
| 商品卡横向左图右文 | 成功 | `prod-half-cuts-desktop.png`：库存号角标、规格标签、EXW、WhatsApp + Get Quote |
| 左边选区选中态 + Brand | 成功 | DOM：`ebay-sidebar--v4`、`is-active`、Brand 勾选行带数量 |
| 顶部 v4 页头无破版 | 成功 | 浅色 chrome + 搜索条正常 |
| `/engines/` 抽测 | 成功 | 侧栏 Engines 选中；配件卡 `ebay-listing-row--v4` + EXW（配件 CTA 为 Save/+Add，属 hub 设计） |
| `/gearboxes/` 抽测 | 成功 | Gearboxes 子模块选中；`ebay-listing-row--v4` + EXW |
| 窄屏 | 可接受 | 分类/Brand 堆叠正常；无整页破版（`prod-half-cuts-mobile.png`） |

## 回滚

```bash
RESTORE_CONFIRM=REL-20260710084449-chrome-76489479 node scripts/release-restore.mjs REL-20260710084449-chrome-76489479
```
