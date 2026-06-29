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

- **Alerts bot** (env): `ASIAPOWER_TELEGRAM_BOT_TOKEN`, `ASIAPOWER_TELEGRAM_CHAT_ID` — lead/upload/reminder pushes via `server/lib/telegram-notify.js`
- **Command Center bot** = `@Asiapower_sam_bot` (polls group, Sam/Kongming/Claude routing)
- **Sursor bot** = `@sursor_bot` (all Sursor ack + replies — not Sam)
- **Work group** (team chat): `Asia-power AI Command Ceter` · chat_id `-1004428287084` — 需求 / 分工 / 复盘
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
