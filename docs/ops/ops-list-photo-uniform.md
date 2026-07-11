# OPS · 列表页照片框高度统一

**Task ID:** `list-photo-uniform`  
**Date:** 2026-07-11  
**Status:** **Production live**（commit → push → 现网已同步；Release Manager `chrome` 全量脚本末尾 SSH 偶发失败，已手工核对通过）

## Production

| Item | Value |
|------|-------|
| Git | `20194de2b` on `chore/backfill-2026-07-10-prod` |
| Cache | `list-photo-uniform-v1`（`ebay-layout.css` + `components.js`） |
| 现网验证 | `/half-cuts/` 前 8 条图框高度全部 **219**；`aspect-ratio: 4/3`；`object-fit: cover` |

## 问题

半切目录列表照片高度不齐（竖图 ~265、方图 ~219），看起来参差。

## 根因

1. v4 列表 `aspect-ratio: auto` + halfcut `object-fit: contain` → 框高跟随原图比例
2. **`js/components.js` 的 `injectEbayStylesheet` 把 CSS 版本强制改回旧 `about-type-v2`** → 浏览器继续吃旧 CSS 缓存，只改 HTML `?v=` 不够

## 修复

| 文件 | 改动 |
|------|------|
| `css/ebay-layout.css` | 固定 4:3 + cover |
| `js/components.js` | `SITE_EBAY_LAYOUT_VER` / `SITE_COMPONENTS_VER` → `list-photo-uniform-v1` |
| 目录 `*/index.html` | CSS/JS cache bust；保留 `about-type-v2` deploy marker |

## 预览

- `docs/previews/list-photo-uniform/list-photo-uniform-preview.html`

## 验证

| 检查 | 结果 |
|------|------|
| 现网 HTML / JS 含 `list-photo-uniform-v1` | Pass |
| 浏览器前 8 条图框高度 | 全部 219（不再 219/265 混用） |
| 零部件 contain 规则 | 保留（未改 parts 专用选择器） |
