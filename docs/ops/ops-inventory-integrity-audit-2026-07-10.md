# OPS · Inventory Integrity Audit 2026-07-10

**Task ID:** `ops-inventory-integrity-audit-2026-07-10`  
**Status:** Restored + guarded  
**CEO trigger:** HC250546 专门变速箱「不在了 / 价格也被改掉」

## 结论（先看这里）

| 项 | 结论 |
|---|---|
| HC250546 是否被删 | **否**。一直在 `half-cut-approved.json`，status=Available |
| 价格是否被改 | **否**。上传/提交/各备份均为 **USD 230**，未发现批量改价脚本动过此条 |
| 「不在了」根因 | 批准后 `passengerPartType` 丢失 + slug 错写成 `-half-cut-`；随后借图隐藏逻辑把 `-half-cut-` 一律当半切 → 真图被挡、在变速箱页像「没了」 |
| 现网已恢复 | 专门变速箱 · 原价 230 · 4 张自有图 · slug 含 `passenger-transmission` |

## A. HC250546 专项时间线

| 时间 (UTC) | 事件 |
|---|---|
| 2026-07-10 00:30 | 供应商提交 `SUB-MRE78IPL-0SV0`，`passengerPartType=transmission`，`priceUsd=230`，4 图 |
| 2026-07-10 05:48 | 批准为 HC250546；**批准落库时 ppt 变空**，slug=`…-half-cut-hc250546`，condition 仍为 Transmission Assembly |
| 今日借图隐藏 `REL-20260710093613` | 半切借图不再展示（正确产品意图） |
| 真图修复 `REL-20260710100148` | `isDedicatedPartListing` **误判**：凡 slug 含 `-half-cut-` 一律不算专门零件 → **误伤 HC250546** |
| 本审计 | 按提交源恢复 ppt/slug；价格保持 230；加防护并部署 |

### 恢复后状态（现网）

| 字段 | 值 |
|---|---|
| stockId | HC250546 |
| passengerPartType | `transmission` |
| vehicleCondition | Transmission Assembly |
| priceUsd | **230**（与提交一致，未臆造） |
| photos | 4（自有图，HTTP 200） |
| slug | `volkswagen-sagitar-2014-passenger-transmission-hc250546` |
| slugAliases | 保留旧 half-cut slug，避免旧链接全断 |

### 相关 Release

| Release | 作用 |
|---|---|
| `REL-20260710101842-api` | 服务端 condition 推断 + 批准保留 ppt + 批量改价护栏 |
| `REL-20260710102140-chrome` | 专门零件判定修复 + 零件目录只列专门上传 |
| `REL-20260710102326-api` | includedParts 不再把专门零件打回半切套装 |
| 后续 api | 公开 API 不再误滤 `Transmission assembly` 文案 |

数据备份：`data/_backups/half-cut-approved.before-hc250546-restore-20260710-101718.json`

## B. 全盘审计表

| 库存号 | 问题类型 | 根因 | 已修/待修 |
|---|---|---|---|
| HC250546 | 专门变速箱被当成半切；真图被挡 | 批准丢 ppt + 错 slug；借图逻辑 `-half-cut-` 一刀切 | **已修** |
| HC250551 | 批准后 ppt 丢失（other→空），slug 半切化 | 同批准/normalize 路径 | **已修**（ppt=other，slug=`passenger-part`） |
| HC250549 | 批准后 ppt 丢失；condition 被写成 Half Cut | 同路径 | **已修**（ppt=other，Part） |
| HC250550 / 548 / 547 / 488 | 专门前切 | 抽查：ppt/slug/价格正常，未误删 | **正常** |
| 专门发动机 | 现网无专门发动机上传 | — | 无条目可伤 |
| 专门底盘 | 现网无专门底盘上传 | — | 无条目可伤 |
| 批量改价 | 今日 bak→现网 **无** 大面积 priceUsd 漂移；HC250546 始终 230 | 历史 8 条「提交价≠批准价」多为审核改价，非今日脚本 | **护栏已加**（≥3 条批量改价需 `allowBulkPriceUpdate`） |
| 列表过滤过严 | gearboxes/engines 曾把半切 transmissionCode/engineCode 全塞进零件页 | 半切淹没专门件 | **已纠正为并行**（见 `ops-parts-parallel-listing-2026-07-10.md`）：规则条目 + 专门上传共存，不再互斥只列专门件 |

### 价格核对说明（CEO 关心）

- **HC250546：上传源 = 批准库 = 各 bak = 230**。没有证据表明今日脚本改过此价。
- 若 CEO 记忆中是别的数字，请提供原报价/聊天记录，再按源文件改；**禁止瞎填**。
- 另有 8 条历史「提交价≠批准价」（如 HC250423 等），属更早审核编辑，不在本次误伤范围；未擅自回滚。

## C. 根因（系统）

1. **批准写库**：服务端 `normalizeListingMeta` 未按 `vehicleCondition`（如 Transmission Assembly）回填 `passengerPartType`，空 ppt → slug 默认 `half-cut`。
2. **借图防护过严**：`isDedicatedPartListing` 先看 `-half-cut-` 就 return false，把「错 slug 的真专门件」一起挡掉。
3. **派生字段副作用**：`rebuildInventoryDerivedFields` 会把单条非标准 `includedParts` 打回半切四件套；公开过滤正则 `^transmission ` 误杀 `Transmission assembly`。

## D. 防护（已上线）

| 防护 | 位置 |
|---|---|
| condition → ppt 推断（与上传端一致） | `server/lib/vehicle-name-normalize.js` |
| 批准时从 submission 补回 ppt | `server/lib/half-cut-api.js` |
| 专门信号优先于错误 half-cut slug | `js/half-cut-directory.js` |
| ~~零件目录只展示专门上传~~（已撤销） | 见 `ops-parts-parallel-listing-2026-07-10.md`：规则+专门并行 |
| 禁止未授权批量改价（≥3 条） | `putState` + `allowBulkPriceUpdate` |
| 专门零件 includedParts 不再打回半切套装 | `rebuildInventoryDerivedFields` |
| 公开 API 保留 Transmission assembly 文案 | `half-cut-public.js` |

## E. 验证

| 检查 | 结果 |
|---|---|
| API `stockId=HC250546` | ppt=transmission · price=230 · photos=4 |
| 自有图 URL | HTTP 200 |
| `/gearboxes/` cache-bust | `integrity-audit-v1` |
| 详情 `detail.html?slug=…passenger-transmission-hc250546` | 200 · Condition=Transmission Assembly |
| 前切抽查 HC250550 等 | 仍在 · 价格未动 |

## F. 下一步（可选）

1. CEO 确认 HC250546 展示价是否应为 230；若否，只按书面源改价。
2. Admin 审核卡：隐藏的 `passengerPartType` 下拉不要在 collectEdits 时覆盖提交值（可再加硬校验）。
3. 历史 8 条提交/批准价差：是否要出对照表给 CEO 审。

## Paths

- 报告：`docs/ops/ops-inventory-integrity-audit-2026-07-10.md`
- 本地：`/Users/longhui/Desktop/AsiaPower/docs/ops/ops-inventory-integrity-audit-2026-07-10.md`
- 现网详情：https://asia-power.com/half-cuts/detail.html?slug=volkswagen-sagitar-2014-passenger-transmission-hc250546  
- 现网列表：https://asia-power.com/gearboxes/
