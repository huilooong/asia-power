# Agency Agents 调研（你说的 agency agent）

日期：2026-07-15  
仓库：https://github.com/msitarzewski/agency-agents  
规模：约 **247** 个专职「数字员工」人设（按部门分：营销 36、工程 49、销售 9…）  
星标：约 10 万级  

> 之前误当成 Angry / Antigravity / LocoAgent，以本报告为准。

---

## 白话它是什么

一套**可安装到 Cursor / Claude / OpenClaw 的角色说明书**（每个角色一个 `.md` 文件）。  
调用时让 AI「变身」成 TikTok 策划、短视频剪辑教练、销售教练等。

它**不是**：

- 自己会登录 TikTok 天天发帖的独立软件（多数角色只出策略/脚本/清单）  
- 替代你们 WhatsApp 子敬的客服系统  

个别角色（如 Carousel Growth Engine）会接第三方 API 自动发帖——见下方风险。

安装方式：官方有 `scripts/convert.sh` 可转成 Cursor / Claude 格式；另有配套 App：https://github.com/msitarzewski/agency-agents-app

---

## 对照你们四大目标

| 需求 | 有没有用 | 推荐启用的角色 | 说明 |
|---|---|---|---|
| 流量提升 | **很有用** | Growth Hacker、SEO Specialist、Social Media Strategist、Content Creator、Cross-border Ecommerce | 出获客实验、内容日历、目录/官网文案 |
| TikTok / 社媒 | **很有用（策划层）** | **TikTok Strategist**、Douyin Strategist、Instagram Curator、Twitter Engager、Multi-platform Publisher | 出选题、脚本、节奏、跨平台改编 |
| 视频剪辑 | **有用（教练层）** | **Short Video Editing Coach**、Video Optimization Specialist | 教怎么剪、字幕、钩子；**不替代** ffmpeg/ChatCut 成片流水线 |
| 自动发布 | **有一个会自动发** | Carousel Growth Engine（轮播图 → Upload-Post API → TikTok/IG） | 默认「中间步骤不问人」——**与公司红线冲突，默认不要开自动发** |
| 客户回复 | **有用（话术层）** | Support Responder、Sales Coach、Discovery Coach、Outbound Strategist | 提升询盘话术；**不要替换**现有 WhatsApp 子敬 |

---

## 建议优先启用的清单（约 12 个，够用）

### 流量 + TikTok（先装这些）

1. `marketing/marketing-tiktok-strategist.md` — TikTok 算法/爆款结构  
2. `marketing/marketing-short-video-editing-coach.md` — 短视频剪辑教练（和你们剪辑流水线最配）  
3. `marketing/marketing-video-optimization-specialist.md` — 完播/封面优化  
4. `marketing/marketing-social-media-strategist.md` — 跨平台总策划  
5. `marketing/marketing-content-creator.md` — 多平台内容生产  
6. `marketing/marketing-growth-hacker.md` — 获客实验  
7. `marketing/marketing-seo-specialist.md` — 网站/目录 SEO  
8. `marketing/marketing-cross-border-ecommerce.md` — 跨境（中国货→海外买家，贴 AsiaPower）  
9. `marketing/marketing-multi-platform-publisher.md` — 一稿多发的改编清单（人工发）  
10. `paid-media/paid-media-paid-social-strategist.md` — 若以后投 TikTok/Meta 广告  

### 客户回复 / 销售（辅助子敬，不替换）

11. `sales/sales-coach.md` — 销售话术教练（仓库里你们已有 `sales_coach` 相关痕迹，可对照）  
12. `sales/sales-discovery-coach.md` — 询盘挖需  
13. `sales/sales-outbound-strategist.md` — 外联节奏（外发须你批准）  
14. `support/support-support-responder.md` — 客服回复框架  

### 暂缓 / 慎用

| 角色 | 原因 |
|---|---|
| `marketing-carousel-growth-engine` | 会接 Gemini + Upload-Post **自动发** TikTok/IG，且写明「中间不问确认」——违反你们「对外发帖先问 CEO / 人工确认」 |
| 微信/微博/小红书/知乎/百度等中国平台角色 | 主战场在加纳 WhatsApp + TikTok，优先级低 |
| 全库 247 个工程/游戏/医疗角色 | 装多了会乱，不装 |

---

## 和你们现有体系怎么拼

```
Agency Agents（人设）
  ├─ TikTok Strategist + Short Video Coach → 选题/脚本/剪辑规范
  ├─ Growth / SEO / Content → 目录外链、官网、内容日历
  └─ Sales Coach / Support Responder → 话术草稿
         ↓
实际执行仍用你们已有系统：
  ├─ 剪辑：ffmpeg / ChatCut + CEO 风格素材
  ├─ 发布：TikTok 官方 API + 人工确认（已定）
  └─ 询盘：WhatsApp 子敬 / APSales（已训练）
```

**一句话：** Agency Agents =「请什么顾问」；你们现有系统 =「谁真正干活」。顾问可以请，干活的人别换。

---

## 风险

1. **Carousel Growth Engine 的零确认自动发** — 默认禁用  
2. 角色是通用西方/互联网语气 — 必须套你们「子敬语气 + 不报死价 + 导流 WhatsApp」  
3. 不要一次装 247 个 — 只装上表 10～14 个  
4. 外发邮件/群发社媒仍须你点头  

---

## 建议下一步（等你一句话）

**方案 A（推荐）：** 把上表「流量+TikTok+销售」约 12 个角色装进本仓库 Cursor（`.cursor/agents` 或项目约定路径），立刻能用来写 TikTok 脚本与获客计划。  

**方案 B：** 先只装 3 个试水：`TikTok Strategist` + `Short Video Editing Coach` + `Sales Coach`。  

你回「装 A」或「装 B」即可；未批准前我只调研不安装。
