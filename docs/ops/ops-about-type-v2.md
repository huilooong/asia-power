# OPS · About 颜色/字间距/行距对齐 catalog-v4

**日期：** 2026-07-10  
**任务：** about 补齐 color / letter-spacing / line-height / font-weight（上次 mainly 字体字号）

## 结论

| 项 | 结果 |
|---|---|
| 上次缺什么 | 主要对齐了 Inter/Barlow 与字号；次要色仍混用 `#707070`/`#3d4a57`/`#191919`，未统一字距行距 |
| 本次补了什么 | catalog-v4 色板 + 显式 letter-spacing / line-height / weight |
| Cache key | `about-type-v2`（禁止复用 `about-type-v1`，CF immutable） |

## 对照（about → half-cuts catalog-v4）

| 角色 | catalog-v4 | 上次 about | 本次 |
|---|---|---|---|
| 标题色 | `#1d1d1f` | 多数已是 | `--about-ink` 全套 |
| 正文/次要 | `#6e6e73` | 混用 `var(--ebay-muted)=#707070` | `--about-muted` |
| 更次要 | `#86868b` | eyebrow 用 `#0a1628` | `--about-subtle` |
| 底色/线 | `#f5f5f7` / `#e8e8ed` | `#f3f5f8` / `#e5e5e5` | `--about-wash` / `--about-line` |
| 标题字距 | `-0.35px` | 已有 | 保留 + 子标题 `-0.2px` |
| 正文字距 | `0` | 未写 | 显式 `letter-spacing: 0` |
| 行距 | 标题 `1.25` / 正文 `1.5` | 部分缺 | 全套补齐 |
| 字重 | 800 / 700 / 400 | 基本有 | 显式核对 |

## 验证

- [x] 现网 `about.html` / CSS `?v=about-type-v2`
- [x] CSS 含 `--about-ink` / `--about-muted` / `letter-spacing: 0`
- [x] about 块无 `var(--ebay-muted)` / `#707070` / `#191919` / `#3d4a57`
- [x] contact lead 亦为 `#6e6e73` + `letter-spacing: 0`
- [x] hard refresh：CF MISS 拉到新 CSS；catalog-v4 h1/lead 色板仍在

## Release

- `REL-20260710111038-chrome-76489479`
- 备份：`asia-power-backup-20260710-111040.tar.gz`
- Cache key：`about-type-v2`（禁止复用 v1）
