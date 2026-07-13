# Message Understanding Schema (V1)

每条客户消息先转为可审计 JSON（无隐藏 CoT）。

## 顶层字段

| 字段 | 说明 |
|------|------|
| message_id | 理解记录 ID |
| conversation_id | `wa:<digits>` |
| language | 默认 `en` |
| message_type | text / image / … |
| communicative_act | 见下表 |
| intent | engine_inquiry / price_request / … |
| entities[] | 结构化实体 |
| references_previous_turn | bool |
| is_clarification | bool |
| is_correction | bool |
| is_answer_to_previous_question | bool |
| cannot_provide_plate | bool |
| offers_photo_alternative | bool |
| unresolved_ambiguities | 如 hedged_engine_code |
| raw_text_excerpt | ≤200 字符 |

## communicative_act（V1）

`greeting` · `new_request` · `provide_information` · `clarify_information` · `correct_information` · `answer_previous_question` · `ask_price` · `ask_availability` · `ask_shipping` · `confirm` · `reject` · `cannot_provide_requested_evidence` · `send_alternative_evidence` · `unknown`

## 实体

`engine_code` · `vin` · `quantity`（以及扩展位：gearbox_code / make / model / year / port / OE / part / media signal）

### engine_code 实体示例

```json
{
  "type": "engine_code",
  "raw_value": "2sz",
  "normalized_value": "2SZ",
  "source": "customer_text",
  "confidence": 0.99,
  "verification_status": "customer_reported",
  "extraction": "phrase|whitelist|standalone"
}
```

## 示例

### `2sz`

- act: `provide_information`
- entity: `2SZ` / customer_reported / conf≈0.90–0.95

### `Engine code is 2sz`（上一轮已 ask_engine_plate）

- act: `clarify_information` 或 `answer_previous_question`
- is_clarification / is_answer_to_previous_question = true
- 仍为 customer_reported，**不是 verified**
