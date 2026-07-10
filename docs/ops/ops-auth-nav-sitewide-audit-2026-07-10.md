# OPS — 登录态顶栏全站审计与修复（auth-nav-sitewide-v1）

**日期：** 2026-07-10  
**触发：** CEO 批评：登录后「关于我们」仍显示「登录」，未全站覆盖

## 道歉式结论

上次只测了首页 + 目录，漏了 about / contact / 国家页 / brands / engines SEO。这是审计不全，不是「偶然 bug」。现已全站改完并现网抽查通过。

## 根因

1. 上次只验证首页 + half-cuts，**未审计** about / contact / 国家页 / brands / engines SEO
2. Cloudflare 对 JS 使用 `cache-control: immutable`（按完整 URL 含 `?v=` 永久缓存）
3. 漏网页仍引用 `components.js?v=v4-chrome-sync-v1` → CDN 继续吐**旧 JS**（无 `AsiaPowerAuthNav`）
4. 磁盘新文件已修好，但旧 `?v=` 键不会自动更新

## 审计：漏了哪些 / 已修

| 类别 | 代表页 | 修复前 | 修复后 |
|------|--------|--------|--------|
| 首页 | `/` | 已 AuthNav | `auth-nav-once-v2` |
| 目录 | `/half-cuts/` `/engines/` 等 | 部分可用 | `auth-nav-once-v2` |
| **漏网静态** | about / contact / kenya / nigeria / ghana / brands / app / supplier-portal | **`v4-chrome-sync-v1`（坏）** | `auth-nav-once-v2` + sitewide marker |
| **漏网品牌** | `brands/*.html`（50+） | **坏** | `auth-nav-once-v2` |
| **漏网发动机 SEO** | `engines/*.html`（60+） | **坏** | `auth-nav-once-v2` |
| 门户壳 | login / buyer / supplier dashboard | 自带 `/api/me` 回退 | 保持 |
| Admin | admin/* | 独立后台顶栏 | 不在本任务 |

登录入口：eBay 布局仅 toolbar 一处（`auth-nav-once`，无 `ebay-header__actions` 重复）。

## 本地抽查清单（部署前）

- [x] 公开 HTML 的 `components.js?v=` 不得再是 `v4-chrome-sync-v1`
- [x] `js/components.js` 含 `AsiaPowerAuthNav` + `auth-nav-sitewide-v1`
- [x] about / contact / kenya / brands/toyota / engines SEO / half-cuts / index 均走 shared header
- [x] `deploy:chrome` 含 about/contact/countries/brands；engines SEO 走 `engines` target
- [x] `patch-site-layout-assets.mjs` 不得写回坏 cache key

## 现网抽查（登录态模拟 `/api/me` → 显示名字）

| URL | 结果 |
|-----|------|
| https://asia-power.com/ | 显示 `AuthNavSitewide`，无「登录」 |
| https://asia-power.com/half-cuts/ | 同上 |
| https://asia-power.com/about.html | 同上（本 bug） |
| https://asia-power.com/contact.html | 同上 |
| https://asia-power.com/engines/ | 同上 |
| about 未登录 | 仍显示 Sign in / 登录 |
| 证据截图 | `docs/ops/evidence/auth-nav-about-logged-in-20260710.png` |

## 部署 Release ID

| 目标 | Release ID | 结果 |
|------|------------|------|
| chrome | `REL-20260710103114-chrome-76489479` | 成功（含 about/contact/countries/brands） |
| engines | `REL-20260710103324-engines-76489479` | 成功 |
| home | `REL-20260710103348-home-76489479` | 成功 |
| portal | `REL-20260710103452-portal-76489479` | 成功 |

现网脚本键：`components.js?v=auth-nav-once-v2`（含 AuthNav + sitewide marker）。

## 规则（教训）

- **登录态 / 顶栏类改动必须全站审计后再上线**，不能只测首页+目录
- 改 `components.js` 后必须 **bump 全站 HTML 的 `?v=`**，禁止复用 Cloudflare 已 immutable 的坏键（如 `v4-chrome-sync-v1`）
- 部署 `chrome` 必须覆盖 about/contact/countries/brands；engines SEO 必须跟 `engines` target
