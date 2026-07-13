# APSALES-NLU-002 — Local Test Results

**Date:** 2026-07-13  
**Runner:** `.venv-qxb/bin/python3` + `node --test`

## Scenarios

| # | Scenario | Result |
|---|----------|--------|
| 1 | `2sz` → ask_scope → `Complete engine` → scope + commercial advance | **PASS** |
| 2 | `2sz` → ask_scope → `Long block` → scope, no LLM path | **PASS** |
| 3 | ask_engine_plate → image → received, no re-ask plate | **PASS** |
| 4 | Same image/webhook wamid replay | **PASS** (dedup) |
| 5 | Concurrent same text wamid ×4 | **PASS** (atomic claim) |

## Unit

- `tests/test_apsales_nlu_002.py` — 6/6 PASS  
- `tests/test_whatsapp_cloud_webhook.js` — 4/4 PASS (incl. P2 concurrent)

Raw output: `test-results.out.txt`

## E2E (local script path)

| Turn | next_action | source |
|------|-------------|--------|
| `2sz` | `ask_scope` | commercial_decision |
| `Complete engine` | `ask_quantity` | commercial_decision |
| image after plate ask | not `ask_engine_plate` | commercial (ack / advance) |
