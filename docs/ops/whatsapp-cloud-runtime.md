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

依赖（**专用 Bot，勿与孔明混用**）：

| 变量 | 用途 |
|------|------|
| `ASIAPOWER_TELEGRAM_BOT_TOKEN` | WhatsApp 盯梢 + 报价桥专用 Bot（生产：`@Asiapower86166_bot`） |
| `ASIAPOWER_TELEGRAM_CHAT_ID` | CEO 私聊 ID |
| `TELEGRAM_WEBHOOK_SECRET` | 报价 webhook 校验 |

- **禁止**把该 token 写进 OpenClaw `credentials/telegram-bot-token`（那是 `@weylonbot` 孔明）  
- 库存站 `.env`：**不要**再把 `TELEGRAM_BOT_TOKEN` 指到孔明做盯梢回落；`telegram-notify.js` 在已设 `ASIAPOWER_*` 时**绝不**回落到 `TELEGRAM_BOT_TOKEN`  
- **双通道**：`@Asiapower86166_bot` **只**收 WhatsApp Cloud 盯梢/报价；待审核/线索/运维等仍走孔明 `@weylonbot`（`TELEGRAM_BOT_TOKEN`）  
- 代码：`notifyWhatsApp*` → 专用 Bot；默认 `notify*` → 孔明  
- 紧急关掉盯梢：`WHATSAPP_TELEGRAM_MONITOR=off` + restart `inventory-site`  
- 换 Bot / 重挂 webhook：`node scripts/setup-whatsapp-telegram-bot.mjs --token … --chat-id …`

### CEO 报价桥（回复绑定 + 二次确认 · 2026-07-20）

Cloud API 无法手机登录时，用 Telegram **指挥报价**（不是随便在聊天里打价格）：

| 步骤 | 行为 |
|------|------|
| 1 | 盯梢消息底部有「回复本条写价格」提示；系统把该 Telegram `message_id` **绑死**到该客户 `wa_id` |
| 2 | 你必须 **Reply / 回复那一条**，写 `450` / `450 USD` / `EXW 450`（自定义：`450 USD \| 话术`） |
| 3 | Bot 弹出确认卡：后四位 + 客户原话摘要 + 将发原文 → 点 **确认发送** 才走 Cloud API |
| 4 | 普通聊天里单独发 `450` = **忽略**（禁止猜“最近一位客户”） |

- Webhook：`POST /api/telegram/whatsapp-quote`（`X-Telegram-Bot-Api-Secret-Token`）
- 环境变量：`TELEGRAM_WEBHOOK_SECRET`（必填生产）；`WHATSAPP_TELEGRAM_QUOTE=off` 可关掉报价桥
- 绑定/待确认：`data/whatsapp_cloud/telegram_quote/`
- 安装 webhook：`node scripts/set-telegram-whatsapp-quote-webhook.mjs`

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
