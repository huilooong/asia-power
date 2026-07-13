# Image Evidence Routing (P1 / P1-2)

## Path

```
inbound media (image/photo/document)
  → force Commercial Decision (not LLM)
  → NLU message_type=image
  → conversation_state update
  → Decision: ack / review_image / manual_review / advance commercial
```

## State fields

| Field | Role |
|-------|------|
| `last_requested_evidence` | set when system asks plate/photo |
| `last_customer_message_type` | `image` / `text` / … |
| `requested_evidence_received` | true after fulfilling image |
| `image_received_at` | ISO timestamp |
| `pending_image_review` | true until human/OCR review |
| `customer_reported.customer_result` | `sent_image` |

## After `ask_engine_plate` / `ask_engine_photo`

1. Mark `sent_image` + `requested_evidence_received=true`
2. Reply acknowledges receipt (or review) — **never** re-send same plate ask
3. Dead-loop guard: same objective + same outbound blocked if image already received

## Without OCR

Still: acknowledge → `pending_image_review` / review path — **do not** re-ask the same photo.
