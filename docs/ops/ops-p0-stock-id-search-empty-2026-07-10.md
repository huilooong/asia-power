# OPS — P0 库存号搜索为空（HC250551 / 250551）

**日期:** 2026-07-10  
**Release:** `REL-20260710104119-chrome-76489479`  
**CEO 质询:** 「为什么我在搜索框搜索250551反馈为空,这是绝对不应该出现的」

## 结论（先看这张表）

| 项 | 结果 |
|---|---|
| 复现 | **成功** — 首页/半切搜 `250551` → 空列表 |
| 根因 | 搜库存号默认进 **半切目录**；HC250551 被标成 **出口整车**（`isExportUsedCar` + 备注「可整车出」），不在半切分类里 → 被分类过滤踢掉 |
| 是否索引缺 stockId | **否** — 公开 API 有 `stockId=HC250551`，匹配函数本身能命中 |
| 修复 | 库存号查询（`HC250551` / `hc250551` / `250551`）**跨分类合并**进结果；次要筛选（品牌/年款等）对库存号命中放宽 |
| 部署 | Release Manager `chrome` → **已上线** |
| 现网验证 | 逻辑回归 **504/504 Available HC 可搜**；焦点 `250551`→HC250551 |
| 改价 | **未改任何价格** |

## 1. 根因（证据）

1. 顶栏搜索 `routeSearch` 对数字/`HC…` 一律跳到 `half-cuts/?q=…`
2. 半切列表只用 `inventoryForCatalogCategory('halfcuts')` = 乘用车且 **非** 出口整车
3. HC250551 现网字段：
   - `stockId=HC250551` · `status=Available` · `priceUsd=14500`
   - `vehicleCondition=Part` · `passengerPartType=other`
   - **`isExportUsedCar=true`** · `notes` 含「可整车出」
4. 因此它落在 **used-cars**（约 16 台同类），不在半切 433 台里 → 半切页搜数字 = 空
5. 全库扫描：约 **72** 台 Available（整车/卡车/驾驶室等）在「只搜半切」时都会空——同类事故面

## 2. 修复内容

| 文件 | 改动 |
|---|---|
| `js/half-cut-directory.js` | `isStockIdQuery` / `matchesStockId` / `mergeStockIdHitsIntoInventory` |
| `js/ebay-catalog-hub.js` | 搜索合并跨分类；库存号命中放宽品牌/年款等；零件目录同样处理 |
| `js/half-cut-catalog.js` | `matchesSearch` 对齐库存号规则 |
| 各目录 `index.html` + `components.js` | 缓存版本 `stock-id-search-v1` |
| `scripts/verify-stock-id-search.mjs` | 防回归脚本 |
| `scripts/deploy-production.mjs` | chrome 部署校验标记 |

**规则（以后）：** 搜库存号 = 找车，**不**被半切/整车/卡车分类墙挡住。

## 3. 验证

| 检查 | 结果 |
|---|---|
| `node scripts/verify-stock-id-search.mjs` | **VERIFY OK**（504 Available，0 miss） |
| `250551` / `HC250551` / `hc250551` | 均命中 HC250551 |
| 抽测跨类：`250519`(整车) `250512`(卡车) `250126`(驾驶室) | 均能按数字命中 |
| 现网 JS | `?v=stock-id-search-v1` 含 `mergeStockIdHitsIntoInventory` |
| Release | `REL-20260710104119-chrome-76489479` · Validation pass |

**请 CEO 硬刷新后再搜一次**（Cmd+Shift+R），避免旧 JS 缓存。

验证 URL：https://asia-power.com/half-cuts/?q=250551

## 4. 回滚

```bash
RESTORE_CONFIRM=REL-20260710104119-chrome-76489479 node scripts/release-restore.mjs REL-20260710104119-chrome-76489479
```

备份：`/root/.openclaw/workspace/inventory-site/backups/scheduled/asia-power-backup-20260710-104121.tar.gz`

## 5. 未做 / 后续（非阻塞）

- **未改** HC250551 分类或价钱（Part + 可整车出 数据本身矛盾，另议）
- 可选：库存号唯一命中时直达详情页（体验增强，非本次 P0）

## Status

| | |
|---|---|
| Status | **成功** |
| Deliverables | 修复代码 + 回归脚本 + 本报告 |
| Paths | `docs/ops/ops-p0-stock-id-search-empty-2026-07-10.md` |
| Next | CEO 硬刷新确认现网搜 `250551` 出霸道；可选清理 Part/整车标签一致性 |
