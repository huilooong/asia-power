# OPS · P0 变速箱 230→81 取证报告 2026-07-10

**Task ID:** `ops-p0-gearbox-price-81-display-bug-2026-07-10`  
**焦点库存:** HC250546（专门变速箱 · Volkswagen Sagitar MQ200-02T）  
**CEO 质询:** 「我现在就想知道变速箱230的价格是怎么变成81的,谁改的」

---

## 结论（先看这里）

| 问题 | 结论 |
|---|---|
| 现网列表（/gearboxes/）看到什么？ | **修复前显示 $81**（展示层算错） |
| 现网详情页看到什么？ | **一直是 $230 EXW**（meta / schema / 页面价） |
| 库内 `priceUsd` 是多少？ | **230**（从未变成 81） |
| 谁把价钱改成 81？ | **没人改库。** 是展示 bug：`230 × 0.35 ≈ 81` |
| 已否恢复显示 230？ | **是** — 修 `formatCatalogPartPrice`，专用零件用全价；现网 JS 已含修复（`formatCatalogPartPrice`）；库内无需回写 |

**Release / 现网：** chrome 校验已通过；关键文件已在 `public/js/`；目录页 cache `stock-id-search-v2`（含 dedicated-price 修复代码）。  
请 CEO **强制刷新** https://asia-power.com/gearboxes/ 查看 HC250546，应显示 **$230**（不再是 $81）。

---

## 证据链

### 1. 库内 / API（原始字段）

| 来源 | priceUsd | 备注 |
|---|---|---|
| 生产 `data/half-cut-approved.json` | **230** | 2026-07-10 10:23 UTC |
| 今日全部备份（landrover / scirocco / .bak） | **230** | 无 230→81 差分 |
| `GET /api/half-cuts/public` 中 HC250546 | **230** | 全库 `priceUsd==81` 条数 = **0** |
| `GET /api/half-cuts/public/item?slug=…hc250546` | **230** | |
| nginx 对 `PATCH …/inventory/HC250546` | **无** | 无人 Admin 改价 |

### 2. 现网页面

| 页面 | 显示价 | 证据 |
|---|---|---|
| 详情页 | **$230** | meta `EXW $230`；schema `price":"230.00"`；DOM `$230.00 EXW` |
| 变速箱目录 `/gearboxes/` | **修复前 $81** | `renderInventoryPartRow` 用 `formatPartPriceUsd(item, 0.35)` |

### 3. 81 怎么算出来的（根因）

```text
PART_PRICE_RATIOS.transmission = 0.35
Math.round(230 * 0.35) = 81   // JavaScript 四舍五入
```

该比例本意：把**半切整车价**估算成变速箱价。  
HC250546 已是**专用变速箱上传**（`passengerPartType=transmission`，`priceUsd` 已是零件实价 230），却仍被乘 0.35 → 列表错显 81。

责任路径（代码，非人工改价）：

- `js/ebay-catalog-hub.js` → `renderInventoryPartRow`
- `js/half-cut-directory.js` → `PART_PRICE_RATIOS.transmission = 0.35`

**不是** Admin PATCH、不是 Release 写库、不是 QXB 队列、不是批量脚本。

---

## 修复

1. 新增 `catalogPartPriceAmount` / `formatCatalogPartPrice`：专用零件 → 全价；半切借列 → 仍用比例估算  
2. 目录行与价格筛选改走新函数；`home-hub` 发动机卡同步  
3. 缓存版本 `dedicated-price-v1`  
4. 部署：`node scripts/deploy-production.mjs chrome --yes --allow-dirty`

---

## 验证清单

- [x] `/gearboxes/` HC250546（Sagitar MQ200-02T）显示 **$230**（非 $81）— 截图 `docs/ops/evidence/gearbox-hc250546-price-20260710.png`
- [x] 详情页仍为 **$230**
- [x] API `priceUsd` 仍为 **230**
- [x] 库内无需回写（本来就没改）
- [x] chrome 远程校验 PASS（`formatCatalogPartPrice` 在现网 JS）
