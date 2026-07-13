# APMAIL-001 Implementation

## 设计

统一结构（`parseEmailPayload` / `parse_raw_email`）：

```json
{
  "subject": "...",
  "from": "...",
  "to": "...",
  "cc": "...",
  "date": "...",
  "messageId": "...",
  "text": "规范化纯文本",
  "html": "...",
  "attachments": [{ "filename", "contentType", "size" }],
  "detectedEncoding": "quoted-printable|base64|...",
  "detectedCharset": "utf-8|gbk|..."
}
```

流程：

```
Raw Email / Gmail-style fields
 → MIME Parser (mailparser | stdlib email)
 → Content-Transfer-Encoding 解码
 → Charset 解码（UTF-8 / GBK / GB18030 / ISO-8859-1 / Windows-1252）
 → HTML→可读文本（去 script/style/像素）
 → 空白规范化
 → 子敬 / APSales / Telegram
```

## 修改内容

| 文件 | 变更 |
|------|------|
| `server/lib/email-mime-parse.js` | **新建** 统一解析：`mailparser` + QP/HTML 清洗 |
| `server/lib/email-proxy.js` | `ingestInbound` 改为 async，先 `parseEmailPayload` |
| `deploy/inventory-site-server.js` | `await ingestInbound`；body 上限 1MB |
| `deploy/cloudflare-email-worker.js` | 嵌套 multipart、缺 CTE 时 QP 启发式、charset、可选 `rawBase64` |
| `customer_gateway/email_text_normalize.py` | **新建** Python 规范化 / stdlib MIME |
| `customer_gateway/email_inbound.py` | `latest_inbound_text` 强制 normalize |
| `package.json` / `package-lock.json` | 依赖 `mailparser` |
| `tests/test_email_mime_parse.js` | Node 回归 |
| `tests/test_email_text_normalize.py` | Python 回归 |
| `tests/test_email_proxy.js` | async ingest |

## 依赖

- Node：`mailparser@^3.9.14`（成熟 MIME 库）
- Python：stdlib `email`（无新 pip 依赖）

## 行为约定

- 优先 `text/plain`；否则由 HTML 生成纯文本
- 软换行：`=\r?\n` 删除；`[space]=\n` 规范为空格（匹配任务样例）
- 正文中间合法 `=`（如 `a = b`、`SKU=G4KJ`）保留
- 附件只保留元数据，不入库二进制
- 子敬只读规范化 `text` / `textRedacted`
