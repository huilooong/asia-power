# Google Ads 关键词搜索投放 — CEO 上手指南

**日期：** 2026-07-06  
**结论：** 只投「搜索广告」，不投 Performance Max。**覆盖西非（不含尼日利亚）+ 北非 19 国，英语 + 法语 + 阿语三语**，关键词、否定词、广告文案已全部配好，导入即可。

---

## 一、你要投什么（一句话）

有人在 Google 搜 **「corolla engine」「moteur corolla」「half cut cars」** 等词时，显示 AsiaPower 广告。覆盖 **西非（不含尼日利亚）+ 北非 19 国**，日预算 **$30 不变**。

---

## 二、搜索规则（已设计好，不用你改）

| 规则 | 设置 | 意思 |
|------|------|------|
| 广告类型 | 仅搜索（Search） | 只在 Google 搜索结果里出现 |
| 匹配方式 | 词组匹配（Phrase） | 搜的词必须包含你设的关键词 |
| 投放地区 | 西非 12 国 + 北非 6 国 | **不含尼日利亚** |
| 语言 | 英语 + 法语 + 阿语 | 覆盖法属西非和北非 |
| 地区选项 | 人在当地（Presence） | 不是「对非洲感兴趣的人」 |
| 日预算 | **$30/天**（4 活动合计） | 发动机 $21 · 变速箱 $5 · 半切 $3 · 进口 $1.5 |

### 4 个广告活动

| 活动名 | 目的 | 日预算 |
|--------|------|--------|
| AF_Search_Engines_HighIntent | 各车型发动机（英/法/阿关键词） | $21 |
| AF_Search_Gearboxes_HighIntent | 变速箱 | $5 |
| AF_Search_HalfCuts_Import | 半切/前切 | $3 |
| AF_Search_Import_FromChina | 从中国进口汽配 | $1.5 |

### 覆盖国家（19 国，不含尼日利亚）

**西非：** 加纳、科特迪瓦、多哥、贝宁、塞内加尔、布基纳法索、马里、尼日尔、利比里亚、塞拉利昂、几内亚、冈比亚

**北非：** 埃及、摩洛哥、阿尔及利亚、突尼斯、利比亚、毛里塔尼亚

**排除：** 尼日利亚（活动排除 + 否定词 nigeria/lagos/abuja）

### 否定关键词（自动过滤垃圾流量）

已配置 40+ 个账户级否定词，例如：`oil`（机油）、`filter`（滤芯）、`sensor`（传感器）、`repair`（维修教程）、`job`（找工作）等。  
意思是：有人搜「corolla engine oil」不会触发你的广告。

---

## 三、你要做的 5 步（约 20 分钟）

### 第 1 步：下载 Google Ads Editor

- 电脑打开：https://ads.google.com/home/tools/ads-editor/
- 安装后登录你的 Google Ads 账号（账号 ID 对应 `AW-971838178`）

### 第 2 步：导入配置包

本地文件夹（按顺序导入 5 个 CSV）：

```
docs/marketing/google-ads-merged-africa-editor-2026-07-06/
├── 01-campaigns.csv          ← 先导入
├── 02-ad-groups.csv
├── 03-keywords.csv           ← 130 个关键词（英/法/阿）
├── 04-responsive-search-ads.csv
└── 05-negative-keywords.csv
```

**不要**导入桌面上的 `asiapower-search-ads-v3.csv`（Claude 版）—— 那个一导入就会开投且匹配方式过时。对比说明见 `docs/marketing/google-ads-merge-analysis-2026-07-06.md`。

**Editor 操作：** 账号 → 导入 → 从 CSV 导入 → 选文件 → 全部选「暂停状态」→ 预览 → 发布到 Google Ads。

> 全部默认 **Paused（暂停）**，不会一导入就开始扣费。

### 第 3 步：确认转化追踪（网站已接好）

| 项 | 状态 |
|----|------|
| GA4 | `G-PB2J3VRX5J` 已在全站 |
| Google Ads 转化 | `AW-971838178` / 表单提交 `vR2aCLjrv8scEOKltM8D` |
| 网站行为 | 客户提交表单 → 自动上报 `generate_lead` 转化 |

**Google Ads 后台检查：** 工具 → 转化 → 确认「表单提交」状态为「已验证」或「最近有记录」。

**同时打开：** 设置 → 账号设置 → **自动标记（Auto-tagging）= 开启**

### 第 4 步：绑卡 + 确认预算

- 结算 → 添加付款方式
- 确认 4 个活动日预算合计约 **$30**（可按你意愿改，建议第一周别超过 $50）

### 第 5 步：先开 1 个活动测试

建议只启用 **AF_Search_Engines_HighIntent**（发动机），跑 3–7 天：

- 有 WhatsApp/表单线索 → 再开变速箱、半切
- 某广告组有点击无线索 → 暂停该组，把搜索词报告发我加否定词

---

## 四、第一周看什么

| 指标 | 健康 | 要动作 |
|------|------|--------|
| 搜索词报告 | 全是 engine/gearbox/half cut | 无关词 → 加否定词 |
| 点击率 CTR | > 3% | < 1% → 改标题 |
| 转化 | 有表单/WhatsApp | 0 转化但花了 $30+ → 暂停查词 |
| 单次转化成本 | 先记录，不设死 | 第二周再定目标 |

**每周三** 把 Google Ads「搜索词报告」导出给我，我帮你加否定词、调关键词。

---

配置包路径

`docs/marketing/google-ads-merged-africa-editor-2026-07-06/`

| 文件 | 用途 |
|------|------|
| `docs/marketing/google-ads-ceo-setup-guide-2026-07-06.md` | 本文 — CEO 操作指南 |
| `docs/marketing/google-ads-ghana-plan-2026-07-06.md` | 英文策略说明 |
| `docs/marketing/google-ads-ghana-keywords-2026-07-06.csv` | 关键词清单（可读版） |
| `docs/marketing/google-ads-merged-africa-editor-2026-07-06/*.csv` | **最终版** 西非+北非（不含尼日利亚）导入包 |
| `docs/marketing/google-ads-merged-ghana-editor-2026-07-06/*.csv` | 加纳单国备用包 |
| `docs/marketing/google-ads-merge-analysis-2026-07-06.md` | Cursor vs Claude 方案对比 |
| `docs/marketing/reference/asiapower-search-ads-v3.csv` | Claude 原版（仅参考，勿导入） |

---

## Status

| 项 | 状态 |
|----|------|
| 关键词 + 否定词 + 广告文案 | ✅ 已配好 |
| UTM 追踪链接 | ✅ 已写入每个关键词 |
| 网站转化代码 | ✅ 已部署生产 |
| Google Ads 账号导入 | ⏳ 需你在 Editor 里点导入 |
| 绑卡 + 开启投放 | ⏳ 需你确认预算后启用 |

**Next：** 你导入并绑卡后告诉我，我帮你看第一周的搜索词报告并优化。
