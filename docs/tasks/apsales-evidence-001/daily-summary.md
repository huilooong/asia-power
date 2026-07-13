# Evidence Daily Summary（规范）

**产物：** 每天最多一页  
**路径：** `docs/agents/apsales/coach/YYYY-MM-DD-evidence.md`  
**输入：** `data/evidence/whatsapp/turns.ndjson` + `patches.ndjson`  
**CLI：** `python -m sales_coach --evidence-summary --date YYYY-MM-DD`  
**禁止：** 消息数量当 KPI、Token、模型名、空洞口号  

**Sales Coach = Read Only**（不得改生产 / Prompt / Decision）

---

## 每天只回答四个问题

### ① 客户为什么继续聊天？

必须引用：`evidence_id`、客户原话、`decision.next_action`、`truth_guard.verdict`、`customer_result.fact`、`decision_result.status`。

### ② 客户为什么停止聊天？

仅事实：`silent` / `ended`。禁止猜情绪。

### ③ 今天哪些 Decision 被真实客户证明有效？

`decision_result.status == succeeded`（例：Ask VIN → Sent VIN）。

### ④ 今天哪些 Decision 没有证据？

`pending` / `inconclusive`。无证据 ≠ 错误。

---

## V1

已实现：`sales_coach/evidence.py`（只读）。
