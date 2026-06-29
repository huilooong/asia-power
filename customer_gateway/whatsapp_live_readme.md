# WhatsApp Business App Live Read-Only Connector

## APLIVE-002 / APLIVE-002A

Linked-device / WhatsApp Web read-only pipeline for WhatsApp **Business App** (not Cloud API).

## Install Playwright (APLIVE-002A)

```bash
pip install playwright
python -m playwright install chromium
```

## Flow

```
WhatsApp Business App → QR / Linked Device
  → Playwright Chromium (persistent session)
  → WHATSAPP_LIVE_INBOX/*.json
  → /whatsapp listen --readonly
  → APSales drafts → Telegram approval
```

## Environment

```bash
WHATSAPP_CONNECTOR_MODE=business_web_readonly
WHATSAPP_LIVE_ADAPTER=browser
WHATSAPP_SESSION_DIR=memory/customer_gateway/whatsapp_session
WHATSAPP_LIVE_INBOX=memory/customer_gateway/live_inbox
WHATSAPP_SEND_ENABLED=false
WHATSAPP_MARK_READ_ENABLED=false
WHATSAPP_BROWSER_HEADLESS=false
WHATSAPP_POLL_RECENT_MESSAGES=20
```

## Manual acceptance

1. `python main.py "/whatsapp business connect"` — scan QR in browser
2. Send test message to CEO WhatsApp Business
3. `python main.py "/whatsapp business poll --readonly"`
4. `python main.py "/whatsapp listen --readonly"`
5. `python main.py "/drafts list"`

## Safety

All write operations raise `SafetyError` and write audit logs. No send, type, mark-read, delete, archive.

## Fallback

Set `WHATSAPP_LIVE_ADAPTER=mock` for CI or when Playwright is unavailable.
