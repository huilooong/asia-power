# APSALES-NLU-002 — Review

## Scope delivered

| ID | Item | Done |
|----|------|------|
| P0-1 | Force Commercial after ask_scope scope phrases | ✅ |
| P0-2 | NLU answer_previous_question + product_scope | ✅ |
| P0-3 | known.product_scope → commercial advance | ✅ |
| P1 | Image → evidence/commercial, not LLM | ✅ |
| P1-2 | Evidence state fields | ✅ |
| P2 | Atomic inbound + outbound idempotency | ✅ (prevention; not today’s root cause) |

## Preserved

Commercial Decision V1, NLU-001, Conversation State, Evidence, Truth Guard.

## Forbidden (honored)

No prompt stacking; no synonym-masking duplicates; no image→LLM; no new Engine/microservice; no quote/VIN/website/ads changes.

## Production

Release `REL-20260713122504-api-d519e7940`（qty binding）已完成。  
US 5223 真出站：`2sz`→scope→`Complete engine`→quantity→`1`→**Which destination port?**（commercial，无欢迎语）；同 wamid 幂等跳过。

详见 `quantity-answer-binding.md` + `production-validation.md`。

