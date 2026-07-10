# Integrations Audit

Audit date: 2026-07-04

## Summary

`integrations/` contains real external-system bridges: Telegram, WeCom, and social-browser automation. These are operationally sensitive because they can send messages, consume account sessions, or process external callbacks.

## Telegram

| File | Responsibility | Status | Risk |
|---|---|---|---|
| `telegram_access.py` | Chat ID parsing and authorization helpers | Active | Low |
| `telegram_coo_bot.py` | COO long-polling Telegram bot | Active | High |
| `telegram_coo_handler.py` | COO handler/debug dispatch | Active | Medium |
| `telegram_apsales_bot.py` | APSales private work console, draft commands | Active | High |
| `telegram_voice.py` | Downloads/transcribes Telegram voice/audio | Active | High |

Assessment: Telegram access control exists, but send paths are spread through `tools/message_tool.py`, `server/lib/telegram-notify.js`, customer gateway modules, and scripts. A single notification service contract is needed.

## WeCom

| File | Responsibility | Status | Risk |
|---|---|---|---|
| `wecom_access.py` | WeCom whitelist and mention handling | Active | Medium |
| `wecom_callback_server.py` | HTTP callback server for WeCom | Active | High |
| `wecom_client.py` | Access token cache, send text/media download | Active | High |
| `wecom_config.py` | Env config loader | Active | Medium |
| `wecom_crypto.py` | Callback encryption/decryption | Active | Medium |
| `wecom_group_upload.py` | Group photo sessions to QXB pipeline | Active | High |
| `wecom_zijing_handler.py` | Routes WeCom messages to agents/upload flow | Active | High |

Assessment: WeCom is useful for supplier/photo ingestion, but the naming is mixed: help text says ZiLong inventory assistant while file name says Zijng/APSales. Inventory and sales routing should be separated before production expansion.

## Social Browser

| File | Responsibility | Status | Risk |
|---|---|---|---|
| `social_browser/session_manager.py` | Persistent Playwright session locks | Active | Critical |
| `social_browser/platform_adapter.py` | Login/session helpers and platform UI adapters | Active | Critical |
| `social_browser/facebook_friends.py` | Accept friend requests | Active | Critical |
| `social_browser/facebook_feed_research.py` | Browse FB feed and extract market intel | Active | High |
| `social_browser/facebook_groups.py` | Search/join/greet FB groups | Active | Critical |
| `social_browser/facebook_messenger.py` | One-to-one Facebook DMs | Active | Critical |

Assessment: This is the riskiest integration area. It uses real browser sessions, can click/post/DM, and is scheduled by cron/launchd in other directories. It should not be invoked by broad “autopilot” flows unless each operation is explicitly approved and rate-limited.

## Main Problems

- Integration send/post abilities are not isolated from business orchestration.
- Browser automation has many action-specific entrypoints instead of one policy-enforced executor.
- WeCom, Telegram, email, and social all have separate approval/authorization logic.
- Some integrations write operational state into `memory/`, which blurs memory vs runtime state.

## Recommendations

1. Create one `OutboundActionGateway` concept for any action that leaves the machine: Telegram send, WeCom send, email send, Facebook post/DM, Cloudflare deploy.
2. Require all external actions to carry: actor, channel, target, payload summary, approval ID, dry-run flag, rate-limit bucket.
3. Keep read-only integrations callable; freeze write-capable social browser operations until the action gateway exists.
4. Separate WeCom supplier upload from APSales routing in naming and code ownership.

