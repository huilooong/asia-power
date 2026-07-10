# GROWTH-001 — Cursor 一线执行方案

Generated: 2026-07-05 08:33 GMT (Africa/Accra)  
Commander: Kongming / OpenClaw brain  
Author: Cursor（仅策略与一线方案 — **不发送、不写代码、不 deploy**）

---

## 结论先行

| 项目 | 状态 |
|------|------|
| 可立即用的线索 | **46 家**真实公司，审计 **PASS**，全部 `pending` 待 CEO 批 |
| 最快获客路径 | CEO 分批人工 WhatsApp（43 家有电话）→ 带 UTM 链到品类页 → contact 转化 |
| 发送前必改 | **B 组 5 家拆车场**草稿错误指向 `/engines/`，应改 `/half-cuts/` |
| 本周现实目标 | 发送 30–40 家 · 回复 ≥3 · UTM 访问 ≥10 · 询盘 ≥1 |
| 禁止事项 | 自动发送 · 假库存 · 编规格 · 未审 deploy |

---

## 1. 任务目标

**不是**做更多文档或大范围改站。  
**是**让全球二手汽配 / 拆车场 / 进口商 / 批发商 / 维修厂买家看到并访问 `asia-power.com`，产生合格询盘，并建立 agent 可重复的一线工作流。

优先级市场：非洲（Ghana、Nigeria、Kenya、Tanzania）→ UAE 贸易枢纽 → 其他有日韩中二手件需求的市场。

---

## 2. 现有资产（已验证，可直接用）

| 资产 | 路径 / 状态 | 用途 |
|------|-------------|------|
| 46 家 outreach 草稿 | `runtime/apbd/2026-07-05/outreach_queue/` | CEO 审批后人工触达 |
| 审计 PASS | `docs/agents/apbd/audit-001-reality-verification.md` | 确认非 mock |
| Sprint 记录 | `docs/agents/apbd/sprint-001-real-customer-discovery.md` | 来源、国家分布 |
| APBD Runner | `runtime/apbd/state.json` → `waiting_approval` | 已停，等 CEO 批准续跑 |
| 网站入口 | `/engines/`、`/half-cuts/`、`/gearboxes/`、`/trucks/`、`/brands.html`、`/contact.html` | 落地 + GA4 `G-PB2J3VRX5J` |
| SEO 90 天 | `docs/product/seo/apseo-011-roadmap.md` | 引擎页 + 国家页 brief |
| 增长 playbook | `docs/agents/apcgo/growth-playbook.md` | 关键词 → 内容 → 询盘 |
| Agent 状态 | `docs/cto/project-status-summary.md` | APBD/APCGO/APSEO 均为 partial |

### 触达渠道覆盖（46 家，字段 `public_*`）

| 渠道 | 数量 | 说明 |
|------|-----:|------|
| 有公开电话 | **43** | 可用于 WhatsApp |
| 有公开网站 | **22** | 可写 1 句定制开场 |
| 有公开邮箱 | **8** | 可邮件备选 |
| **无电话（本周跳过 WhatsApp）** | **3** | 见 §3.3 |

**数据来源：** 100% Google Maps（`summary.json`）。OSM / Yellow Pages / Europages 已连接但本 sprint **0 新增**；Europages 有 29 条 API 参数错误待修。

---

## 3. 46 家线索分组（Outreach Groups）

按 `business_type` + 产品意图分组，便于分批批准、发送、统计。

| 组别 | 代码 | 数量 | 典型买家 | 推荐落地页 | APBD 现草稿 | 本周优先 |
|------|------|-----:|----------|------------|-------------|:--------:|
| 发动机进口商 | **A** | **8** | Engine importer | `/engines/` | `/engines/` ✅ | ★★★ |
| 拆车场 / Half-cut | **B** | **5** | Auto dismantler | **`/half-cuts/`** | `/engines/` ❌ | ★★★ |
| 车队 / 商用车工房 | **C** | **17** | Fleet / CV workshop | `/trucks/` | `/trucks/` ✅ | ★★★ |
| 二手配件批发商 | **D** | **7** | Used parts wholesaler | `/contact.html` 或 `/brands.html` | `/contact.html` ✅ | ★★ |
| 一般进口商 / 经销商 | **E** | **9** | Importer / dealer / repair | `/contact.html` | `/contact.html` ✅ | ★★ |

**落地页分布（现草稿）：** `/engines/` 13 · `/trucks/` 17 · `/contact.html` 16  
（13 = 8 家 A + 5 家 B 错误指向 engines）

### 3.1 按国家 × 数量（发送批次）

| 国家 | 数量 | 城市分布 | 建议批次 |
|------|-----:|----------|----------|
| Nigeria | 12 | Lagos 7 · Abuja 5 | **第 1 批** |
| Kenya | 10 | Nairobi | 第 2 批 |
| UAE | 9 | Dubai | 第 3 批 |
| Ghana | 8 | Accra | 第 4 批（可强调 Accra 办公室） |
| Tanzania | 7 | Dar es Salaam | 第 5 批 |

### 3.2 B 组 — 发送前必须改 landing（5 家）

| 公司 | 国家 | 现链接 | 应改为 |
|------|------|--------|--------|
| Salvage Group Ghana | Ghana | `/engines/` | `/half-cuts/` |
| Ladipo Spare Parts Market | Nigeria | `/engines/` | `/half-cuts/` |
| Bunyala Salvage Motors | Kenya | `/engines/` | `/half-cuts/` |
| Salvage CARS KENYA | Kenya | `/engines/` | `/half-cuts/` |
| Copart UAE Auctions LLC | UAE | `/engines/` | `/half-cuts/` |

> 发送时手工替换链接即可；改 APBD 模板属后续开发，**本任务不做代码**。

### 3.3 无电话 — 本周跳过 WhatsApp（3 家）

| 公司 | 国家 | 备选 |
|------|------|------|
| Ladipo Auto Market | Nigeria | 与同市场 Ladipo Spare Parts 可能重复；不强行触达 |
| The Balo of Abuja super cars | Nigeria | 仅 Maps；无 WhatsApp 草稿号码 |
| 飞鹿汽车修理 FEILU AUTO REPAIR | Tanzania | 可试邮件/网站（均无公开）→ 暂缓 |

### 3.4 组内样例（审计已验证真实）

**A — 发动机：** Benz City House of Engines (Ghana) · Grande Motor Imports (Kenya) · Engines World Trading (UAE)

**B — 拆车场：** Salvage Group Ghana · Ladipo Spare Parts Market · Salvage CARS KENYA

**C — 车队/商用车：** Fleet Tech Automotive (Ghana) · New Empire Auto Garage (Tanzania) · Fleet Management (UAE)

**D — 批发：** AUTOPARTS WHOLESALES (Ghana) · HASMA AUTO SPARES (Kenya) · UZDPART (UAE，有站 uzdpart.com)

**E — 一般：** Partste (Nigeria) · Taleon AutoSpares Kenya（有站 + 邮箱 info@taleonspareskenya.co.ke）· AUTO SPARE PART GUDU ABUJA

---

## 4. 落地页映射规则

| 买家意图 | 主落地页 | 备选深链 | 说明 |
|----------|----------|----------|------|
| Used engines | `/engines/` | `/engines/toyota-1kd-ftv.html` 等 | 有库存码时深链更好 |
| Half-cuts / 拆车 | **`/half-cuts/`** | `/front-cuts/` | B 组必用 |
| Gearbox | `/gearboxes/` | — | 队列无单独组；E/D 可补 |
| 商用车 / 车队 | `/trucks/` | `/machinery/` | trucks 有 Contact CTA ✅ |
| 泛配件 / 批发 | `/contact.html` | `/brands.html` | 最终转化口 |

**UTM 模板（所有 outreach 链接必带）：**

```text
?utm_source=apbd&utm_medium=whatsapp&utm_campaign=growth001-{country}-{group}
```

示例：`https://asia-power.com/half-cuts/?utm_source=apbd&utm_medium=whatsapp&utm_campaign=growth001-nigeria-b`

### 网站 conversion 现状（已读 HTML，未截图）

| 页面 | Hero / 目录 CTA | 直达 Contact 按钮 | WhatsApp 浮窗 |
|------|-----------------|-------------------|---------------|
| `engines/` | 品牌/catalog | ❌ 无 | ✅ `#site-whatsapp` |
| `half-cuts/` | 品牌/catalog | ❌ 无 | ✅ |
| `gearboxes/` | 品牌/catalog | ❌ 无 | ✅ |
| `trucks/` | catalog | ✅ **Contact Us** | ✅ |
| `contact.html` | — | ✅ 表单 + WhatsApp +233 | — |

**缺失 / 待补（策略 brief，非本周必 deploy）：**

1. **国家落地页** — APSEO-011 Phase 1 已规划 Ghana/Nigeria brief，尚无 `/ghana/`、`/nigeria/` 公开页  
2. **engines / half-cuts / gearboxes 底部 CTA** — 对齐 trucks 的「Get export quote → contact.html」  
3. **contact 表单字段** — 可选 `Country` + `Business type`（便于 lead quality）  
4. **B 组 half-cut 专用短链文案** — 「browse live half-cut stock IDs」

---

## 5. 八大策略区 — 一线执行映射

### 5.1 直接公开线索发现 + 审批触达（APBD）

| 项 | 内容 |
|----|------|
| **本周可做** | 审 `outreach-queue.csv` → 分批批准 → 人工 WhatsApp/邮件（≤10–15 家/天） |
| **可安全自动化** | `/apbd leadfinder` 发现；draft 生成；dedup；**不自动发送** |
| **需 CEO 批准** | 每条 outbound；Runner 下一 cycle；对外文案变更 |
| **已有数据** | 46 JSON + CSV；`approval_status: pending` |
| **不要做** | 批量自动发、买名单、爬私人信息 |
| **成功指标** | 发送数、回复数、UTM 点击、询盘数 |

### 5.2 SEO（APSEO）

| 项 | 内容 |
|----|------|
| **本周可做** | Search Console baseline；确认 50 引擎页 sitemap；Top 16 引擎内链到 contact 清单 |
| **可安全自动化** | `scripts/sync-seo-static-meta.mjs`、sitemap（**本地跑，deploy 需 CTO 批准**） |
| **需 CEO 批准** | 国家页上线、canonical 变更、production deploy |
| **新页面** | Ghana/Nigeria used engines / half-cut landing brief（Phase 1，4–6 页） |
| **不要做** | 编造规格、假库存、重复 canonical |
| **成功指标** | 索引页数、有机点击、引擎页 → contact 转化 |

### 5.3 目录 / 市场平台（APBD + APCGO）

| 渠道类型 | 具体渠道 | 动作 | 负责人 |
|----------|----------|------|--------|
| B2B 目录 | Europages、Kompass、TradeKey | 手动建 AsiaPower supplier profile → contact | CEO/APBD |
| 非洲行业目录 | 各国汽配协会、Yellow Pages | APBD 多源验证（修 Europages bug 后） | APBD |
| 社交 | Facebook 非洲汽配群（只读摸底）、LinkedIn 公司页 | 每周 1 条库存摘要（CEO 批） | APCGO |
| Google Business | Accra 办公室 GBP | 确保网站链正确 | CEO |

**本周测试：** 2 个目录平台各建 1 个 profile（不群发）。

### 5.4 社交 / 内容（不 spam）

| 项 | 内容 |
|----|------|
| **本周可做** | 真实 half-cut 库存 3 图 + 1 段「how to verify engine before import」 |
| **渠道** | Facebook 群摸底、YouTube Shorts、LinkedIn |
| **需 CEO 批准** | 每条公开发帖 |
| **不要做** | 群刷、假评论、未核实库存宣传 |

### 5.5 供应商 / 伙伴（APInventory）

| 项 | 内容 |
|----|------|
| **本周可做** | outreach 只引用 QXB/HC 已上架 SKU 作「verified stock」 |
| **需 CEO 批准** | supplier portal 推广邮件 |
| **指标** | 可报价 SKU 数、供应商上传量 |

### 5.6 网站转化路径

```text
Outreach / SEO / Social / 目录
  → 品类落地页（engines | half-cuts | trucks | contact）
  → WhatsApp 或 contact 表单
  → APSales 报价（24h SLA）
```

**小改建议（需 CTO + CEO 批准 deploy）：** engines/half-cuts/gearboxes 加 contact CTA；contact 表单加 Country/Business type。

### 5.7 追踪数据

| 字段 | 采集方式 | 存储 |
|------|----------|------|
| 访问来源 | UTM | GA4 |
| 落地页 | `page_path` | GA4 |
| 发送记录 | company_id, channel, date, group | `runtime/apbd/outreach_sent.jsonl` 或表格 |
| 回复 | yes/no, date | 同上 |
| 询盘 | WhatsApp/email 线索 ID | APSales / customer_gateway |
| Lead quality | business_type, country, 1–5 分 | 人工 |

**本周 baseline：** GA4 过去 7 天 sessions by landing page；记发送前数字。

### 5.8 Agent 分工

| Agent | 一线职责 | 本周交付 |
|-------|----------|----------|
| **APBD** | 线索、草稿、outreach_queue、发送批次清单 | 批批准清单 |
| **APCGO** | 关键词、内容选题、目录/竞品 | 5 条内容 brief |
| **APSEO** | 引擎/国家 SEO、sitemap、GSC | baseline 报告 |
| **APSales** | 回复询盘、报价、记录转化 | 24h SLA |
| **APCOO** | 批准门、优先级、站会 | 每日 15min 记录 |
| **APInventory** | 落地页库存与 QXB 一致 | 库存快照给 outreach |

---

## 6. 安全 Outreach 文案角度（仅方案，不发送）

结构：**1 句 relevance + 1 个 UTM 链接 + 1 个低摩擦 CTA**

| 组别 | 角度（英文，WhatsApp） | 落地页 |
|------|------------------------|--------|
| A | We export verified used engines (1KD, G4KD, QR25…) with VIN photos — catalog: {link} | `/engines/` |
| B | Half-cuts and front cuts from China yards — browse live stock IDs: {link} | **`/half-cuts/`** |
| C | Commercial vehicle parts & truck components — FOB quotes within 24h: {link} | `/trucks/` |
| D | Wholesale used parts — weekly stock list, export docs included: {link} | `/contact.html` |
| E | Auto parts import support — engines, gearboxes, half-cuts: {link} | `/contact.html` |

**统一 CTA：** 「Reply with engine code or stock ID for today's list」

**有网站 22 家：** 加 1 句定制（如 Taleon 的 Ex-Japan 定位、FleetTechGH 的 truck 服务）。

**需 CEO 逐条批准：** 全文修改；>15 家/天；含价格承诺。

---

## 7. 每日一线工作流

```text
08:00  APCOO — 读 docs/agent-commands/ 新指令
08:15  APBD   — pending 数；Runner 状态
09:00  CEO    — 批准今日批次（≤15 家，组别+国家）
09:30  人工   — WhatsApp 发送；UTM 链接；记 outreach_sent
10:00  APSales — overnight 询盘；标记 UTM 来源
11:00  APSEO   — 1 引擎页 meta/内链检查（本地，不 deploy）
14:00  APCGO   — 1 内容 brief 或 1 目录登记
17:00  全员   — Daily KPI 一行
17:30  APBD   — CEO 批准后：/apbd leadfinder 或 /apbd run once
```

### Daily KPI

| 日期 | 发送 | 回复 | UTM 访问 | 询盘 | 报价 | 备注 |
|------|-----:|-----:|---------:|-----:|-----:|------|

---

## 8. 本周执行日历（Day 1–7）

| 天 | 焦点 | 具体动作 | 负责人 |
|----|------|----------|--------|
| **D1** | 批准 + 修正 | 审 CSV；确认 B 组 5 家改 half-cuts 链接；UTM 模板；备份 outreach | CEO + APBD |
| **D2** | Nigeria | 7 家有电话：A ladipo International · B Ladipo Spare Parts · E Partste/GUDU/APO MERCEDES · C Fleet And Cosy + Mobtech（可选 +2 C） | CEO 人工 |
| **D3** | Kenya | 8 家：A×2 · B×2（改 landing）· D×2 · E Taleon + Spares Mall | CEO 人工 |
| **D4** | SEO baseline | GA4 + GSC 导出；Top 16 引擎内链清单 | APSEO |
| **D5** | UAE | 6–8 家：A×2 · B Copart · C Fleet Management 等 · D NOOR + UZDPART | CEO 人工 |
| **D6** | Ghana + 目录 | Ghana 6 家有电话；Europages + 1 非洲目录各 1 profile | CEO + APCGO |
| **D7** | 复盘 | 回复率；是否批准 APBD 下一 discovery run | APCOO + CEO |

**本周数字目标：** 发送 30–40 · 回复 ≥3 · UTM visit ≥10 · 询盘 ≥1

---

## 9. Output Standard 逐条回答

| 问题 | 回答 |
|------|------|
| **本周能做什么？** | 审批并人工发送 43 家有电话线索；B 组改链接；GA4 baseline；2 目录 profile |
| **什么能安全自动化？** | APBD leadfinder/draft；SEO 脚本本地；KPI 汇总 |
| **什么需 CEO 批准？** | 每条 outbound；Runner 续跑；deploy；社交；目录发布 |
| **什么已存在？** | 46 outreach JSON/CSV；审计 PASS；catalog 页；APSEO/APCGO 文档 |
| **需要什么新资产？** | 国家 landing brief；UTM 模板；outreach_sent 日志；CTA 小改 |
| **什么不应做？** | 自动发送；假库存；编规格；未审大范围 frontend deploy |
| **如何衡量成功？** | UTM 访问、回复率、询盘、lead 质量、有机点击周环比 |

---

## 10. 风险与约束

| 风险 | 级别 | 缓解 |
|------|------|------|
| APBD runtime 未 commit，可能丢 | 高 | 备份 `runtime/apbd/` + outreach 导出 |
| 100% Google Maps 单源 | 中 | 修 Europages API；轮换 query |
| B 组 landing 错误 | 中 | 发送前手工改 half-cuts |
| 草稿模板化，回复率低 | 中 | 按组换角度；22 家有网站加定制句 |
| 3 家无电话 | 低 | 跳过或等下轮多源 |
| Places API 配额 | 中 | 监控 `api_quota_exhausted` |
| 仓库大量 dirty 文件 | 高 | growth 不与无关 frontend 混 deploy |
| `usedpartsdubai.com` 死链 | 低 | 以 Maps+电话为准 |

---

## 11. CEO 立即决策（3 项）

1. **批准 D2 Nigeria 批次** — 从 `outreach-queue.csv` 勾选 §8 D2 名单（7–9 家）  
2. **是否允许 CTA 小改 deploy** — engines/half-cuts/gearboxes 加 contact 按钮  
3. **是否批准 `/apbd run once`** — 继续发现（新 city/query，需 API 配额）

---

## 12. 相关文件

| 文件 | 作用 |
|------|------|
| `docs/agent-commands/growth-001-global-scrap-parts-traffic.md` | 任务来源 |
| `docs/agent-commands/cursor.md` | Cursor 任务定义 |
| `runtime/apbd/2026-07-05/outreach_queue/outreach-queue.csv` | CEO 操作台 |
| `docs/agents/apbd/audit-001-reality-verification.md` | 数据真实性 |
| `docs/product/seo/apseo-011-roadmap.md` | SEO 90 天 |
| `docs/agents/apcgo/growth-playbook.md` | 内容/关键词 |

---

## Completion Report

| 项 | 内容 |
|----|------|
| **Status** | ✅ Completed（仅报告） |
| **Deliverables** | 本一线执行方案 |
| **Paths** | `docs/agent-reports/cursor-growth-001-plan.md` |
| **Files Modified** | `cursor-growth-001-plan.md`、`cursor-latest.md` |
| **Validation** | outreach 46 条与 summary 一致；分组 A8+B5+C17+D7+E9=46；联系渠道 Python 复核 |
| **Next Task** | CEO 批准 D2 批次 → 人工发送；或指令「检查指令」 |

---

*本文件为策略与一线执行方案。不包含已发送记录。所有 outbound 必须 CEO 逐批批准。*
