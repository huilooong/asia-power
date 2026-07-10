# OPS — 现网实测复验：搜 250551

**时间:** 2026-07-10 10:50–10:59 UTC+  
**结论:** 修前空；cache-bust 后现网出 HC250551（霸道）

## 实测

| 我测了吗 | URL / 操作 | 结果 | 证据 |
|---|---|---|---|
| 是 | `/half-cuts/?q=250551` 修前 | **0 results** | `docs/ops/evidence-250551-search-2026-07-10/before-half-cuts-q-250551.png` |
| 是 | `/half-cuts/?q=HC250551` 修前 | **0 results** | `.../before-half-cuts-q-HC250551.png` |
| 是 | CDN `half-cut-directory.js?v=parts-parallel-v1` | 无 `stock-id-search`（旧缓存） | curl：bytes≈77062 stock=0，cf-cache HIT |
| 是 | 修后 `?q=250551` | **1 results · HC250551 · Prado · $14,500** | `.../after-half-cuts-q-250551.png` |
| 是 | 修后 `?q=HC250551` / `hc250551` | 同上命中 | after-*-HC250551 / DOM |
| 是 | 公开 API 库存 | HC250551 Available 14500 isExportUsedCar=true | `/api/half-cuts/public` |

## 失败后怎么修

1. 根因：代码在 origin，Cloudflare 仍喂 `parts-parallel-v1` 旧 JS  
2. 动作：HTML 改为 `?v=stock-id-search-v2` + 同步 directory/ebay/catalog + `deploy chrome`  
3. 验证：CDN 新 URL 含 `mergeStockIdHitsIntoInventory`；页面截图 1 results

## 规则

改公开 JS 必须换**从未用过**的 `?v=`；否则 immutable 缓存会让「已修好」在现网测不通。
