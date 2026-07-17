# +233 线 5W2H 第三段(成交:Where/How/How much)—— 独立排期,谨慎设计

## 给 Cursor 的交付说明

**这份文件不要一次性全部做完。分阶段排期,每个阶段做完先让龙哥看效果,再决定要不要做下一阶段——尤其是阶段三,不做 CEO 明确点头不要开工。**

**阶段三已获龙哥明确批准开工(2026-07-17):"开始做"。按上面"阶段三 —— 重新设计(2026-07-17)"那个版本做,不是最早那版(触发条件已经改了,以重新设计版为准)。** 阶段一、二已经做完部署,这次只需要做阶段三。

**⚠️ 开工前先看 [[closing-flow-video-inspection-fee]]**(2026-07-17,经龙哥几轮纠正后的最终版)——那份文件改了成交流程本身:视频确认+上门检测不管客户付 $50 还是付全款都不能省;新增买入意愿即时提醒(不等这里阶段二已经上线的 2 小时热单卡住检查,那个继续保留当兜底);新增报价 24 小时未接受的一次性客户侧温和跟进。会给 `deal_state` 加 `payment_status`/`fulfillment_stage` 等新字段(注意是拆成两个独立维度,不是单一 `closing_stage` 线性枚举)。**两份文件都要改同一批文件(`bridge.mjs`/`apsales-closing-memory.mjs`),先做那份、确认 `deal_state` schema 定下来之后,阶段三的"反重复检测"实现时读取的 deal_state 字段要跟那份对齐,不要各做各的加出两套不兼容的字段。**

开始动手前,先在本文件最下面的「Cursor 实施报告」章节追加一行「已开始 <日期时间>」。做完一个阶段,把结果写进「Cursor 实施报告」(带日期,追加,不覆盖),并且明确写清楚做的是哪个阶段。

## Context

背景调研见 [[whatsapp-233-sales-quality-audit-20260716]] 的 E 部分(已经从那份文件移出来,原因见下)。龙哥的原始问题是"5W2H 好像对 agent 没有太多帮助",复盘 20 个今日真实对话后的结论是:**第一段(Which/What,车型/VIN)有 `deal_state.vin`/`part_intent` 这种硬字段挡着"不能重复问",执行得很好;第三段(Where/How/How much,港口/付款/数量)完全没有对应的结构化状态,全靠模型每轮临场判断,今天 3 单真正报价的对话里没有一单被明确问过数量。**

**龙哥的明确要求:这部分要谨慎思考,不要把客服写死了。** 这是这份文件存在的原因——第一版草稿(已经从主审计文件删掉)写的是"一旦报价确认,就要求 agent 每轮主动追问一个缺失项",这条规则本身就有把客服写死的风险,所以单独拿出来重新设计,不能直接照抄。

## 为什么"强制追问"这个直觉方案是错的(先讲清楚,不要重蹈覆辙)

`docs/zijing-training/LIVE-RULES.md` 里对第三段的设计哲学写得很明确:

> 第三段·成交(Where + How + How much)——目的地/付款方式/数量，临门一脚。通常客户自己会在这个阶段主动问代理/付款方式，顺势推进到"来签约"就是自然的，不要子敬硬拽。

这不是疏漏,是**刻意的设计选择**——销售场景里,客户主导成交细节的推进,比 agent 像填表一样连续追问("你要几件?""发哪个港口?""怎么付款?")要自然得多,后者会让 agent 显得像个机器人问卷,直接违反 prompt 里"Reply like a real salesperson, not a chatbot"这条最高优先级的风格要求。

**如果直接加一条"报价确认后必须主动追问缺失项"的硬规则,大概率会做出一个不断在成交关键时刻打断对话节奏、机械式列清单的客服,这正是要避免的"写死"。**

## 真正的问题不是"agent 不追问",是"没人知道单子卡住了"

重新看今天的 3 个真实报价对话,问题不是"agent 应该主动逼问客户"——而是:

- +233249632526:客户已经说了"yes"愿意下单,问了港口/清关问题,agent 给出的回答是"团队会把地址发给你"这种承诺,**但没有任何机制确保这个承诺被兑现**(这个具体的号码/触发条件 bug 已经在 [[whatsapp-233-sales-quality-audit-20260716]] A 部分修好了,但即便触发条件对了,后续也只是"通知了同事",不代表同事一定会及时跟进)。
- 客户最后一条消息之后过了几个小时没人回复,**没有人知道这单可能正在冷掉**。

**结论:该"写死"的不是客服对话本身,是运营层面的安全网——一旦一个客户明确表达了购买意愿、报价已确认,这笔"热单"如果卡住没有推进,应该有人被自动提醒去跟进,而不是让 agent 在对话里死磕客户去逼问细节。** 把强制性放在"提醒人类"这一层,而不是"约束对话怎么说"这一层——这样客服对话本身还是自然、灵活、模型自己判断怎么问最合适,但生意不会因为 agent 某一轮没问到位就悄悄流失。

## 分阶段方案

### 阶段一(低风险,不改变任何对客户的对话行为,先做):被动记忆,不主动追问

在 `deal_state` schema 里新增字段(参照现有 `vin`/`part_intent` 抽取模式,只是"记得住客户已经说过的",不是"逼客户说"):

- `destination_port`
- `quantity`
- `payment_notes`(自由文本,不是布尔——付款方式这种东西客户表达方式千差万别,存成结构化枚举容易漏,存原始文本片段更安全)

`rememberDealFromContext()`(`bridge.mjs` 里已有的抽取函数)增加对应抽取逻辑:客户在对话里**主动**提到港口名(Tema/Takoradi/Accra/Apapa/Lagos 等)、数量表述("2 units"/"a container"/"just one")、付款相关表述时,写入这些字段。

**这一步不加任何"必须追问"的 prompt 规则**——纯粹是让 agent 不会因为没记住客户之前说过的港口/数量,而在后面重复问或者答非所问。这本身就可能改善一部分"5W2H 好像没用"的观感(如果根因部分是"记性差"而不是"没问"),而且完全不涉及"写死对话怎么进行"的风险。

### 阶段二(真正解决"热单卡住没人知道"的问题,阶段一验证完再做):人类安全网,不是客服脚本

这一阶段的核心思路:**给运营层面加一道确定性的提醒机制,而不是给客服对话加确定性的话术脚本。**

1. 复用 [[whatsapp-233-sales-quality-audit-20260716]] D 部分已经在用的模式(`support_line_unreachable` 那种布尔标志):在 prompt JSON 返回里加一个新字段 `"buying_intent_confirmed": true|false`——当且仅当客户在本轮明确表达了购买意愿(说"yes"/"let's do it"/"I'll proceed"/主动问付款方式或取货安排这类信号)时置为 `true`。**这个判断交给模型做语义判断,不要写关键词正则**——原因同 D 部分:客户表达"我要买了"的方式无穷多样,硬编码关键词列表会漏,而这正是模型该做的事。
2. `deal_state` 里增加 `buying_intent_confirmed_at` 时间戳字段,首次出现 `buying_intent_confirmed === true` 时写入(已存在则不覆盖,保留最早一次)。
3. 新增一个独立的定时检查(可以跑在现有的 `growth_autopilot` 或 `apsales-growth` cron 节奏里,不需要新建 cron 任务):扫描所有 `deal_state`,找出满足以下全部条件的:
   - `confirmation_status === 'team_quoted'`
   - `buying_intent_confirmed === true`
   - 距离 `updated_at`(最后一次有实质进展的时间)超过一个阈值(建议 **2 小时**作为起点,可以按 CEO 反馈调整,不要一上来就定死一个数字自己觉得合理的)
   - 还没有为这次"卡住"发过提醒(避免同一个卡住的单子每次 cron 跑都重复提醒——加一个 `stall_alert_sent_at` 字段,发过一次之后如果状态又有新进展就清空,允许下次卡住再提醒一次)
4. 命中的单子,给加纳同事 + CEO Telegram 发提醒(内容用现有 `sendTelegram`/`ghana-staff-handoff` 的发送方式即可,不需要新通道),内容包括:客户号码、确认的报价、多久没进展、对话最后几轮摘要——**这条提醒是给人看的,不是给客户的自动话术,所以这里可以且应该写得结构化、信息密度高,跟客服对话的"不要写死"是两码事**。

这一步做完,"客户说 yes 之后单子卡住没人知道"这个真实发生过的问题(+233249632526 那单)就有了兜底,而且完全没有改变 agent 跟客户说话的方式一个字。

### 阶段三 —— 重新设计(2026-07-17,龙哥纠正了目的,原设计范围太窄)

**龙哥的原话:**"阶段三主要的目的是让agent有聊天的思路,现在在获取了客户的底盘号和采购信息之后没有思路,基本都是翻来覆去说重复的话,5w2h是提供聊天的思路,不需要把所有的问题都问完,我们的目标是成交,不是做市场调研。"

**这纠正了一个理解错误**:上面第一版阶段三,触发条件是"`buying_intent_confirmed === true`(报价已确认、客户明确要买)"——只覆盖了成交前最后一步。但真实问题发生得更早、更常见:**agent 拿到 VIN/车型(第一段完成)之后,只要还在等团队人工报价,就没话说,来回车轱辘同一句话**,客户可能在等报价这几轮就流失了,根本到不了"报价已确认"那一步。

**证据(今天真实对话,客户 243824612008,法语客户问 Lexus IS 变速箱)**:

> "We are checking the price for the Lexus IS manual gearbox...team will confirm..."(14:25)
> "Got it! We are working on confirming the price..."(14:29)
> 客户抱怨:"Depuis hier j'attends votre confirmation près que 24h"(从昨天就在等你确认了,快 24 小时了)+ 问要照片
> "Apologies for the wait. The team is still confirming the price... We will send you images tomorrow."(14:34)

三轮基本是同一句"团队在确认价格"换个说法,客户明确表达不耐烦,agent 没有用上任何其他角度(目的地、数量、有没有其他型号可以先参考、紧急程度)让对话保持有用,纯粹重复干等。这才是"没有聊天思路"的真实样子。

**重新定义 5W2H 第三段的用途**:不是"成交前必须问完的清单",是**agent 没有新内容可说时可以用来保持对话有价值、往前推进的素材库**——Why(买家类型/用途)、When(紧急度)、Where(港口)、How(付款)、How much(数量),这五个维度,**任何时候只要 agent 快要重复自己说过的话,就从里面挑一个没问过的、跟当前语境搭得上的,自然带一句,而不是逼客户填完一整张表**。目标是成交(让对话保持推进、保持有用),不是信息收集完整度。

**设计要点**:

1. **硬性反重复检查(确定性,不只是 prompt 建议)**——不能只在 prompt 里写"别重复自己",今天已经验证过一次"prompt 说了但模型还是犯错"(A 那次)。做法:生成回复前,读这个客户最近 1-2 轮 agent 自己发过的话(复用 `ghana-staff-handoff.mjs` 里 `buildHandoffSummary()` 已经在用的、从 `data/evidence/whatsapp/turns.ndjson` 按 `customer_id` 取最近几轮的模式,不用新写一套),做一个粗粒度相似度检查(不需要复杂算法,核心句式重复,比如"team is checking"/"still confirming"/"team will confirm"这类核心短语连续出现 2 次以上就算命中)。命中时,把这个信号加进传给 LLM 的 structured context(比如 `possible_repeat_detected: true` + 最近说过的原文),让模型知道"你上一轮已经这么说过了,这次换个角度"。
2. **prompt 里把 5W2H 剩余维度明确列成"可选素材",不是"必须完成项"**:类似这样的措辞(具体用词 Cursor 可以打磨,但方向要对):`"If you're about to repeat a previous holding message with no new information (recent context flags possible_repeat_detected), don't repeat it. Instead pick ONE relevant angle you haven't covered yet — why they need it, how urgent, destination port, payment preference, or quantity — and naturally work it into your reply. Pick at most one. Skip entirely if none fits naturally with what the customer just said. The goal is to keep the conversation moving toward a sale, not to collect all five answers."`
3. **不设"必须在几轮内问完"这种进度指标**——这也是容易滑向"写死"的地方,不要为了"5W2H 覆盖率"去追问,只在"agent 原本会重复自己"这个具体触发点上介入。没有重复的风险,就不要额外插入话题。
4. **仍然保留"退出信号"识别**:客户明显不想展开(答非所问、转移话题、说"等一下"),不要在这轮硬塞角度进去。
5. **上线方式同原方案**:先只记录模型会怎么选、不真的发出去,人工抽查几天判断是否自然、有没有该识别重复却没识别、该换角度却生硬的情况,质量过关再真正启用。

## 验证

- 阶段一:新增测试覆盖 `destination_port`/`quantity`/`payment_notes` 的抽取逻辑(客户消息包含港口名/数量表述/付款关键词时正确写入 `deal_state`,不包含时不写入、不报错)。部署后跑几个真实对话(可以用今天已有的对话重放),确认这些字段被正确记录,同时确认 agent 的回复语气/行为没有任何变化(这一阶段的验证重点恰恰是"什么都没变,只是记性变好了")。
- 阶段二:新增测试覆盖"卡单检测"逻辑(mock 不同的 `deal_state` 组合,断言只有同时满足 team_quoted + buying_intent_confirmed + 超过阈值 + 未发过提醒 的记录会触发通知)。部署后拿一个真实数据模拟(比如手动把某个测试 `deal_state` 的 `updated_at` 改到 2 小时前),确认真的收到 Telegram/WhatsApp 提醒。一周后回看:有多少笔"热单卡住"被这套机制捕获、CEO/同事实际跟进后转化了多少单——这是可以量化汇报的指标。
- 阶段三(重新设计版):
  - 反重复检查:新增测试覆盖 `possible_repeat_detected` 的判定逻辑(mock 最近 2 轮 agent 回复包含相同核心短语时命中,内容不同时不命中)。
  - 先按"只记录不发送"跑至少几天,人工抽查:(a) 命中重复检测的场景,模型换的角度是否自然、跟客户当前语境搭不搭;(b) 有没有该识别重复却没识别、或者不该介入却硬塞话题的情况。质量过关再真正启用。
  - 启用后第一周每天抽查几条真实对话,重点看有没有变成"变相清单式追问"(比如虽然每次只问一个,但连续好几轮都在问 5W2H 相关问题,让对话整体感觉像做调查)——这是要避免的偏离,不是只看单轮对不对。

**这一版仍然要等龙哥明确说"开始做"才让 Cursor 动手**——这次是重新对齐了目的,不是已经批准开工。

## Cursor 实施报告

<!-- 追加,不要覆盖之前记录 -->

- 已开始 2026-07-17 ~01:49 Asia/Shanghai（Cursor；本批做阶段一+二，阶段三不做）

### 完成报告 — 2026-07-17 ~01:52（Cursor）— 阶段一 + 阶段二

**状态**: 阶段一、二已落地；**阶段三未做**（需 CEO 明确点头且建议阶段一二跑 ≥1 周后再议）

**阶段一（被动记忆）**:
- 新模块 `apsales-closing-memory.mjs`：从客户原文抽 `destination_port` / `quantity` / `payment_notes`
- `rememberDealFromContext` 合并写入 `deal_state`（不改对客户话术）

**阶段二（热单卡住提醒人类）**:
- prompt JSON 增加 `buying_intent_confirmed`（语义判断，无关键词正则）
- 首次确认写入 `buying_intent_confirmed_at`
- bridge 循环内 `checkHotDealStalls`（默认静默 ≥2h 且 `team_quoted` + buying intent + 未提醒）→ Telegram + 加纳同事 WhatsApp 英文结构化提醒；写 `stall_alert_sent_at`；有新进展则清空可再提醒
- 部署脚本同步新模块

**验证**: `node --test tests/test_apsales_closing_memory.mjs tests/test_openclaw_parse_agent_reply.mjs` → 通过

**阶段三**: 未开工（禁止强制追问港口/数量/付款）

**生产 Release**: `REL-20260717015327-apsales-openclaw-61c87ee6b`（服务 active；boot 日志 internalStaffCount=1, hotDealStallMs=7200000）

- 已开始 2026-07-17 ~03:38 Asia/Shanghai（Cursor；仅阶段三重新设计版）

### 完成报告 — 2026-07-17 ~03:41（Cursor）— 阶段三（重新设计版）

**状态**: 已落地并部署（默认 dry-run）

**开工前 schema 核对（closing-flow 已落地，无冲突）**:
- 沿用 `payment_status` / `fulfillment_stage` / `destination_port` / `quantity` / `payment_notes` 等，**未**新增并行的 `closing_stage`
- 阶段三仅新增审计字段：`last_chat_angle` / `last_chat_angle_at` / `last_chat_angle_dry_run`

**阶段三做了什么**:
1. 硬性反重复：读最近 2 轮 agent 回复，holding/wait 类连续出现 → `possible_repeat_detected`
2. `uncovered_closing_angles`：基于已有港口/数量/付款笔记（+ why/when 会话向）列可选素材，不是必填清单
3. prompt：命中重复时最多带一个角度；退出信号则跳过；目标是成交推进不是调研
4. JSON `chat_angle_used`；默认 `APSALES_SOFT_ANGLE_SEND=false` → **只记录角度、不把 5W2H 问卷写进客户回复**
5. 新模块 `apsales-soft-angle.mjs`

**生产 Release**: `REL-20260717034033-apsales-openclaw-b06d732b4`  
boot 预期：`softAngleSend=false`

**验证**: soft-angle + parse + closing-memory 测试全部通过

**待 CEO**: 抽查几天 `apsales_soft_angle_dry_run` 活动日志后，若自然再开 `APSALES_SOFT_ANGLE_SEND=true`
