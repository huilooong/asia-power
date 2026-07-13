# Quantity / context answer binding (NLU-002 follow-up)

## Bug

After `ask_quantity`, customer sent `1` → NLU `new_request` (no quantity entity) → router missed Commercial Decision → Python LLM import failed (`No module named 'core'`) → JS **fallback welcome** (“Hi — AsiaPower here…”).

## Fix (existing chain only)

| last_system_action | Customer answer | Act / entity | Force commercial |
|--------------------|-----------------|--------------|------------------|
| ask_scope | complete engine / long block / … | answer_previous_question + product_scope | yes |
| ask_quantity | `1` / `2 units` / `ten pieces` | answer_previous_question + quantity | yes |
| ask_destination | Tema / Accra / Dubai / country | answer_previous_question + destination_port | yes |
| ask_vin | 17-char VIN | answer_previous_question + vin | yes |
| ask_engine_plate/photo | image | media evidence path | yes |

Bare `1` **without** ask_quantity stays `new_request` (not quantity).

State: `known.quantity` / `known.destination_port` via Conversation State.  
Decision: qty present → next `ask_destination` (or existing follow-on).

## Double welcome investigation

Two `1` messages at 12:15:20Z and 12:15:45Z:

| | |
|--|--|
| Normalized wamids | **two different** inbound message ids |
| Outbound wamids | **two different** Graph sends |
| Gap | ~25 seconds |
| Verdict | **Two real inbound messages** (customer resent / typed twice). Not outbound idempotency miss — each wamid was unique so P2 correctly allowed one send each. Root cause of welcome text = missing quantity binding + fallback path. |
