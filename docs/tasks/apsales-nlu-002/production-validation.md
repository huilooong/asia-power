# APSALES-NLU-002 — Production Validation

**Status:** PENDING deploy — fill after Release Manager + sandbox live turns  
**Mode:** `WHATSAPP_AUTONOMY_MODE=sandbox`  
**Business number:** +86 166 3880 1930  
**Sandbox allowlist:** `CEO_WHATSAPP_NUMBER` (US number on allowlist)

## Deploy (to fill)

| 项 | 值 |
|----|-----|
| Commit | TBD |
| Release (api) | TBD |
| Python sync | rsync → `/root/.openclaw/workspace/AsiaPower/` `sales_core/` + `scripts/whatsapp_cloud_sandbox_reply.py` + tests |

## Live checklist

| 场景 | Expected | Result |
|------|----------|--------|
| 1 Complete engine after ask_scope | answer_previous_question; scope; commercial NBA; not LLM | TBD |
| 2 Long block | scope=long_block; advance | TBD |
| 3 Image after plate ask | sent_image; requested_evidence_received; no re-ask | TBD |
| 4/5 Dedup | one process / one send | verified by unit + code on api |

## Evidence paths (prod)

- `inventory-site/data/whatsapp_cloud/normalized/`
- `inventory-site/data/whatsapp_cloud/decisions/` (if present)
- `AsiaPower/data/conversation_state/` (or site-local state dir used by reply script)

## Rollback

```bash
RESTORE_CONFIRM=<REL-ID> node scripts/release-restore.mjs <REL-ID>
# Plus restore AsiaPower sales_core / sandbox_reply to previous commit
```
