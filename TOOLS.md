# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH / production

- asia-power → `root@159.65.86.24`
- site root → `/root/.openclaw/workspace/inventory-site/`
- public → `.../public/`
- deploy → `node scripts/deploy-production.mjs root@159.65.86.24` (approval required)

### Telegram

- **WhatsApp Cloud monitor + quote bot** (env `ASIAPOWER_TELEGRAM_BOT_TOKEN` / `ASIAPOWER_TELEGRAM_CHAT_ID`) = **`@Asiapower86166_bot`** — dedicated; webhook `/api/telegram/whatsapp-quote`. Do **not** share token with OpenClaw.
- Legacy note: site `TELEGRAM_BOT_TOKEN` may still equal Kongming `@weylonbot`; `telegram-notify.js` prefers `ASIAPOWER_*` first. lead/upload/reminder pushes via `server/lib/telegram-notify.js` now go to the dedicated bot when `ASIAPOWER_*` is set.
- **Sam = COO bot = `@APCOO_BOT`** (env `COO_TELEGRAM_BOT_TOKEN`), the dispatcher: takes CEO message → `coo_core/dispatcher.py` `dispatch_message` → approval gate → `route_with_profile()` assigns to other agents. **PRIVATE CHAT ONLY** — `integrations/telegram_access.py` hard-rejects group/supergroup (`non_private`). Whitelist `COO_TELEGRAM_ALLOWED_CHAT_IDS=8918522756` (= Weylon Hui private chat). DM **@APCOO_BOT** directly; do NOT @ it in a group, and `@Asiapower_sam_bot` does NOT exist.
- **Sursor bot** = `@sursor_bot` (周瑜) (all Sursor ack + replies — not Sam)
- **Work group** `Asia-power AI Command Ceter` · chat_id `-1004428287084` — multi-agent in-group reporting/discussion is NOT implemented (premature; bot rejects group chats). Private chat with Sam only for now.
- Launcher: COO bot is a **launchd agent** `~/Library/LaunchAgents/ai.asiapower.apcoo-bot.plist` (repo copy at `ops/launchd/`), `RunAtLoad`+`KeepAlive` → starts at login, auto-restarts on crash. Manage: `launchctl kickstart -k gui/$(id -u)/ai.asiapower.apcoo-bot` (restart after code change), `launchctl bootout gui/$(id -u)/ai.asiapower.apcoo-bot` (stop). Logs → `memory/apcoo-bot.log`. Do NOT also run it manually (409 polling conflict).
- **Voice notes:** DM a voice/audio message to @APCOO_BOT → `integrations/telegram_voice.py` downloads via `getFile` and transcribes with OpenAI Whisper (`whisper-1`, override via `COO_VOICE_MODEL`) → bot echoes "🎙️ 已识别:…" then routes the text through `dispatch_message`. Only the whitelisted chat is transcribed (auth happens first).
- **Sursor long tasks:** @sursor → `sursor_tasks` queue → `sursor_openclaw_worker.py` on prod (3600s, autonomous, no confirm loops)
- Test alert: `node scripts/telegram-test.js "message"`

### WhatsApp

- **Primary customer entry (APCONTACT-001):** `8616638801930` (`+86 166 3880 1930`) — `js/config.js` `whatsapp` + `chinaWhatsapp` (unified)
- Legacy Ghana Business App `+233 54 091 1111` kept for historical/ads/browser-chain notes only — not site default
- Cache-bust pattern: bump the `?v=` token on `config.js` / `styles.css` in HTML to force Cloudflare + browser to reload (CF API token on the box is R2-scoped, **cannot** purge zone cache)

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

### 汽修宝 QXB 批量上传

- 运维/runbook → **`data/knowledge-base/qxb-batch-upload-runbook.md`**（限流、脚本、reconcile、行状态）
- 单行：`python3 scripts/qxb-batch-upload.py <row…>`
- 全量剩余：`python3 scripts/qxb-batch-remaining.py --delay 15 --retry 4 --backoff 60`
- 429 瓶颈：`submissions` 30/h、`upload-token` 80/h（**不是** `/api/vin/decode`）
- **限流豁免**仅对白名单 IP：`TRUSTED_SUPPLIER_UPLOAD_IPS`（生产 `.env` + nginx geo）；其他客户保持限流
- 查本机 IP：`curl -s https://ifconfig.me`
- 进度：`reports/qxb-batch-upload.log` + `reports/qxb-batch-progress.json`

### 汽修宝 QXB 本地审核页（8789）— Codex UI + 子龙训练

- **单独终端**，仓库根目录：
  ```bash
  cd /Users/longhui/Desktop/AsiaPower
  QXB_REVIEW_PORT=8789 node work/qxb-agent/review_server.js
  ```
- Python pipeline：`.venv-qxb/bin/python3`（QXB 上传脚本）或 `.venv/bin/python3`（销售数据等）
- 浏览器：**http://127.0.0.1:8789/review**
- **确认可上传** → 写入 `trainingExemplars` + `rowOverrides` → `process --live` → `submit-review`
- **只保存学习 / 缺图跳过** → 同样写入子龙 learnings（不上传）；跳过会 `park_row`
- 记忆库收益来自 **`qxb-photo-slot-learnings.json` recognitionModel**（非浏览器 localStorage）
- 策略：`work/qxb-agent/qxb_policy.json`

### 企业微信 · AsiaPower 库存 Agent（内部昵称：子敬）

| 企业微信里显示 | 我们内部叫 |
|----------------|------------|
| **AsiaPower 库存 Agent** | **子敬** |

- Runbook：**`data/knowledge-base/wecom-zijing-setup-runbook.md`**
- 管理后台创建应用名：**`AsiaPower 库存 Agent`**
- Agent：**鲁肃（子敬）** = `apsales`；上传/VIN/库存关键词 → 自动 **子龙**
- 验证配置：`.venv/bin/python3 scripts/wecom-verify-config.py`
- 回调服务：`.venv/bin/python3 integrations/wecom_callback_server.py`（默认 **8790**）
- 开发公网：ngrok → 管理后台填 `WECOM_PUBLIC_BASE_URL` + `/wecom/callback`
- **国内 Lighthouse（企微回调）**：`ssh -i ~/.ssh/asiapowermac.pem root@124.222.191.164` · 代码 `/opt/AsiaPower/` · 回调 `https://asia-power.cn/wecom/callback`
- 群用法：**@AsiaPower 库存 Agent** 提问；`/ping`、`/help`、销售统计、`/sales-intelligence …`
- 日志：`memory/wecom-zijing.log`（launchd）+ `data/message_log.jsonl`（channel=`wecom`）
- **注意**：桌面登录企业微信 ≠ 管理后台；CorpID/Secret 必须在 [work.weixin.qq.com 管理后台](https://work.weixin.qq.com/wework_admin/frame) 获取
- **打开图文清单（CEO 双击 `.command`，勿直接双击 `.html` 以免用 Cursor 打开）**：`docs/打开-腾讯云购域名清单.command` · `docs/打开-国内同事腾讯云清单.command` · `docs/打开-子龙群内训练说明.command`（子敬配置仍用 `docs/企业微信-子敬-一步一步.command`）

### Cursor Agent 连接器状态（2026-06-30）

| 连接器 | 状态 | 用途 |
|--------|------|------|
| **浏览器 MCP** | ✅ 已连 | 打开 Admin、验证上线页、截图确认 |
| **Cursor 应用控制** | ✅ 已连 | 保存个人规则、打开自动化 |
| **生产 SSH** | ✅ 可用 | `root@159.65.86.24` 部署/查日志 |
| **国内 Lighthouse SSH** | ✅ 可用 | `ssh -i ~/.ssh/asiapowermac.pem root@124.222.191.164` |
| **asia-power.cn** | ✅ 可用 | 企微回调 HTTPS + 企业备案 |
| **asia-power.com** | ✅ 可用 | Admin / API / 公开目录 |
| **GitHub CLI** | ✅ 已登录 | `huilooong`，可查 PR/CI/workflow |
| **GitHub MCP** | ✅ 已配 | 项目 `.cursor/mcp.json` · 自动用 `gh auth token` · 查 PR/CI/issue |
| **Fetch MCP** | ✅ 已配 | 读外部文档/网页（Resend/Cloudflare 文档等） |

个人规则已写入：**CEO 模式 — 小白用户 + 全权授权**（中文沟通 + 已授权生产操作）。

## Sales Intelligence DB — ALWAYS query, never re-derive

The WhatsApp/sales DB is already built (`memory/sales_intelligence/`, 524 会话 / 12724 消息).
**Any data question → run the verified report; do NOT burn tokens analyzing or guessing numbers.**

```bash
cd /Users/longhui/Desktop/AsiaPower && source .venv/bin/activate
.venv/bin/python3 -m truth.verified_sales_intelligence "客户来自哪些国家"   # deterministic, ~5ms, no LLM
```

- Reads only on-disk verified files; every number carries a `source:`. If a stat isn't in the DB it says "不能判断" — that's correct, don't invent it.
- Telegram COO/Sales bots auto-route data questions here via `truth.truth_guard.is_business_intelligence_query` + `coo_core/dispatcher.py`. If a real data question slips to the LLM, fix = add a pattern to `_BI_PATTERNS` in `truth/truth_guard.py`, NOT answer from memory.
- Refresh the DB: `/sales-intelligence import --browser && /sales-intelligence analyze` (only when asked).

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## Related

- [Agent workspace](/concepts/agent-workspace)
