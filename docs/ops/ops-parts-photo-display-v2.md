# OPS · Parts own-photo display fix (v2)

**Task ID:** `parts-photo-display-v2`  
**Date:** 2026-07-10  
**Status:** Deployed  
**Release:** `REL-20260710100148-chrome-76489479`

## Problem (CEO)

半切借图已正确隐藏；但专门上传的真图（前切等）显示不好 / 像没显示。

## Root cause

| 项 | 说明 |
|---|---|
| CDN 缓存 | 源站 CSS 已是 200px + `contain`，但 `components.js` 把样式强制改成 `?v=v4-listing-card-v1` |
| 旧 query | CDN 仍缓存该 key 下的 **旧 CSS（66×66 + cover）** → 真图被压成细条并裁切 |
| 误判借图 | `vehicleCondition=Transmission Assembly` 的半切（如 HC250546）被当成专门变速箱而出图 |

## Fix

1. `SITE_EBAY_LAYOUT_VER` / `SITE_COMPONENTS_VER` → `parts-photo-v2`（强制新 CDN key）
2. 目录页 HTML cache-bust → `parts-photo-v2`
3. `isDedicatedPartListing`：半切 slug / Half Cut 条件一律不算 dedicated
4. CSS：parts 页 `object-fit: contain` 选择器加强

## Validation (live)

| 页 | 库存号 | 结果 |
|---|---|---|
| `/front-cuts/` | HC250550 / HC250548 / HC250547 | 真图 · 200px · contain |
| `/front-cuts/` | HC250552（半切） | 占位（借图不显示） |
| `/engines/` | HC250552 | 占位（现网无专门发动机上传） |
| `/gearboxes/` | HC250546 | 占位（半切误标已挡） |
| `/chassis-parts/` | — | 现网无专门底盘上传 → 全占位 |

## Deploy

| 项 | 值 |
|---|---|
| Release ID | `REL-20260710100148-chrome-76489479` |
| Backup | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-100150.tar.gz` |
| Target | `chrome`（未改公开主页） |

## Files

| Path | Change |
|---|---|
| `js/components.js` | layout ver → parts-photo-v2 |
| `js/half-cut-directory.js` | dedicated gate 收紧 |
| `css/ebay-layout.css` | contain 选择器 |
| `engines\|gearboxes\|front-cuts\|chassis-parts\|half-cuts\|trucks\|machinery/index.html` | cache bust |
| `scripts/deploy-production.mjs` | chrome 校验对齐 |

## Rule（以后）

改 `ebay-layout.css` 后必须同步 bump `SITE_EBAY_LAYOUT_VER`，否则 CDN 旧 `?v=` 会盖掉新样式。
