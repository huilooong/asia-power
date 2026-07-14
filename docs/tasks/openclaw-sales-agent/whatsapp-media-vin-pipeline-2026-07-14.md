# WhatsApp 图片 / VIN 管线 — 2026-07-14

Status: implemented; awaiting CEO photo E2E on +233 after release.

## 结论

+233 bridge 已补齐：**下载图片 → OCR VIN → AsiaPower Vehicle Intelligence 解析 → 结构化上下文给 sales-agent → 自动回复**；并修复挂死超时与失败兜底。

## 图片丢失点（任务一）

| 层 | 事实 |
|---|---|
| QA driver `normalizeObservedMessage` | 只保留 `hasMedia/mediaType/...`，丢弃 Baileys raw（mediaKey 等） |
| 旧 bridge | `textForRouting` 只发「客户发来图片」占位 |
| 本次修复 | 新建 `apsales-whatsapp-session.mjs`（QA 路径，不碰 monitor 接管），保留 raw + `downloadInboundImage()` |

## 修改文件

- `deploy/apsales-live-draft/apsales-whatsapp-session.mjs`（新）
- `deploy/apsales-live-draft/bridge.mjs`
- `scripts/apsales-media-vin-ocr.py`（新）
- `scripts/apsales-media-vin-intelligence.py`（新）
- `scripts/deploy-production.mjs`
- `scripts/lib/release-manager.mjs`

## 关键能力

1. **媒体下载**：`session.downloadInboundImage(messageId)` — jpeg/png/webp，默认 8MB，落盘 hash 日志，不打 base64
2. **OCR**：tesseract / pytesseract；标准 17 位 VIN（允许首位数字）
3. **VIN 解析**：`enrich_from_vin`（AsiaPower store → NHTSA），**不用 QXB**
4. **sales-agent**：结构化 `media` + `vin_decode`；短回复规则；非 JSON/超时发客户安全兜底
5. **知识库**：只写 `vin_knowledge_pending.jsonl`（pending_confirm），不自动永久入库
6. **防挂死**：Gateway 子进程硬超时 `timeout+15s` SIGKILL

## 回滚（只关媒体/VIN，不影响文字接待）

```bash
# on production
cat >/etc/systemd/system/apsales-whatsapp-bridge.service.d/openclaw-sales-agent.conf <<'EOF'
[Service]
Environment=APSALES_REPLY_BRAIN=openclaw
Environment=APSALES_OPENCLAW_AGENT=sales-agent
Environment=APSALES_OPENCLAW_TIMEOUT_SECONDS=90
Environment=APSALES_MEDIA_VIN_ENABLED=false
EOF
systemctl daemon-reload
systemctl restart apsales-whatsapp-bridge.service
```

系统包回滚（如需）：`apt-get remove tesseract-ocr`（一般不必）。

## 本地验证

| 项 | 结果 |
|---|---|
| OCR 清晰 VIN 图 | 成功抽出 `1HGCM82633A004352` |
| Vehicle Intelligence | Honda Accord 2003 / NHTSA |
| bridge / session `node --check` | 通过 |

## 生产 E2E（CEO）

待发布后：控制号发铭牌/底盘照片 → 查 bridge 日志 `media downloaded` / `openclaw reply sent`。

## Release

- Commit / Release ID：部署后回填
