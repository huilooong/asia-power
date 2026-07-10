# OPS · Parts photo display + half-cut borrow hide

**Task ID:** `parts-photo-display`  
**Date:** 2026-07-10  
**Status:** Implemented · deploy via `chrome` target

## Problem

1. **显示不完整**：`/engines/` 等零部件列表把缩略图压成 **66×66** 且 `object-fit: cover`，发动机舱图被裁切，框里看不全。
2. **半切借图**：半切车相册里带 `Engine` / 前脸等标签的图，被 `pickPartListingPhoto` 借到发动机/变速箱/底盘/前切列表展示，冒充配件图。

## Root cause

| 项 | 说明 |
|---|---|
| CSS | `body[data-page=engines|…] .ebay-parts-main` 强制 `--ebay-list-photo-w: 66px` + `object-fit: cover`，与 v4 卡片 200px 栏冲突 |
| JS | `pickPartListingPhoto`：engine 用标签匹配即可展示（含半切）；transmission/chassis/front 无匹配时 **fallback `photos[0]`**（整车半切图） |

## Fix

### 1. Display (CSS)

- 零部件页照片栏改为 **200px**，与 v4 listing 一致
- 图片改为 **`object-fit: contain`** + 浅灰底，完整显示不裁切过头
- 文件：`css/ebay-layout.css`

### 2. Borrow rule (JS)

- 新增 `isDedicatedPartListing(display, partType)`
- **仅**专门上传条目显示照片：
  - `passengerPartType` ∈ engine / transmission / chassis / front
  - 或 truck `truckPartType=engine` / slug / condition 同类标记
- 半切车（`passengerPartType` 空）→ **不显示**借来的图，列表用占位
- `renderPartListingPhoto` 始终加 `ap-listing-photo--fit-contain`
- 文件：`js/half-cut-directory.js`（`home-hub.js` 同步过滤，避免首页再推借图）

### 3. Cache bust

- `engines|gearboxes|chassis-parts|front-cuts/index.html` → `?v=parts-photo-v1`

## Validation (pre-deploy)

| 检查 | 结果 |
|---|---|
| 现网 API 抽样：有 engineCode 的半切带 Engine 标签 | ~172 → 将改为占位 |
| 专门前切 `passengerPartType=front` | 4 条（HC250550/548/547/488）→ 继续显示自己的图 |
| 专门发动机上传 | 现网 0 → 有上传后自动显示 |
| 未改 upload/compress 核心 | 避开 `server/lib/media-optimize.js` |

## Preview

- Rel: `docs/previews/parts-photo-display/parts-photo-display-preview.html`
- Abs: `/Users/longhui/Desktop/AsiaPower/docs/previews/parts-photo-display/parts-photo-display-preview.html`
- 本地打开即可；现网验证 URL：`https://asia-power.com/engines/`、`https://asia-power.com/front-cuts/`

## Deploy

```bash
node scripts/deploy-production.mjs chrome --yes --allow-dirty
```

| 项 | 值 |
|---|---|
| Release ID | `REL-20260710093613-chrome-76489479` |
| Backup | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-093615.tar.gz` |
| 现网验证 | `https://asia-power.com/engines/` 已带 `parts-photo-v1`；JS 含 `isDedicatedPartListing`；CSS 为 contain 非 66px |

CEO 指令视为批准：显示 bug 修复 +「借图不必显示」产品规则一并上线。

## Files

| Path | Change |
|---|---|
| `js/half-cut-directory.js` | dedicated gate + contain |
| `css/ebay-layout.css` | parts photo frame |
| `js/home-hub.js` | no borrowed engine shelf |
| `engines|gearboxes|chassis-parts|front-cuts/index.html` | cache bust |
| `docs/previews/parts-photo-display/` | preview |
| `docs/ops/ops-parts-photo-display.md` | this report |

## Next

- 部署后抽查 `/engines/` 半切条目为占位、`/front-cuts/` 专门上传图完整
- 供应商用乘用车配件通道上传发动机/变速箱后，列表会自动出图
