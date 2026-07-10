# OPS — 全站商品搜索覆盖（catalog-search-v1/v2）

**时间:** 2026-07-10  
**结论:** Available 全库审计 **100%** 可搜；现网抽测库存号 / 车型 / 中文别名 / 发动机号均命中  
**Release ID:** `REL-20260710111656-chrome-76489479`（cache key `catalog-search-v2`）  
**不改价；专用零件原价规则未动**

## 修前缺口

| 问题 | 影响 |
|---|---|
| 顶栏搜索默认进 `/half-cuts/?q=`，仅库存号跨分类合并 | 二手车/卡车/机械用车型名、发动机号搜不到 |
| haystack 只有 stockId/brand/model/engine/trans/title | 中文原名、VIN、gearboxModel 搜不到 |
| 无中文别名（尚酷/霸道） | 搜「尚酷」空，虽库内是 Scirocco |
| 短码去空格匹配过宽 | `CDL` 误伤含 `Automatic DLX` 的车（v2 已收紧） |

## 覆盖字段（现网）

- stockId（HC/UV 全号 + ≥4 位数字后缀）
- brand / brandSlug（make）
- model
- engineCode
- transmissionCode / gearboxModel
- title / shortDescription / originalVehicleName
- vin / maskedVin（片段）
- slug / fuelType
- 中文别名表 `js/catalog-search-aliases.js`（166 条，含尚酷→Scirocco、霸道→Land Cruiser Prado）

跨分类：任意非空关键词都会把全库命中合并进当前列表（与库存号同逻辑）。

## 审计

```bash
node scripts/verify-catalog-search.mjs
# 兼保留：node scripts/verify-stock-id-search.mjs
```

| 指标 | 结果 |
|---|---|
| Available | 504 |
| 检查次数 | 2917（stockId/digits/model/engine/brand/vin6） |
| 通过率 | **100%** |
| 跨分类 miss | 0 |
| 失败样例 | 无 |

## 现网抽测

| 关键词 | 结果 | 证据 |
|---|---|---|
| `250551` | 1 · HC250551 Prado $14,500 | `docs/ops/evidence-catalog-search-2026-07-10/q-250551.png` |
| `HC250546` | 1 · HC250546 Sagitar $230 | `.../q-HC250546.png` |
| `Scirocco` | 1 · HC250552 | `.../q-Scirocco.png` |
| `尚酷` | 1 · HC250552 Scirocco | `.../q-shangku.png` |
| `霸道` | 3 · 含 HC250551 Prado | `.../q-badao.png` |
| `CDL` | 1 · HC250552（v2 去掉误伤） | `.../q-CDL-v2.png` |

CDN：`?v=catalog-search-v2` 含 `matchesCatalogSearch` + `tn.length >= 4`。

## 改动文件

- `js/half-cut-directory.js` — 统一 `matchesCatalogSearch` / 跨分类 merge
- `js/ebay-catalog-hub.js` / `js/half-cut-catalog.js` — 接入
- `js/catalog-search-aliases.js` — 中文别名
- `scripts/verify-catalog-search.mjs` / `scripts/build-catalog-search-aliases.mjs`
- 各目录 `index.html` cache bust + `scripts/deploy-production.mjs`

## 规则

1. 改公开搜索 JS 必须换**从未用过**的 `?v=`（CF immutable）
2. 短关键词（&lt;4）禁止靠「去空格折叠」命中，避免 CDL←Automatic DLX
3. 回归：`node scripts/verify-catalog-search.mjs`
