# OPS — 审核多图 / 现网少图事故修复

**Task ID:** `ops-photo-count-loss-incident`  
**Date:** 2026-07-10  
**Status:** **Production deployed**  
**Severity:** High — CEO 可见「偷图」观感（压缩减体积被误当成少张数）

## Production deploy (2026-07-10)

| Item | Value |
|------|-------|
| API Release | `REL-20260710093446-api-76489479` |
| Chrome Release | `REL-20260710093620-chrome-76489479` |
| Backup (api) | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-093448.tar.gz` |
| Backup (chrome) | `/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-093622.tar.gz` |

### 现网验证（HC250552）

| Check | Result |
|-------|--------|
| 详情预渲染 photos | **15**（修复前 4） |
| `data-photo-index` | **15** |
| `/api/half-cuts/public/item` | 15 |
| `/api/half-cuts/public` 目录 | 4（列表性能截断，保留） |
| cache-bust `photo-count-fix-v1` | Pass |
| QXB album_fill 单测 8 槽相册 | `QXB_ALBUM_FILL_PASS` |

## 结论（先看这个）

| 项 | 内容 |
|----|------|
| 根因 | 公开目录 API 为性能只返回 **4 张**图；详情页预渲染误用了这份截断数据；前端又优先用预渲染、不拉全量 `/public/item` |
| 不是 | 压缩把图「压没了」。库里张数仍在（例：HC250552 审核/库内 **15** 张） |
| 已修 | 详情预渲染改用全量 item；详情页强制拉全量并升级照片数组；压缩失败保留原图；QXB CEO 槽位后补全相册 |
| 历史数据 | **未删**任何库存照片 |

## 真实证据（HC250552，压缩上线后首条多图）

| 来源 | 张数 |
|------|------|
| Admin / submissions | 15 |
| approved JSON | 15 |
| `GET /api/half-cuts/public/item` | 15 |
| `GET /api/half-cuts/public`（目录） | **4**（有意截断） |
| 详情页 `__HALF_CUT_PRERENDER_ITEM__`（修复前） | **4** |

提交 ID：`SUB-MREP68GZ-I07B` → 库存 `HC250552`  
创建时间：2026-07-10T08:52Z（压缩 Release `REL-20260710085831-api-76489479` 前后）

submission vs approved 全库对比：**0 条张数不一致**（数据层未丢图；丢在展示链路）。

## 次要风险（一并修）

1. **客户端预压缩**：压缩结果异常大时曾直接报错，可能让单张上传失败 → 改为回退原图。  
2. **服务端 sharp**：失败已回退原图；日志改为明确「keep original」。  
3. **QXB 审核上传**：CEO 只标 5 槽时，旧逻辑只传 5 张；现改为槽位优先 + **补全相册剩余图**（上限 40）。

## 修复文件

| 文件 | 改动 |
|------|------|
| `deploy/inventory-site-server.js` | 详情预渲染用 `getPublicItemBySlug` 全量照片 |
| `js/half-cut-detail.js` | 始终 fetch `/public/item` 并升级 photos |
| `half-cuts|trucks|machinery/detail.html` | cache-bust `photo-count-fix-v1` |
| `js/supplier-half-cut-upload.js` | 压缩失败/过大 → 保留原图 |
| `server/lib/media-optimize.js` | 失败日志强调 keep original |
| `server/lib/half-cut-api.js` | 可信批量上传允许最多 40 张 |
| `inventory_core/qxb_photo_pick.py` | `manual_override+album_fill` |
| `inventory_core/qxb_pipeline.py` | 默认 `QXB_UPLOAD_MAX_PHOTOS=40` |
| `scripts/deploy-production.mjs` | chrome 目标同步 `half-cut-detail.js` |

## 验证清单

- [x] 详情预渲染 photos.length === approved photos.length（HC250552 → 15）
- [x] `data-photo-index` 数量与库内一致（15）
- [x] 本地 QXB album_fill：8 张相册 + 5 槽 → 上传 picks=8
- [x] 压缩失败路径仍保存原图（服务端 fallback + 客户端回退原图）

## 规则（以后禁止）

- 目录截断（maxPhotos=4）**只许**用于列表卡片，**禁止**喂给详情预渲染  
- 压缩只许减体积，**禁止**减张数；失败必须保留原图或重试  
