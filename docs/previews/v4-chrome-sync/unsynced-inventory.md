# 全站未同步清单 · v4-chrome-sync

**Date:** 2026-07-10  
**Task:** 全站壳同步到 v4（详情 + 审批 + 审计）

## 本轮已对齐

| 区域 | 方式 |
|------|------|
| 详情页 ×3（half-cuts / trucks / machinery） | 共享 `components.js` 文字 logo + `ebay-layout.css` 首页风搜索 |
| 主目录 / about / contact / brands / 国家页等 eBay 壳页 | 随共享头自动对齐（无需逐页改 HTML） |
| Admin ×3（inventory / analytics / leads） | 新 `admin-v4.css` + 文字 logo 顶栏 +「Admin · v4」标记 |

## 随共享壳自动对齐（无需单独改）

- `half-cuts/`、`trucks/`、`machinery/`、`front-cuts/`、`chassis-parts/` 目录页
- `brands/*`、`ghana.html` / `nigeria.html` / `kenya.html`
- 多数 `engines/*.html`（仍用 eBay 壳注入；内容布局属 Phase D）

## 仍待后续

| 项 | 说明 |
|----|------|
| engines SEO ×64 | Phase D：内容重排，不只换头 |
| supplier upload ×4 | 预览已出：`docs/previews/v4-upload-sync/` · 等 CEO 确认后再部署（见 `docs/ops/ops-v4-upload-sync.md`） |
| 公开列表内容区 | 预览已出：`docs/previews/v4-listing-sync/` · 本地已改浅色 hero · **等 CEO 确认后再部署**（见 `docs/ops/ops-v4-listing-sync.md`） |
| `app.html` | 独立壳，不走 eBay 注入 |

## 规则（防再跳版本）

1. **新公开页**必须走共享壳（`components.js` + `ebay-layout.css`），禁止单独做一版头。
2. **Admin 新页**必须挂 `css/admin-v4.css?v=admin-v4-sync-v1`（或后续版本号）。
3. 部署用 Release Manager：`chrome` / `admin` target，勿整站盲 rsync。

## 预览

- [chrome-sync-preview.html](../previews/v4-chrome-sync/chrome-sync-preview.html)
- [admin-v4-preview.html](../previews/v4-chrome-sync/admin-v4-preview.html)
