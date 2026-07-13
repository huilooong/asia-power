# APMAIL-001 Analysis

## 真实调用链

```
客户邮件 → Cloudflare Email Routing
  → deploy/cloudflare-email-worker.js  (email handler)
      ├─ extractBodies / decodeQuotedPrintable  ← 旧版唯一解码点（有缺陷）
      ├─ POST /api/email/inbound  (text / 现已含 rawBase64)
      └─ message.forward(CEO Gmail)  ← raw 转发，Gmail 自己解码正常
  → deploy/inventory-site-server.js
  → server/lib/email-proxy.js::ingestInbound
  → customer_gateway/email_webhook_handler.py
  → customer_gateway/email_inbound.py::latest_inbound_text → APSales
  → Telegram notify + CEO Gmail 审批草稿
```

**没有 Gmail API 读信。** Gmail 只是 CEO 副本转发与审批邮箱。

## 根因

乱码发生在 **Cloudflare Worker 的手写 MIME 提取**，不是 Telegram/Agent 二次损坏。

典型失败类：

1. 正文是 quoted-printable，但缺少 / 错误 `Content-Transfer-Encoding` 头 → 走 `decodeBody()`，**不去掉行尾 `=` 软换行**
2. 非 multipart 或找不到 `text/plain` → 同样走 `decodeBody()`
3. 嵌套 multipart 只切顶层 boundary，可能选错 part
4. QP `=XX` 按 Latin-1 字符拼，未按 UTF-8 字节解码 → 中文乱码
5. Worker 之后 Node/Python **只存/读 `text`，不再解码** → 乱码原样进入子敬 / Telegram

任务样例：

```
sales@ =
inbound ... Cloudflare =
destination
```

即软换行 `=` 残留（常见还有空格 + `=` 形式）。

## 涉及文件（修复前）

| 文件 | 角色 |
|------|------|
| `deploy/cloudflare-email-worker.js` | 唯一 MIME/QP 解码（脆弱） |
| `server/lib/email-proxy.js` | 直接存 `payload.text` |
| `customer_gateway/email_inbound.py` | `latest_inbound_text` 直接取 text |
| `deploy/inventory-site-server.js` | Telegram 预览用 textRedacted |

## 修复策略

- **权威解析**：Node `mailparser`（`server/lib/email-mime-parse.js`）在 ingest 时规范化
- Worker 增强解码 + 可选 `rawBase64` 供 Node 重解析
- Python `email_text_normalize` 作为子敬入口二次清洗
- Agent **只消费规范化 `text`**
