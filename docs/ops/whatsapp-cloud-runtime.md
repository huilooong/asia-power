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
| `WHATSAPP_AUTONOMY_MODE` | `observe` / `sandbox` / `off` |
| `CEO_WHATSAPP_NUMBER` | Sandbox 白名单 wa_id（仅此号码自动回复） |

## 模式

| 模式 | 行为 |
|------|------|
| `observe` | 收消息落库，不回复客户 |
| `sandbox` | 仅 `CEO_WHATSAPP_NUMBER`：子敬生成 → 立即 Graph 回复；其它号码只观察 |
| `off` | 紧急关闭 |

### Sandbox（APWA-002）

- 无 Draft / Approval / Telegram / Shadow  
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
