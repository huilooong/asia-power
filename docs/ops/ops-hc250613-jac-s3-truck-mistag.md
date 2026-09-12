# OPS · HC250613 江淮 S3 误进卡车栏

**Date:** 2026-09-12  
**Stock:** HC250613  
**Status:** 代码已修（待 CEO 批准部署 + 生产改库）

## 结论

| 项 | 内容 |
|---|---|
| 现网位置 | **不对**。出现在卡车 / 驾驶室，而且是首页卡车货架第 1 条 |
| 正确位置 | 乘用车（江淮瑞风 S3），不应出现在 Trucks |
| 现网链接 | https://asia-power.com/trucks/detail.html?slug=jac-s3-2018-hfc4gb2-3e-truck-cab-hc250613 |

## 现网字段（2026-09-12 现网 API）

| 字段 | 值 | 是否合理 |
|---|---|---|
| brand / model | JAC / S3 | 乘用 SUV（瑞风 S3） |
| vehicleCategory | truck | 错 |
| vehicleCondition | Driver Cab | 错 |
| truckPartType | cab | 错 |
| passengerPartType | front | 和卡车驾驶室互相矛盾 |
| includedParts | Front clip assembly | 库里写成前脸 |
| priceUsd | 300 | 更接近发动机总成，不像前切（同类前切 $3000+） |
| 5 张图 | 全是独立发动机（GREENJET / HFC4GB2.3E） | 和「驾驶室 / 前脸」标签不一致 |

对照：同品牌 **JAC Refine M5 HC250153** 正确在乘用半切；**JAC 帅铃 / 轻型货车** 留在卡车是对的。

## 为什么过滤没拦住

江淮同时做卡车和乘用车。旧的「乘用车品牌黑名单」**不能**把整个 JAC 标成乘用车，否则帅铃也会被踢出卡车。于是 S3 这种乘用 SUV 漏网。

同类旧案：2026-07-10 卡车栏混入乘用车、路虎 Freelander。

## 代码修复（本 PR）

1. 只拦江淮**乘用系列**：S2/S3/S4/S5/S7、Refine/瑞风、和悦、思皓  
2. 不拦：帅铃 Shuailing、轻型货车  
3. 文件：`server/lib/vehicle-name-normalize.js`、`js/home-v4-hybrid.js`、`js/half-cut-directory.js`、`js/half-cut-upload-layer.js`、`js/home-hub.js`  
4. 前端 cache key：`jac-s3-mistag-v1`  
5. 改库脚本支持 `--passenger-part` / `--clear-truck-part`

## 生产改库（部署后或 SSH 立刻做）

照片和 $300 更像**发动机总成**。库里写的是前脸。先离开卡车栏；品类建议：

```bash
node scripts/fix-inventory-record.mjs --stock HC250613 \
  --category passenger \
  --condition "Engine Assembly" \
  --passenger-part engine \
  --clear-truck-part \
  --parts "Engine assembly" \
  --description "2018 JAC S3 HFC4GB2.3E engine assembly — supplier-verified listing via AsiaPower." \
  --root /root/.openclaw/workspace/inventory-site
```

若 CEO 确认卖的是前脸而不是发动机，把 `--condition "Front Cut" --passenger-part front --parts "Front clip assembly"` 即可，**仍必须是 passenger，不能是 truck**。

## 验证

```bash
node scripts/verify-jac-s3-passenger-mistag.mjs
```

部署后：

- API `HC250613.vehicleCategory === passenger`
- 首页卡车货架、`/trucks/` 不再出现 HC250613
- `/half-cuts/?q=250613` 能搜到
- JAC 帅铃 HC250125 / HC250126 仍在卡车

## 顺带发现（未改）

HC250581 Volvo XC60 也被标成 `truck-cab`（Reserved）。同一类双品牌误标，未纳入本次范围。
