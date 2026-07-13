# APSALES-NLU-002 — Local Test Results

**Date:** 2026-07-13 (qty binding follow-up)  
**Runner:** `.venv-qxb/bin/python3`

## Scenarios

| # | Scenario | Result |
|---|----------|--------|
| 1 | Complete engine after ask_scope | **PASS** |
| 2 | Long block after ask_scope | **PASS** |
| 3 | Image after ask_engine_plate | **PASS** |
| 4–5 | Inbound/outbound dedup (Node) | **PASS** (prior) |
| Q1 | Bare `1` after ask_quantity → qty=1 → ask_destination | **PASS** |
| Q2 | Bare `1` without context ≠ quantity answer | **PASS** |
| Q3 | Tema after ask_destination | **PASS** |
| Q4 | VIN after ask_vin | **PASS** |

`tests/test_apsales_nlu_002.py` — 12/12 PASS  
Raw: `test-results.out.txt`
