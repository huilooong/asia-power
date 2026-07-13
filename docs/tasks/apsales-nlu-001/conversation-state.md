# Conversation State (V1)

路径：`data/whatsapp_cloud/conversation_state/wa:<digits>.json`

## 结构

```json
{
  "conversation_id": "wa:19402375223",
  "known": {},
  "customer_reported": {
    "engine_code": "2SZ",
    "engine_code_confidence": 0.99,
    "engine_code_status": "customer_reported"
  },
  "provider_reported": {},
  "verified": {},
  "conflicting": {},
  "missing": ["product_scope", "quantity", "destination_port", "installed_engine_evidence"],
  "asked_actions": ["ask_engine_plate"],
  "customer_answers": [],
  "unavailable_evidence": [],
  "last_customer_act": "clarify_information",
  "last_system_action": "ask_engine_plate",
  "last_outbound_hash": "…",
  "last_outbound_excerpt": "…",
  "turn_count": 2,
  "updated_at": "…"
}
```

## 更新规则

1. **先** Message Understanding，**再** `update_state_from_understanding`
2. 客户声称 engine code → `customer_reported` + `known.claimed_engine_code`（非 verified）
3. 澄清同一代码 → 提高 confidence，保留 customer_reported
4. 纠正（not 2SZ, it is 3SZ）→ 写入新代码；旧值进 history / conflicting
5. 「没有铭牌」→ `unavailable_evidence` 含 `engine_plate`
6. Decision 之后 `record_system_action` 写入 last_system_action / outbound hash

## Decision 消费

`decide_commercial(..., prior_state=, understanding=)` 读取：

- customer_reported.engine_code
- asked_actions / last_system_action
- unavailable_evidence

不得只靠当前句 keyword。
