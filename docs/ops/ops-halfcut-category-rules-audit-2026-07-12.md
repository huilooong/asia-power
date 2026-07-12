# OPS · 完整半切四类挂牌规则与现网审计

**日期：** 2026-07-12  
**状态：** 规则已定稿；首个四类样例已完成现网验证  
**范围：** 乘用车完整半切、发动机、变速箱、底盘、前切（车头）公开目录

## 结论

| 项 | 结论 |
|---|---|
| 一句话规则 | **完整半切必须在发动机、变速箱、底盘、前切（车头）四类都有对应可见入口；同一实物优先用同一 stockId 派生多类目卡片，不重复计算库存。** |
| 独立零件 | `passengerPartType` 继续优先；纯发动机、纯变速箱、独立底盘、独立前切不得被四类规则串类 |
| 完整性依据 | 发动机 + 变速箱 + 前切结构 + 可拆前副车架/悬挂/转向等底盘件；缺件或资料不足的半切不能自动宣称完整 |
| 现网审计 | 398 条无独立零件类型、同时有 engineCode/transmissionCode 的 Half Cut；0 条公开文案含 chassis/subframe/suspension/axle 等底盘证据，因此现行规则下这些车全部缺底盘入口 |
| 底盘为何曾只恢复 1 条 | 旧规则把 445 条乘用车几乎全塞进底盘；收紧后又误杀为 0。全库 523 条宽关键词复核仅 HC250488 是有公开底盘证据的乘用车记录，所以当时恢复 1 条有证据，并非“完整半切只需恢复 1 条” |
| 样例 | 选 HC250132：发动机 C6、变速箱 6DCT、前切照片和公开部件清单齐全；补写可拆前副车架/悬挂/转向部件后，用同一 stockId 在四类可见 |

## 一、证据与规则沿革

1. `docs/ops/ops-parts-parallel-listing-2026-07-10.md`：规则半切与专门上传并行；半切可按 engineCode/transmissionCode 进入发动机、变速箱目录。
2. `docs/ops/ops-part-category-filter-fix-2026-07-12.md`：独立零件以 `passengerPartType` 为主分类，真正半切保留多目录能力。
3. `docs/ops/ops-chassis-transmission-filter-repair-2026-07-12.md`：底盘采用公开证据准入，防止 445 条误放；当时只有 HC250488 有明确证据。
4. CEO 2026-07-12 最新定稿：完整半切不能只修底盘后退出，必须按发动机 / 变速箱 / 底盘 / 前切四件套验收。

之前“只有明确底盘关键词才进入底盘”的规则只能防误放，不能完成“完整半切四类挂牌”的业务目标。两者合并后的执行口径是：先确认完整性，再让完整半切四类可见；不完整或资料不足的库存继续证据准入。

## 二、现网对照（改前）

抽样 HC250132：

| 类目 | 改前 | 依据 |
|---|---|---|
| 前切（车头） | 可见 | 真正 Half Cut |
| 发动机 | 可见 | `engineCode=C6` |
| 变速箱 | 可见 | `transmissionCode=6DCT` |
| 底盘 | **不可见** | `includedParts` 未写 subframe/suspension/steering，现网底盘证据规则不放行 |

全库脚本从 `https://asia-power.com/api/half-cuts/public` 读取生产数据：398 条记录同时满足真正 Half Cut、发动机号、变速箱号，但公开底盘证据命中 0 条。这证明现网普遍只完成三类入口，违反新定稿的完整半切四类验收。

## 三、可执行纠正方案

| 项 | 方案 |
|---|---|
| 范围 | 先纠正 HC250132 样例；随后审计 398 条候选，逐条区分 complete / partial / evidence-needed |
| SKU | 完整半切不新建四个库存 SKU；同一 stockId 派生四类卡片，避免重复计库存 |
| 何时新建镜像 SKU | 只有部件可独立出售、数量和价格独立时才建镜像，例如 HC250567–570 套装变速箱镜像 |
| 价格 | 同一半切的类目卡继续使用既有半切部件估价规则；有独立实价的镜像 SKU 使用独立全价，禁止重复乘估价系数 |
| 照片 | 四类入口引用同一实物来源；有对应部件实拍用实拍，无对应实拍用类目占位，禁止挪用别的库存照片 |
| 风险控制 | 不把 398 条一次性全判为完整；先核对照片、includedParts、缺件 notes，再批量补 complete/partial 与四项部件字段 |

## 四、样例执行与验证

### 生产纠正

| 项 | 结果 |
|---|---|
| stockId | HC250132 |
| 改前部件 | Engine & gearbox assembly；Front clip；Wiring harness；Radiator pack |
| 改后补全 | Front subframe, suspension & steering assembly |
| 生产备份 | `data/backups/complete-halfcut-sample-HC250132-20260712T165942Z/` |
| 库存方式 | 保留同一 HC250132，不新建重复 SKU |
| 公共 API | `updatedAt=2026-07-12T16:59:42.453Z`，新部件清单已返回 |

### 四类矩阵

| 类目 | 改后 | 现网页面显示价 | Chrome 证据 |
|---|---|---:|---|
| 前切（车头） | **可见** | USD 250 | `docs/ops/evidence/halfcut-four-category-front-hc250132-20260712.png` |
| 发动机 | **可见** | USD 650 | `docs/ops/evidence/halfcut-four-category-engine-hc250132-20260712.png` |
| 变速箱 | **可见** | USD 350 | `docs/ops/evidence/halfcut-four-category-gearbox-hc250132-20260712.png` |
| 底盘 | **可见** | USD 280 | `docs/ops/evidence/halfcut-four-category-chassis-hc250132-20260712.png` |

`node scripts/verify-category-filter.mjs` 读取真实生产 API 通过：chassis 由 1 → 2（HC250488、HC250132），engines=436，gearboxes=431，frontcuts=432；Ford 套装变速箱镜像和独立件互斥矩阵无回归。

## 五、全库批量审批清单

样例完成后，全库批量仍需 CEO 一句话批准：

> 批准按“完整半切四类可见、同 stockId 不重复计库存”规则，审计并纠正 398 条候选；资料不足的先标 evidence-needed，不臆造完整性。

