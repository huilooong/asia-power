# APSALES-AUTOINTELLIGENCE-001 — Analysis

**日期：** 2026-07-13  
**阶段：** Phase 1 — 调研 / 分析 / 架构  
**禁止本阶段：** 改生产、部署、写大量实现代码、接汽修宝到 APSales

---

## 1. 结论（先看这里）

| 问题 | 答案 |
|------|------|
| 要新建 VIN Engine 吗？ | **不要** |
| VIN 属于哪里？ | **Sales Decision → Customer Intelligence** |
| 仓库已有 VIN 解码吗？ | **有**（汽修宝 QXB → `/api/vin/decode`），但用于**库存/供应商/子龙**，**未接销售对话** |
| APSales 本阶段接汽修宝吗？ | **不接**（CEO 定：汽修宝属子龙采购） |
| APSales 需要什么？ | **全球 VIN 能力**（NHTSA / 成熟开源）作 Customer Intelligence 输入 |
| Phase 1 交付？ | 调研 + 架构文档；**等 CEO Review** |

---

## 2. 真实问题（来自 WhatsApp Evidence）

当前行为：

```
客户发 VIN
  → 立刻生成回复（常重复问车型/年份/发动机）
```

应有行为（Think Before Reply）：

```
客户发 VIN
  → Customer Intelligence（解码 / 已知事实）
  → Sales Decision（还缺什么销售字段）
  → Truth Guard
  → Reply（只问缺失项）
```

Evidence 已证明：`ask_vin → sent_vin → Decision Result=succeeded`，  
但下一轮仍未「用 VIN 变聪明」，只是确认收到。

---

## 3. 现有能力（可复用，不重复造）

| 能力 | 路径 | 用途 | APSales 现状 |
|------|------|------|--------------|
| QXB 解码链 | `server/lib/vin/*` + `/api/vin/decode` | 库存 / 供应商上传 | **销售未用**；本阶段**不接** |
| Python 调解码 | `inventory_core/qxb_pipeline.decode_vin_via_api` | QXB 批量 | 子龙侧 |
| Enquiry 缺字段 | `sales_core/enquiry_context.py` | 「别重复问」原则 | **无 VIN/车型槽位** |
| Sandbox VIN 回复 | `whatsapp-cloud-sandbox.js` `vinReceivedReply` | 固定三问 | **未 decode** |
| Evidence Decision | `asiapower-evidence.js` | 记录 ask_vin / sent_vin | 无 vehicle_snapshot |
| Coach VIN flags | `sales_coach/decisions.py` | 启发式 | 不解码 |

**屎山风险：** 若销售再写一套 QXB 直连，会与库存解码双轨、配额双倍。  
**正确做法：** Customer Intelligence 用**统一 enrich 接口**；Provider 可插拔（全球 OSS / 未来子龙 QXB）。

---

## 4. 本任务真正要新增什么？（批准后，非本阶段）

| 新增 | 性质 |
|------|------|
| `Customer Intelligence` 概念（属 Sales Decision） | 设计层 |
| VIN enrich Provider（全球，优先开源/NHTSA） | 薄适配，非 Engine |
| `known` / `missing` 事实计算 | 扩 `enquiry_context` 思路 |
| Decision 先于 Reply | 改 Sales Decision 顺序 |

**不新增：** Engine / Service / Microservice / 顶层目录 / 自研 VIN 算法 / 汽修宝接 APSales。

---

## 8. CEO Architecture Review 修订（2026-07-13）

| 修订 | 落实 |
|------|------|
| 最终目标 | **AsiaPower Vehicle Intelligence**（VIN 只是入口） |
| Vehicle Knowledge | `data/vehicle_knowledge/`；自有优先，外部补充 |
| 降低外部依赖 | Roadmap：逐步降低 Decoder/API/LLM/Token |
| 无 Engine / Service | 保持 |
| CI ∈ Sales Decision | 保持 |
| 有条件批准 → Phase 4 | 本地已实现；**未部署** |
