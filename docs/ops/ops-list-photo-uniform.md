# OPS · 列表页照片框高度统一

**Task ID:** `list-photo-uniform`  
**Date:** 2026-07-11  
**Status:** Preview ready · **awaiting CEO deploy approval**

## 问题

半切目录列表照片「整体输出不一致、看起来很丑」：竖图卡片明显高于方图卡片，灰边参差。

## 根因

| 项 | 说明 |
|---|---|
| CSS v4 | `.ebay-listing-row--v4 .ap-listing-photo { aspect-ratio: auto; height: 100%; }` → 框高跟随原图像素比例 |
| Half-cut | `.ebay-listing-row--halfcut … { object-fit: contain }` → 竖图把行撑高，方图留灰边 |
| 证据（现网桌面） | 方图框 **200×219**；竖图框 **200×265** |

不是单张图 404（多数图能打开）；是布局规则让列表视觉不齐。

## 修复（本地已改，未部署）

1. v4 列表图框改为固定 **`aspect-ratio: 4 / 3`**
2. 半切 / 车辆列表图改为 **`object-fit: cover`**
3. 目录卡片同步 cover（零部件页专用 contain 选择器保留）
4. Cache bust：`list-photo-uniform-v1`

## 文件

| Path | Change |
|---|---|
| `css/ebay-layout.css` | 统一列表图框 |
| `half-cuts|trucks|machinery|engines|gearboxes|chassis-parts|front-cuts/index.html` | CSS cache bust |
| `docs/previews/list-photo-uniform/list-photo-uniform-preview.html` | 预览 |
| `docs/ops/ops-list-photo-uniform.md` | 本报告 |

## 预览

- Rel: `docs/previews/list-photo-uniform/list-photo-uniform-preview.html`
- Abs: `/Users/longhui/Desktop/AsiaPower/docs/previews/list-photo-uniform/list-photo-uniform-preview.html`

## 部署（等 CEO「上线」）

```bash
# commit → push GitHub → Release Manager chrome
node scripts/deploy-production.mjs chrome --yes
```

## 验证计划

| 检查 | 期望 |
|---|---|
| `/half-cuts/` 前 8 条图框高度 | 一致（不再 219 vs 265） |
| CSS 含 `list-photo-uniform` / `aspect-ratio: 4 / 3` | Pass |
| `/engines/` 专门配件图 | 仍 contain，不误伤 |
