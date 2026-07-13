# APCONTACT-001 — Analysis

**任务：** AsiaPower Contact Entry Migration  
**日期：** 2026-07-13  
**目标号码：** `+86 166 3880 1930` → `https://wa.me/8616638801930`

## 结论

| # | 问题 | 答案 |
|---|------|------|
| 1 | 共发现多少 WhatsApp 链接？ | 迁移范围内约 **260** 条公司入口 `wa.me`（旧：`233540911111` 110 + `8618603773077` 150） |
| 2 | 成功迁移多少？ | **260** → 全部改为 `wa.me/8616638801930`；另统一显示号 / JSON-LD telephone |
| 3 | 还有哪些旧号码残留？ | 证据快照、历史任务文档、login 国家区号、客户 CRM 号码（故意保留） |
| 4 | 网页默认入口是否统一到 +86？ | **是**（config + 公开 HTML/JS） |
| 5 | 是否需要重新部署网站？ | **是** — 现网仍是旧入口，需 commit → push → Release Manager |

## 迁移前双入口问题

| 来源 | 旧号码 | 用途 |
|------|--------|------|
| `js/config.js` → `whatsapp` | `233540911111`（+233） | Footer / 浮动按钮 / 多数 CTA |
| `js/config.js` → `chinaWhatsapp` | `8618603773077`（旧中国号） | 首页 / Engine CTA / 部分落地页 |
| 硬编码 HTML | 同上两套 | engines/*、contact、国家页等 |

## 迁移后

| 字段 | 值 |
|------|-----|
| `whatsapp` | `8616638801930` |
| `chinaWhatsapp` | `8616638801930`（与主入口统一） |
| Display | `+86 166 3880 1930` |
| JSON-LD telephone | `+86-166-3880-1930` |

## 未改范围（遵守）

- 业务逻辑 / 样式 / SEO 文案策略（仅换联系电话）
- +233 Facebook 广告与预算
- APSales Commercial Decision 设计
- 历史 evidence / 任务文档（只标记）
- login 表单国家区号 `+233 GH`（不是公司入口）
