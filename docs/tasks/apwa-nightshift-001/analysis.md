# APWA-NIGHTSHIFT-001 — Analysis

**日期：** 2026-07-13  
**生产核对：** `root@159.65.86.24` inventory-site + Meta Graph

## 结论（5 问速答）

| # | 问题 | 答案 |
|---|------|------|
| 1 | 白名单是 Meta 还是我们代码？ | **主要是我们代码**（`WHATSAPP_AUTONOMY_MODE=sandbox` + `CEO_WHATSAPP_NUMBER`）。Meta +86 号码本身已 `CONNECTED` / `VERIFIED` / GREEN。 |
| 2 | +86 是否已能接收任意陌生客户？ | **Webhook 可收**（号码 live）；**自动回复不行**（sandbox 白名单只放行 CEO）。 |
| 3 | Ads Manager 能否选 +86？ | **本环境无法代点 Ads Manager**（token 无 ads 权限）。需 CEO 在后台目视确认。 |
| 4 | 今晚能否安全上线夜班广告？ | **不能发布**。接待代码可升 live，但广告绑定未确认 + 未过发布闸门。 |
| 5 | 最短还差哪一步？ | ① 生产切 `live` 并验证陌生号能自动回复；② CEO 确认广告 CTA 可选 +86；③ 建 Night Shift **草稿**并预览；④ 你明确批准后再发布。 |

## 生产实际状态（已测）

| 项 | 值 |
|----|-----|
| `WHATSAPP_AUTONOMY_MODE` | `sandbox`（审计时） |
| `CEO_WHATSAPP_NUMBER` | `19402375223` |
| Phone Number ID | `1161442857060571` |
| Display | `+86 166 3880 1930` |
| WABA | `2429009167504708`（AsiaPower） |
| Meta status | `CONNECTED` · `VERIFIED` · quality `GREEN` · tier `TIER_250` |
| Token scopes | `whatsapp_business_messaging` + `whatsapp_business_management`（**无** ads_management） |
| WABA 内号码 | **仅 +86**（无 +233；+233 为独立 Business App 链） |

## 代码阻断点

`server/lib/whatsapp-cloud-sandbox.js`：sandbox 下非白名单 → `not_allowlisted`。  
`server/lib/whatsapp-cloud-webhook.js`：仅 `mode===sandbox` 时触发自动回复（已扩展支持 `live`）。

## 禁止项（遵守）

- 不停止 +233 广告  
- 不发布新广告、不改预算（未经 CEO 批准）  
- 不改 Commercial Decision 设计  
