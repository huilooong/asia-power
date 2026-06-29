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

- **Alerts bot** (env `ASIAPOWER_TELEGRAM_BOT_TOKEN` / `ASIAPOWER_TELEGRAM_CHAT_ID`) is actually **`@sursor_bot` (周瑜)** — same token as `SURSOR_TELEGRAM_BOT_TOKEN`. So `scripts/telegram-test.js` pushes appear FROM Sursor, not Sam. lead/upload/reminder pushes via `server/lib/telegram-notify.js`
- **Sam = COO bot = `@APCOO_BOT`** (env `COO_TELEGRAM_BOT_TOKEN`), the dispatcher: takes CEO message → `coo_core/dispatcher.py` `dispatch_message` → approval gate → `route_with_profile()` assigns to other agents. **PRIVATE CHAT ONLY** — `integrations/telegram_access.py` hard-rejects group/supergroup (`non_private`). Whitelist `COO_TELEGRAM_ALLOWED_CHAT_IDS=8918522756` (= Weylon Hui private chat). DM **@APCOO_BOT** directly; do NOT @ it in a group, and `@Asiapower_sam_bot` does NOT exist.
- **Sursor bot** = `@sursor_bot` (周瑜) (all Sursor ack + replies — not Sam)
- **Work group** `Asia-power AI Command Ceter` · chat_id `-1004428287084` — multi-agent in-group reporting/discussion is NOT implemented (premature; bot rejects group chats). Private chat with Sam only for now.
- Launcher: COO bot is a **launchd agent** `~/Library/LaunchAgents/ai.asiapower.apcoo-bot.plist` (repo copy at `ops/launchd/`), `RunAtLoad`+`KeepAlive` → starts at login, auto-restarts on crash. Manage: `launchctl kickstart -k gui/$(id -u)/ai.asiapower.apcoo-bot` (restart after code change), `launchctl bootout gui/$(id -u)/ai.asiapower.apcoo-bot` (stop). Logs → `memory/apcoo-bot.log`. Do NOT also run it manually (409 polling conflict).
- **Voice notes:** DM a voice/audio message to @APCOO_BOT → `integrations/telegram_voice.py` downloads via `getFile` and transcribes with OpenAI Whisper (`whisper-1`, override via `COO_VOICE_MODEL`) → bot echoes "🎙️ 已识别:…" then routes the text through `dispatch_message`. Only the whitelisted chat is transcribed (auth happens first).
- **Sursor long tasks:** @sursor → `sursor_tasks` queue → `sursor_openclaw_worker.py` on prod (3600s, autonomous, no confirm loops)
- Test alert: `node scripts/telegram-test.js "message"`

### WhatsApp

- **Primary (live since 2026-06-25):** Ghana `233540911111` (`+233 54 091 1111`) — in `js/config.js` as `whatsapp`
- China number `8618603773077` kept as `chinaWhatsapp` fallback in config
- Cache-bust pattern: bump the `?v=` token on `config.js` / `styles.css` in HTML to force Cloudflare + browser to reload (CF API token on the box is R2-scoped, **cannot** purge zone cache)

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Sales Intelligence DB — ALWAYS query, never re-derive

The WhatsApp/sales DB is already built (`memory/sales_intelligence/`, 524 会话 / 12724 消息).
**Any data question → run the verified report; do NOT burn tokens analyzing or guessing numbers.**

```bash
cd /Users/longhui/Desktop/AsiaPower && source .venv/bin/activate
python -m truth.verified_sales_intelligence "客户来自哪些国家"   # deterministic, ~5ms, no LLM
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
