# OPS · Parts catalog placeholder images

**Task ID:** `parts-placeholder`  
**Date:** 2026-07-10  
**Status:** Deployed  
**Release:** `REL-20260710102752-chrome-76489479`

## Problem (CEO)

发动机 / 变速箱 / 底盘 / 前切列表：无专门上传真图时只剩空洞相机图标，不好看。仍不要用半切借图冒充。

## Fix

| 情况 | 显示 |
|---|---|
| 专门上传真图 | 真图 · contain（沿用 parts-photo 规则） |
| 无真图 · engine | `supply-engines.webp` + Photos on request 角标 |
| 无真图 · gearbox | `supply-gearbox.webp` + 角标 |
| 无真图 · chassis | `supply-chassis.webp` + 角标 |
| 无真图 · front | `parts-placeholder.svg` + 角标 |

## Validation (live)

| 检查 | 结果 |
|---|---|
| 占位 SVG / 品类 webp | HTTP 200 |
| JS/CSS `parts-placeholder-v1` | HTTP 200 · 含 `partsCatalogPlaceholderSrc` |
| HC250550/548/547 前切 | 真图（dedicated） |
| HC250552 发动机/前切列表 | 占位（半切不借图） |
| 未改库存数据 | 仅 chrome 展示层 |

## Deploy

| 项 | 值 |
|---|---|
| Release ID | `REL-20260710102752-chrome-76489479` |
| Backup | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-102755.tar.gz` |
| Target | `chrome`（未改公开主页大改版；未碰库存 JSON） |

## Files

| Path | Change |
|---|---|
| `assets/images/parts-placeholder.svg` | 品牌占位 SVG |
| `js/half-cut-directory.js` | `partsCatalogPlaceholderSrc` + 列表占位 |
| `js/half-cut-detail.js` | 配件详情无图占位 |
| `css/ebay-layout.css` | `.photo--parts-ph` / badge |
| `js/components.js` | layout ver `parts-placeholder-v1` |
| catalog/detail `index.html` | cache bust |
| `scripts/deploy-production.mjs` | 同步 SVG + 校验 |

## Preview

`docs/previews/parts-placeholder/parts-placeholder-preview.html`

## Rule

占位图仅在「按规则应显示但确实无图」时用。列表必须 **规则半切 + 单独上传并行**（见 `ops-parts-parallel-listing-2026-07-10.md`）。改 `ebay-layout.css` 必须 bump `SITE_EBAY_LAYOUT_VER`。
