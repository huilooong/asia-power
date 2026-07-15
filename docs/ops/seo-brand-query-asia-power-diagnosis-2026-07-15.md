# SEO 诊断：品牌词 “asia power” 排名 ~34（2026-07-15）

## 结论（先看这个）

**不是网站坏了，是搜索词本身太“脏”。**  
Google 搜 `asia power` 时，前排被**电力设备商、地缘政治指数、发电集团**占满；AsiaPower（汽配动力总成，`asia-power.com`）跟这些实体抢同一个英文短语，品牌词排到 30+ 名是**预期内的竞争结果**，不是 GSC 配错或 title 写错。

加纳市场平均排名约 2.1（方案里的数据）说明：**带品类/市场意图的长尾词**我们能排得很好；问题集中在**裸品牌词**。

---

## 证据：裸搜 “asia power” 谁在前面

| 大致位置 | 实体 | 域名/来源 | 行业 |
|---|---|---|---|
| 前列 | Asiapower（熔断器/避雷器等配电设备） | asiapower.net | 电力器材制造 |
| 前列 | Asia Power LLC（低压开关柜） | asiapowerllc.com | 电力开关设备 |
| 前列 | Lowy Institute **Asia Power Index** | power.lowyinstitute.org / Wikipedia | 地缘政治指数（“亚洲力量指数”） |
| 前列 | Mitsubishi Power Asia Pacific 等 | power.mhi.com 等 | 发电设备 |

以上来自 2026-07-15 Web 检索结果（非猜测）。这些站点域名权威、外链、百科引用远强于我们，且**字面完全匹配** `Asia Power` / `Asiapower`。

对照：用更具体查询（带 engines / half-cut / Ghana）时，`asia-power.com` 才会更容易进入相关结果——与“加纳意图词排名好、裸品牌词差”的 GSC 画像一致。

---

## 网站自身技术信号（已查现网）

| 检查项 | 现网结果 | 是否构成“品牌信号弱”主因 |
|---|---|---|
| `<title>` | `AsiaPower \| Global Powertrain Sourcing…`（品牌在最前） | 否 — 写法正常 |
| `Organization` JSON-LD `name` | `AsiaPower` | 否 — 与品牌一致 |
| `canonical` | `https://asia-power.com/` | 否 |
| 域名形态 | `asia-power.com`（带连字符） | **加重因素**：用户常搜无连字符 `asia power`，而权威结果多为无连字符品牌 |

结论：**技术面没有明显“自残”**（title/schema 不需要为这次诊断大改）。主因是**词义竞争 + 外链/权威不足**，不是 Organization 写错。

---

## 建议（改动要小，对准可赢的词）

1. **不要把精力砸在硬刚裸词 “asia power” 第 1 名**——对面是电力行业同名公司 + Lowy 指数，ROI 极差。  
2. **外链与内容统一推“可区分品牌串”**：`AsiaPower` + `used engines` / `half-cut` / `Ghana` / `powertrain`（对应本方案板块 2 外链节奏）。  
3. **GSC 监测拆开看**：  
   - 裸词 `asia power` / `asiapower` → 预期仍差，作对照；  
   - 品牌+品类 / 加纳意图词 → 才是成功指标。  
4. **可选轻量改动（非必须，需 CEO 点头再上）**：首页/关于页首屏一句英文点明差异，例如 *“AsiaPower — used engines & half-cuts from China (not electrical power equipment)”*，降低同名电力公司混淆；**不要**指望这一句把裸词冲到第 1。  
5. **不要改域名**（成本高）；连字符域名继续用，广告/WhatsApp/名片上写 `AsiaPower (asia-power.com)`。

---

## 验收给 Claude 用的一句话

> 排名 34 的根因是 **SERP 被同名电力/地缘政治实体占据**，现网 title/Organization 正常；应用外链+品类词加强区分度，而不是按“网站坏了”去大翻修。
