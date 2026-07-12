# OPS · 零部件类目互斥过滤修复

**日期：** 2026-07-12
**状态：** 代码已修复并通过生产数据回归；待 Release Manager 发布与现网截图
**范围：** 首页、半切/车头、底盘、发动机、变速箱公开目录

## 结论

根因不是 HC250556–HC250566 字段标错，而是前端先取全部乘用车库存：
发动机/变速箱只看是否有型号，车头/底盘直接全量放行，搜索还会把全库命中项跨类目塞回当前列表。

生产字段已经正确：

- HC250556–HC250564：`passengerPartType=engine`、`vehicleCondition=Engine Assembly`
- HC250565：`passengerPartType=transmission`、`vehicleCondition=Transmission Assembly`
- HC250566：`passengerPartType=engine`、`vehicleCondition=Engine Assembly`
- `category`、`partType`、`productType`、`tags`、`isEngine`、`bodyType` 均未使用/为空

因此本次不改生产库存数据，修正系统过滤规则。

## 最终类目规则

| 类目 | 允许 | 明确禁止 |
|---|---|---|
| 半切 / 车头 | 真正半切（无专用零件类型）与 `front` | 独立发动机、独立变速箱、底盘件、其它散件 |
| 底盘 | 仅 `chassis` | 半切/车头、发动机、变速箱、其它散件 |
| 发动机 | 独立 `engine`；真正半切且有 `engineCode` | 独立变速箱、底盘件、车头件 |
| 变速箱 | 独立 `transmission`；真正半切且有 `transmissionCode` | 独立发动机、底盘件、车头件 |
| 首页半切货架 | 与半切类目相同 | 所有独立动力总成/底盘散件 |
| 首页发动机货架 | 与发动机类目相同 | 非发动机专用件 |

判断优先级：`passengerPartType` 明确字段优先；旧库存才回退到 slug 与
`vehicleCondition`。搜索可扩大“匹配字段”，不得扩大“所属类目”。

真正半切没有专用零件类型时，可因自带发动机号/变速箱号同时进入动力总成目录；
独立发动机即使填写了变速箱代码，仍只按发动机主类型归类。

## 根因链路

1. `getPassengerHalfCutInventory()` 旧逻辑把所有非二手车乘用车都当半切，未排除
   `engine` / `transmission` / `chassis`。
2. `inventoryPartItems()` 对 `chassis` / `front` 无类型限制，直接 `return true`。
3. 发动机/变速箱目录旧逻辑只检查 `engineCode` / `transmissionCode`，忽略库存主类型。
4. `mergeCatalogSearchHitsIntoInventory()` 与零件目录搜索从 `HALF_CUT_LIST` 全库补项，
   可绕过前面的类目过滤。
5. 首页 `isPassengerHalf()` 只要 `vehicleCategory=passenger` 就成立，因此独立发动机
   同时进入半切货架。

## 代码与数据变更

代码：

- `js/half-cut-directory.js`：新增统一主类型解析与 `matchesInventoryCategory()`；
  半切列表排除独立零件。
- `js/ebay-catalog-hub.js`：四个零件目录统一使用类目匹配器；搜索不再跨类目补项。
- `js/home-v4-hybrid.js`：首页半切/发动机货架使用同一业务规则。
- 五个目录 HTML 与首页：缓存键升级为 `category-filter-v1`。
- `scripts/verify-category-filter.mjs`：用现网 11 条真实库存做互斥回归。
- `scripts/deploy-production.mjs`、`scripts/lib/release-manager.mjs`：新增窄范围
  `categories` 发布目标，保留生产 HTML 其它漂移并自动备份。

数据：

- **无数据修改、无库存删除。**
- HC250556–HC250566 的现有主类型字段已经正确，不需要再次改字段。

## 验证证据

预发布：

| 检查 | 结果 |
|---|---|
| `node scripts/verify-category-filter.mjs` | 通过；HC250556–564、566 仅发动机，HC250565 仅变速箱 |
| 真半切保护 | 通过；仍在半切/车头，可按代码进入发动机/变速箱，不进入纯底盘 |
| JavaScript 语法 | 通过 |
| `git diff --check` | 通过 |

生产 URL：

- `https://asia-power.com/half-cuts/`
- `https://asia-power.com/front-cuts/`
- `https://asia-power.com/chassis-parts/`
- `https://asia-power.com/engines/`
- `https://asia-power.com/gearboxes/`

现网截图（发布后补充）：

- `docs/ops/evidence/category-filter-engines-20260712.png`
- `docs/ops/evidence/category-filter-gearboxes-20260712.png`
- `docs/ops/evidence/category-filter-halfcuts-20260712.png`
- `docs/ops/evidence/category-filter-frontcuts-20260712.png`
- `docs/ops/evidence/category-filter-chassis-20260712.png`

## 发布与回滚

- Release ID：发布后补充
- Git commit：发布后补充
- 远端备份：由 Release Manager 写入对应 release snapshots
- 回滚：`RESTORE_CONFIRM=<Release ID> node scripts/release-restore.mjs <Release ID>`

## 交付路径

- 报告：`docs/ops/ops-part-category-filter-fix-2026-07-12.md`
- 回归：`scripts/verify-category-filter.mjs`
- 证据：`docs/ops/evidence/`
- 工作区：`/Users/longhui/Desktop/AsiaPower`
