# APSALES-DECISION-001 — Decision Model

## Commercial Decision Record（每轮）

字段与任务书一致。只存可审计业务理由，不存隐藏 CoT。

```json
{
  "decision_id": "cdr-...",
  "conversation_id": "",
  "customer_intent": "engine_code_claim|vin_provided|price_request|...",
  "customer_type": "unknown|retail|repairer|wholesaler|repeat_buyer",
  "product_type": "engine|gearbox|half_cut|part|unknown",
  "claimed_identity": {"engine_code": "", "source": "customer_text|vin|plate|photo|none"},
  "evidence": [],
  "evidence_confidence": 0.0,
  "commercial_risk": "low|medium|high",
  "risk_reasons": [],
  "known": [],
  "missing": [],
  "sales_stage": "identify|confirm_identity|scope|commercial_fields|quote_ready|manual_review",
  "objective": "",
  "next_best_action": "",
  "expected_result": "",
  "alternative_actions": [],
  "human_review_required": false,
  "decision_reason": ""
}
```

## Next Best Action 枚举（V1）

`ask_engine_photo` · `ask_engine_plate` · `ask_vin` · `ask_scope` · `ask_quantity` · `ask_destination` · `decode_vin` · `inspect_image` · `check_knowledge` · `request_manual_review` · `check_supplier` · `prepare_quote` · `wait_customer` · `decline_wrong_supply`

## Decision Result（Evidence，客户下一行为）

`sent_engine_photo` · `sent_engine_plate` · `sent_vin` · `confirmed_scope` · `confirmed_quantity` · `confirmed_destination` · `entered_supplier_check` · `entered_quote_preparation` · `customer_replied_without_progress` · `customer_silent` · `wrong_identity_detected` · `manual_review_required`
