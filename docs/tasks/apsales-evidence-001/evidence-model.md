# APSALES-EVIDENCE-001 — Evidence Model（V1）

**原则：** Decision First · Append Only · 事实不猜 · Truth Guard 独立节点 · 学 Decision 不学 Reply。

**根目录：** `data/evidence/`（AsiaPower 级）  
**V1 通道：** `data/evidence/whatsapp/`

---

## 1. Evidence Flow（存证顺序）

```
Customer → Decision → Truth Guard → Reply → CEO → Customer Result → Decision Result
```

---

## 2. Turn Schema（`turns.ndjson` 一行）

```json
{
  "schema_version": 1,
  "type": "evidence_turn",
  "evidence_id": "ev-20260713T053755Z-a1b2c3d4",
  "at": "2026-07-13T05:37:55.711Z",
  "channel": "whatsapp",

  "customer": {
    "message": "How much for this car?",
    "intent": "price_request",
    "conversation_id": "19402375223",
    "customer_id": "wa:19402375223",
    "timestamp": "2026-07-13T05:37:50.000Z",
    "inbound_wamid": "wamid.IN..."
  },

  "decision": {
    "sales": "quotation",
    "sales_detail": "collect_vin_first",
    "next_action": "ask_vin",
    "module": "SALES_DECISION",
    "reason_code": "price_advance",
    "flags": { "ask_vin": true, "defer_quote": true, "quote_now": false }
  },

  "truth_guard": {
    "verdict": "rewrite",
    "reason_code": "price_advance",
    "risk_blocked": true,
    "original_reply": "（Guard 之前的回复全文；若未改写可与 reply 相同或省略）",
    "note": "why blocked / why passed / why rewritten — 可追溯"
  },

  "reply": {
    "text": "（最终真正发送给客户的完整原文）",
    "outbound_wamid": "wamid.OUT...",
    "sent": true
  },

  "ceo": {
    "modified": false,
    "before_text": null,
    "after_text": null,
    "reason": null,
    "source": null
  },

  "customer_result": {
    "status": "pending",
    "observed_at": null,
    "fact": null,
    "next_inbound_wamid": null
  },

  "decision_result": {
    "status": "pending",
    "observed_at": null,
    "basis": null
  },

  "live_fix": null,

  "refs": {
    "normalized_path": null,
    "draft_id": null,
    "sandbox_log": "data/whatsapp_cloud/sandbox/decisions.ndjson"
  }
}
```

---

## 3. Truth Guard（独立节点）

| verdict | 含义 |
|---------|------|
| `pass` | 放行，未改回复 |
| `block` | 阻止原回复并替换 |
| `rewrite` | 因策略改写（如 price_advance） |

必须能回答：**为什么放行 / 为什么阻止 / 为什么改写** → 靠 `verdict` + `reason_code` + `original_reply`。

---

## 4. Customer Result（事实）

| fact | 含义 |
|------|------|
| continued_chat | 继续聊天 |
| sent_vin | 发送 VIN |
| sent_model | 发送车型 |
| sent_image | 发送图片 |
| sent_qty | 发送数量 |
| sent_port | 发送港口 |
| asked_price | 询价 |
| silent | 沉默（超时规则另定） |
| ended | 结束 |
| pending | 尚无观察 |

**禁止猜测情绪。**

---

## 5. Decision Result（学 Decision，不学 Reply）

| status | 含义 |
|--------|------|
| `pending` | 尚无客户下一步 |
| `succeeded` | 客户行为证明 Decision 有效（例：Ask VIN → Sent VIN） |
| `failed` | 客户明确结束，或 Decision 目标被明确拒绝 |
| `inconclusive` | 有下一步，但未证明也未否定 Decision |

示例：

```
Decision.next_action = ask_vin
Customer Result.fact = sent_vin
→ Decision Result.status = succeeded
  Decision Result.basis = customer_sent_vin
```

回填方式：追加 `patches.ndjson`，**不覆盖**原 turn。

```json
{
  "type": "evidence_patch",
  "evidence_id": "ev-...",
  "at": "...",
  "customer_result": { "status": "observed", "fact": "sent_vin", "observed_at": "...", "next_inbound_wamid": "..." },
  "decision_result": { "status": "succeeded", "basis": "customer_sent_vin", "observed_at": "..." }
}
```

读时：turn + 最新 patch 合并为视图。

---

## 6. Append 规则

1. 永不覆盖、永不删除  
2. 结果回填只走 patch  
3. 写入失败 → `failed.ndjson`，不挡发送  

---

## 7. 明确不存

Prompt、Token、模型名、内部分析全文、猜测情绪、自动改进建议（那是 Coach 只读输出）。

---

## 8. 多通道复用

同一 schema；换 `channel` + 子目录：`email/` `website/` `supplier/` `seo/` `apcoo/`。  
V1 **只实现** `whatsapp/`。
