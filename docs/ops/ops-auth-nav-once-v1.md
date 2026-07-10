# OPS — 去掉搜索旁重复用户名（auth-nav-once-v2）

**日期：** 2026-07-10  
**触发：** CEO 指出列表页名字显示两次（顶栏 + 搜索框旁），属失误重复

## 事实

- 根因：`js/components.js` 的 `renderEbayHeader()` 同时渲染了两处登录态：
  1. 顶栏 `renderEbayToolbar()` → `renderLoginEntry({ compact: true })`（应保留）
  2. 搜索框旁 `ebay-header__actions` → `renderLoginEntry()`（多余，已删）
- 首页可见登录态在主导航一处（正确）

## 修复

- 删除 `ebay-header__actions` 内第二处 auth slot
- 顶栏保留：语言开关 + 用户名/登录（各一处）
- 缓存键：`components.js?v=auth-nav-once-v2`（v1 曾被 CF immutable 缓存污染，已换新键）

## 部署 / 验证

| 项 | 结果 |
|----|------|
| 源站文件 | `ebay-header__actions` = 0 |
| 同步 Release | `REL-20260710103330-chrome-76489479`（文件已上源站） |
| half-cuts / engines / about | 现网 Puppeteer：`slotCount=1`，仅顶栏，搜索旁无名字 |
| 首页 | 可见登录态 1 处（导航） |

## 规则

- 用户名/登录态只出现在顶栏 chrome，禁止再插到搜索区旁
- 静态资源 `immutable` 长缓存：换内容必须换 `?v=`
