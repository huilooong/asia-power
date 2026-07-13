# APSALES-AUTOINTELLIGENCE-001 — VIN → Sales Decision

**目标：** Think Before Reply。VIN 用于 **减少提问、提高专业度**，不是展示解码炫技。

---

## 1. 收到 VIN 后：先思考的问题

### ① 能识别哪些信息？（尽量）

| 信息 | 典型来源 | 销售用途 |
|------|----------|----------|
| 品牌 Make | NHTSA / corgi | 不再问品牌 |
| 车型 Model | 同上 | 不再问车型 |
| 年款 Year | 同上 | 不再问年份 |
| 发动机构造描述 | 常有（排量/缸数/燃料） | 辅助；精确代码可能仍缺 |
| 发动机精确代码（G4KD 等） | **经常没有** | 有则不再问；无则可用「确认发动机型式」弱问或靠库存侧 |
| 变速箱 | 有时有 | 有则少问 |
| 制造国 / 工厂 | 常有 | 专业感；非必问 |
| 平台 / 车身 | 有时有 | 辅助 |

若 decode **失败**：诚实降级 → 仍可确认「已收到 VIN」，只问销售缺口；**禁止假装解码成功**。

---

### ② 哪些问题已经不用再问？

规则（Decision 层）：

| 若 known 包含 | do_not_ask |
|---------------|------------|
| brand + model | 车型是什么 |
| year | 哪一年 |
| engine_code（高置信） | 发动机型号是什么 |
| vin | 请发 VIN |

**禁止：** VIN 已提供仍发「Please send VIN or model + year + engine code」整段模板。

---

### ③ 还缺哪些信息？（才该问）

销售成交仍常缺（与 VIN 无关）：

| missing | 为什么还要问 |
|---------|----------------|
| product_scope | long block / complete engine / gearbox / 附件范围 |
| quantity | 数量 |
| destination_port | 港口 / 贸易条款基础 |
| （可选）配件清单 | 交流发电机等 — **一次短列表，勿邮件腔长文** |

**原则：** 一次最多问 **真正 missing** 的 1～3 项；短句；WhatsApp 风格。

---

## 2. Decision 先于 Reply（伪代码）

```text
IF message contains VIN:
  snapshot = CustomerIntelligence.enrich_vin(vin)
  known = snapshot.known_fields
  missing = sales_required - known
  decision = {
    next_action: ask_missing_sales_fields | confirm_vehicle_then_quote | ...,
    vehicle_snapshot: snapshot,
    do_not_ask: known,
    ask_list: missing
  }
  THEN Truth Guard(decision, draft_reply)
  THEN send Reply that only asks ask_list
ELSE
  existing flow
```

---

## 示例（Think Before Reply）

**客户：** `1HGCM82633A004352`

**Decision：**

```text
known: vin, brand, model, year, engine_code, …
do_not_ask: brand, model, year, …
ask: product_scope, quantity, destination_port
next_action: ask_missing_sales_fields
knowledge: AsiaPower first → NHTSA supplement → write-back
```

**Reply 形态：** Identified: 2003 HONDA Accord → 只问 missing（验证已通过）。

---

## 4. 与 Evidence / Decision Result

| 事件 | Evidence |
|------|----------|
| decode 成功 | `customer_intelligence.ok=true` + snapshot 摘要 |
| 只问 missing | Decision=`ask_missing_sales_fields` |
| 客户回数量/港口 | Customer Result + Decision Result |

学习的是：**「VIN enrich 后少问」是否带来更快成交**，不是学长邮件。

---

## 5. Truth Guard 配合

| 情况 | 行为 |
|------|------|
| 无 snapshot | 不得声称「已确认匹配某某发动机」 |
| 有 snapshot | 可陈述 decode 字段；仍不得无供货证据承诺 stock/price |
| decode 失败 | 明确「VIN received, specs pending」类短句 |

---

## 6. 本阶段不实现

本文只定规则。实现等 CEO 批准后另开阶段。
