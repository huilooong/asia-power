# Scope Answer Routing (P0-1 / P0-2 / P0-3)

## Phrases → `product_scope`

| Phrase | `normalized_value` |
|--------|-------------------|
| complete engine / full engine / complete | `complete_engine` |
| long block | `long_block` |
| bare engine / engine only | `bare_engine` |
| engine + gearbox / with gearbox | `engine_gearbox` |

Standalone `complete` only when `previous_system_action == ask_scope`.

## NLU output (after `ask_scope`)

```
communicative_act = answer_previous_question
intent = provide_scope
entity.type = product_scope
entity.normalized_value = complete_engine | long_block | …
references_previous_turn = true
```

Without prior `ask_scope`, same text may remain `new_request` (intent still `provide_scope` when phrase matches).

## Router

If `last_system_action == ask_scope` AND NLU has `product_scope` → `force_commercial = True` → **never** general LLM.

## State + Decision

- `update_state_from_understanding` writes `conversation_state.known.product_scope`
- Commercial Decision sees scope → next among `ask_quantity` / `ask_destination` / `check_supplier` / `prepare_quote`
- Strip / block `ask_engine_plate` / `ask_engine_photo` unless new high-risk conflict
