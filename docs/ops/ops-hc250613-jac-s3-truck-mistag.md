# OPS · 库存错位扫描（HC250613 发动机 + XC60 半切）

**Date:** 2026-09-12  
**Scan:** 现网公开目录 599 条  
**Status:** 规则已修（待 CEO 批准部署）

## 结论

| 库存号 | 现网位置 | 正确位置 | 依据 |
|---|---|---|---|
| **HC250613** JAC S3 | 卡车驾驶室（首页卡车第 1） | **乘用发动机** `/engines/` | 5 张图全是独立发动机；$300；CEO 确认 |
| **HC250581** Volvo XC60 | 卡车驾驶室（已预留） | **乘用半切** `/half-cuts/` | 半切件清单 + $3900；CEO 确认 |
| **HC250102** Hyundai Mighty | 乘用半切 | **卡车驾驶室** | 品牌 Hyundai Trucks；照片全是驾驶室 |
| **HC250103** Hyundai P440 | 乘用半切 | **卡车驾驶室** | 同上；说明也写 driver cab |
| **HC250516** Hyundai Xcient | 乘用二手整车 | **卡车整车** | 现代重卡，不该进乘用二手车 |

## 全库扫描：这 5 条要改，其余不用动

对照留下的正确例子：

- JAC 帅铃 / 轻型货车 → 卡车（对）
- JAC Refine M5 → 乘用半切（对）
- Hyundai D6CF48E5 HC250074 → 卡车半切（对，不能当乘用车踢走）
- 长安跨越新豹 HC250154 → 轻卡（对）
- 比亚迪轮胎 HC250585 → 乘用轮胎（对）
- 便宜半切（阳光、雨燕 $500–800）→ 仍是半切，不是发动机

回归：

```bash
node scripts/verify-jac-s3-passenger-mistag.mjs
node scripts/scan-inventory-category-mistags.mjs --file /tmp/catalog.json
```

扫描结果必须正好 5 条，不能再误伤跨越小卡 / 现代轻卡 / 轮胎。

## 规则

1. 江淮、沃尔沃是双品牌：只按**车系**判断乘用（S3 / Refine / XC60），不能把整个品牌当乘用车。
2. `Hyundai Trucks` / Xcient / Mighty / P440 / D6CF → 卡车。
3. 长安跨越 / 新豹 → 轻卡，不能因「长安」进乘用车。
4. HC250613 必须是 `passenger` + `Engine Assembly` + `passengerPartType=engine`，才会出现在发动机目录。

## 部署后现网应看到

- `/engines/?q=250613` 有这台发动机
- `/trucks/` 和首页卡车货架没有 250613、没有 XC60
- `/half-cuts/?q=250581` 能搜到 XC60（预留状态不变）
- 帅铃、跨越、现代 D6CF 轻卡仍在卡车

未部署前现网位置仍是错的。
