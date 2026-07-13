# APSALES-AUTOINTELLIGENCE-001 — Review（Phase 5）

## 新增了什么？

- AsiaPower **Vehicle Intelligence** 目标与 `data/vehicle_knowledge/`  
- `sales_core/vehicle_intelligence.py`（Customer Intelligence ∈ Sales Decision）  
- WhatsApp VIN：先 enrich/Decision，再 Reply  
- Evidence：`customer_intelligence` 块  

## 为什么新增？

真实客户发 VIN 后仍像普通 AI 追问已知项；需要 Think Before Reply。

## 为什么不放进新 Engine？

CEO 边界：CI 属于 Sales Decision；Knowledge 是数据沉淀，不是调度引擎。

## 最终目标对齐？

✅ VIN Decoder ≠ 终点；终点是 **AsiaPower Vehicle Intelligence** + 自有 Knowledge 优先。

## 可复用？

✅ 未来 OE / 铭牌 / 图片 / 反馈 / 人工纠正 → 同一 Knowledge 形状。

## 未部署

本地验证通过；生产需 CEO 另批。
