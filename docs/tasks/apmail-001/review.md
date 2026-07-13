# APMAIL-001 Review

## 是否建议部署

**建议部署，分两步：**

1. **先部署 Node API（`inventory-site-server` + `email-proxy` + `mailparser`）**  
   - 即使旧 Worker 仍吐出带 `=` 的 text，ingest 层也会清洗  
   - 子敬 Python 层也有二次 normalize  
   - **立即挡住 Telegram/Agent 乱码**

2. **再部署 Cloudflare Email Worker**  
   - 源头解码更正确，并开始传 `rawBase64` 供 mailparser  
   - 需 `wrangler deploy` + 确认 webhook secret 不变

## 风险

| 风险 | 说明 | 缓解 |
|------|------|------|
| Worker 未立刻部署 | 旧 Worker 仍可能产出坏 text | Node/Python 双层清洗已覆盖 |
| rawBase64 体积 | 大附件邮件可能超限 | Worker 限制约 180KB；超限只发 text/html |
| mailparser 新依赖 | 需生产 `npm install` | 已写入 package.json |
| HTML→text 信息损失 | 复杂表格变简文本 | 优先 plain；业务本就是询盘文本 |

## 兼容性

- 现有 webhook JSON 字段兼容（`from/to/subject/text/...`）
- 新增可选：`html`、`rawBase64`、`detectedEncoding`、`detectedCharset`
- 出站 Resend / WhatsApp / SEO **未改动**

## 遗留问题

1. 历史已入库的乱码线程不会自动回写；新入站与 `latest_inbound_text` 读取时会清洗
2. 若需回放历史线程，可另写一次性脚本对 `data/email-threads.json` 跑 `normalizeEmailText`
3. Cloudflare Worker 需人工/流水线部署后，源头质量才完全对齐

## 结论

代码与测试已完成，**可部署**。优先 Node，再 Worker。
