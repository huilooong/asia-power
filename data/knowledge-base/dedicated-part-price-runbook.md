# 专用零件定价展示 Runbook

**CEO 定稿：** 2026-07-10  
**一句话：** 单独上传的零件显示库内原价；半切估算才乘系数。

---

## 规则（必须遵守）

| 场景 | 列表 / 详情显示价 | 可否 ×0.35 等 |
|---|---|---|
| **单独上传**（发动机 / 变速箱 / 底盘 / 前切等，有 `passengerPartType` 或等价专用标记） | **库内 `priceUsd` 原价** | **禁止** |
| **规则带出、无单独实价**（半切整车挂到零件目录估算） | 整车 EXW × `PART_PRICE_RATIOS` | **允许**（transmission=0.35 等） |

- 详情页本来就走全价 EXW；列表也必须与库价一致。
- 事故例：HC250546 库价 **230**，列表误乘 0.35 → 错显 **81**。库从未被改。

## 代码入口

- `js/half-cut-directory.js`：`catalogPartPriceAmount` / `formatCatalogPartPrice` / `isDedicatedPartListing`
- `js/ebay-catalog-hub.js`：零件行价走 `formatCatalogPartPrice`（勿再裸调 `formatPartPriceUsd(…, ratio)`）
- 部署标记：`dedicated-price-v1`（后续 cache key 如 `stock-id-search-v2` 须**仍含**上述函数，换 `?v=` 时勿回退）

## 抽查

1. API：`GET /api/half-cuts/public/item?stockId=HC250546` → `priceUsd=230`，`passengerPartType=transmission`
2. 列表逻辑：专用件 → 显示 **230**，不是 **81**
3. 半切估算仍生效：非专用件仍可 ×0.35（例：整车价 ×0.35）

## 相关

- 取证报告：`docs/ops/ops-p0-gearbox-230-to-81.md`
- 展示 bug 初稿：`docs/ops/ops-p0-gearbox-price-81-display-bug-2026-07-10.md`
