# OPS · 全站壳同步到 v4（详情 + 审批 + 审计）

**Status:** 已实现并部署  
**Date:** 2026-07-10  
**Task ID:** v4-chrome-sync

## 结论

| 项 | 结果 |
|----|------|
| 详情/目录文字 AsiaPower logo | ✅ 现网已验 |
| 搜索框对齐首页（浅灰边 + 黑按钮） | ✅ `rgb(29,29,31)` |
| Admin 三页 v4 皮肤 | ✅ |
| 未同步审计清单 | ✅ |
| 部署 target `chrome` / `admin` | ✅ |

## Releases

| Release | Target |
|---------|--------|
| `REL-20260710062229-chrome-76489479` | chrome（首发） |
| `REL-20260710062333-admin-76489479` | admin |
| `REL-20260710062614-chrome-76489479` | chrome（含目录 HTML cache-bust，绕过 CF 旧缓存） |

## 预览（CEO）

相对路径：`docs/previews/v4-chrome-sync/`

```text
docs/previews/v4-chrome-sync/
  chrome-sync-preview.html
  admin-v4-preview.html
  unsynced-inventory.md
```

本地打开：`docs/previews/v4-chrome-sync/chrome-sync-preview.html`

## 变更文件

| 文件 | 说明 |
|------|------|
| `js/components.js` | 文字 logo；Admin 精简顶栏；cache `v4-chrome-sync-v1` |
| `css/ebay-layout.css` | 搜索对齐 hero-search |
| `css/admin-v4.css` | 新建 Admin v4 皮肤 |
| `admin/inventory.html` 等 | 挂 admin-v4 + 徽章 |
| 公开 HTML ×225 | cache-bust 指向 `v4-chrome-sync-v1`（Cloudflare 按 query 缓存） |
| `scripts/deploy-production.mjs` | 新增 `chrome` / `admin` |
| `scripts/lib/release-manager.mjs` | 路径清单 |

## 部署

```bash
node scripts/deploy-production.mjs chrome --allow-dirty --yes
node scripts/deploy-production.mjs admin --allow-dirty --yes
```

## 验证（现网）

| 检查 | 结果 |
|------|------|
| `/half-cuts/` | 文字 AsiaPower；黑 Search 按钮 |
| `/half-cuts/detail.html?id=HC250361` | 同上 |
| `/admin/inventory.html` | Admin · v4 + admin-v4.css |
| 语言切换 / Sign in | 仍在顶栏 |

## 规则

见预览内 `unsynced-inventory.md`：新公开页走共享壳；Admin 新页挂 `admin-v4.css`。
