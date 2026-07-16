# Antigravity Awesome Skills 调研（你说的「Angry Agent / 继承几百个」）

日期：2026-07-15  
更正：上一份 LocoAgent 报告是听错方向；本报告对准真正目标。

## 你指的是哪个项目？

| 你说的 | 实际项目 |
|---|---|
| Angry Agent / 继承几百个 agent | **Antigravity Awesome Skills**（现亦称 Agentic Awesome Skills） |
| 仓库 | https://github.com/sickn33/agentic-awesome-skills |
| 规模 | **约 1958 个**可安装 `SKILL.md` 技能包（不是 12 个辩论机器人，也不是 LocoAgent） |
| 星标 | 4 万+ 量级（社区很火） |
| 本质 | 给 Cursor / Claude Code / Antigravity / Codex 等用的**技能说明书大礼包** |

白话：它不是一个会自己跑去刷 TikTok 的独立 App；而是「把几百上千套工作方法装进你的 AI 编程助手」，让 Cursor/Claude **按需加载**对应技能。

安装示例：`npx agentic-awesome-skills`（或旧包名 `antigravity-awesome-skills`），可装到 Cursor 的 `.cursor/skills/`。

**重要：** 全量安装 1900+ 容易「技能过载」（意思是：助手犹豫选哪个、上下文变乱）。官方文档也建议按 bundle / 标签**精选启用**。

---

## 对照你们四大目标：哪些有用？

### 总表

| 需求 | 有没有直接可用 | 代表技能 | 建议 |
|---|---|---|---|
| 流量 / 获客文案策略 | **有** | `content-marketer`, `content-creator`, `copywriting`, `growth-engine`, `cold-email`, `sales-automator` | **优先装**（低风险，主要是写作方法） |
| TikTok 运营 / 发帖 | **有，但依赖第三方 API** | `tiktok-automation`, `socialclaw`, `taisly-social-media-posting`, `riffkit` | **可评估，不可盲目全自动**；多标 `risk: critical` |
| 视频剪辑 | **部分** | `remotion`（代码生成视频）、`riffkit`（仿爆款短视频）、`seek-and-analyze-video`（分析视频） | 可作「分析/仿写」；成片仍建议你们 ffmpeg/ChatCut + 人工确认 |
| 客户回复（WhatsApp） | **有 API 类技能，但你们已有更好方案** | `whatsapp-cloud-api`, `whatsapp-automation` | **不要替换**现有 APSales/子敬；最多当参考 |

---

### 1）流量提升 —— 最值得先拿

这些技能主要是**教 AI 怎么写/怎么规划**，不直接碰账号：

| 技能 | 干什么 | 对我们 |
|---|---|---|
| `content-marketer` | 内容营销、多渠道分发、SEO | 官网/目录/社媒文案统一 |
| `content-creator` | 品牌语气、平台差异化内容 | 与子敬语气可对齐 |
| `copywriting` | 转化向文案，禁止瞎编 | 落地页、邮件 |
| `cold-email` | B2B 冷邮件与跟进序列 | 欧美中间商触达（需你批准外发） |
| `sales-automator` | 销售话术、提案、案例模板 | 报价跟进话术草稿 |
| `growth-engine` | 增长黑客 / SEO / 获客框架 | 和 growth-master-plan 互补 |
| `ai-seo` / `frontend-seo` | SEO | 公开站流量 |

→ **建议：先装这一组（营销写作类），立刻能帮你出文案与节奏，几乎无封号风险。**

### 2）TikTok / 社媒自动发 —— 有，但要花钱接 API + 风控

| 技能 | 说明 | 风险 |
|---|---|---|
| `tiktok-automation` | 经 Rube/Composio 上传发帖、看数据 | **critical**；要 Composio 账号与 TikTok 授权 |
| `socialclaw` | 一个 Key 发 13 平台（含 TikTok） | **critical**；第三方聚合，密钥与内容审核要严 |
| `taisly-social-media-posting` | 短视频多平台发布（需审批后发） | **critical**；「approved」流程更接近你们「人工确认再发」 |
| `linkedin-automation` / `instagram-automation` | Composio 自动化 | **critical** |
| `social-orchestrator` | Instagram + Telegram + WhatsApp 编排 | **critical**；与现有 WhatsApp 易打架 |
| `riffkit` | 研究爆款 TikTok → 生成你们产品版短视频 | **critical**；偏「生成创意」，不是官方发帖 |

对照你们已定规则（`docs/ops/tiktok-pipeline-stage1-needs-ceo-assets.md`）：

- 剪辑：本地流水线 + 人工确认  
- 发布：优先**官方 Content Posting API**，不做浏览器瞎刷  
- 评论：草稿+人工  
- 私信：导流 WhatsApp 子敬  

→ **Antigravity 里的 TikTok 技能可当「接官方/合规 API 的说明书」来参考；不要当成一键全自动养号工具。**  
→ `taisly-*`（强调 approved）比「直接发」更贴近你们。

### 3）视频剪辑 —— 不能替代你们的成片流水线

| 技能 | 角色 |
|---|---|
| `remotion` | 用代码做讲解/演示视频（偏产品演示，不是加纳零件口播） |
| `riffkit` | 仿爆款结构出短视频创意 |
| `seek-and-analyze-video` | 分析对标视频结构 |

→ 适合「研究爆款 + 出脚本/分镜」；最终成片仍走你们 ffmpeg/ChatCut + CEO 风格素材。

### 4）客户回复 —— 你们已有更强的，别换栈

| 技能 | 说明 |
|---|---|
| `whatsapp-cloud-api` | Meta Cloud API 样板（Node/Python） |
| `whatsapp-automation` | Composio 发消息/模板 |

你们已有：WhatsApp bridge、子敬、媒体 VIN/OCR、跟进逻辑。  
→ **这些技能最多对照「Cloud API 最佳实践」；禁止用 Composio 另开一套客服并行。**

---

## 和 LocoAgent 差在哪（避免再混）

| | Antigravity Awesome Skills | LocoAgent |
|---|---|---|
| 是什么 | 技能说明书库（装进 Cursor） | 真浏览器社媒机器人 |
| 「几百个」 | ✅ ~1958 skills | ❌ 主要是 X skill + 几个 workflow |
| 流量文案 | ✅ 强 | 弱（偏执行点击） |
| TikTok 官方发帖思路 | ✅ 有 API 类技能 | ❌ 无 TikTok skill |
| 客户 WhatsApp | 参考用 | 不替代 |

你要的「继承几百个」→ **就是 Antigravity 这套。**

---

## 风险（CEO 必看）

1. **别全量安装 1900+** → 会乱、会慢、会误触发危险技能  
2. 标了 `risk: critical` 的发帖/消息技能 = 可能真的对外发内容 → **必须人工闸**  
3. 很多技能绑 **Composio / SocialClaw / Taisly** 等第三方 → 多一层密钥与费用  
4. 社区技能质量参差 → 只启用你们审过的白名单  
5. 外发邮件/社媒群发仍须你点头（公司红线）

---

## 建议落地（三步，由你拍板）

### 步骤 A — 本周就有用（推荐立刻做）

只启用营销/写作白名单（约 8～12 个），装到 Cursor：

- `content-marketer`, `content-creator`, `copywriting`, `cold-email`  
- `sales-automator`, `growth-engine`, `ai-seo`  
- （可选）`linkedin-post-writer`, `social-content`

用途：目录外链文案、TikTok 脚本草稿、LinkedIn/X 文案、询盘跟进话术草稿。

### 步骤 B — TikTok 发帖（你批准后再做）

评估其一，**不要同时开三个**：

1. **Taisly**（短视频多平台 + approved）是否符合「人工确认再发」  
2. 或继续自建 **TikTok Content Posting API**（你们文档主路径）  
3. `riffkit` 仅作「仿爆款脚本/成片草稿」，不直接连发帖

### 步骤 C — 明确不做

- 不装全库  
- 不用 `whatsapp-automation` 替换子敬  
- 不用浏览器刷赞类技能碰 TikTok 号

---

## 下一步请你回一句

1. **确认：** 是不是 https://github.com/sickn33/agentic-awesome-skills ？  
2. **是否批准步骤 A**：只装营销写作白名单到本仓库 Cursor？  
3. TikTok：继续等你交风格素材走自建流水线，还是要我评估 Taisly / `tiktok-automation` 的接入成本？
