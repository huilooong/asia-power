# OPS · 福特动力总成原表挂牌纠正（含双品牌占位图）

**日期：** 2026-07-12  
**权威来源：** CEO 原始图片《福特试验车最后一批发动机/变速器清单》  
**范围：** HC250556–HC250565；HC250566 仅盘点、不修改  
**状态：** 已完成现网数据纠正 + 双品牌占位图；10/10 成功

## 结论

原表不是「9 台发动机 + 1 台变速箱」，而是 **10 个型号/配置挂牌行**：

- 106 套发动机+变速箱；
- 105 台纯发动机；
- 33 台独立自动变速箱；
- 业务口径：**211 台发动机、139 台变速箱**（套装重叠计入）；
- 实物挂牌单位合计：**244 套/台**。

现网已按原表数量、类目、命名与价格纠正；本批 10 条主图均为 **Ford logo + AsiaPower** 双品牌占位图。HC250566 真车照片未改动。

## 原表逐行复核

| 行 | 型号 | 排量 | 状态 | 数量 | 备注 |
|---:|---|---:|---|---:|---|
| 1 | CAF372WQ | 1.0T | 发动机+变速器 | 24 | 手动挡 |
| 2 | CAF384Q | 1.5 | 发动机+变速器 | 47 | 自动挡 |
| 3 | CAF384Q | 1.5 | 发动机+变速器 | 18 | 手动挡 |
| 4 | CAF384Q | 1.5 | 发动机总成 | 2 | 无变速器 |
| 5 | CAF384WQ | 1.5T | 发动机总成 | 4 | 无变速器 |
| 6 | CAF488WQ | 2.0T | 发动机+变速器 | 17 | 自动挡 |
| 7 | CAF488WQ | 2.0T | 发动机总成 | 62 | 无变速器 |
| 8 | GTDIQ8 | 2.7T | 发动机总成 | 3 | 无变速器 |
| 9 | CAF488Q10 | 2.0L | 发动机总成 | 34 | 无变速器（福特混动） |
| 10 | 自动变速器 | 1.5 | 变速器总成 | 33 | 空 |

## 旧错误 vs 新挂牌

| 问题 | 旧呈现 | 新规则 |
|---|---|---|
| 数量口径 | 易被理解为每库存号 1 台；历史还写成“9 发动机 + 1 变速箱” | 一行一个 SKU，`quantityUnits/quantity/sellableQty` = 源表数量 |
| 套装识别 | 普通发动机标题，变速箱价值不清 | 标题明确 `Engine + ... Transmission Powertrain Package` |
| 套装类目 | 无 combo 类目 | 单 SKU 放 engine 主类目；标题/描述/配件清单写明发动机+变速箱；不进变速箱/车头/底盘 |
| 独立变速箱 | 公共标题退化成 `Ford Focus AT` | 仅 transmission；命名 Focus 2019–2021 1.5L Automatic Transmission |
| 价格 | 套装仍按单发动机 1250 | 纯发动机 1250；独立变速箱 441；套装 1691 |
| 照片 | 空相册 | 本批专用 Ford x AsiaPower 双品牌占位图 |

## 新挂牌清单

| stockId | 源表行 | 公开名摘要 | 数量 | 类目 | 价格 | 主图 |
|---|---:|---|---:|---|---:|---|
| HC250556 | 1 | CAF372WQ 1.0T Engine + Manual Transmission Package | 24 套 | engine | USD 1,691 | 双品牌占位 |
| HC250557 | 2 | CAF384Q 1.5L Engine + Automatic Transmission Package | 47 套 | engine | USD 1,691 | 双品牌占位 |
| HC250558 | 3 | CAF384Q 1.5L Engine + Manual Transmission Package | 18 套 | engine | USD 1,691 | 双品牌占位 |
| HC250559 | 4 | CAF384Q 1.5L Engine Assembly | 2 台 | engine | USD 1,250 | 双品牌占位 |
| HC250560 | 5 | CAF384WQ 1.5T Engine Assembly | 4 台 | engine | USD 1,250 | 双品牌占位 |
| HC250561 | 6 | CAF488WQ 2.0T Engine + Automatic Transmission Package | 17 套 | engine | USD 1,691 | 双品牌占位 |
| HC250562 | 7 | CAF488WQ 2.0T Engine Assembly | 62 台 | engine | USD 1,250 | 双品牌占位 |
| HC250563 | 8 | GTDIQ8 2.7T Engine Assembly | 3 台 | engine | USD 1,250 | 双品牌占位 |
| HC250564 | 9 | CAF488Q10 2.0L Hybrid Engine Assembly | 34 台 | engine | USD 1,250 | 双品牌占位 |
| HC250565 | 10 | Focus 2019-2021 1.5L Automatic Transmission Assembly | 33 台 | transmission | USD 441 | 双品牌占位 |

### 套装定价

采用 **USD 1,691 = 1,250 + 441**。系统无 combo 类目，故用单 SKU 套装，不拆两个库存号，避免数量翻倍。

### 双品牌占位图

| 项 | 路径 |
|---|---|
| 源文件 SVG | `assets/images/ford-asiapower-powertrain-placeholder.svg` |
| 现网主图 PNG | `assets/images/ford-asiapower-powertrain-placeholder.png` |
| 公开 URL | https://asia-power.com/assets/images/ford-asiapower-powertrain-placeholder.png |
| 范围 | 仅 `sourceImport=ford-test-powertrain-lot-2026-07-12` 的 HC250556–HC250565 |
| 未改 | HC250566 等其它库存真车照片 |

## 生产实施

| 项 | 结果 |
|---|---|
| Git commits | `680bce125` 数量纠正；`faae95c9a` 公开命名；`1e11bf850` 起含占位图资产（后续补 PNG） |
| 生产备份 | `/root/.openclaw/workspace/inventory-site/data/backups/ford-powertrain-table-reconcile-2026-07-12T15-28-13-442Z/` 及后续同名前缀备份 |
| 执行报告 | `/root/.openclaw/workspace/inventory-site/reports/ford-powertrain-table-reconcile-2026-07-12.json` |
| 脚本 | `scripts/reconcile-ford-powertrain-table-2026-07-12.mjs` |
| 资产同步 | 已 rsync PNG/SVG 到生产 `public/assets/images/`；`deploy-production.mjs` chrome 目标已登记 |

## 现网验证

| 检查 | 结果 |
|---|---|
| 公开 API 10/10 数量 | 24/47/18/2/4/17/62/3/34/33，合计 244 |
| 构成口径 | packages=106；engines qty=211；transmissions qty=139 |
| 类目 | 556–564 = engine；565 = transmission |
| 价格 | 套装 1691；纯发动机 1250；变速箱 441 |
| 照片 | 10/10 指向双品牌 PNG；HC250566 真车相册未动 |
| 发动机列表 | `/engines/?q=HC250556` 可见套装名、24 units、$1691、占位图 |
| 变速箱列表 | `/gearboxes/?q=HC250565` 可见 33 units、$441、占位图 |
| 详情页 | HC250556 / HC250565 主图均为 Ford x AsiaPower 占位图 |
| 车头/底盘 | `/front-cuts/?q=HC250565`、`/chassis-parts/?q=HC250556` 无本批串入 |

### 截图证据

- `docs/ops/evidence/ford-powertrain-engine-list-placeholder-20260712.png`
- `docs/ops/evidence/ford-powertrain-engine-detail-placeholder-20260712.png`
- `docs/ops/evidence/ford-powertrain-transmission-list-placeholder-20260712.png`
- `docs/ops/evidence/ford-powertrain-transmission-detail-placeholder-20260712.png`
- `docs/ops/evidence/ford-powertrain-frontcut-exclusion-20260712.png`
- `docs/ops/evidence/ford-powertrain-chassis-exclusion-20260712.png`

## 需 CEO 再拍板？

套装价已按 **1250+441=1691** 上线。若你希望套装对外只标发动机价 1250、或改成别的套装价，再说一声我改。

## 交付路径

```text
docs/ops/ops-ford-powertrain-table-reconcile-2026-07-12.md
docs/ops/evidence/ford-powertrain-*-20260712.png
assets/images/ford-asiapower-powertrain-placeholder.png
assets/images/ford-asiapower-powertrain-placeholder.svg
scripts/reconcile-ford-powertrain-table-2026-07-12.mjs
```

绝对工作区：`/Users/longhui/Desktop/AsiaPower`
