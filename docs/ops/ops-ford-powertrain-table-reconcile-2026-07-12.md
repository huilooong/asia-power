# OPS · 福特动力总成原表挂牌纠正

**日期：** 2026-07-12  
**权威来源：** CEO 原始图片《福特试验车最后一批发动机/变速器清单》  
**范围：** HC250556–HC250565；HC250566 仅盘点、不修改  
**状态：** 实施前设计已定稿；生产结果与证据见文末

## 结论

原表不是「9 台发动机 + 1 台变速箱」，而是 **10 个型号/配置挂牌行**：

- 106 套发动机+变速箱；
- 105 台纯发动机；
- 33 台独立自动变速箱；
- 因套装同时含一台发动机和一台变速箱，业务口径为 **211 台发动机、139 台变速箱**；
- 按源表每行数量直接相加是 **244 个可售套/台**，这是实物挂牌单位合计，不应与 211+139 相加。

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

## 旧错误与纠正策略

| 问题 | 旧呈现 | 新规则 |
|---|---|---|
| 数量口径 | 页面容易被理解为每库存号 1 台；历史汇报还写成“9 发动机 + 1 变速箱” | 一个源表行对应一个 SKU，`quantityUnits/quantity/sellableQty` 必须写源表数量 |
| 套装识别 | 三个套装行仍以普通发动机标题展示，变速箱价值不清楚 | 标题明确 `Engine + ... Transmission Powertrain Package` |
| 套装类目 | 系统只有互斥的 engine/transmission 类目 | 单 SKU 套装放 engine 主类目，但标题、描述、配件清单明确发动机+变速箱；不复制进变速箱，不进入车头/底盘 |
| 纯发动机 | 标题未稳定体现数量/排量/总成 | 仅 engine 类目，标题明确型号、排量、Engine Assembly、数量 |
| 独立变速箱 | 公共标题退化成 `Ford Focus AT` | 仅 transmission 类目；用既有上下文命名为 Focus 2019–2021 1.5L Automatic Transmission，并注明原表无车型/年份 |
| 价格 | 三个套装仍按单发动机 USD 1,250 | 纯发动机 USD 1,250；独立变速箱 USD 441；套装按两项合计 USD 1,691 |

## 新挂牌清单

| stockId | 源表行 | 新挂牌名 | 数量 | 类目 | 价格 |
|---|---:|---|---:|---|---:|
| HC250556 | 1 | Ford CAF372WQ 1.0T Engine + Manual Transmission Powertrain Package | 24 套 | engine（套装单 SKU） | USD 1,691 |
| HC250557 | 2 | Ford CAF384Q 1.5L Engine + Automatic Transmission Powertrain Package | 47 套 | engine（套装单 SKU） | USD 1,691 |
| HC250558 | 3 | Ford CAF384Q 1.5L Engine + Manual Transmission Powertrain Package | 18 套 | engine（套装单 SKU） | USD 1,691 |
| HC250559 | 4 | Ford CAF384Q 1.5L Engine Assembly | 2 台 | engine | USD 1,250 |
| HC250560 | 5 | Ford CAF384WQ 1.5T Engine Assembly | 4 台 | engine | USD 1,250 |
| HC250561 | 6 | Ford CAF488WQ 2.0T Engine + Automatic Transmission Powertrain Package | 17 套 | engine（套装单 SKU） | USD 1,691 |
| HC250562 | 7 | Ford CAF488WQ 2.0T Engine Assembly | 62 台 | engine | USD 1,250 |
| HC250563 | 8 | Ford GTDIQ8 2.7T Engine Assembly | 3 台 | engine | USD 1,250 |
| HC250564 | 9 | Ford CAF488Q10 2.0L Hybrid Engine Assembly | 34 台 | engine | USD 1,250 |
| HC250565 | 10 | Ford Focus 2019-2021 1.5L Automatic Transmission Assembly | 33 台 | transmission | USD 441 |

### 套装定价决定

采用 **USD 1,691 = USD 1,250 发动机 + USD 441 变速箱**。原因是原表明确为发动机+变速器完整套装；继续只收发动机价会漏掉变速箱价值。系统没有 combo 类目，因此采用单 SKU 套装，不拆成两个库存号，避免数量翻倍和重复售卖。

## 生产实施与验证

待执行后补充：

- 生产备份路径；
- 10 条 approved 与 linked submissions 更新结果；
- 公开 API 数量、标题、类目、价格；
- 发动机/变速箱/车头/底盘目录互斥；
- 页面截图证据；
- HC250566 未修改确认。

## 交付路径

- 报告：`docs/ops/ops-ford-powertrain-table-reconcile-2026-07-12.md`
- 可复跑脚本：`scripts/reconcile-ford-powertrain-table-2026-07-12.mjs`
- 执行报告：`reports/ford-powertrain-table-reconcile-2026-07-12.json`
