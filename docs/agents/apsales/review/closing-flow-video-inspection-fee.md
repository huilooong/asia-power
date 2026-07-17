# 成交流程改造:视频确认永远不跳过 + 买入意愿即时提醒 + 报价未接受的温和跟进

## 给 Cursor 的交付说明

**龙哥已批准开工(2026-07-17)。**

**这份文件和已经批准开工的 [[whatsapp-233-stage3-closing-design]] 共用同一块地基(`deal_state` schema、热单卡住提醒逻辑),两份文件都会改到 `bridge.mjs`/`apsales-closing-memory.mjs` 里同样的区域。建议顺序:先做这份文件(这份定义了"报价确认之后到底应该发生什么"),再继续做 stage3 阶段三(那份解决的是"等待期间怎么不车轱辘话"),后做的那份实现时要读一下这份文件此时的 `deal_state` schema 有没有变,不要两份各自加字段加出冲突。**

**这份文件是经过几轮来回纠正之后定的版本,不是第一版——如果看到本地/记忆里有更早的草稿(比如"先$50后尾款,单线流程,视频→检测费→上门检测"这种描述),以这份为准,那版理解错了。**

开始动手前,先在本文件最下面的「Cursor 实施报告」章节追加一行「已开始 <日期时间>」。做完把结果写进「Cursor 实施报告」(带日期,追加,不覆盖)。

## Context(2026-07-17,经龙哥几轮纠正后的最终理解)

### 核心事实 1:付款方式和履约流程是两条并行的线,不是一条线上的先后步骤

报价里 **$50 检测费永远单列**出来,客户自己选:

- **选项 A(分两次付)**:先付 $50 检测费 → 我们找货、上门检测 → 检测合格后再付尾款。
- **选项 B(一次付清)**:直接付全款(已经包含这 $50)。

**不管客户选哪种,我们内部的履约流程完全一样**——都要先找到实际这台货、安排检测、**发货之前必须给客户发视频确认**。区别只在于尾款是已经收了还是等确认后再收,**跟要不要检测、要不要发视频完全无关**。

**千万不要理解成"客户想付全款我们就不检测/不确认了"**——哪怕客户已经付清全款、很着急要发货,视频确认这一步照样不能省。理由:客户为了运一台机器过去要承担很大的运费成本,如果最后是一台不能用的机器,砸的是公司商誉,不是这一单的钱,不能因为钱已经到账就走捷径。

### 核心事实 2:检测不合格换机器,不重复收 $50;最终客户放弃,$50 不退(龙哥已确认)

- 上门检测不合格 → 帮客户找另一台机器,重复"找货 → 视频 → 检测",**不再收第二次 $50**。
- 客户最终决定不要了(比如换了好几台都不满意)→ 这 $50 **不退**,如果客户主动问,如实说明这是已经产生的检测服务成本,语气委婉,不用主动提这件事。

### 核心事实 3:买入意愿要即时提醒,不要等 2 小时批次检查

现有(已部署)的"热单卡住"提醒是 `confirmation_status===team_quoted` + `buying_intent_confirmed` + **2 小时**无进展才触发,这个继续保留,作为兜底安全网。但**客户明确表示要买、或者主动问付款方式的那一刻**,应该**立刻**通知,不是等 2 小时批次扫描——这是两件不同的事,一个是"买入意愿刚出现,马上让人知道",一个是"已经知道了但拖着没进展,提醒该跟进了"。

龙哥原本希望能直接打 WhatsApp 语音电话到 `+86 186 0377 3077`——查过现有 WhatsApp 会话代码,目前只有发文字/图片/位置/名片这些接口,**没有发起语音通话的能力**,而且这不是代码没写全,WhatsApp 自动化(不管官方 Business API 还是现在这套)普遍做不到程序触发语音呼叫。改成:即时发 WhatsApp 文字给这个号码 + 同时 Telegram 推送,双重保险,不等批次检查。

### 核心事实 4:报价发出但客户没接受/没回应,24 小时后有一次温和跟进——**目的是收集顾虑,不是催单**(2026-07-17 龙哥再次修正)

跟上面第 3 点不是一回事——这条是**主动联系客户**,不是提醒内部同事。触发条件:`confirmation_status===team_quoted` 但 `buying_intent_confirmed` 还没出现,且**距离最后一次对话超过 24 小时**。

**龙哥明确的定位:这条的核心目的不是"催客户下决定",是简单问一句客户的顾虑是什么,把顾虑收集下来,方便后续人工判断**(比如发现一批客户都卡在运费/时效上,能反映出来是不是要调整报价策略或者物流方案)。所以措辞上要把"问顾虑"作为主要内容,不是单纯"还在考虑吗"这种寒暄式确认——礼貌问候(按对方时区)之后,直接、温和地问一句具体是什么让他还没决定,类似:`Good morning! Just checking in — is there anything specific holding you back on the quote, like price or shipping time?` 不要写成销售话术、不带紧迫感措辞。

**只发一次,不要重复骚扰。** 客户如果回复了顾虑(不管是价格、时效、还是别的),要把这个原因**结构化记录下来**,不是只留在聊天记录里让人海底捞针——见下面改动 4 的具体做法。

**这类"主动找客户"的消息,`LIVE-RULES.md` 里之前有一条明确说过要单独评估、不能顺手塞进日常对话规则**(呼应之前被冻结的社媒自动加好友/发帖那类风险)。这次是龙哥明确要求要做的,范围严格限定在"同一个客户、同一次报价,最多发一次"——不要顺带把这个能力做成可以扩展到其它场景的通用"主动外呼"框架,只做这一个具体、范围很窄的场景。

## 改动范围

### 1. `deal_state` schema —— 拆成两条独立维度,不要用一条线性状态硬塞并行的东西

之前的草稿把付款和履约拧成一条线(`quoted → video_sent → inspection_fee_paid → ...`),这是错的,因为付款和履约是并行的两件事。改成两个独立字段:

**`payment_status`**(枚举):
- `unpaid`
- `inspection_fee_paid`(选了分两次付,已付 $50)
- `paid_in_full`(选了一次付清)
- `balance_paid`(分两次付的路径,尾款也付完了)

**`fulfillment_stage`**(枚举,跟 `payment_status` 完全独立,不因为客户付没付钱而跳步骤):
- `sourcing`(在找匹配的货)
- `video_sent`(视频已发给客户)
- `inspection_scheduled`(中国团队安排/进行中上门检测)
- `inspection_passed` / `inspection_failed`
- `ready_to_ship`(检测合格 **且** 该收的钱已经收齐——`paid_in_full` 或 `balance_paid`)

`inspection_failed` 时:`fulfillment_stage` 打回 `sourcing`,`payment_status` **不变**(不管是 `inspection_fee_paid` 还是 `paid_in_full`,都不因为换机器而重置或要求再付)。

其它字段:

- `inspection_fee_paid_at` / `paid_in_full_at`:时间戳,首次设置后不再变。
- `inspection_attempt_count`:每次进入 `inspection_scheduled` +1(不管第几台候选机器),用于以后统计,不是强制要求但顺手加。
- `inspection_result_history`:数组,记录每次检测结果(时间 + 合格/不合格 + 原因),不要覆盖丢掉之前的记录。
- `buying_intent_confirmed_notified_at`:首次对"买入意愿即时提醒"(见改动 3)完成通知的时间戳,防止同一个客户反复触发即时提醒。
- `quote_followup_sent_at`:24 小时温和跟进(见改动 4)发送过的时间戳,发过一次之后不再发第二次。
- `quote_decline_reason`:自由文本,客户回复"顾虑是什么"这个问题之后,提炼出的简短原因摘要(比如"价格偏高"/"运费+时效太长"/"还在比较其他供应商"),这是这条跟进消息**存在的主要目的**——收集下来给龙哥后续判断用,不能只留在聊天记录里。

这几个字段哪些是客户对话里能自然抽取的(比如客户说"视频收到了挺满意"可以推断进入下一状态),哪些只能靠团队人工在 WhatsApp 里录入(比如检测结果,子敬自己判断不了,必须来自团队),参照现有 `team_replies`(人工录入) vs `rememberDealFromContext`(对话抽取)两条已有路径分开处理,不要混。

### 2. `docs/zijing-training/LIVE-RULES.md` —— 补充 `## 成交推进`,不是删掉重写

**上一版方案说这条跟现有规则"矛盾、必须删掉重写"是理解错了**——"来办公室付款签合同"这个机制没有问题,只是现在要能覆盖两种情况(付 $50 或者付全款),而且不管哪种都要有"发货前发视频确认"这一步。在现有 `## 成交推进` 里追加,不是删除原句,核心要传达给子敬的判断逻辑:

- 报价 + 交易条件被客户接受后(`buying_intent_confirmed` 为真那一刻),说明接下来的流程:我们会先找到实际这台货、拍视频给他看;付款上他可以选先付 $50 检测费(找到货、检测合格后再付尾款),也可以直接一次付清(如果客户主动提出要全付,正常接受,不要以任何理由劝退或拖延)。
- **不管客户选哪种付款方式,视频确认 + 上门检测这两步都不能省**,哪怕已经收到全款——这条要写得斩钉截铁,不要留模糊空间,防止子敬因为"钱已经到账"就跳过确认环节。
- 检测结果必须来自团队人工录入,子敬不能自己判断或编造"合格/不合格"——呼应现有"永远不要编造"红线。
- 检测不合格 → 告诉客户"这台不合适,我们再帮你找一台",**同一笔 $50(或者已付的全款)继续有效,不需要客户再付一次**。
- 客户中途想放弃 → 按现有"没关系我们随时在"的口吻,不用主动提退款(政策是不退),客户主动问才委婉说明。

### 3. 买入意愿即时提醒(新增,独立于现有的 2 小时热单卡住机制)

在 `bridge.mjs` 主回复路径里(参照现有 `notifyGhanaStaffIfHandingOff`/`notifyGhanaStaffSupportLineUnreachable` 那种 fire-and-forget 内联调用模式,不要用定时轮询),`generated.buyingIntentConfirmed === true` 且这是**这个客户第一次**出现该标志(检查 `dealState.buying_intent_confirmed` 之前是不是还没设置过,避免每轮都重复通知)时:

- 立刻 `session.sendText` 一条 WhatsApp 文字到 `+8618603773077`。
- 同时 `sendTelegram` 一条。
- 两条都写清楚:客户号码、确认的报价内容、客户刚才说的原话。
- 写入 `buying_intent_confirmed_notified_at`,防止重复触发。

这一条和现有的 2 小时"热单卡住"安全网(`checkHotDealStalls`)是互补关系,不是二选一——即时提醒解决"第一时间让人知道",2 小时兜底解决"知道了但没人跟进"。两个都要保留。

### 4. 报价未接受的 24 小时温和跟进(新增,客户侧消息,不是内部提醒)

新增一个跟 `checkHotDealStalls` 类似结构但独立的检查函数(可以放在同一个轮询周期里,不用新建 cron):扫描 `deal_state`,找出满足以下全部条件的:

- `confirmation_status === 'team_quoted'`
- `buying_intent_confirmed` 不为真(客户还没明确表示要买)
- 距离客户最后一条消息(不是 `updated_at` 泛指,要精确是客户发的最后一条消息时间)超过 24 小时
- `quote_followup_sent_at` 还没设置过(只发一次)

命中后,生成一条符合前面给的示例语气的消息(按对方时区礼貌问候 + 直接、温和地问具体是什么顾虑),通过 `sendCustomerText` 直接发给客户,写入 `quote_followup_sent_at`。

**这条消息建议用 LLM 生成(不是写死模板)**,但要给足够窄的约束(参照上面示例的语气、长度、不带紧迫感措辞、核心内容是问顾虑不是问"还要不要"),生成后可以先记录不真发、人工抽查几条效果自然再启用——跟之前阶段三"先记录不发送"验证的思路一致,这类新增的主动对客户发消息的能力,上线前格外要谨慎。

**收集顾虑的具体做法**(这条消息真正的目的,不能只发出去就完事):发送这条跟进消息之后,`deal_state.quote_followup_sent_at` 已经设置。客户回复的下一条消息进来时,`bridge.mjs` 的 structured context 里加一个信号(比如 `awaiting_quote_followup_reply: true`,判断依据是 `quote_followup_sent_at` 已设置且 `quote_decline_reason` 还没有值),让 LLM 判断这条回复是不是在回答"顾虑是什么"——参照 `buying_intent_confirmed`/`support_line_unreachable` 已经在用的模式,加一个 JSON 返回字段 `quote_decline_reason_captured`(客户如果说了具体原因,提炼成一句简短摘要;客户如果没提原因或者答非所问,留空/不设置),`bridge.mjs` 收到后写进 `deal_state.quote_decline_reason`。**这个判断交给模型做语义提炼,不要写关键词正则去匹配"价格/运费/时效"这几个词**——客户可能会用完全不在预设列表里的话表达顾虑,交给模型总结更准。

暂时不需要为这些收集到的原因单独建一个汇总报表——先确保数据可靠地进了 `deal_state`,以后龙哥要看汇总(比如"这个月客户主要卡在什么原因"),可以直接扫描所有 `deal_state` 文件按 `quote_decline_reason` 统计,不用现在就为这个建专门的报表功能。

## 验证

- `deal_state` 新增字段:测试覆盖 `payment_status` 和 `fulfillment_stage` 两条独立维度不会互相干扰(比如 `paid_in_full` 之后 `fulfillment_stage` 依然从 `sourcing` 正常走到 `inspection_scheduled`,不会因为已经付款就跳过);`inspection_failed` 后 `fulfillment_stage` 回到 `sourcing` 但 `payment_status` 不受影响;`inspection_fee_paid_at`/`paid_in_full_at` 只设置一次不被覆盖。
- LIVE-RULES.md 改完后,构造测试场景:客户主动要求付全款,断言 agent 依然会说明视频确认/检测流程,不会因为客户想付全款就跳过或者劝退。
- 买入意愿即时提醒:新增测试覆盖只在**首次**出现 `buying_intent_confirmed` 时触发,同一客户后续轮次不重复通知;断言同时调用了 WhatsApp 发送和 Telegram 发送。
- 24 小时跟进:新增测试覆盖触发条件(`team_quoted` 且未确认买入意愿且超过 24 小时且未发送过);断言只发一次,`quote_followup_sent_at` 设置后同一客户不会再触发第二次;人工抽查生成的跟进消息语气是否符合"礼貌问候 + 直接问顾虑"这个约束,不能变成带紧迫感的推销话术,也不能只问"还考虑吗"而不问具体原因。
- 顾虑收集:新增测试覆盖 `quote_decline_reason_captured` 的解析(mock LLM 返回带原因/不带原因两种情况,断言只有带原因时才写入 `deal_state.quote_decline_reason`);部署后人工验证一次真实场景——发送跟进消息后用测试号回复一个具体理由(比如"价格有点贵"),确认 `deal_state` 里正确记录了这个原因摘要。
- 端到端:模拟两条路径分别走一遍——(a)客户选分两次付:报价确认→即时提醒触发→找货→发视频→付$50→检测→不合格→换机器不重复收费→检测合格→付尾款→ready_to_ship;(b)客户选一次付清:报价确认→即时提醒触发→付全款→找货→发视频→检测(即使已付全款也照常走)→合格→ready_to_ship。两条路径都要人工确认 `deal_state` 变化和 agent 话术符合预期。

## Cursor 实施报告

<!-- 追加,不要覆盖之前记录 -->

- 已开始 2026-07-17 ~03:19 Asia/Shanghai（Cursor）

### 完成报告 — 2026-07-17 ~03:24（Cursor）

**状态**: 已落地并部署

**生产 Release**: `REL-20260717032220-apsales-openclaw-942e092dd`  
boot: `buyingIntentNotifyE164=+8618603773077`, `quoteFollowupSend=false`（24h 跟进默认 dry-run）, listener connected

**做了什么**:
1. `deal_state` 并行维度：`payment_status` + `fulfillment_stage`（付全款也不跳过视频/检测；`inspection_failed`→sourcing 且付款不变）
2. `LIVE-RULES.md`「成交推进」追加：两种付款选项、视频+检测不可省、$50 换机不重收、放弃不主动提退款
3. 买入意愿**即时**提醒：首次 `buying_intent_confirmed` → WhatsApp `+8618603773077` + Telegram（保留原 2h 热单卡住兜底）
4. 报价未接受 24h 温和跟进：问顾虑（非催单）；默认 **dry-run 不真发**；客户回复经 `quote_decline_reason_captured` 写入 `quote_decline_reason`
5. 团队 WhatsApp 文案可推进：`video sent` / `inspection passed|failed` / `$50 paid` 等

**验证**:
- 单元测试 closing-memory + parse：全部通过
- 生产 dry-run 已命中一例预览：`+233543596750`（未发给客户）

**待 CEO 决定**:
- 抽查 dry-run 文案后，若要真发给客户：systemd/环境设 `APSALES_QUOTE_FOLLOWUP_SEND=true` 后重启 bridge（或再跑一次 openclaw 部署）
- 端到端两条付款路径仍建议人工走一遍确认话术

**未做**: stage3 阶段三软追问（按方案顺序，本文件优先；阶段三仍须另批）
