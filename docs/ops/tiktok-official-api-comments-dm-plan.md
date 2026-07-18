# TikTok 官方 API 接入计划 — 评论管理（私信维持导流 WhatsApp）

CEO 决策(2026-07-18，最终版)：评论管理走 TikTok 官方 Accounts API；私信**不走** Business Messaging API 的 DSPR 审查（太重，需要正规安全合规体系），继续沿用 `tiktok-pipeline-stage1-needs-ceo-assets.md` 的原方案——视频导流到已训练的 WhatsApp 子敬。

决策过程：CEO 最初想两条都走官方通道 → 得知开发者账号需本人注册、私信还要过 TikTok 的 Data Security & Privacy Review（隐私负责人、安全政策、ISO27001/SOC2 级别材料）后，觉得太麻烦 → 拆分处理：评论走官方（门槛低），私信维持现状（零新增门槛）。

来源：https://business-api.tiktok.com/portal/docs/how-to-connect-to-tiktok-for-business-mcp-server/v1.3 及其 Organic API 文档树（2026-07-18 查证）。

## 范围

| 能力 | 方案 | 门槛 |
|---|---|---|
| 评论管理（发/回复/赞/隐藏/删/拉取 + webhook） | Accounts API（Organic API 下） | 开发者应用 + Accounts API Access Application Form，约1-2周 |
| 私信 | **不接 API**，维持视频导流 WhatsApp | 已有，`js/tiktok-hub.js` + `campaigns/ghana-tiktok/` bio-link hub 已上线 |

## 阶段一：账号与开发者身份（只能龙哥本人做，不能代办）

1. **确认/创建 TikTok for Business 账号**（区别于 @sssspaer 创作者账号，是广告/商业账号）
   文档：https://business-api.tiktok.com/portal/docs/create-a-tiktok-for-business-account/v1.3
2. **注册开发者账号**：https://business-api.tiktok.com/portal/docs/register-as-a-developer/v1.3
   - 必须用**公司域名邮箱**（建议 `developers@asia-power.com` 或类似别名），个人邮箱/临时邮箱会被拒
   - 公司网站：`asia-power.com`，域名要和邮箱一致
   - Primary Developer Location 选**开发团队所在地**（不是业务所在地）
   - 用途描述参考：
     > AsiaPower is an e-commerce/export company headquartered in [地点], operating asia-power.com for used engine, gearbox and half-cut parts export to Africa. We are the product team building tools to manage comments on our TikTok Business Account.
   - 审核：3个工作日
3. **创建开发者应用**：https://business-api.tiktok.com/portal/docs/create-a-developer-app/v1.3
   - 只需要勾选 `TikTok Accounts` scope（评论用）——**不需要**再申请 `Ad Account Management` / `CTX Events Management` / `Measurement`，那三个是 Business Messaging 的前置 scope，这次不用

## 阶段二：评论管理审批

- **闸门**：2026年3月20日起，申请 `TikTok Accounts` scope 前必须先填
  **Accounts API Access Application Form**：https://bytedance.sg.larkoffice.com/share/base/form/shrlgu4WEvtSXpEDLcCw56u4Rfc
- 通过后即可用：
  - `/business/comment/create/`、`/business/comment/reply/create/`（回复评论）
  - `/business/comment/like/`、`/business/comment/hide/`、`/business/comment/delete/`
  - `/business/comment/list/`、`/business/comment/reply/list/`（拉取）
  - Webhook `comment.update`（新评论/回复5分钟内推送）
- 前提：账号下要有已发布视频

## 建议执行顺序

1. 龙哥本人：注册 TikTok for Business 账号 + 开发者账号 + 开发者应用（阶段一，1-3个工作日审核，只勾 `TikTok Accounts` scope）
2. 批下来后提交 Accounts API Access Application Form
3. 表单通过后，评论 API 接进现有 `customer_gateway` 架构——复用邮件/WhatsApp 那套 webhook receiver + 草稿人工审核模式（子敬语气，不全自动，跟 `constitution/roles/apbd.md` 的红线一致）
4. 私信维持现状：视频/评论区继续引导客户加 WhatsApp，不接 Business Messaging API，不再推进 DSPR

## 我（Claude）不能代做的部分

- 注册开发者账号 / 创建开发者应用（账号创建类动作，规则不允许代做）
- 提交 Accounts API Access Application Form（含公司信息，需要本人提交）

## 状态

- **当前卡点**：等龙哥完成阶段一（TikTok for Business 账号 + 开发者账号 + 开发者应用，只勾 `TikTok Accounts` scope）
- 私信路线已定案维持现状，不再单独跟踪 Business Messaging API / DSPR
