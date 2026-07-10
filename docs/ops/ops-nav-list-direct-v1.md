# OPS — 顶栏分类直达列表页

**Release ID:** `REL-20260710102012-home-76489479`  
**Target:** home  
**Date:** 2026-07-10

## Status
成功

## 改了什么
| 分类 | 旧链接 | 新链接 | 验证 |
|------|--------|--------|------|
| Half-Cuts | `#shelf-half` | `/half-cuts/` | 200 |
| Engines | `#shelf-engines` | `/engines/` | 200 |
| Trucks | `#shelf-trucks` | `/trucks/` | 200 |
| Construction | `#shelf-machinery` | `/machinery/` | 200 |
| Used Cars | `#shelf-used` | `/half-cuts/?cat=used-cars` | 200 |

另：首页「What are you looking for?」分类卡片同步上述 URL；Construction 货架 See All 改为 `/machinery/`。

## Paths
- `index.html`（顶栏 + See All）
- `js/home-v4-hybrid.js`（分类卡片）
- `scripts/deploy-production.mjs`（home 部署校验 marker）

## Validation
- 本地：顶栏无 `#shelf-*`
- 现网：`https://asia-power.com/` 含 `nav-list-direct-v1`；五条列表 URL 均 HTTP 200
- Release Manager post-deploy：pass

## Next
CEO 硬刷新首页点顶栏五分类确认跳转。
