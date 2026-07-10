# OPS · 卡车货架混入乘用车修复

**Date:** 2026-07-10  
**Status:** ✅ 已修生产数据 + 过滤加固

## 结论

| 项 | 内容 |
|----|------|
| 现象 | 首页 Trucks 货架出现帝豪GL、科鲁兹、英朗等乘用车 |
| 数量 | **12 台**（HC250528–HC250540 中的一批） |
| 根因 | QXB 上传（汽修宝，7/8–7/9）源表是乘用车 Half Cut，入库却被标成 `vehicleCategory=truck` + `Driver Cab` + `truckPartType=cab` |
| 展示层 | 首页/目录只信 `Driver Cab`/`cab` 字段，未校验是否真是卡车 |

## 已处理

1. **生产数据纠正**：12 台改回 `passenger` / `Half Cut`，清空 `truckPartType`，slug 去掉 `truck-cab`  
   - 备份：`data/_backups/*before-truck-cab-fix-20260710-051500*`
2. **过滤加固**：首页 `home-v4-hybrid.js`、`home-hub.js`、`half-cut-directory.js` 要求 `vehicleCategory===truck`，并拦截乘用车品牌误标
3. **入库防护**：`server/lib/vehicle-name-normalize.js` + `half-cut-upload-layer.js` — 乘用车品牌不再被 `Driver Cab` 强行改成卡车

## 验证

- 现网卡车驾驶室：**48 台**（JAC/JMC/Shacman/HOWO…）
- 12 台问题库存：均为 `passenger` / `Half Cut`

## 后续注意

QXB 审核通过时核对「品类」：乘用车不要选卡车驾驶室。若再出现，先查 `vehicleCategory`/`truckPartType` 是否被误写。
