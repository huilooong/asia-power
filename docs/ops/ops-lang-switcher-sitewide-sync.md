# OPS — 全站语言开关与首页同步

**日期：** 2026-07-10  
**状态：** 已部署并现网验证  
**Cache：** `lang-sync-v2`

## 事实

- CEO：about / half-cuts / engines / contact 等页的语言开关与首页不一样
- 首页：文字 + 竖线分隔（无胶囊底、无金色激活块）
- 其他页：灰色胶囊 + 金色激活按钮（旧 `styles.css` / `ebay-layout.css`）

## 根因

1. 样式两套：首页用 `home-v4-hybrid.css` 文字样式；目录/关于页用 ebay 顶栏胶囊样式
2. HTML 虽可 bump `?v=`，但 `components.js` 的 `SITE_EBAY_LAYOUT_VER` 会在运行时把 `ebay-layout.css` 改回旧 key → Cloudflare immutable 继续喂旧 CSS
3. 顶栏类改动若只测首页+目录，about/contact 等静态页容易漏

## 修复

- 统一 `css/styles.css` 与 `css/ebay-layout.css` 语言开关为首页同款（透明底、竖线分隔、无 pill）
- `SITE_EBAY_LAYOUT_VER = 'lang-sync-v2'`，避免 JS 改回旧 CDN key
- 全站公开 HTML bump：`styles.css` / `ebay-layout.css` → `lang-sync-v2`
- chrome 部署覆盖 about / contact / brands / 国家页 + catalog；home + engines 同步

## Release

| 目标 | Release ID |
|------|------------|
| chrome | `REL-20260710103655-chrome-76489479` |
| home | `REL-20260710103901-home-76489479` |
| engines | `REL-20260710104002-engines-76489479` |

## 验证（现网 Puppeteer）

| 页面 | 样式 | 行为 |
|------|------|------|
| 首页 | 透明底、竖线、12px 文字 | EN/中文/FR/AR |
| about | 与首页一致 | 点中文 → 标题变中文 |
| half-cuts | 与首页一致 | 同文案按钮 |

证据截图：`docs/ops/evidence/lang-sync-v2-{home,about,half-cuts}-20260710.png`

## 规则（以后必须）

1. **顶栏类（登录态、语言开关）必须全站同源组件/同源 CSS**，禁止各页各一套
2. **上线前全站审计**：首页 + about + contact + 目录 + engines SEO，不能只测首页
3. 改 `ebay-layout.css` / 顶栏 chrome 时：同步 bump HTML `?v=` **且** bump `SITE_EBAY_LAYOUT_VER`（否则 CF 仍喂旧文件）
4. 不改库存数据
