# OPS · Parts listing parallel restore（规则 + 单独上传）

**Task ID:** `parts-parallel-listing`  
**Date:** 2026-07-10  
**Status:** Restored · deploy via `chrome`  
**CEO 纠正:** 零部件展示是「既定规则 + 单独上传」**并行**，不是互斥

## 之前错在哪

| 项 | 错误做法 | 后果 |
|---|---|---|
| `REL-20260710102140` 完整性审计 | `inventoryPartItems` 只保留 `isDedicatedPartListing` | 半切按规则带出的发动机/变速箱等**整类从列表消失** |
| 借图隐藏被理解成「半切永不出现」 | 列表过滤与照片策略绑死成互斥 | CEO 看到「车不在了」 |
| 占位图 | 在互斥之后用占位「顶替」整套规则展示 | 占位成了规则替代品，而不是「无图时的兜底」 |

**正确意图（恢复后）：**

| 来源 | 是否出现在 engines/gearboxes/chassis/front-cuts | 照片 |
|---|---|---|
| **既定规则**（半切有 engineCode / transmissionCode 等） | ✅ 出现 | 按原规则：发动机需 Engine 标签图；变速箱/底盘/前切可为标签图或相册首图；确实无图 → 占位 |
| **单独上传**（ppt/slug/condition 专门件） | ✅ 出现（并行，不互斥） | 真图优先（标签匹配，否则首张自有图） |
| 占位图 | 仅「按规则应显示但确实无图」 | 不替代整套规则、不砍条目 |

## 既定列表规则（代码）

`js/ebay-catalog-hub.js` → `inventoryPartItems(partType)`：

1. 未售乘用车库存
2. **专门上传**该类型 → 一律列入
3. 否则按规则：
   - `engine` → 有 `engineCode`
   - `transmission` → 有 `transmissionCode`
   - `chassis` / `front` → 乘用车库存按目录既定规则列入

## 照片规则（代码）

`js/half-cut-directory.js` → `pickPartListingPhoto`：

- 专门上传：标签图 → 否则首张真图
- 规则半切：发动机仅 Engine 标签；其他类型标签或 `photos[0]`
- 返回 null → `renderPartListingPhoto` 才用营销/品牌占位 + Photos on request

`isDedicatedPartListing` **仍保留**（判定专门件、真图优先），但**不再**用作「只有专门件才进列表」的互斥闸门。

## 相关 Release（今日链路）

| Release | 作用 | 与本纠正关系 |
|---|---|---|
| `REL-20260710093613` | 借图隐藏 + contain | 照片意图部分正确；后来被扩成列表互斥则错 |
| `REL-20260710100148` | 真图 CSS / dedicated 判定 | 保留 dedicated 信号优先 |
| `REL-20260710102140` | **零件目录只列专门上传** | **本次回滚的互斥点** |
| `REL-20260710102752` | 无图占位 | 占位保留，但不再替代规则条目 |
| 本任务 `parts-parallel-v1` | 恢复并行 | 列表 + 照片规则对齐 CEO |

## Files

| Path | Change |
|---|---|
| `js/ebay-catalog-hub.js` | 并行 filter |
| `js/half-cut-directory.js` | 恢复规则照片 + 专门真图优先 |
| `js/home-hub.js` | 货架并行（专门发动机 \|\| 规则半切） |
| `js/components.js` | marker `parts-parallel-v1` |
| `engines|gearboxes|…/index.html` | cache bust |
| `scripts/deploy-production.mjs` | 校验并行 marker；同步 home-hub |

## Validation（现网）

| 检查 | 结果 |
|---|---|
| Release | `REL-20260710103928-chrome-76489479`（后续 chrome 因并发校验抢写偶发未收尾，但 JS 已在现网） |
| JS marker `rule + dedicated parallel` | ✅ 现网 `ebay-catalog-hub.js` |
| 照片规则 `Dedicated uploads: labeled` | ✅ 现网 `half-cut-directory.js` |
| `/engines/` 并行条目（模拟） | **454**（规则半切 454 · 专门发动机 0） |
| `/gearboxes/` 并行条目（模拟） | **453**（含专门变速箱 **HC250546**） |
| 若仍互斥「只列专门」 | engines=0 · gearboxes=1 → 即 CEO 所见「车不在了」 |
| HC250546 | ppt=transmission · **USD 230** · 4 真图（未改价） |
| 前切专门上传 | HC250550 / 548 / 547 / 488 仍在 |
| 验证 URL | https://asia-power.com/engines/ · https://asia-power.com/gearboxes/ |

Backup（首成）：`/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-103931.tar.gz`

## Paths

- 报告：`docs/ops/ops-parts-parallel-listing-2026-07-10.md`
- 本地：`/Users/longhui/Desktop/AsiaPower/docs/ops/ops-parts-parallel-listing-2026-07-10.md`
