# OPS — HC250552 尚酷显示成朗逸/Lavida

> 日期：2026-07-10  
> 库存：HC250552 · VIN `WVWR23131DV010119`

## 事实

| 项 | 值 |
|---|---|
| 汽修宝 / decode | 尚酷（Scirocco），引擎 CDL |
| 提交 `decodedData.model` | 尚酷 |
| 提交/现网 `model`（错） | 朗逸 → 公开展示 **Lavida** |
| `nameCorrections.model` | 尚酷（说明上传时被「纠正」覆盖） |
| CEO 口述 | 「拉昂」——现网实际英文是 Lavida（朗逸），非凌渡 Lamando |

## 根因

`vehicle-name-normalize` 的 `normalizeKey()` 用 `[^a-z0-9]+` **剥掉全部中文**，导致：

1. `尚酷` / `途安` / `朗逸` 的 key 都变成 `''`
2. 供应商端又把学过的中文车型写进 `vehicle-model-memory`（含「朗逸」）
3. `exact = models.find(normalizeKey(m) === '')` 命中**第一个**中文车型 → 尚酷被改成朗逸

同类受害（同 bug，非 VIN 前缀误映射）：HC250244 途安→朗逸；HC250243 狮跑→赛拉图；HC250176 兰德酷路泽→霸道；HC250164 五菱之光→宏光。

## 规则（以后）

- `normalizeKey` **必须保留 CJK**；空 key 禁止模糊匹配
- 中文车型用显式 alias / `zh-en-seed` 映射到英文目录名（尚酷→Scirocco）
- 修显示优先信 `decodedData` / `nameCorrections` 原始车型，勿盲信被 normalize 后的 `model`
- 禁止：为了「目录对齐」把未知中文塌缩到任意已学中文名

## 修复

- 代码：`server/lib/vehicle-name-normalize.js`、`js/vehicle-name-normalize.js`、`zh-en-seed.js`、`vehicle-catalog.js`
- 数据：`fix-inventory-record.mjs` 改 HC250552→Scirocco 及同类受害库存
- 部署：Release Manager `api` + 同步供应商端 normalize JS

## 验证（2026-07-10）

| 项 | 结果 |
|---|---|
| Release | `REL-20260710095317-api-76489479` |
| 详情新 slug | https://asia-power.com/half-cuts/detail.html?slug=volkswagen-scirocco-2011-cdl-half-cut-hc250552 → Scirocco，无 Lavida |
| 旧 slug 别名 | `volkswagen-2011-cdl-half-cut-hc250552` 仍打开同一台，显示 Scirocco |
| VIN decode | `WVWR23131DV010119` → model Scirocco / qxbSeries 尚酷 |
| 同类已修 | HC250244 Touran；HC250243 Sportage；HC250176 Land Cruiser；HC250164 Sunshine |
| 备份 | `data/half-cut-*.json.bak-scirocco-20260710` |
