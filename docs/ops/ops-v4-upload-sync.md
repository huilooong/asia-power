# OPS · 供应商上传页同步到 v4（预览，未部署）

**Status:** 预览待 CEO 确认  
**Date:** 2026-07-10  
**Task ID:** v4-upload-sync  
**Deploy:** ❌ 未部署（等批准）

## 结论

| 项 | 结果 |
|----|------|
| 「上传页面」定位 | ✅ 供应商门户 4 个上传表单 |
| 与现网差异审计 | ✅ 仍是旧深蓝壳 + PNG logo |
| 预览 | ✅ `docs/previews/v4-upload-sync/` |
| 生产部署 | ❌ 未做，需 CEO 确认 |

## 上传页路径（现网）

| 页面 | URL |
|------|-----|
| 乘用车整车 | https://asia-power.com/supplier-portal/half-cut-upload.html |
| 乘用车配件 | https://asia-power.com/supplier-portal/passenger-parts-upload.html |
| 商用车整车 | https://asia-power.com/supplier-portal/truck-vehicle-upload.html |
| 卡车配件 | https://asia-power.com/supplier-portal/truck-upload.html |
| 入口（选类型） | https://asia-power.com/supplier-portal.html |

本地对应：`supplier-portal/*.html`（`data-page="supplier-upload"`）。

**不是这些：** QXB 审核工具、Admin Inventory、本地 `work/qxb-agent/review_server.js`。

## 现网 vs 已同步 v4

| 检查项 | 现网上传 ×4 | 详情/目录 | Admin |
|--------|-------------|-----------|-------|
| `components.js` | `trust-bar-v1`（旧） | `v4-chrome-sync-v1` | `v4-chrome-sync-v2` |
| `ebay-layout.css` | `v=56`（旧） | `v4-chrome-sync-v1` | 不挂 |
| `admin-v4.css` | ❌ 未挂 | — | ✅ |
| Logo | PNG | 文字 AsiaPower | 文字 AsiaPower |
| 页头 | 深蓝 `page-hero` | 公开 eBay 壳 | 白底工具头 |
| 搜索 | 无（工具页） | 浅灰边+黑按钮 | 无 |

说明：上传页在 `components.js` 里被标成「内部工具页」，**不走**公开 eBay 搜索壳；应对齐的是 **Admin 同系的白底 v4 皮肤**，但导航必须是供应商入口，不能照搬 Inventory / Analytics / Leads。

## 预览怎么打开

相对路径：`docs/previews/v4-upload-sync/upload-v4-preview.html`

```text
docs/previews/v4-upload-sync/
  upload-v4-preview.html
```

绝对路径：`/Users/longhui/Desktop/AsiaPower/docs/previews/v4-upload-sync/upload-v4-preview.html`

Finder 双击该 HTML，或终端：

```bash
open /Users/longhui/Desktop/AsiaPower/docs/previews/v4-upload-sync/upload-v4-preview.html
```

## 批准后拟改（尚未动手）

1. 新建 `css/upload-v4.css`（或扩展 `admin-v4.css` 覆盖 `body[data-page="supplier-upload"]`）
2. `js/components.js`：供应商专用顶栏/页脚（Portal / 四类上传 / Home），勿复用 Admin 菜单
3. 四个 `supplier-portal/*-upload.html`：挂 `upload-v4.css` + cache-bust
4. 可选：`supplier-portal.html` 入口 hero 一并换白底
5. Release Manager 新 target（如 `upload`）或并入现有 `chrome` — **部署前再定**

## 验证计划（上线后）

| 检查 | 期望 |
|------|------|
| 任一上传页顶栏 | 文字 AsiaPower，无 PNG |
| 页头 | 白底，非深蓝 |
| 导航 | 无 Admin Inventory 链接 |
| 表单 | VIN 步骤仍可用 |
| 徽章 | Upload · v4 |

## 关联

- 全站壳审计：`docs/ops/ops-v4-chrome-sync-audit.md`
- 未同步清单曾写「supplier upload ×4 另开任务」→ 本任务即该条目
