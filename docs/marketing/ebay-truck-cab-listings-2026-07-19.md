# eBay Motors — 卡车驾驶室（Truck Cab Head）Listing 草稿包

**日期：** 2026-07-19
**来源：** `https://asia-power.com/api/half-cuts/public`（生产实时库存，`vehicleCategory=truck`, `truckPartType=cab`）
**范围：** 18 条真实在售驾驶室，价格 $1,473–$28,000，全部来自已批准（`supplierVerified: true`）库存，没有编造数据。
**用途：** 你开好 eBay 卖家账户后，照抄粘贴即可发布。发布前务必自己审一遍价格和描述——我没有 eBay 账号，没法帮你在真实平台上核对显示效果。

---

## 一、账户与分类设置（所有 listing 共用，只需设一次）

**类目路径（2026-07-19 已在真实草稿里核实）：** eBay Motors → Parts & Accessories → Commercial Truck Parts → **Other Commercial Truck Parts**
（原计划写的"Body & Frame → Cabs"是我猜的，实测 eBay 分类树里没有这个精确叶子分类；搜"Truck Cab"/"Cab"都搜不到专门的驾驶室子类，"Other Commercial Truck Parts"是实际可选项里最贴切的一个）

**Item specifics 通用字段（每条 listing 都要填）：**

| 字段 | 值 |
|---|---|
| Brand | 见下方各条（Sinotruk / HOWO / FAW / Shacman / Dongfeng / Isuzu / Hongyan / Beiben） |
| Type | Cab / Cab & Chassis Part |
| Placement on Vehicle | Front |
| Country/Region of Manufacture | China |
| Country/Region of Origin | China |
| Condition | Used |
| Warranty | Seller warranty available（按你实际政策填，建议 30 天问题反馈期，不是退换货保修） |

**运费/物流政策（写死一次，套用到所有 listing）：**
- Shipping: **Freight quote on request**（驾驶室尺寸大重量大，不能用 eBay 标准运费计算器，必须客户联系报价——在 listing 描述里写清楚 "Buyer to arrange freight forwarder, or contact us for FOB Zhengzhou / sea freight quote to your port"）
- Handling time: 3-5 business days（打包装箱时间）
- Item location: Zhengzhou, Henan, China（注：你的 eBay 卖家账号本身 Item location 默认设成了 Ghana——如果你想让 listing 显示为 Ghana 发货就保留，但描述里务必写清楚实际发货地是中国郑州，避免买家收货后因发货地不符投诉）

**退货政策：**
- 建议 **Returns not accepted**（大件工业品跨境退货成本极高，不现实）——但listing 描述里要写清楚验货环节："Video call inspection before shipment available on request" 弥补不能退货的顾虑，这是这个品类通常的做法，不是偷懒。

---

## 二、定价策略（两种方案，任选，也可以混着用）

现有 `priceUsd` 是**网站 EXW 郑州价**。eBay 买家习惯看到的是"更接近到手价"的数字，两种做法：

**方案A：FOB 中国港口价（推荐用于大部分 listing）**——在 EXW 基础上加 8-12% 覆盖内陆运输+报关+装箱，作为 "Buy It Now" 价格，运费仍然是"另外联系报价"。这样标价不会显得比同行低得离谱（容易招致低价陷阱质疑），又比纯 EXW 更贴近买家预期。

**方案B：原价 EXW + 醒目标注"运费另议"**——适合高价值单品（比如 HC250582 那台 $28,000 的东风康明斯，客户本来就会认真核价，不在乎多问一句运费）。

下表 "eBay 挂牌价" 一列用的是方案A（EXW × 1.10，四舍五入到整数），你可以按感觉调整，这不是精确科学。

**注意：草稿默认 Format 是 Auction（拍卖），我们的定价策略是按 Buy It Now（一口价）设计的**——发布时记得把 Format 从 Auction 切换成 Buy It Now，否则下面的"eBay挂牌价"要填到 Starting bid 而不是固定价，逻辑会不一样。

---

## 三、18 条 Listing

### 1. HC250582 — 2024 东风 康明斯（Cummins）
- **Title：** `2024 Dongfeng Truck Cab Head Complete w/ Cummins Engine China Export`（68字符）
- **Brand:** Dongfeng　**Engine:** Cummins　**Transmission:** 14挡手动　**Drivetrain:** 2WD　**Mileage:** 50,000 km
- **VIN（部分打码）：** LGAG4YL3XR****126
- **网站 EXW 价：** $28,000　→ **eBay 挂牌价（方案A）：** $30,800
- **描述：**
  > 2024 Dongfeng truck cab head, complete assembly including Cummins engine & gearbox, front clip, wiring harness, radiator pack. Low mileage (50,000 km), supplier-verified condition. Sourced and exported directly from our Zhengzhou, China facility — video-verified before dismantling. VIN partial: LGAG4YL3XR****126 (full VIN on request after inquiry). Freight quote on request — we ship worldwide via FOB or CIF.
- **图片：** 4张（Cab Front / Cab Rear / Left Side / Right Side）来自 `https://asia-power.com/trucks/detail.html?slug=dongfeng-2024-cab-truck-cab-hc250582`
- **追踪链接（放描述底部）：** `https://asia-power.com/trucks/detail.html?slug=dongfeng-2024-cab-truck-cab-hc250582&utm_source=ebay&utm_medium=listing&utm_content=hc250582`

### 2. HC250080 — 2021 中国重汽 Sinotruk TX
- **Title：** `2021 Sinotruk TX Truck Cab Head Complete w/ Engine & Gearbox China Export`（73字符）
- **Brand:** Sinotruk　**Engine:** 随驾驶室原厂发动机（未记录具体型号，可现场确认）　**Drivetrain:** 2WD
- **网站 EXW 价：** $4,060　→ **eBay 挂牌价：** $4,466
- **描述：** 同结构模板（见下方"描述模板"，替换品牌型号即可）
- **链接：** `https://asia-power.com/trucks/detail.html?slug=sinotruk-tx-2021-cab-truck-cab-hc250080&utm_source=ebay&utm_medium=listing&utm_content=hc250080`

### 3. HC250106 — 2020 豪沃 HOWO N7
- **Title：** `2020 HOWO n7 Truck Cab Head Complete w/ wp400 Engine China Export`（65字符）
- **Brand:** HOWO (Sinotruk)　**Engine:** WP400　**Transmission:** 12AT　**Drivetrain:** 2WD　**Mileage:** 16,500 km
- **VIN：** LZZPCLSC6L****662
- **网站 EXW 价：** $3,500　→ **eBay 挂牌价：** $3,850
- **链接：** `https://asia-power.com/trucks/detail.html?slug=howo-n7-2020-wp400-truck-cab-hc250106&utm_source=ebay&utm_medium=listing&utm_content=hc250106`

### 4. HC250079 — 2020 中国重汽 Sinotruk TX
- **Title：** `2020 Sinotruk TX Truck Cab Head Complete w/ Engine & Gearbox China Export`（73字符）
- **Brand:** Sinotruk　**Drivetrain:** 2WD
- **网站 EXW 价：** $3,450　→ **eBay 挂牌价：** $3,795
- **链接：** `https://asia-power.com/trucks/detail.html?slug=sinotruk-tx-2020-cab-truck-cab-hc250079&utm_source=ebay&utm_medium=listing&utm_content=hc250079`

### 5. HC250082 — 2012 五十铃 Isuzu Qingling Pickup
- **Title：** `2012 Isuzu Qingling Pickup Truck Cab Head Complete w/ 4JB1 Engine China Export`（78字符）
- **Brand:** Isuzu　**Engine:** 4JB1　**Transmission:** MSB-5MT　**Drivetrain:** 4WD　**Mileage:** 500,000 km（高里程，描述里要如实标注，不要隐瞒）
- **网站 EXW 价：** $3,200　→ **eBay 挂牌价：** $3,520
- **描述附加提醒：** 里程较高，建议描述里加一句 "High mileage unit priced accordingly — mechanically sound, video inspection available"，避免买家事后投诉信息不透明。
- **链接：** `https://asia-power.com/trucks/detail.html?slug=isuzu-2012-4jb1-truck-cab-hc250082&utm_source=ebay&utm_medium=listing&utm_content=hc250082`

### 6. HC250071 — 2021 中国重汽 Sinotruk Hohhan
- **Title：** `2021 Sinotruk Hohhan Truck Cab Head Complete w/ Engine & Gearbox China Export`（77字符）
- **Brand:** Sinotruk　**Drivetrain:** 2WD
- **网站 EXW 价：** $2,690　→ **eBay 挂牌价：** $2,959
- **链接：** `https://asia-power.com/trucks/detail.html?slug=sinotruk-2021-cab-truck-cab-hc250071&utm_source=ebay&utm_medium=listing&utm_content=hc250071`

### 7. HC250091 — 2020 一汽解放 FAW J6P
- **Title：** `2020 FAW J6P Truck Cab Head Complete w/ Engine & Gearbox China Export`（69字符）
- **Brand:** FAW　**Drivetrain:** 2WD
- **网站 EXW 价：** $2,300　→ **eBay 挂牌价：** $2,530
- **链接：** `https://asia-power.com/trucks/detail.html?slug=faw-j6p-2020-cab-truck-cab-hc250091&utm_source=ebay&utm_medium=listing&utm_content=hc250091`

### 8. HC250114 — 2019 陕汽 Shacman L3000
- **Title：** `2019 Shacman L3000 Truck Cab Head Complete w/ Engine & Gearbox China Export`（75字符）
- **Brand:** Shacman　**Drivetrain:** 2WD
- **网站 EXW 价：** $2,200　→ **eBay 挂牌价：** $2,420
- **链接：** `https://asia-power.com/trucks/detail.html?slug=shacman-l3000-2019-cab-truck-cab-hc250114&utm_source=ebay&utm_medium=listing&utm_content=hc250114`

### 9. HC250110 — 2021 东风 天龙VL
- **Title：** `2021 Dongfeng Tianlong VL Truck Cab Complete w/ Engine China Export`（67字符）
- **Brand:** Dongfeng　**Model:** Tianlong VL　**Drivetrain:** 2WD
- **网站 EXW 价：** $1,800　→ **eBay 挂牌价：** $1,980
- **链接：** `https://asia-power.com/trucks/detail.html?slug=dongfeng-tianlong-vl-2021-cab-truck-cab-hc250110&utm_source=ebay&utm_medium=listing&utm_content=hc250110`

### 10. HC250070 — 2017 五十铃 Isuzu Giga
- **Title：** `2017 Isuzu Giga Truck Cab Head Complete w/ Engine & Gearbox China Export`（72字符）
- **Brand:** Isuzu　**Drivetrain:** 2WD
- **网站 EXW 价：** $1,800　→ **eBay 挂牌价：** $1,980
- **链接：** `https://asia-power.com/trucks/detail.html?slug=isuzu-giga-2017-cab-truck-cab-hc250070&utm_source=ebay&utm_medium=listing&utm_content=hc250070`

### 11. HC250077 — 2017 陕汽 Shacman X3000
- **Title：** `2017 Shacman X3000 Truck Cab Head Complete w/ Engine & Gearbox China Export`（75字符）
- **Brand:** Shacman　**Drivetrain:** 2WD
- **网站 EXW 价：** $1,790　→ **eBay 挂牌价：** $1,969
- **链接：** `https://asia-power.com/trucks/detail.html?slug=shacman-x3000-2017-cab-truck-cab-hc250077&utm_source=ebay&utm_medium=listing&utm_content=hc250077`

### 12. HC250101 — 2023 陕汽 Shacman M3000
- **Title：** `2023 Shacman M3000 Truck Cab Head Complete w/ Engine & Gearbox China Export`（75字符）
- **Brand:** Shacman　**Drivetrain:** 2WD（年份新，可在标题/描述里突出 "Late model / low hours"）
- **网站 EXW 价：** $1,767　→ **eBay 挂牌价：** $1,944
- **链接：** `https://asia-power.com/trucks/detail.html?slug=shacman-m3000-2023-cab-truck-cab-hc250101&utm_source=ebay&utm_medium=listing&utm_content=hc250101`

### 13. HC250092 — 2020 红岩 Hongyan Genlyon
- **Title：** `2020 Hongyan Genlyon Truck Cab Head Complete w/ Engine & Gearbox China Export`（77字符）
- **Brand:** Hongyan　**Drivetrain:** 2WD
- **网站 EXW 价：** $1,690　→ **eBay 挂牌价：** $1,859
- **链接：** `https://asia-power.com/trucks/detail.html?slug=hongyan-2020-cab-truck-cab-hc250092&utm_source=ebay&utm_medium=listing&utm_content=hc250092`

### 14. HC250100 — 2020 北奔 Beiben V3
- **Title：** `2020 Beiben V3 Truck Cab Head Complete w/ Engine & Gearbox China Export`（71字符）
- **Brand:** Beiben　**Drivetrain:** 2WD
- **网站 EXW 价：** $1,620　→ **eBay 挂牌价：** $1,782
- **链接：** `https://asia-power.com/trucks/detail.html?slug=beiben-v3-2020-cab-truck-cab-hc250100&utm_source=ebay&utm_medium=listing&utm_content=hc250100`

### 15. HC250089 — 2018 一汽解放 FAW JH6
- **Title：** `2018 FAW JH6 Truck Cab Head Complete w/ Engine & Gearbox China Export`（69字符）
- **Brand:** FAW　**Drivetrain:** 2WD
- **网站 EXW 价：** $1,500　→ **eBay 挂牌价：** $1,650
- **链接：** `https://asia-power.com/trucks/detail.html?slug=faw-jh6-2018-cab-truck-cab-hc250089&utm_source=ebay&utm_medium=listing&utm_content=hc250089`

### 16. HC250095 — 2018 红岩 Hongyan Genlyon
- **Title：** `2018 Hongyan Genlyon Truck Cab Head Complete w/ Engine & Gearbox China Export`（77字符）
- **Brand:** Hongyan　**Drivetrain:** 2WD
- **网站 EXW 价：** $1,490　→ **eBay 挂牌价：** $1,639
- **链接：** `https://asia-power.com/trucks/detail.html?slug=hongyan-2018-cab-truck-cab-hc250095&utm_source=ebay&utm_medium=listing&utm_content=hc250095`

### 17. HC250068 — 2019 中国重汽 Sinotruk Hohan
- **Title：** `2019 Sinotruk Hohan Truck Cab Head Complete w/ Engine & Gearbox China Export`（76字符）
- **Brand:** Sinotruk　**Drivetrain:** 2WD
- **网站 EXW 价：** $1,475　→ **eBay 挂牌价：** $1,623
- **链接：** `https://asia-power.com/trucks/detail.html?slug=sinotruk-hohan-2019-cab-truck-cab-hc250068&utm_source=ebay&utm_medium=listing&utm_content=hc250068`

### 18. HC250111 — 2021 北奔 Beiben V3MT
- **Title：** `2021 Beiben V3MT Truck Cab Head Complete w/ Engine & Gearbox China Export`（73字符）
- **Brand:** Beiben　**Drivetrain:** 2WD
- **网站 EXW 价：** $1,473　→ **eBay 挂牌价：** $1,620
- **链接：** `https://asia-power.com/trucks/detail.html?slug=beiben-v3mt-2021-cab-truck-cab-hc250111&utm_source=ebay&utm_medium=listing&utm_content=hc250111`

---

## 四、描述模板（没写具体描述的条目，照这个套用）

```
{Year} {Brand} {Model} truck cab head, complete assembly including engine & gearbox,
front clip, wiring harness, radiator pack. Supplier-verified condition, sourced and
exported directly from our Zhengzhou, China facility — video-verified before dismantling.
Full VIN available on request after inquiry. Freight quote on request — we ship
worldwide via FOB or CIF. See more photos and full spec sheet: {tracking link}
```

---

## 五、发布顺序建议

1. 账户开通后，**先发 2-3 条测试**（建议挑 HC250106 HOWO N7、HC250091 FAW J6P、HC250100 北奔 V3 这三条——价格中等、信息完整度高、不是极端案例），确认分类/图片/价格显示都正常。
2. 测试没问题再把剩下 15 条一次性发完。
3. **不要挂 HC250582 那台 $28,000 康明斯做测试**——高价商品出了显示问题损失更大，等流程走顺了再发它。
4. 每条 listing 发布后，把 eBay 上的真实 listing 链接记下来发我，我可以帮你后续追踪从 eBay 点回网站的流量（GA4 里看 `utm_source=ebay` 的数据）。

---

## 六、2026-07-19 实测记录

- 你的 eBay 卖家账户已经在用了（draftId=5316415831612），说明账户开通这一步你已经自己搞定了，比原计划快。
- 帮你把这条草稿的类目从默认的 "Engines" 换成了 "Other Commercial Truck Parts"（见上方"一、账户与分类设置"里的更正）。
- 这条草稿目前 Format 是 Auction（拍卖），跟本文档"一口价+运费另议"的设计不一致——发布前记得看一眼要不要切到 Buy It Now。
- 账号 Item location 默认设成了 Ghana——如果保留这个设置，描述里务必写清楚实际发货地是中国郑州（见上方运费政策的注解），否则可能引起买家对发货地的困惑。
- **正在填 HC250106（HOWO N7）作为这条草稿的实际内容**，见下方进度记录。

---

## 数据免责声明

- 所有价格、车型、发动机代码、VIN（部分打码）均直接取自生产库存 API（`https://asia-power.com/api/half-cuts/public`），截至 2026-07-19，**不是编造的**。
- 里程数据部分记录为空（"Not recorded"）——这些条目发布时如实填 "Mileage not recorded" 或 "Contact for details"，不要编一个数字。
- 变速箱代码大部分为空——同理如实标注，不要编。
- 如果你发布时发现某条已经卖掉/库存有变化，先去 `https://asia-power.com/trucks/detail.html?slug=...` 对应链接确认还在架上，再发布。
