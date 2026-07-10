# OPS — 登录后顶栏显示用户名（auth-nav-v1）

**日期：** 2026-07-10  
**触发：** CEO 批评登录成功后仍显示「登录」，客户误会未登录

## 事实

- 根因：`js/components.js` 的 `renderLoginEntry` 写死「Sign in / 登录」，从不查 `/api/me`
- 首页 `index.html` 顶栏、目录页 eBay 顶栏、门户壳 `v4-portal-shell.js` 同问题

## 修复

- 已登录：显示 `displayName` / `name` / 联系人 / 公司名；否则手机号脱敏 `138****8901`
- 下拉：工作台 / 退出
- 未登录：才显示「登录」
- 买家 + 供应商均走同一套 `/api/me` 水合

## 部署

| 目标 | Release ID | 结果 |
|------|------------|------|
| chrome | `REL-20260710100755-chrome-76489479` | 成功 |
| home | `REL-20260710100923-home-76489479` | 成功 |
| portal | `REL-20260710101200-portal-76489479` | 成功（首次校验失败后已重跑） |

## 验证（现网 Playwright 硬刷新）

| 场景 | 结果 |
|------|------|
| 买家登录后首页 | 顶栏显示 `AuthNavBuyer`，无「登录」按钮 |
| 买家登录后 /half-cuts/ | 顶栏两处均显示名字，无「登录」 |
| 未登录首页 | 仍显示 Sign in / 登录 |
| 证据截图 | `docs/ops/evidence/auth-nav-home-logged-in-20260710.png` |

## 规则

- 登录态 UI 必须读 session（`/api/me`），禁止写死「登录」按钮当已登录态
- 本改动只修顶栏登录态，不做公开主页大改版、不动 Facebook
