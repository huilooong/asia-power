# Google Ads 方案对比与合并说明 — 2026-07-06

对比对象：

- **A 方案（Cursor）**：`docs/marketing/google-ads-editor-2026-07-06/`
- **B 方案（Claude 桌面）**：`asiapower-search-ads-v3.csv`（最新版，v1/v2 为迭代草稿）

---

## 结论（CEO 版）

**用 A 方案的骨架 + B 方案的文案和车型词，不要用 B 方案直接导入。**

B 方案一导入就会 **Enabled 开投 + 用过时的广泛匹配**，第一周很容易烧钱在机油、教程、乱搜词上。

合并后的最终包：**`docs/marketing/google-ads-merged-ghana-editor-2026-07-06/`**

---

## 优劣对比

| 维度 | A 方案（Cursor） | B 方案（Claude v3） | 合并决策 |
|------|------------------|---------------------|----------|
| 默认状态 | Paused，安全 | **Enabled，导入即扣费** | ✅ 保留 Paused |
| 匹配类型 | Phrase 词组匹配 | **Broad Match Modified（+词，已废弃）** | ✅ 只用 Phrase |
| 否定词 | 40+ 个（机油/传感器/工作） | 仅 8 个 | ✅ 保留 A + 补 B 的 oil change 等 |
| 转化追踪 | UTM + AW-971838178 | 无 UTM | ✅ 保留 A |
| 活动结构 | 按意图分：发动机/变速箱/半切/进口 | 按语言分：英/法/阿 | ✅ 第一阶段只用加纳英语 A 结构 |
| 广告组 | 7 个发动机组，较粗 | **每车型一组，更精准** | ✅ 采用 B 的拆组思路 |
| 关键词 | 59 个，偏保守 | 110+，含年份/配件词 | ✅ 合并 B 的年份词，配件词放半切/进口组 |
| 广告文案 | 7 组共用同一套标题 | **每组独立标题+年份** | ✅ 采用 B 的文案风格 |
| 落地页 | ghana.html / engines/ / gearboxes/ |  mostly 首页 | ✅ 保留 A 的精准落地页 |
| 出价 | Manual CPC $0.35/组 | Manual CPC **$1.50** | ✅ 保留 $0.35–0.45（加纳 CPC 更低） |
| 多语言 | 仅英语 | 英+法+阿三活动 | ⏸ 第二阶段再开法语/阿语 |
| 导入方式 | Editor 5 文件标准格式 | 单 CSV 混合行 | ✅ 保留 Editor 5 文件 |
| 展示路径 | 无 | corolla/engine 等 | ✅ 从 B 吸收 Path 1/2 |

---

## B 方案必须丢弃的部分（糟粕）

1. **Status = Enabled** — 导入就开始花钱，对新手最危险。
2. **Broad Match Modified（+toyota +corolla）** — Google 2021 年起已取消，Editor 可能报错或变成乱匹配。
3. **阿拉伯语 Broad 广泛匹配** — 无足够否定词，极易跑飞。
4. **发动机组里混 half cut / spare parts 词** — 广告与搜索意图不一致，Quality Score 低、点击贵。
5. **$1.50 Max CPC** — 加纳市场 CPC 通常 $0.20–0.60，上限过高。
6. **落地页全是首页** — 客户搜 Corolla 发动机应进 ghana.html 或 1ZR 页，不是首页。
7. **「Quote in 2 hours」** — 若团队无法保证 2 小时回复，会伤信任；改为「Send model & year」。

---

## 从 B 方案吸收的部分（精华）

1. **按车型拆广告组** — Corolla / Camry / RAV4·Prado / CR-V / Accord·Civic / ix35·Tucson / Elantra·Sonata / Qashqai·X-Trail
2. **年份关键词** — `corolla 2009 engine`、`crv 2010 engine`、`ix35 2012 engine` 等（Phrase）
3. **车型专属广告标题** — 如 Honda 组不再出现「Corolla / Camry Engines」
4. **标题里写年份和机型** — `2007 2008 2009 2010 — Real Stock`
5. **展示 URL 路径** — Path 1: `corolla` Path 2: `engine`
6. **半切/通用组补充词** — `used car parts ghana`、`second hand car parts ghana`
7. **法语/阿语活动结构** — 存档备用，加纳测试通过后再开

---

## 合并后变化摘要

| 项 | 原 A | 合并后 |
|----|------|--------|
| 广告组 | 13 | 16（发动机 9 组） |
| 关键词 | 59 | 92 |
| 广告文案 | 13 组共用模板 | 16 组独立文案 |
| 出价策略 | Maximize clicks | **Manual CPC**（更可控） |
| 否定词 | 40 | 45 |

---

## 推荐使用路径

1. **现在导入**：`docs/marketing/google-ads-merged-ghana-editor-2026-07-06/`
2. **桌面 Claude CSV**：仅作参考，**不要直接导入**
3. **CEO 操作指南**：`docs/marketing/google-ads-ceo-setup-guide-2026-07-06.md`（已指向合并包）

---

## Status

| 项 | 状态 |
|----|------|
| 对比分析 | ✅ |
| 合并配置包 | ✅ `google-ads-merged-ghana-editor-2026-07-06/` |
| Claude 原文件归档 | ✅ `docs/marketing/reference/asiapower-search-ads-v3.csv` |

**Next：** CEO 导入合并包 → 绑卡 → 只开 `GH_Search_Engines_HighIntent` 测 7 天。
