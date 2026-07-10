# OPS · P0 变速箱 230→81 取证（HC250546）

**Task ID:** `ops-p0-gearbox-230-to-81`  
**日期:** 2026-07-10  
**焦点:** HC250546（专门变速箱 · Volkswagen Sagitar MQ200-02T）  
**CEO 质询:** 「变速箱230的价格是怎么变成81的,谁改的」

---

## 结论（先看这里）

| 项 | 结论 |
|---|---|
| **谁改的** | **没人改库价。** 不是 Admin / 不是脚本 / 不是 Release 写库 / 不是 QXB |
| **怎么变成 81** | **展示算错**：变速箱目录把专用零件价又乘了半切估算系数 `0.35` → `Math.round(230 × 0.35) = 81` |
| **现网库价 / API** | **USD 230**（`priceUsd`） |
| **详情页** | **一直 $230 EXW**（meta / schema / DOM） |
| **列表页 /gearboxes/** | 修复前 **$81**；现网已部署 `dedicated-price-v1`，专用件显示 **$230** |
| **要不要回写 230** | **不需要**——库里从未变成 81 |
| **责任** | 前端目录价逻辑（`PART_PRICE_RATIOS.transmission = 0.35`）误伤专用上传件 |
| **CEO 定稿** | 单独上传保持原价；0.35 仅半切估算；已落盘 MEMORY + runbook |

---

## 1. 现网 API / 库内实际值

| 来源 | 字段 | 值 |
|---|---|---|
| 生产 `data/half-cut-approved.json` | `priceUsd` | **230** |
| | `passengerPartType` | `transmission` |
| | `slug` | `volkswagen-sagitar-2014-passenger-transmission-hc250546` |
| `GET /api/half-cuts/public`（HC250546） | `priceUsd` | **230** |
| `GET /api/half-cuts/public/item?stockId=HC250546` | `priceUsd` | **230** |
| 全库 `priceUsd == 81` | — | **0 条** |
| 专门变速箱（ppt=transmission） | — | 仅 **HC250546**，价 **230** |

---

## 2. 备份时间线：有没有 230→81？

| 备份 / 文件 | 时间 (UTC) | HC250546 `priceUsd` |
|---|---|---|
| `half-cut-approved.json.bak-landrover-20260710-060511` | 06:03 | **230**（当时 ppt 曾为空） |
| `half-cut-approved.json.bak-scirocco-20260710` | 09:45 | **230** |
| `_backups/...before-hc250546-restore-20260710-101718.json` | 10:16 | **230** |
| `half-cut-approved.json.bak` | 10:17 | **230** |
| 现网 `half-cut-approved.json` | 10:23 | **230** |

**结论：今日全部备份对比，无 230→81 差分。库价从未变成 81。**

---

## 3. nginx / Admin PATCH：谁改过价？

| 查询 | 结果 |
|---|---|
| `PATCH …/inventory/HC250546`（今日 access.log） | **无** |
| 今日唯一库存 PATCH | `HC250551` @ **06:18:23 UTC**（Admin 库存页 · Mac Chrome）— 与变速箱无关 |
| journalctl `inventory-site` 今日 HC250546 | 仅媒体 promote，无改价 |

**结论：无人通过 Admin 把 HC250546 改成 81。**

---

## 4. 81 怎么算出来的（展示链路）

```text
PART_PRICE_RATIOS.transmission = 0.35
JavaScript: Math.round(230 * 0.35) = Math.round(80.5) = 81
```

- **本意：** 半切整车挂到变速箱目录时，用整车 EXW × 0.35 **估算**变速箱价。  
- **误伤：** HC250546 已是**专用变速箱上传**，`priceUsd=230` 已是零件实价，列表仍走 `formatPartPriceUsd(item, 0.35)` → 错显 **$81**。  
- **不是** EXW/CIF 换汇，**不是**分单位（cent）错误，**不是** 230÷某汇率。

责任代码路径：

- `js/half-cut-directory.js` → `PART_PRICE_RATIOS.transmission = 0.35`
- `js/ebay-catalog-hub.js` → `renderInventoryPartRow`（修复前直接乘 ratio）

详情页走全价 EXW，故 CEO 若只看详情会看到 230；看 `/gearboxes/` 列表会看到 81——**库一致、页不一致 = 展示 bug**。

---

## 5. 修复状态（无需改库）

| 项 | 状态 |
|---|---|
| `catalogPartPriceAmount` / `formatCatalogPartPrice` | 专用件全价；半切借列仍用比例 |
| 现网 HTML 脚本 | `?v=dedicated-price-v1` |
| 部署标记 | `deploy-marker: … dedicated-price-v1` |
| 库回写 | **不需要** |

验证（2026-07-10 本次复检）：

- API `priceUsd=230`
- 详情 `detail.html?slug=…hc250546`：`$230` / schema `"230.00"` / 无 `$81`
- 旧逻辑复现：`Math.round(230*0.35)=81`
- 新逻辑：专用 transmission → **230**

---

## 6. CEO 定稿规则（2026-07-10）

CEO 原话：「好了,我明白了,这不是你的问题,是我们没有区分逻辑的问题,以后单独上传的保持原价」

| 规则 | 说明 |
|---|---|
| **单独上传零件**（发动机 / 变速箱 / 底盘 / 前切等） | 列表与详情 **一律显示库内原价** |
| **禁止** | 对专用件再乘 `0.35`（或其它 `PART_PRICE_RATIOS`） |
| **0.35 仅用于** | 「规则带出、无单独实价」的半切估算件 |
| **库价** | 不因展示 bug 回写；HC250546 库内始终 230 |

落盘：

- 长期：`MEMORY.md`（Engineering gotchas）
- 当日：`memory/2026-07-10.md`
- Runbook：`data/knowledge-base/dedicated-part-price-runbook.md`

### 定稿后复验（同日 · 无需再部署）

| 检查 | 结果 |
|---|---|
| 生产库 `HC250546.priceUsd` | **230** · `passengerPartType=transmission` |
| 公开 API item | **230** |
| 现网 JS（`?v=stock-id-search-v2`） | 仍含 `catalogPartPriceAmount` + `isDedicatedPartListing` |
| 列表逻辑（专用 transmission） | **230**（旧错算 81） |
| 半切估算仍生效 | 例 HC250552 整车 2500 → 估算变速箱 875（×0.35） |
| 代码漏洞 / 再部署 | **无** · 只落盘+验证 |

---

## 7. 相关文档

- 同日展示 bug 初稿：`docs/ops/ops-p0-gearbox-price-81-display-bug-2026-07-10.md`
- 改价事故（HC250551）：`docs/ops/ops-p0-price-change-incident-2026-07-10.md`
- 库存完整性：`docs/ops/ops-inventory-integrity-audit-2026-07-10.md`
- 定价 runbook：`data/knowledge-base/dedicated-part-price-runbook.md`

---

## Status

| | |
|---|---|
| **Status** | 取证完成 · CEO 定稿已落盘 · 现网仍 230 · 无需再部署 |
| **Deliverables** | 本报告 + runbook + MEMORY |
| **Paths** | `docs/ops/ops-p0-gearbox-230-to-81.md` · `data/knowledge-base/dedicated-part-price-runbook.md` |
| **Validation** | 现网 API + 生产库 SSH + JS 函数存在 + 列表逻辑 230≠81 |
| **Next** | 无；以后改零件目录价逻辑必须先过本 runbook |
