# WhatsApp Cloud API（+86）运行说明 — APWA-001 / APWA-002

## 号码

- Cloud API 官方号：`+86 166 3880 1930`  
- **禁止**本任务触碰 +233 Business App 接待链  

## Webhook

- URL：`https://asia-power.com/api/whatsapp/webhook`  
- 服务：`inventory-site.service`  
- 代码：`server/lib/whatsapp-cloud-webhook.js` → 生产 `lib/whatsapp-cloud-webhook.js`  

## 环境变量（勿提交真实值）

| 变量 | 用途 |
|------|------|
| `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_CLOUD_VERIFY_TOKEN` | Meta GET 验证 |
| `WHATSAPP_APP_SECRET` / `WHATSAPP_CLOUD_APP_SECRET` | POST 签名（**必填**） |
| `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | 备用发送 ID（优先用入站消息里的 ID） |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_CLOUD_ACCESS_TOKEN` | Graph 发送（**Sandbox 必填**） |
| `WHATSAPP_AUTONOMY_MODE` | `observe` / `sandbox` / `live` / `off` |
| `CEO_WHATSAPP_NUMBER` | Sandbox 白名单 wa_id（仅此号码自动回复） |

## 模式

| 模式 | 行为 |
|------|------|
| `observe` | 收消息落库，**不回复客户**（只观察；勿当生产接待） |
| `sandbox` | 仅 `CEO_WHATSAPP_NUMBER`：子敬生成 → 立即 Graph 回复；其它号码只观察 |
| `live` | **生产接待**：所有真实入站 → APSales → Graph 从 +86 回（CEO 2026-07-13 批准） |
| `off` | 紧急关闭 |

**事故 2026-07-14：** 生产被设回 `observe` → 客户看得见发来、系统不回。已改回 `live`。  
Cloud API（+86）与 OpenClaw WhatsApp Baileys 插件（+233）是两条线，勿混开。

## CEO 盯梢（Telegram · 方案 B · 2026-07-14）

Cloud API **没有**手机/网页登录看聊天。用 Telegram 实时摘要代替：

| 事件 | 你会收到 |
|------|----------|
| 客户发来消息 | `📲` **客户原文全文**（号码只显示后四位） |
| 客户发来照片/文件 | **原图转发**（`📷`）+ 说明原文 |
| 子敬自动回复 | `🤖` **客户原文 + 子敬原文全文**（不摘要） |
| 该回却没回（无 Token 等） | `⚠️` + 客户原文 |

依赖：`ASIAPOWER_TELEGRAM_BOT_TOKEN` + `ASIAPOWER_TELEGRAM_CHAT_ID`（与库存审核通知同一 Bot）。  
紧急关掉盯梢（不停接待）：`WHATSAPP_TELEGRAM_MONITOR=off` + restart `inventory-site`。

### Sandbox（APWA-002）

- 无 Draft / Approval / Shadow  
- 仍强制 Truth Guard / Inventory / Risk（禁库存承诺、报价、付款、发货承诺）  
- 详情：`docs/tasks/apwa-002/sandbox-mode.md`

## 紧急关闭

```bash
WHATSAPP_AUTONOMY_MODE=off
systemctl restart inventory-site.service
```

## 详细任务文档

- `docs/tasks/apwa-001/`
- `docs/tasks/apwa-002/`
