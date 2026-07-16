# LocoAgent / Angry Agents 调研 —— AsiaPower 可用性

> **更正（2026-07-15）：** CEO 补充「继承了几百个 agent」后，目标项目更正为  
> **Antigravity / Agentic Awesome Skills**（~1958 skills）：  
> https://github.com/sickn33/agentic-awesome-skills  
> 详见：`docs/agent-reports/antigravity-awesome-skills-research-2026-07-15.md`  
> 下文 LocoAgent 分析仅作对照保留，**不再作为主推荐**。

日期：2026-07-15  
对象：流量提升 · TikTok/社媒 · 视频剪辑自动发布 · 客户回复  
主仓库（高度匹配你描述）：https://github.com/LocoreMind/locoagent  

> 若你指的不是这个，而是 `twelve-angry-agents`（12 人陪审团做决策），文末有一节；它**不**做社媒运营。

---

## 一句话结论

| 需求 | LocoAgent 能不能帮 | AsiaPower 建议 |
|---|---|---|
| 流量提升（X/LinkedIn 互动、搜关键词回复） | **能**（现成 workflow） | 可试点 X/LinkedIn，**不要**拿去刷 TikTok |
| TikTok 运营 | **几乎不能**（无 TikTok skill；靠浏览器发易封） | 继续你们已定方案：剪辑流水线 + 官方 API + 导流 WhatsApp |
| 视频剪辑 | **不能**（不管剪辑） | 继续 ffmpeg / ChatCut；LocoAgent 只管「发文/互动」 |
| 自动发帖 | **部分能**（X 图文已有范例；视频/TikTok 弱） | X/LinkedIn 可学其 workflow；TikTok 仍走官方 API |
| 客户回复 | **社媒评论/回复能**；WhatsApp 询盘**不能替代** | 询盘继续 APSales/子敬；LocoAgent 只做公开平台引流回复 |

**总评：** 值得「借思路 + 试点 X/LinkedIn」，**不要**整仓替换现有 WhatsApp/TikTok 体系。

---

## LocoAgent 是什么（白话）

开源社媒机器人：用你**真实 Chrome 登录态**，像人一样打开网页点赞、评论、发帖、关注。  
不是调官方 API，而是「真浏览器自动化」（意思是：驱动你电脑里已登录的 Chrome）。

核心三块：

1. **Agent 循环**：AI 看页面 → 决定下一步 → 点击/输入  
2. **Platform Skills**：平台操作手册（目前成熟的是 **X.com / Twitter**，37 项操作）  
3. **Workflow 引擎**：固定流水线、可定时跑（daemon），不一定每次都烧大模型钱  

现成流水线（仓库自带）：

- `hf-papers-to-x`：抓内容 → 配图 → 发到 X  
- `x-search-reply`：搜关键词 → AI 写回复 → 发评论（可常驻）  
- `linkedin-search-reply`：LinkedIn 同款搜评  

Skills 目录现状：主要是 `skills/x-com/`；LinkedIn/Reddit/Instagram 文档说可扩展，**TikTok 没有**。

---

## 对照你们四个目标

### 1）流量提升 —— 有用（中高）

可直接借鉴：

- 关键词搜帖 + AI 回复（零件/引擎/Ghana import 等英文词）  
- 定时发图文（库存亮点、到货、半截车）到 X / LinkedIn  
- Operation log：避免重复点赞/回复（意思是：有去重记录）

对 AsiaPower：非洲 B2B 买家更多在 WhatsApp；X/LinkedIn 适合**品牌曝光 + 欧美/中东中间商**，不是加纳询盘主战场。适合作为「第二渠道」，别指望它替代 WhatsApp。

### 2）TikTok 社媒运营 —— 基本没用

- 仓库**没有 TikTok skill**  
- 浏览器自动刷 TikTok 极易触发风控/封号  
- 你们 `docs/ops/tiktok-pipeline-stage1-needs-ceo-assets.md` 已定：**不做浏览器自动发帖**；优先官方 Content Posting API；评论草稿+人工；私信导流 WhatsApp  

→ **不要**用 LocoAgent 发 TikTok。

### 3）视频剪辑 + 自动发布 —— 剪辑无用；发布仅限图文社媒

| 环节 | LocoAgent | 你们现有/应继续 |
|---|---|---|
| 剪辑 | 无 | ffmpeg 流水线 / ChatCut；等 CEO 风格素材 |
| 发 TikTok | 不推荐 | 官方 API |
| 发 X 图文 | 有范例可抄 | 可试点 |
| 发 LinkedIn | workflow 有搜评；发帖可扩 | 可试点 |

### 4）客户回复 —— 分流使用

| 场景 | 用谁 |
|---|---|
| WhatsApp 询盘（VIN/报价/跟进） | **继续 APSales / 子敬**（已训练、已接媒体 OCR） |
| X/LinkedIn 公开评论、引流话术 | 可试点 LocoAgent 式「搜→回复」 |
| TikTok 评论 | 草稿+人工（已定），不全自动 |

LocoAgent **不能**替代 WhatsApp 会话、库存查询、报价合规。

---

## 风险（必须心里有数）

1. **封号风险**：真浏览器刷互动，平台仍可能判异常；要限频、去重、人工抽查  
2. **账号安全**：CDP 挂真实 Cookie = 机器能完全控制账号；生产机/本机隔离、勿多人共用  
3. **许可证**：底层 fork Claude Code CLI 源码树，商用前要法务/合规再看一眼 LICENSE 边界  
4. **运维重**：要常开 Chrome、配 CDP、Bun、LLM Key；比「调一个发帖 API」重得多  
5. **与现网重复**：你们已有 `growth_autopilot`、WhatsApp bridge、TikTok 文档——整仓接入成本高，收益不如「抄 workflow 模式」

---

## 建议怎么用（可执行优先级）

| 优先级 | 做什么 | 不做 |
|---|---|---|
| P0 | **只借架构**：Skill 手册 + Workflow 定时 + 操作去重 → 用在你们自己的脚本/OpenClaw | 不整仓部署替代 APSales |
| P1 | 若要试点：本机 Chrome 登 **公司 X 或 LinkedIn**，跑 `x-search-reply` / 发库存图文，人工审第一周 | 不碰 TikTok 浏览器发帖 |
| P2 | 自建 `skills/tiktok` **仅**做「读数据/整理草稿」，发布仍走官方 API | 不自动乱评、不自动私信 |
| — | 客户询盘 | 一律 WhatsApp 子敬 |

### 若确认试点（需你点头后再做）

1. 指定：用哪个 X / LinkedIn 账号（公司号，非私人）  
2. 本机或独立小机跑 Chrome + LocoAgent（不建议直接挂现网库存机）  
3. 第一周：只「搜+草稿回复」，自动发送关闭或极低频  
4. 话术对齐子敬：导流 `asia-power.com` + WhatsApp，不在公开平台报死价

---

## 备选：Twelve Angry Agents

仓库：https://github.com/hillolkallol/twelve-angry-agents  

- 12 个 AI 人格辩论后给决策结论（本地 Ollama）  
- **有用场景：** 大决策（要不要砸广告、选哪个市场、定价策略）  
- **无用场景：** TikTok、剪辑、自动发帖、客户即时回复  

若你其实指这个：可当「战略会诊工具」，与流量流水线无关。

---

## 和你们现有体系怎么拼

```
素材/成片 ──► 剪辑流水线(ffmpeg/ChatCut) ──► TikTok 官方 API（人工确认）
                                              │
                                              └──► 导流 WhatsApp 子敬（询盘主路径）

库存亮点/关键词 ──► [可选] LocoAgent 式 X/LinkedIn 发帖+搜评 ──► 导流网站/WhatsApp

决策争议 ──► [可选] Twelve Angry Agents 陪审团
```

---

## 下一步（等你一句话）

1. **确认项目**：是 LocoAgent，还是 Twelve Angry Agents，或另有链接？  
2. 若是 LocoAgent：**是否批准「仅 X 或 LinkedIn 本机试点」**（不碰 TikTok、不动 WhatsApp）？  
3. TikTok 侧：是否先交 2–3 条风格参照素材，继续剪辑流水线？
