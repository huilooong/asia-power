# APSALES-NLU-002 — Root Cause

**Date:** 2026-07-13  
**Incident (prod):** wa_id suffix `3077` — after `ask_scope`, customer said `Complete engine` → dropped into APSales LLM → asked engine plate; later image → same plate ask again.

## Facts

| Step | Observed |
|------|----------|
| Customer `2sz` | Commercial Decision → `ask_scope` ✅ |
| Customer `Complete engine` | Router treated as non-commercial → **LLM** → `ask_engine_plate` ❌ |
| Customer `[image]` | No evidence path → **LLM** → same plate ask ❌ |
| Webhook logs | 1 decision / 1 normalized / dups=0 for that text |

## Root cause (confirmed)

1. **NLU** classified bare scope phrases (`Complete engine`, `Long block`, …) as `new_request` / generic inquiry without binding to prior `ask_scope`.
2. **Router** (`whatsapp_cloud_sandbox_reply.py`) only forced Commercial Decision on engine-code / price / certain NLU hits — **not** on scope answers after `ask_scope`.
3. **Images** were not forced onto commercial / evidence path; state lacked `requested_evidence_received`, so dead-loop guard did not stop re-asking plate.
4. **Not** webhook concurrent double-send for this incident (P2 still added as prevention).

## Fix principle

Context-bound communicative acts + force Commercial Decision + image evidence state — **no prompt stacking**.
