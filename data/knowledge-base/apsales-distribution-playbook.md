# 子敬 · 分销推广渠道 Playbook

> Agent：鲁肃（子敬 / `apsales`）  
> **最终 KPI**：让客户 **访问 asia-power.com**；有需求则 **发邮件 sales@asia-power.com**（或 WhatsApp +233 54 091 1111）。社媒 **不硬销成交** — 流量 + 邮件线索。  
> 目标：通过 **Facebook 小组、Instagram、X（Twitter）、Google 搜索、专业论坛、Google 地图（找客户）、海关数据（找进口商）** 为 AsiaPower 平台带来合格买家线索  
> 原则：**所有对外公开发帖/回复 = 草稿 → CEO 批准 → 才发布**（不自动外发）  
> 推广方案 A–E（v2）：`data/knowledge-base/apsales-promotion-schemes-v2.md`

---

## 今日任务 · 2026-07-04（CEO 策略转向 · 引流优先）

| 项 | 内容 |
|----|------|
| **KPI** | 客户访问 **asia-power.com**；有需求发邮件 **sales@asia-power.com** |
| **P0** | **加入 FB 小组**（关键词 tokunbo / half cut / spare parts / Toyota / engine + 国家名）· 每日 **2–3 个** |
| **P1** | **入组后真人问候 + 链接**（非硬广 blast）· 每组一次 |
| **P2** | **小组内评论他人帖**（相关时带链接）· 限速 |
| **P3** | **时间线发帖 · 0–1/日** · 平台限流 → 自动停 24h |
| **P4** | **好友 DM · 5–15/日** · 带图链 |
| **P5** | **X 关注** · 低优先级 |
| **暂停** | Instagram 今日跳过 |
| **配置** | `config/apsales_social_engagement_policy.yaml` · 小组清单 `config/apsales_fb_target_groups.yaml` |
| **Mac 脚本** | `scripts/apsales-facebook-daily-run.py` — 顺序：入组 → 问候 → 浏览 → DM → 时间线（余量） |
| **看板** | https://asia-power.com/admin/apsales-zijing-live.html |

**原则**：平台限流 = 计划错了 → **减/停时间线发帖**，改攻小组真人互动。

**Cron**：Mac 本地每日一体运行；生产 autopilot 每 30 分钟最多 1 个队列动作。**每日 UTC 00:00** 按向西时间线重排队列（小组动作优先）。

---

## 向西逐波时间线（Follow the sun westward）

> 配置：`config/apsales_market_timeline.yaml` · 引擎：`customer_gateway/social_engagement_engine.py`

互动波次随 UTC **向西移动**，对齐各市场本地营业高峰。子敬只执行 **当前波 + 相邻波** 的队列动作。

| UTC 时段 | 市场区 | 主攻动作 |
|----------|--------|----------|
| 00:00–03:00 | 东南亚 | 浏览情报、轻量 X |
| 03:00–08:00 | 东非 | **FB 小组搜索+入组+问候** |
| 08:00–12:00 | 西非 | **小组主战场 · 入组+问候+评论 · 好友私信** |
| 12:00–16:00 | 法语西非 | **法语小组 · 入组+问候** |
| 14:00–18:00 | 海湾重叠 | 小组评论+浏览 |
| 16:00–21:00 | 西非下午 | 小组问候+评论 · 私信 · 时间线仅余量 |

**CEO 看板**：
- 实时横幅：https://asia-power.com/admin/apsales-zijing-live.html
- 晨间报告章节：「向西逐波 · 当前波次 / 下一波次」

---

## 红线（必读）

| 规则 | 说明 |
|------|------|
| **平台定位** | AsiaPower 是连接全球买家与 **验证供应商网络** 的平台，**不默认自有库存** |
| **半切卖点** | 对外统一口径：**定制拆解，按需取件** → 链到 `https://asia-power.com/half-cuts/` |
| **CEO 审批** | 任何 Facebook / Instagram / X / 论坛 / 地图外联 / 海关数据开发邮件 / 广告文案，**必须先出草稿给 CEO，批准后才发** |
| **禁止** | 自动发帖、批量灌水、虚假库存、未授权折扣、暴露 AI/审批流程 |
| **联系方式** | **首选**：引导进站 `https://asia-power.com/half-cuts/` → 邮件 **sales@asia-power.com**；备选 WhatsApp +233 54 091 1111 |
| **链接格式** | 详情页必须用 `half-cuts/detail.html?slug=…`（旧路径 `/half-cuts/toyota-vios-…/` 会 404） |
| **链接优先级** | 半切 `half-cuts/` → 发动机 `engines/` → 卡车 `trucks/` → 工程机械 `machinery/` |
| **社媒 KPI** | 进站 PV · 邮件询盘 · WhatsApp 点击 — **不在评论/DM 里报价成交** |

---

## 渠道优先级（市场总监定稿 · 子敬按序执行）

| 优先级 | 渠道 | 为什么 | 子敬每周投入 |
|--------|------|--------|--------------|
| **P0** | Facebook 西非汽配/进口小组 | 买家集中、询价多、加纳办公室可承接 | 3–5 条回复草稿 + 1 条主帖草稿 |
| **P0** | WhatsApp 群 / 广播列表 | 现有 +233 主号阵地，转化最快 | 维护群名单 + 2 条群发草稿（CEO 批） |
| **P1** | Google 地图（**客户发现工具**） | 直接找汽配店/汽修厂/拆车场/进口商，比被动等询盘快 | **每周 20 家**目标城市店铺入库 + 2–3 条 WhatsApp/邮件草稿 |
| **P1** | **海关数据**（**找进口商**） | 按 HS 编码 + 目的国查真实进口记录，精准锁定 B2B 进口商 | **每周 10 家**进口商入库 + **2 条**开发邮件草稿 |
| **P1** | 专业论坛（PakWheels、Nairaland 等） | 高意图长尾搜索 | 每 2 周 1 主题帖草稿/论坛 |
| **P1** | **Instagram**（视觉库存） | 半切/发动机实拍、装柜视频封面，西非买家刷图找货 | **2 条帖草稿/周** + Bio 链 `half-cuts/` |
| **P2** | **X（Twitter）**（搜索 + B2B 触达） | 型号/engine code 搜索、进口商互动、链官网 | **3 帖草稿/周** + **2 条 DM 草稿/周** |
| **P2** | LinkedIn（B2B 进口商） | 中大型进口商、工程机械买家 | 2 连接请求 + 1 帖草稿/周 |
| **P2** | B2B 平台（Alibaba.com、Made-in-China 展示页） | 被动询盘入口 | 每月更新 1 次产品摘要（CEO 批） |
| **P3** | TikTok / YouTube Shorts | 装柜、验车、拆解短视频引流 | 1 条脚本/周（CEO 批后拍摄/发布） |
| **P3** | Reddit / 品牌论坛 | 技术向、型号精准 | 3 评论/周（须审批） |

**原则：** 先 P0 做满，再开 P1；P2/P3 有余力再做，不分散精力。

---

## 一、Facebook 小组

> **优先级：西非 > 东非/中非 > 南亚 > 其他**

### 1.1 小组类型（按地区）

#### 🇬🇭🇳🇬🇨🇮 西非（最高优先）

| 类型 | 搜索关键词（英文/法文） | 用途 |
|------|------------------------|------|
| 二手车/拆车进口商 | `Ghana auto parts`, `Nigeria tokunbo`, `Abidjan spare parts`, `Tema port import` | 半切、发动机询价 |
| 卡车/商用车 | `Ghana truck parts`, `HOWO Ghana`, `Isuzu NPR parts`, `Hino 500 Africa` | 卡车头、半切 |
| 工程机械 | `Ghana excavator parts`, `CAT parts West Africa` | 工程机械目录引流 |
| 法语区 | `pièces auto Abidjan`, `import véhicule Afrique`, `moteur occasion Chine` | 法文买家 |
| 港口/物流 | `Tema port`, `Lagos clearing agent`, `Cotonou import` | 建立 B2B 关系，不硬广 |

#### 🇰🇪🇹🇿🇺🇬 东非

| 类型 | 关键词 | 用途 |
|------|--------|------|
| 拆车/配件 | `Kenya spare parts`, `Mombasa import`, `Uganda auto parts` | 发动机、变速箱 |
| 丰田/日产专线 | `Toyota Hilux engine Kenya`, `Nissan Hardbody parts` | 型号精准帖 |

#### 🇵🇰🇧🇩 南亚

| 类型 | 关键词 | 用途 |
|------|--------|------|
| 日本车拆件 | `Pakistan JDM parts`, `half cut Japan`, `corolla engine Lahore` | 半切、发动机 |
| 商用车 | `Suzuki Ravi engine`, `Hino parts Karachi` | 小商用 |

#### 🌍 其他（低优先，有余力再做）

- 加勒比：`Jamaica auto parts`, `Trinidad half cut`
- 中东：`Dubai auto parts export`, `Saudi spare parts`
- 东南亚：`Philippines surplus parts`, `Indonesia half cut`

### 1.2 入组与发帖规则

1. **先潜水 3–7 天**：读群规，看管理员是否禁止外链/商业帖
2. **首帖用「帮助型」语气**：回答别人询价，附 1 条官网链接（经 CEO 批准的草稿）
3. **配图**：用现网库存真实图（经子龙/库存工具确认），禁止盗图
4. **频率**：每个活跃小组 **每周最多 1 条主帖** + **每日最多 2 条评论回复**（均须草稿审批）
5. **话术模板（草稿）**：

```
Hi — we help importers source verified half-cuts and engines from China 
through our supplier network. Browse current listings: https://asia-power.com/half-cuts/
For a quote (EXW Zhengzhou / CIF to your port), WhatsApp us or use the contact form.
```

6. **法文区加纳/科特迪瓦** 改用简短法文版（子敬出双语草稿）

**半切专用帖（可改型号）：**

```
Custom dismantling — parts on demand. Browse half-cuts & engines from our 
verified supplier network: https://asia-power.com/half-cuts/
Quote EXW Zhengzhou or CIF to your port — WhatsApp +233 54 091 1111
```

### 1.3 子敬每周 Facebook 动作

| 动作 | 频率 |
|------|------|
| 扫描西非新小组 / 活跃帖 | 每周一 |
| 整理 3–5 条「可回复询价」+ 草稿 | 每周二 |
| 提交 CEO 审批 | 每周三前 |
| 批准后发布 + 记录 CRM | 每周四–五 |
| 周报：点击/私信/询价数 | 每周五 |

---

## 1B、WhatsApp 社群（与 Facebook 并列 P0）

> 不陌生骚扰；只进 **已有客户拉群、行业协会群、港口货代群**，或 CEO 批准的广播列表。

| 群类型 | 怎么找 | 发什么 |
|--------|--------|--------|
| 西非进口商群 | 现有 CRM 客户邀请、Tema/Lagos 货代合作群 | 每周 1 条「本周可询型号 + 半切目录链接」 |
| 丰田/日产专线群 | Facebook 小组里问「有没有 WhatsApp group」 | 发动机页 `engines/` + 具体型号 |
| 卡车/重卡群 | HOWO / Hino / Isuzu 相关 FB 帖下留 WhatsApp | `trucks/` + 实拍图（库存确认后） |
| 工程机械群 | 卡特/小松买家群 | `machinery/` |

**群发规则：**

1. 每条必含 **1 个链接**（半切优先 `half-cuts/`）+ **WhatsApp 一键联系**
2. **每周每群最多 1 条**；禁止连发 3 天以上
3. 全部走 CEO 审批包（与 Facebook 草稿合并提交）

---

## 二、Google 搜索（SEO + 可选 Ads）

### 2.1 核心 SEO 关键词

#### 高意图（优先做落地页/目录页）

| 英文关键词 | 对应页面 |
|-----------|----------|
| `half cut export China`, `half cut car for sale`, `JDM half cut FOB` | `/half-cuts/` |
| `used engine export China`, `Toyota 1NZ engine export`, `Nissan QR25 engine` | `/engines/` + 型号子页 |
| `truck head export China`, `HOWO truck cab export`, `Isuzu NPR cab` | `/trucks/` |
| `used excavator export China`, `CAT 320D export` | `/machinery/` |
| `auto parts exporter China FOB`, `spare parts Zhengzhou export` | 首页 + `/contact.html` |

#### 西非长尾（法语/英语）

- `moteur occasion export Chine CIF Tema`
- `half cut shipping to Ghana`, `engine import Nigeria Lagos`
- `Tokunbo parts China supplier`

#### 品牌 × 产品组合（持续扩充）

- `{Brand} {Model} half cut` — 如 `Toyota Corolla half cut`, `Honda CR-V half cut`
- `{Engine code} for sale export` — 如 `1KD-FTV export`, `G4KD engine China`

### 2.2 站内 SEO 优先级（给 CEO/技术对照，子敬提需求）

| 优先级 | 页面 | 动作 |
|--------|------|------|
| P0 | `/half-cuts/`, `/engines/`, `/trucks/` | title/description 含 half-cut / engine export / FOB |
| P0 | 各 `engines/{code}.html` | 唯一 H1、型号+export 关键词、链回目录 |
| P1 | `/contact.html`, `/about.html` | NAP 与 Google 地图一致；加纳+郑州双办公室 |
| P1 | `/brands.html` + 各品牌页 | 内链到 half-cuts / engines |
| P2 | `/gearboxes/`, `/machinery/` | 补充 meta 与内链 |

**子敬职责**：每月整理「买家常搜词 TOP10」→ 提交 CEO 做页面/文案微调（不直接改代码）。

### 2.3 Google Ads（可选 · 须 CEO 批准后才开户/充值）

| 项 | 说明 |
|----|------|
| **触发条件** | 自然搜索 4 周无起色，或 CEO 主动要求测投放 |
| **预算** | CEO 书面批准金额与周期；子敬 **不得** 自行绑卡 |
| **推荐结构** | _campaign A_ 半切+发动机 export · _campaign B_ 西非 CIF/Tema · _campaign C_ 品牌型号 |
| **落地页** | 仅指向现网目录页或 contact，禁止临时单页 |
| **文案草稿** | 子敬出 3 版 → CEO 选版 → 再上线 |
| **禁词** | `cheapest`, `we have all stock`, 未核实价格 |

---

## 三、专业论坛

> 原则：**先贡献价值，再带链接**；每个论坛单独记「版规摘要」到 CRM 备注。

### 3.1 论坛清单

| 论坛/社区 | 地区/语言 | 适合内容 | 链接指向 |
|-----------|-----------|----------|----------|
| **PakWheels** (forums.pakwheels.com) | 巴基斯坦 · 英文 | 丰田/本田/Honda 发动机、半切、JDM | `/engines/`, `/half-cuts/` |
| **Nairaland** — Auto / Car Talk | 尼日利亚 · 英文 | 西非进口、Tokunbo、港口费用讨论 | `/half-cuts/`, `/contact.html` |
| **Ghana auto Facebook 镜像帖** + **GhanaWeb Forum** (若开放) | 加纳 | 本地进口商、Tema 港 | `/half-cuts/`, WhatsApp |
| **Reddit** — r/MechanicAdvice, r/Cartalk, r/Diesel | 全球 · 英文 B2B 风 | 技术答疑式回复，签名档放官网 | `/engines/` |
| **Alibaba 论坛 / 1688 商友圈** | 中文/英文 | 供应商侧曝光；强调 **平台撮合** 非囤货 | 首页 + `/about.html` |
| **Toyota Nation / Nissan Forums** | 全球 | 具体发动机型号帖 | 对应 `engines/*.html` |
| **Heavy Equipment Forums** | 全球 | 卡特/小松等工程机械 | `/machinery/` |
| **French: AutoAfrique / FB 法语汽配群** | 科特迪瓦/塞内加尔 | 法文短帖 | `/half-cuts/?lang=fr` |

### 3.2 发帖规则（通用）

1. **注册账号**：用 `AsiaPower Sales` 或 `@sales@asia-power.com`，头像用官方 logo
2. **版规**：禁止首帖硬广的板块 → 先回复 5–10 帖建立信任
3. **标题示例**：`Sourcing half-cuts from verified CN suppliers — platform catalog (not a single-yard stock list)`
4. **正文结构**：
   - 1 句平台定位（验证供应商网络）
   - 1–2 个真实可搜型号示例（经库存工具确认）
   - 链接：`https://asia-power.com/half-cuts/` 或 `/engines/`
   - CTA：WhatsApp / contact form
5. **频率**：每个论坛 **每 2 周最多 1 主题帖**；日常 **评论回复须审批**
6. **存档**：帖 URL + 截图 → `memory/customers/` 或销售 pipeline 备注

### 3.3 按产品线的链接策略

| 买家问 | 首选链接 |
|--------|----------|
| 半切 / front cut / nose cut | `https://asia-power.com/half-cuts/` |
| 发动机型号 / engine code | `https://asia-power.com/engines/` → 具体型号页 |
| 卡车头 / cab / truck head | `https://asia-power.com/trucks/` |
| 挖机 / 铲车 | `https://asia-power.com/machinery/` |
| 变速箱 | `https://asia-power.com/gearboxes/` |
| 询价 / 报价 | `https://asia-power.com/contact.html` |

---

## 3B、LinkedIn · B2B 平台（P2）

### LinkedIn

| 动作 | 说明 |
|------|------|
| 搜索人群 | `auto parts importer Ghana`, `used car parts Nigeria`, `half cut buyer` |
| 连接话术 | 简短自我介绍 + 平台定位 + 官网（草稿 → CEO 批） |
| 公司页帖 | 每周 1 条：库存亮点 / 装柜图 / 半切案例 → 链 `half-cuts/` |
| 禁则 | 不 InMail 轰炸、不承诺价格 |

### B2B 平台（展示为主，非主战场）

| 平台 | 用途 | 链向 |
|------|------|------|
| **Alibaba.com** 国际站 | 被动询盘、关键词 `half cut`, `used engine export` | 详情页链回 `asia-power.com` 目录 |
| **Made-in-China / Globalsources** | 补充曝光 | 同上 |
| **Facebook Marketplace** | ⚠️ 仅 CEO 批准；易违规，低优先 | 单品帖 + WhatsApp |

**子敬职责：** 每月整理「平台询盘来源表」→ 哪个渠道带来有效 WhatsApp/邮件。

---

## 3C、短视频（TikTok / YouTube · P3）

| 内容类型 | 示例 | CTA |
|----------|------|-----|
| 装柜/发货 | 40 秒集装箱装半切 | 主页链 `asia-power.com` |
| 验车启动 | 出口前启动视频（已有库存规则） | `half-cuts/detail.html?slug=…` |
| 拆解说明 | 「定制拆解，按需取件」口播 + 字幕 | `half-cuts/` |

脚本须 CEO 批；不在视频里报未核实价格。

---

## 3D、Instagram（Ins · P1 · 视觉库存主阵地）

> **为什么 P1：** 半切、装柜、发动机实拍天然适合 Ins 图文/Reels；西非买家常通过 Ins 搜 `#tokunbo`、`#GhanaAuto` 找货源。  
> **红线：** 发帖、Story、Reels、评论回复、**DM 私信** — 全部草稿 → CEO 批准 → 才发布/发送。

### 账号策略

| 账号类型 | 建议 | 说明 |
|----------|------|------|
| **AsiaPower 品牌号**（主） | ✅ 推荐 | 名称 `AsiaPower Auto Export`；头像官方 logo；Bio 写平台定位 + **加纳办公室**（Accra/Tema）+ 郑州 |
| **CEO 个人号**（辅） | 可选 | 仅 CEO 本人运营；子敬可出草稿，**不代 CEO 发帖** |
| **加纳办公室角度** | ✅ 推荐 | Bio/帖文强调「West Africa support · WhatsApp +233」— 本地信任感 |

**Bio 模板（草稿 · 须 CEO 批）：**

```
AsiaPower — verified half-cuts & engines from China
Custom dismantling · parts on demand
🇬🇭 Ghana office · 🇨🇳 Zhengzhou export
👇 Browse catalog
https://asia-power.com/half-cuts/
WhatsApp +233 54 091 1111
```

**Link in Bio：** 固定指向 `https://asia-power.com/half-cuts/`（半切优先）；可用 Linktree 类工具加 `engines/`、`contact.html` 子链 — 须 CEO 批链接清单。

### 内容类型

| 类型 | 示例 | 配图/视频要求 | CTA |
|------|------|---------------|-----|
| **库存亮点** | 本周可询半切/发动机 3–5 款 | 现网库存真实图（经子龙/库存工具确认） | `half-cuts/` 或具体 `half-cuts/detail.html?slug=…` |
| **半切实拍** | Front cut / nose cut 多角度 | 禁止盗图；标注型号（如 Corolla / Hilux） | Bio 链 + 评论置顶 WhatsApp |
| **装柜/发货** | 集装箱装半切、封柜 | 15–60 秒 Reels 或轮播图 | 「CIF to your port — DM or WhatsApp」 |
| **发动机代码** | `1KD-FTV` / `QR25DE` / `G4KD` 特写 | 铭牌/缸体清晰可读 | 链对应 `engines/{code}.html` |
| **加纳办公室** | 本地接待、验货、港口协调（如有素材） | 真实办公/团队场景 | 强化西非买家信任 |

** caption 结构（英文为主，法文区可加 1 句法语）：**

1. 1 句平台定位（验证供应商网络，非单 yard 囤货）
2. 型号/engine code + 定制拆解口径
3. `#autoparts #halfcut …`（见下）
4. CTA：Link in bio · WhatsApp

### Hashtag 与找买家

**发帖用（每帖 8–15 个，混用大小流量）：**

| 类别 | 标签示例 |
|------|----------|
| 通用汽配 | `#autoparts` `#usedautoparts` `#autopartsexport` `#spareparts` |
| 半切/拆车 | `#halfcut` `#frontcut` `#nosecut` `#cardismantling` `#JDMparts` |
| 西非/Tokunbo | `#tokunbo` `#GhanaAuto` `#NigeriaAuto` `#Accra` `#Tema` `#LagosAuto` |
| 发动机 | `#usedengine` `#ToyotaEngine` `#NissanEngine` `#engineexport` |
| 中国出口 | `#ChinaExport` `#autoexport` `#CIF` |

**搜索找买家（子敬每周扫描，不自动 DM）：**

- 搜 `#tokunbo`、`#GhanaAuto`、`#halfcut`、`#usedengine` → 记录 **进口商/汽配店** 账号 → 入 CRM
- 搜 `#TemaPort`、`#LagosImport` → 港口/货代相关账号
- 看谁 **点赞/评论** 竞品半切帖 → 潜在客户名单

### DM 私信规则

| 规则 | 说明 |
|------|------|
| **仅草稿** | 子敬写 DM 文案 + 目标客户 @ → 进周三 CEO 审批包 |
| **CEO 批准后才发** | 未收到「批准」不得点 Send |
| **禁止 spam** | 不批量群发、不连发 3 天、不对同一账号 7 天内重复 DM |
| **频率** | **最多 2 条新 DM 草稿/周**（批准后再发） |
| **语气** | 简短、帮助型；附 `half-cuts/` + WhatsApp，不承诺未核实价格 |

**DM 草稿示例（须改 @、经 CEO 批）：**

```
Hi — saw your posts on tokunbo / auto parts. We help West Africa importers 
source verified half-cuts & engines from China (custom dismantling, parts on demand).
Catalog: https://asia-power.com/half-cuts/
Happy to quote EXW or CIF — WhatsApp +233 54 091 1111
```

### 发帖频率上限（批准后再发）

| 动作 | 上限 |
|------|------|
| Feed 帖（图文/Reels） | **2 条/周** |
| Story | **3 条/周**（可与 Feed 复用素材） |
| 评论回复（别人帖下） | **3 条/天**（须草稿审批） |
| DM 新联系人 | **2 条/周** |
| 关注/取关批量操作 | **禁止** |

### 子敬每周 Instagram 动作

| 动作 | 频率 |
|------|------|
| 扫描 `#tokunbo` `#GhanaAuto` 等 → 潜客入库 | 每周一 |
| 整理 2 条帖 + 0–2 条 DM 草稿 | 每周二 |
| 提交 CEO 审批包 | 每周三前 |
| 批准后发布 + 截图归档 | 每周四–五 |

---

## 3E、X（Twitter · P2 · 搜索 + B2B 触达）

> **为什么 P2：** X 适合 **engine code / 型号** 搜索触达、转推行业帖、与进口商公开互动；视觉不如 Ins，但长尾搜索价值高。  
> **红线：** 发帖、回复、Quote、**DM** — 全部草稿 → CEO 批准 → 才发布/发送。

### 账号策略

| 账号类型 | 建议 | 说明 |
|----------|------|------|
| **AsiaPower 品牌号**（主） | ✅ 推荐 | `@AsiaPowerExport` 或类似；Bio 同 Ins 口径（平台 + 加纳办公室 + 郑州） |
| **CEO 个人号**（辅） | 可选 | CEO 本人转发/背书；子敬只出草稿 |
| **加纳办公室角度** | ✅ 推荐 | Pin 一条「West Africa importers — half-cuts & engines」帖，链 `half-cuts/` |

**Bio 模板（草稿 · 须 CEO 批）：**

```
AsiaPower | Verified half-cuts & engines · China export
Custom dismantling · parts on demand
🇬🇭 Ghana · 🇨🇳 Zhengzhou | WhatsApp +233 54 091 1111
🔗 asia-power.com/half-cuts/
```

**Profile 链接：** 固定 `https://asia-power.com/half-cuts/`

### 内容类型

| 类型 | 示例 | 格式 |
|------|------|------|
| **库存亮点** | 「This week: Hilux 2KD, Corolla 1NZ half-cuts available」 | 1 图 + 短文案 + 链 |
| **半切/装柜图** | 装柜现场 1–4 张图 | 图文帖 |
| **发动机代码** | `1KD-FTV export · QR25DE · G4KD — browse engines/` | 纯文字或配图 |
| **行业互动** | Quote 进口商/港口新闻 + 1 句 AsiaPower 能做什么 | Quote 帖（须审批） |
| **链接帖** | 半切目录更新、新型号上架 | 链 `half-cuts/` 或 `engines/` |

### Hashtag 与搜索找买家

**发帖标签（每帖 2–4 个，避免堆砌）：**

`#autoparts` `#halfcut` `#tokunbo` `#GhanaAuto` `#usedengine` `#autoexport` `#Toyota` `#NigeriaAuto`

**搜索（X 高级搜索 / 关键词提醒 · 子敬每周）：**

| 搜索词 | 用途 |
|--------|------|
| `half cut export` / `half cut China` | 找询价帖 → 回复草稿 |
| `tokunbo parts` / `Ghana auto parts` | 西非买家 |
| `1KD-FTV` / `QR25DE` / `{engine code}` | 型号精准触达 |
| `CIF Tema` / `Lagos import engine` | 港口/CIF 意图 |
| `auto parts importer Ghana` | B2B 进口商 |

潜客 @ 入库 CRM；**不自动回复**，出草稿进审批包。

### DM 与公开回复规则

| 规则 | 说明 |
|------|------|
| **DM** | 同 Ins：**草稿 → CEO 批 → 才发**；**2 条新 DM/周**上限 |
| **公开 @回复** | 帮助型短回复 + 官网链；**3 条/天**上限（须草稿） |
| **禁止** | 批量关注私信、机器人式连发、未批准 Quote 硬广 |
| **语气** | 专业 B2B；不 `@` 轰炸陌生人 |

**公开回复草稿示例：**

```
We help importers source verified half-cuts & engines from CN suppliers 
(custom dismantling). Catalog: https://asia-power.com/half-cuts/ 
WhatsApp +233 54 091 1111 for EXW/CIF quote.
```

### 发帖频率上限（批准后再发）

| 动作 | 上限 |
|------|------|
| 原创帖 | **3 条/周** |
| 回复 / Quote | **3 条/天**（合计） |
| DM 新联系人 | **2 条/周** |
| 关注批量操作 | **禁止** |

### 子敬每周 X 动作

| 动作 | 频率 |
|------|------|
| 关键词搜索 + 潜客 @ 入库 | 每周一 |
| 3 帖 + 0–2 回复/DM 草稿 | 每周二 |
| 提交 CEO 审批包 | 每周三前 |
| 批准后发布 + 链接存档 | 每周四–五 |

---

## 四、Google 地图 · 客户发现（主）+ 自有 GBP（辅）

> **核心用途：用地图找买家，不是只维护 AsiaPower 自己的商家页。**  
> 子敬在 Google 地图里搜索目标市场的 **汽配店、汽修厂、拆车场、进口商**，筛选后入库，再起草 WhatsApp/邮件联系 — **全部须 CEO 批准后才发**。

### 4.1 目标客群（地图上找这些）

| 类型 | 中文 | 地图常见名称 / 标签 | 为什么优先 |
|------|------|---------------------|------------|
| 汽配店 | 配件零售/批发 | Auto parts store, Spare parts shop, Motor spare parts | 直接买发动机/半切 |
| 汽修厂 | 维修车间 | Motor mechanic, Auto repair, Car workshop, Garage | 常帮客户找件、有稳定需求 |
| 拆车场 | 二手车/拆解 | Car dismantling, Auto salvage, Scrap yard, Tokunbo dealer | 半切、总成、批量进口 |
| 进口商/港口周边 | B2B 批发 | Auto parts importer, Vehicle parts wholesaler, Clearing agent | 大单、可长期合作 |

**市场优先级：** 西非先行 → **加纳（Accra、Tema、Kumasi）**、**尼日利亚（Lagos、Apapa、Ikeja）** → 科特迪瓦（Abidjan）→ 肯尼亚（Mombasa、Nairobi）等。

### 4.2 怎么搜（关键词 · 英文 + 当地用语）

在 Google 地图搜索框组合 **「业务词 + 城市名」**：

| 搜索词（英文/当地） | 示例组合 |
|---------------------|----------|
| `auto parts` / `spare parts` | `auto parts Accra`, `spare parts Tema` |
| `motor mechanic` / `auto repair` | `motor mechanic Lagos`, `car workshop Ikeja` |
| `car dismantling` / `auto salvage` | `car dismantling Tema`, `scrap yard Lagos` |
| `Tokunbo`（西非常用二手进口车/件） | `Tokunbo parts Lagos`, `Tokunbo dealer Accra` |
| `half cut` / `used engine` | `used engine importer Ghana` |
| 法语区 | `pièces auto Abidjan`, `moteur occasion` |

**技巧：**

1. 以 **港口/汽配聚集区** 为中心缩小范围（如 Tema Port 周边、Lagos Apapa）
2. 看 **评分、评论数、是否有电话/WhatsApp、是否写「importer/wholesale」**
3. 同一商圈换关键词再搜一轮，避免漏店
4. 记录 **店名、地址、电话、地图链接、备注**（主营丰田/日产/卡车等）

### 4.3 标准工作流（子敬每周执行）

```
地图搜索 → 初筛（有电话/WhatsApp、像目标客群）→ 存入 CRM/外联名单
→ 起草 WhatsApp 或邮件（附 half-cuts/ 链接）→ 提交 CEO 审批 → 批准后再联系
```

| 步骤 | 动作 | 产出 |
|------|------|------|
| 1. 搜索 | 本周聚焦 **1 个优先城市**（如 Accra 或 Lagos） | 候选店 ≥ 30 家 |
| 2. 初筛 | 去掉明显无关（纯洗车、4S 新车、无联系方式） | 合格 **20 家/周** 入库 |
| 3. 入库 | CRM 或外联表：店名、城市、电话、地图 URL、类型、备注 | 名单可导出 |
| 4. 起草 | 从本周入库里挑 **2–3 家** 优先联系，写 WhatsApp/邮件草稿 | 草稿进 CEO 审批包 |
| 5. 联系 | **CEO 批准后** 才发 WhatsApp/邮件；加纳本地可安排实地拜访（CEO 定） | 记录回复/询价 |
| 6. 跟进 | 有回复的进 pipeline；无回复 7 天后可换话术再草稿（仍须审批） | 周报统计 |

**WhatsApp 草稿示例（须改店名、经 CEO 批）：**

```
Hi [Shop name] — AsiaPower helps West Africa importers source verified 
half-cuts & engines from China. Browse: https://asia-power.com/half-cuts/
Quote EXW or CIF to your port — reply here or WhatsApp +233 54 091 1111
```

### 4.4 每周配额

| 指标 | 目标 |
|------|------|
| 地图新入库店铺 | **20 家/周**（单城市深耕，不撒网） |
| 外联草稿 | **2–3 条/周**（WhatsApp 或邮件，合并进周三审批包） |
| 优先城市轮换 | 第 1–2 周 Accra/Tema → 第 3–4 周 Lagos → 再 Abidjan 等 |

### 4.5 自有 Google 商家页（GBP · 次要）

AsiaPower **郑州 + 阿克拉** 双办公室可在 Google 地图认领商家页（GBP），用于本地信任展示；**但这不是子敬地图工作的重点** — 找客户 > 维护自家页。

| 项 | 说明 |
|----|------|
| **NAP 一致** | 名称/地址/电话须与官网 `contact.html`、WhatsApp 一致（CEO/技术维护） |
| **子敬职责** | 每季度核对一次 NAP；若收到 GBP 私信/问答 → 出回复草稿 → CEO 批 |
| **频率上限** | GBP 帖子 **1 条/2 周**（仍须审批）；**不得** 用 GBP 替代「找买家店铺」 |

认领与资料完善由 **CEO 或授权同事** 操作；子敬主战场是 **§4.2–4.4 客户发现**。

---

## 五、海关数据 · 找进口商

> **核心用途：用公开/合法授权的海关与贸易数据，找到真实进口汽配/半切/发动机的 B2B 公司，再起草开发邮件 — 工作流与 Google 地图找客户相同：找 → 筛选 → 入库 → 草稿 → CEO 批准 → 才发。**  
> 子敬 **不得** 自行购买付费订阅；如需开通付费平台，须 **CEO 书面批准** 后再注册/充值。

### 5.1 什么数据有用

| 数据类型 | 说明 | AsiaPower 怎么用 |
|----------|------|------------------|
| **HS 编码** | 海关商品分类号（意思是：进出口货物在海关登记用的「品类编号」） | 锁定汽配、发动机、半切、二手车等品类进口商 |
| **进口记录** | 某国某时段的进口商名称、品类、大致数量/频次 | 判断是否为活跃 B2B 买家 |
| **目的国/起运国** | 西非、东非、南亚等重点市场 | 优先 Ghana、Nigeria、Kenya、Côte d'Ivoire 等 |
| **进口商品描述** | 如 engine, half cut, auto parts, used vehicle | 与 AsiaPower 产品线对齐后再联系 |

**常用 HS 编码参考（子敬搜索时可组合使用，以平台实际字段为准）：**

| 品类 | HS 编码示例 | 备注 |
|------|-------------|------|
| 汽车零配件 | 8708、870829、870899 | 半切拆解件、车身件 |
| 发动机 | 8407、8408、8409 | 汽油/柴油发动机总成 |
| 完整/半切车辆 | 8703、8704 | 二手车、半切整车进口 |
| 变速箱等总成 | 870840 | 可与发动机分开搜 |

> 编码因国别口径略有差异；子敬以所选平台提供的分类为准，**不对外声称「我们看过您某票具体报关单」**。

### 5.2 可用平台与工具（类型说明 · 不强制付费注册）

| 类型 | 代表平台/来源 | 能查什么 | 子敬怎么用 |
|------|---------------|----------|------------|
| **全球贸易数据库** | Panjiva、ImportGenius、Volza、Export Genius | 按 HS + 目的国查进口商公司名、品类趋势 | 免费试用/样例足够筛名单；**付费订阅须 CEO 批** |
| **各国海关统计** | 加纳 GRA、尼日利亚海关、肯尼亚 KRA 公开统计等 | 宏观品类进口量、主要来源国 | 定优先市场与品类 |
| **中国海关数据** | 海关总署进出口统计、部分第三方汇总 | 中国出口至某国的品类与趋势 | 交叉验证哪些品类在出 |
| **联合国/世贸工具** | TradeMap（ITC）、UN Comtrade | 国别 × 品类贸易流向 | 定本周聚焦国家与 HS 范围 |
| **商业情报补充** | 平台导出公司名 → Google / LinkedIn 交叉验证 | 联系人、官网、WhatsApp | 避免错号、空壳公司 |

**原则：**

1. 只使用 **合法公开数据** 或 **CEO 批准后的 licensed 订阅**
2. **不编造**「我们看到您某票货」等具体 shipment 细节
3. 付费平台（Panjiva / ImportGenius / Volza 等）→ **先向 CEO 申请**，批准后再开通

### 5.3 标准工作流（与地图找客户并列）

```
HS 编码 + 目的国搜索 → 初筛进口商（品类匹配、近 12 个月有进口）
→ Google/LinkedIn 交叉验证 → 存入 CRM/外联名单
→ 起草个性化开发邮件（引用品类/市场，附 half-cuts/ 链接）→ CEO 审批 → 批准后再发
```

| 步骤 | 动作 | 产出 |
|------|------|------|
| 1. 定范围 | 本周聚焦 **1 个目的国** + **1–2 个 HS 品类**（如 Ghana + 8708/8407） | 搜索条件记录 |
| 2. 搜索 | 在批准的数据源中导出/记录进口商公司名 | 候选 ≥ 20 家 |
| 3. 初筛 | 去掉明显无关（纯物流货代、与汽配无关、无联系方式） | 合格 **10 家/周** 入库 |
| 4. 交叉验证 | Google 搜公司 + LinkedIn 看是否汽配/拆车/进口商 | 店名、邮箱、WhatsApp、备注 |
| 5. 起草 | 从本周入库挑 **2 家** 优先联系，写开发邮件草稿 | 草稿进 CEO 审批包 |
| 6. 联系 | **CEO 批准后** 才发邮件/WhatsApp | 记录回复/询价 |
| 7. 跟进 | 有回复进 pipeline；无回复 14 天后可换话术再草稿（仍须审批） | 周报统计 |

**开发邮件草稿示例（须改公司名、经 CEO 批）：**

```
Subject: Verified half-cuts & engines for [Country] importers — AsiaPower

Hi [Company name],

AsiaPower connects importers with verified suppliers for half-cuts, engines, 
and auto parts from China — custom dismantling, parts on demand.

We noticed active import activity in auto parts / engines in your market and 
would like to explore whether we can support your sourcing needs.

Browse our catalog: https://asia-power.com/half-cuts/
Engines: https://asia-power.com/engines/

Quote EXW Zhengzhou or CIF to your port — reply here or WhatsApp +233 54 091 1111.

Best regards,
AsiaPower Sales
sales@asia-power.com
```

> 正文只写 **品类/市场级别** 的引用（如「贵国汽配/发动机进口活跃」），**禁止** 捏造具体提单号、日期、数量。

### 5.4 每周配额

| 指标 | 目标 |
|------|------|
| 海关数据新入库进口商 | **10 家/周**（单目的国深耕） |
| 开发邮件/WhatsApp 草稿 | **2 条/周**（合并进周三审批包） |
| 目的国轮换 | 与地图渠道错开：如地图做 Accra 店铺，海关可并行筛 Ghana 全国进口商 |

### 5.5 红线

| 规则 | 说明 |
|------|------|
| **禁止 spam** | 不批量群发、不连发 3 天以上、不购买邮件列表 |
| **禁止造假** | 不说「我们看到您某票具体货」；只用品类/市场级表述 |
| **合法数据** | 仅用公开统计或 CEO 批准的 licensed 数据；不爬取未授权私密库 |
| **CEO 审批** | 开发邮件/WhatsApp **须 CEO 批准后才发** |
| **平台定位** | AsiaPower 是验证供应商网络撮合平台，**不默认自有库存** |
| **付费订阅** | Panjiva / ImportGenius / Volza 等 **须 CEO 书面批准** 后再付费 |

---

## 六、子敬每周 checklist

| # | 任务 | 频率 | 产出 |
|---|------|------|------|
| 1 | Facebook 西非小组：扫描询价 + 草稿 | 每周 | 3–5 份草稿 |
| 2 | **Instagram**：2 帖 + 0–2 DM 草稿；扫描 `#tokunbo` 潜客 | 每周 | 帖文 + Bio 链 `half-cuts/` |
| 3 | **X（Twitter）**：3 帖 + 0–2 回复/DM 草稿；关键词搜买家 | 每周 | 帖文 + 潜客 @ 入库 |
| 4 | 论坛：回复待办 + 新主题帖草稿 | 每 2 周 1 帖/论坛 | 草稿 + 链接存档 |
| 5 | SEO：记录买家搜索词 / 竞品标题 | 每周 | TOP10 词表 |
| 6 | **Google 地图找客户**：搜索 → 入库 20 家 + 2–3 条 WhatsApp/邮件草稿 | 每周 | 名单 + 草稿 → CEO 批准 |
| 7 | **海关数据找进口商**：HS + 目的国 → 入库 10 家 + 2 条开发邮件草稿 | 每周 | 名单 + 草稿 → CEO 批准 |
| 8 | 邮件/WhatsApp 线索回链 CRM | 每日 | pipeline 更新 |
| 8b | **社媒回复扫描**（§十 · 每小时） | **每小时** | 有回复 → 跟进草稿 → CEO 批 |
| 9 | **提交 CEO 审批包**（合并上述草稿） | **每周三 18:00 前** | Telegram/内部摘要 |
| 10 | 批准后执行发布 + **登记 social_posts_registry** | 发布后立即 | 帖文 URL 入库 |
| 11 | 流量/邮件询盘周报（KPI：进站 + sales@ 邮件） | 每周五 | 1 页表格 |

### 发帖频率上限（批准后再发）

| 渠道 | 上限 |
|------|------|
| Facebook 单小组 | 1 主帖/周 + 2 评论/天 |
| **Instagram** Feed/Reels | 2 帖/周 |
| **Instagram** Story | 3 条/周 |
| **Instagram** 评论回复 | 3 条/天 |
| **Instagram** DM 新联系人 | 2 条/周（须审批） |
| **X（Twitter）** 原创帖 | 3 帖/周 |
| **X** 回复 / Quote | 3 条/天（须审批） |
| **X** DM 新联系人 | 2 条/周（须审批） |
| 专业论坛 | 1 主题帖/2 周/论坛 |
| Google 地图新入库店铺 | 20 家/周（单优先城市） |
| 地图外联 WhatsApp/邮件 | 2–3 条/周（须审批） |
| 海关数据新入库进口商 | 10 家/周（单目的国） |
| 海关数据开发邮件/WhatsApp | 2 条/周（须审批） |
| GBP 帖子（自有页 · 次要） | 1 条/2 周 |
| Reddit 评论 | 3 条/周（技术向） |
| Google Ads | 按 CEO 批预算，不自行加投 |

---

## 七、CEO 审批包格式（子敬提交）

```
【分销推广 · 本周审批包 · YYYY-MM-DD】
1. Facebook 草稿 × N（附小组名、截图）
2. Instagram 帖/Story/Reels 草稿 × N + DM 草稿 × N（附目标 @、配图说明）
3. X（Twitter）帖/回复/Quote 草稿 × N + DM 草稿 × N（附目标 @、链接）
4. 论坛草稿 × N（附论坛版规摘要）
5. 地图找客户：本周入库名单 + WhatsApp/邮件草稿 × N
6. 海关数据找进口商：本周入库名单（公司名、目的国、HS 品类）+ 开发邮件草稿 × N
7. （如有）GBP 问答/帖子回复 × N
8. （如有）Google Ads 文案 × N
9. （如有）Ins/X Bio 或 Link in bio 变更
10. （如有）付费海关平台开通申请（平台名、月费、试用结论）
11. 风险自评：有无库存断言 / 价格承诺 / 版规冲突 / 是否未经批准外联 / 是否捏造 shipment 细节 / Ins·X DM 是否 spam
→ 请 CEO 回复：批准 / 修改 / 暂缓
```

**未收到 CEO 明确「批准」前，一律不得点击 Publish / Post / Send。**

---

## 七点五、社媒自动化（2026-07-04 · 子敬登录一次 → 全自动）

> **CEO 决策**：子敬可操作公司 FB/IG/X；登录 **一次** 后，系统 **自动发帖 + 扫回复**，看板显示真实 URL。  
> **详细 Runbook**：`data/knowledge-base/apsales-social-automation-runbook.md`

| 渠道 | 一次性（子敬/CEO） | 之后谁干活 |
|------|-------------------|------------|
| **Facebook Page** | Meta Business + Page；API token 或 `apsales-social-login.py --platform facebook` | Autopilot cron 每 15 分钟 |
| **Instagram** | 绑 FB Page；**必须** Graph API（`META_IG_USER_ID`） | Autopilot API 发帖 |
| **X** | 注册 + API token 或 `apsales-social-login.py --platform x` | Autopilot cron |
| **回复/DM** | 无 | 每小时扫描 → 草稿 → **CEO 批准** 后发送 |

**子敬不再 copy-paste 发帖。** 新文案仍须 CEO 批；已批方案 A–E 进队列后自动发。

**登录后执行（生产）：**

```bash
cd /root/.openclaw/workspace/AsiaPower
.venv/bin/python3 scripts/apsales-social-autopilot.py --all
```

**看板登录状态**：https://asia-power.com/admin/apsales-progress.html → 可执行渠道 · ✅已登录 / ❌需子敬登录一次

---

## 七点五（旧）· 社媒需先开户（诚实说明 · 2026-07-04）

> **子敬和 CEO 目前都没有 FB / Instagram / X 登录权限。** 看板上这类帖文标记为 **「无账号 / blocked_no_account」**，不是「待手动」。

| 渠道 | 今天能否发 | 需要谁做什么 |
|------|-----------|--------------|
| **邮件** | ✅ 可以 | 已接 Resend · `sales@asia-power.com` · 网站 Lead 跟进 |
| **WhatsApp** | ❌ 只读 | CEO 扫码 Business 或开 Cloud API |
| **Facebook / IG** | ❌ 无账号 | CEO ~30 分钟：Meta Business Manager + Page + 授权 |
| **X (Twitter)** | ❌ 无账号 | CEO 注册 + 2FA，或付费 API |
| **官网 SEO** | ✅ 在线 | 持续更新库存；客户可自助浏览 |
| **Telegram 群** | ⚠️ 需真人号 | 可加非洲汽配群，但不能假装已自动化 |

**今天可执行的替代方案（CEO 已批「发吧」）：**

1. **邮件 outreach** — 给网站留资未回复的真实邮箱发跟进（脚本 `scripts/apsales-email-outreach-batch.py`）
2. **Partner 模式** — 邮件找 Ghana/Nigeria 本地汽配商代发帖（佣金模板，待 CEO 定稿）
3. **Meta Lead Ads** — 需 CEO 绑卡开广告户（付费获客，非免费帖）

**禁止：** 再看板显示「待子敬手动发 FB」——除非 CEO 确认有人能登录该账号。

---

## 八、相关文档

| 文档 | 用途 |
|------|------|
| `data/knowledge-base/apsales-promotion-schemes-v2.md` | **推广方案 A–E 全文（多语言 · 正确链接）** |
| `data/knowledge-base/apsales-email-outreach-runbook.md` | 邮件转发 + 主动找客户 |
| `constitution/roles/apsales.md` | 子敬职责与审批级别 |
| `profiles/apsales.yaml` | Agent 配置与 KPI |
| `scripts/apsales-social-login.py` | 一次性社媒登录（保存 Session） |
| `scripts/apsales-social-autopilot.py` | 自动发帖 + 扫回复（cron 每 15 分钟） |
| `data/knowledge-base/apsales-social-automation-runbook.md` | **社媒全自动 Runbook** |
| `scripts/apsales-social-reply-watch.py` | 每小时社媒回复扫描提醒（cron） |

---

## 九、非洲市场 · 按语言分区（推广必用）

> **不再笼统写「西非」** — 子敬按 **语言 × 国家 × 渠道** 执行；文案用对应语言版（见 `apsales-promotion-schemes-v2.md`）。

### 9.1 国家 → 语言 → 渠道对照表

| 语言 | 主要国家 | P0 渠道 | P1 渠道 | 推广方案优先 |
|------|----------|---------|---------|--------------|
| **英语 EN** | Ghana 🇬🇭, Nigeria 🇳🇬, Kenya 🇰🇪, Tanzania 🇹🇿, Uganda 🇺🇬, South Africa 🇿🇦, Zambia 🇿🇲, Rwanda 🇷🇼, Sierra Leone, Liberia, Gambia | Facebook 英语汽配/Tokunbo 小组 · Instagram · WhatsApp 群 | X · Nairaland（尼日利亚）· Google 地图找店 · 海关数据 | **A + B**（西非）· **A + D**（东非）· **A + E**（南非） |
| **法语 FR** | Côte d'Ivoire 🇨🇮, Senegal 🇸🇳, Cameroon 🇨🇲, DRC 🇨🇩, Mali 🇲🇱, Burkina Faso 🇧🇫, Benin 🇧🇯, Togo 🇹🇬, Gabon 🇬🇦, Niger 🇳🇪, Chad 🇹🇩, Congo 🇨🇬, Madagascar 🇲🇬 | Facebook 法语汽配群（`pièces auto`, `moteur occasion`, `Abidjan`, `Dakar`）· Instagram | X · LinkedIn B2B · 论坛 AutoAfrique 镜像 | **A（法文）+ D（法文）** · **C（法文）** 重卡 |
| **阿拉伯语 AR** | Morocco 🇲🇦, Algeria 🇩🇿, Tunisia 🇹🇳, Egypt 🇪🇬, Libya 🇱🇾, Sudan 🇸🇩, Mauritania 🇲🇷 | Facebook 阿语汽配/进口群 · WhatsApp | LinkedIn · 港口/物流群 | **A（阿文）+ E**（低优先 · 半切需求较英语/法语区弱） |
| **葡萄牙语 PT** | Angola 🇦🇴, Mozambique 🇲🇿, Guinea-Bissau 🇬🇼, Cape Verde 🇨🇻 | Facebook 葡语汽配群 · Instagram | WhatsApp · LinkedIn | **A（葡文）+ B** · **E（葡文）** |

### 9.2 各语言 FB 搜索关键词

| 语言 | 小组/帖文搜索词 |
|------|-----------------|
| EN | `Ghana auto parts`, `Nigeria tokunbo`, `Kenya spare parts`, `Tema port import`, `Mombasa import`, `Lagos clearing agent` |
| FR | `pièces auto Abidjan`, `moteur occasion Dakar`, `import véhicule Afrique`, `demi-coupe Chine`, `CIF Abidjan` |
| AR | `قطع غيار`, `استيراد سيارات`, `محرك`, `المغرب`, `مصر` |
| PT | `peças auto Angola`, `importação carros Moçambique`, `motor usado`, `Luanda` |

### 9.3 上线波次（CEO 批准后）

| 波次 | 语言 | 国家 | 方案 | 说明 |
|------|------|------|------|------|
| **第 1 波** | EN | Ghana, Nigeria | A + B | 加纳办公室主场 · Tokunbo 小组 |
| **第 1 波** | EN | Kenya, Tanzania, Uganda | A + D | HR16DE / 丰田日产修理厂 |
| **第 2 波** | FR | Côte d'Ivoire, Senegal, Cameroon | A + D（法文） | 阿比让/达喀尔法语群 |
| **第 2 波** | EN | South Africa, Zambia | A + E | X 搜 engine code |
| **第 3 波** | FR | DRC, Mali, Burkina | A + C（法文） | 重卡/物流 |
| **第 3 波** | PT | Angola, Mozambique | A + B（葡文标题） | 罗安达/马普托 |

---

## 十、发帖后 · 每小时回复扫描 SOP

> **目标**：客户在任何渠道回复 → 子敬 **1 小时内** 发现 → 起草跟进（引导 **进站 + 邮件 sales@asia-power.com**）→ **CEO 批准** 后才回复。  
> **不在社媒里报价成交。**

### 10.1 子敬每小时做什么（**自动化 · 2026-07-04**）

| 步骤 | 动作 | 产出 |
|------|------|------|
| 1 | cron 跑 `apsales-social-autopilot.py --all` | 自动发帖 + 扫评论 |
| 2 | cron 跑 `apsales-social-reply-watch.py` | 跟进草稿进 draft_queue |
| 3 | Telegram 通知 CEO | 「社媒回复待批准」 |
| 4 | CEO 回复「批准」 | 子敬或未来 auto-send 发送 |
| 5 | 看板更新真实 `post_url` | apsales-progress.html |

**子敬不再需要每小时手动打开 FB/IG/X** — 除非会话过期需重新 `--platform` 登录。

### 10.1（旧）· 子敬每小时做什么（人工 + 脚本提醒）

| 步骤 | 动作 | 产出 |
|------|------|------|
| 1 | 收到 Telegram「⏰ 社媒回复扫描」提醒（或整点自查） | — |
| 2 | 打开 `memory/customer_gateway/social_posts_registry.json` 里 **status=live** 的帖文链接 | — |
| 3 | 逐条检查 **评论、回复、DM**（FB / IG / X） | 有/无新回复 |
| 4 | 若有客户问价/感兴趣 → 写入 `social_reply_inbox.json`（`status: pending_draft`） | 待跟进记录 |
| 5 | 运行 `scripts/apsales-social-reply-watch.py`（或等 cron 自动跑）→ 自动生成 **跟进草稿** 进 draft_queue | draft_id |
| 6 | Telegram 通知 CEO：**「社媒回复待批准」** | CEO 批/改 |
| 7 | CEO 回复「批准」后，子敬 **手动** 在对应平台发送（不自动发） | 已回复 |
| 8 | 更新 registry：`last_scan_at`、inbox：`status=replied` | 归档 |

### 10.2 跟进回复模板（须改人名 · CEO 批）

**英语（默认）：**

```
Hi — thanks for your comment.

Browse verified listings with photos here: https://asia-power.com/half-cuts/
For a quote, email sales@asia-power.com — we'll reply with options and photos.
WhatsApp +233 54 091 1111 if easier.

We don't close deals in DMs — visit the site first.
```

**法语：**

```
Bonjour — merci pour votre message.
Catalogue : https://asia-power.com/half-cuts/?lang=fr
Devis : sales@asia-power.com · WhatsApp +233 54 091 1111
```

**葡萄牙语：**

```
Olá — obrigado pela mensagem.
Catálogo: https://asia-power.com/half-cuts/
Orçamento: sales@asia-power.com · WhatsApp +233 54 091 1111
```

### 10.3 登记已发布帖文（发帖后立即做）

CEO 批准发布 → 子敬在 `memory/customer_gateway/social_posts_registry.json` 追加：

```json
{
  "post_id": "fb-ghana-2026-07-03-a",
  "platform": "facebook",
  "language_market": "EN-Ghana",
  "scheme_id": "A",
  "post_url": "https://facebook.com/groups/.../posts/...",
  "listing_url": "https://asia-power.com/half-cuts/",
  "posted_at": "2026-07-03 12:00 UTC",
  "last_scan_at": "2026-07-03 12:00 UTC",
  "status": "live"
}
```

### 10.4 Cron 配置（生产 · 每小时）

```bash
# /etc/cron.d/apsales-social-reply-watch（示例 · CEO/运维确认后启用）
0 * * * * root cd /root/.openclaw/workspace/AsiaPower && APSALES_SOCIAL_REPLY_WATCH=1 .venv/bin/python3 scripts/apsales-social-reply-watch.py >> /var/log/apsales-social-reply-watch.log 2>&1
```

| 环境变量 | 默认 | 说明 |
|----------|------|------|
| `APSALES_SOCIAL_REPLY_WATCH` | `1` | `0` 关闭 |
| `APSALES_SOCIAL_SCAN_HOURS` | `1` | 扫描间隔（小时） |
| `APSALES_SOCIAL_MAX_DRAFTS` | `5` | 每轮最多自动起草跟进数 |
| `APSALES_SOCIAL_ALWAYS_NOTIFY` | `0` | `1` = 无待办也每小时 ping |

### 10.5 红线

| 规则 | 说明 |
|------|------|
| **不自动回复** | 脚本只 **提醒 + 起草**；发送须 CEO 批准 + 子敬手动点 Send |
| **不社媒报价** | 跟进只引导 **进站 + 邮件**；价格/库存确认走邮件 |
| **1 小时 SLA** | 活跃帖文 `last_scan_at` 超过 1h → 下轮 cron 必提醒 |

---

*最后更新：2026-07-03 · 维护人：子敬（APSales）*
