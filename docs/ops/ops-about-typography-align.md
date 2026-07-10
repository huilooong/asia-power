# OPS · About 字体字号对齐全站 chrome

**日期：** 2026-07-10  
**任务：** about 页字体/字号与 half-cuts、contact 对齐并部署

## 结论

| 项 | 结果 |
|---|---|
| 是否已修正 | 是 |
| 差在哪 | about 曾挂 Apple 字体覆盖；去掉后仍用偏大的营销字号，与 catalog-v4 不一致 |
| 现网是否已齐 | 是（`about-type-v1`） |

## 根因（为何「感觉不一样」）

1. **首页**用 `home-v4-hybrid.css` 的 Apple 系统字体（SF Pro / -apple-system），与 chrome 页本就不是同一套。
2. **about / half-cuts / contact** 应共用 Inter 正文 + Barlow Condensed 标题（`styles.css` + `ebay-layout.css`）。
3. about 曾加载 `asia-power-apple.min.css`（强制系统字体）；去掉后未把 about 专用字号收到 catalog-v4 尺度 → 标题偏大、字距更「营销稿」。
4. **之前没有单独做过 about 字体修正**；只有顶栏/语言开关全站同步，未动正文层级。

## 修正

- `.ebay-about-*` 明确 `font-family: var(--font-body|display)`
- 标题对齐 catalog-v4：`clamp(1.65–2.1rem)` / `800` / `letter-spacing: -0.35px`
- 正文/lead：`14px` / `line-height: 1.5` / `#6e6e73`
- 与 contact 居中共用 cache key `contact-center-v1`（不互相覆盖选择器）

## 验证清单

- [ ] about.html 含 `about-type-v1` + `contact-center-v1`
- [ ] 现网 CSS `?v=contact-center-v1` 含 `about-type-v1`
- [ ] 计算样式：h1 Barlow、lead Inter 14px
- [ ] contact 居中规则仍在（`max-width: 920px`）

## Release

- `REL-20260710105159-chrome-76489479`
- Cache key: `css/ebay-layout.css?v=about-type-v1`
- 现网验证：CSS 含 `about-type-v1` + `clamp(1.65rem`；contact `max-width: 920px` 仍在
