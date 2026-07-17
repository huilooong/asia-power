# 报价前先问 VIN/年份/发动机代码(结构化字段,不是加一条规则) + bridge.mjs 崩溃看护

## 给 Cursor 的交付说明

**两件独立的事,分开做完分开写报告:**

- **A(优先级最高,真实事故,今天已经影响真实客户)**:这条"报价前先问 VIN 或年份+发动机代码"**不要**以再加一条 prompt 规则文本的方式修——`bridge.mjs` 的 prompt 已经有 30 多条 "Hard style rules" bullet 外加整份 `LIVE-RULES.md` 大文本,规则本身早就写在里面了,这次是模型在一堆并列指令里漏看了这一条,不是规则缺失。再加一条 bullet 治标不治本,下次换个场景大概率还会漏别的——**规则单子只会越滚越大,不会让模型更可靠**。改成用代码算一个结构化布尔字段(`must_qualify_before_price`),参照这个系统里已经在用的 `needs_price_confirmation`/`support_line_unreachable`/`buying_intent_confirmed` 这几个字段的路数——判断逻辑放代码里,模型只服从一个算好的旗标,不用自己在文字堆里判断"这轮该不该问"。
- **B**:给 `bridge.mjs` 加进程看护,崩了/异常退出自动重启,并且崩溃时通知到人(区分"进程崩了"和"WhatsApp 会话掉线"这两种不同情况,处理方式不一样)。
- **C(优先级同样高,同一天另一个真实事故)**:$50 检测费流程被套用到了不该套用的配件上(真实案例:客户要 Honda Civic 后视镜,机器人报了 $50 检测费)。跟 A 一样,不是往规则里加文字,是加一个代码算好的布尔字段(`inspection_fee_applicable`,只有 `part_intent` 是发动机/变速箱时才为 true)。
- **D(只做一半——另一半需要龙哥先给数据,不要自己猜)**:报价前必须先问客户要的数量,数量决定批发价还是零售价。这条现在完全没有,`LIVE-RULES.md` 里唯一提到数量的地方(第 22/112 行)写的是相反方向("客户自己提,不要子敬硬拽"/"没别的可问才问数量"),要改成报价前必问。**但是**——批发价具体怎么算(多少件起算批发、批发价相对零售价打几折或者怎么定),现在整个代码库里没有任何这类逻辑,这部分**不要凭空编**,只做"报价前必须先问数量"这一半(用 D 类似字段的方式,不是加规则文字),批发/零售两档定价的具体数值和阈值,实施报告里写清楚"等龙哥提供具体规则",不要自己拍一个数字上去。

开始动手前,先在本文件最下面的「Cursor 实施报告」章节追加一行「已开始 <日期时间>」,注明做的是 A/B/C/D 哪一项。做完把结果写进同一章节(带日期,追加,不覆盖)。

## Context

2026-07-17,+233 线因为 WhatsApp 关联设备被清空掉线,龙哥要求立即修复(过程见对话记录,最终通过重新扫码关联恢复,不在这份方案范围内)。恢复后几分钟内,一个真实客户("Mercedes Benz C 180 diesel engine",电话 +233264138814)发来第一条消息,子敬(销售 agent)的回复直接跳到"我去跟团队确认价格",完全没问年份、没问发动机代码、没问 VIN。龙哥当场发现:"为什么他又不问底盘号了,不问年份,不问发动机型号,直接说确认价格,这是严重事故"。

排查确认:`docs/zijing-training/LIVE-RULES.md` 里明确写着这条规则(约在"价格与单位"一节):

> 问价时：推进成交，不要停在 "cannot quote"；先要 VIN 或 model+year+engine code；**禁止编造价格数字**。

`bridge.mjs` 构造给模型的 prompt 时,确实把整份 `LIVE-RULES.md` 当一大段文本贴进去了(`liveRules` 变量,追加在 "CEO LIVE-RULES (highest priority style/commercial rules)" 标题下),规则文字本身**没有丢**。但前面单独列出来的那份"Hard style rules"(bullet list,比如"Ask at most ONE missing question"、"inventory_matches 有匹配就报 exact price_usd"、"没匹配就说去确认团队,别编价格")模型执行得很稳——这次真实案例里,模型确实老老实实执行了"没有库存匹配就不编价格,说去确认团队"这条硬规则,但同时把"该问 VIN/年份/发动机代码"这条(混在后面一整段大文本规则里)漏掉了。**结论:不是规则丢了,是规则的"权重"不够——放在越来越长的规则堆里,单条规则的执行率只会越来越不稳定,靠"再加一条"补不完。**

## A. 结构化字段替代 prompt 规则堆(优先级最高)

### 为什么不是再加一条 prompt 规则

`bridge.mjs` 现在的 prompt 已经是 30+ 条 "Hard style rules" + 整份 `LIVE-RULES.md` 大文本,这次真实事故本身就是"规则数量太多、模型顾此失彼"的直接证据。继续用"再加一条 bullet"的方式修,治的是这一次的症状,治不了这个模式——规则单子会持续膨胀,每次新增都在稀释所有旧规则的执行率,是在制造下一次同类事故,不是在防止它。

这条具体规则("有没有 VIN/年份/发动机代码"决定"这轮能不能提报价")本质是**可以用代码精确判断的事实**,不该丢给模型在文字堆里自己判断。这个系统里已经有成熟先例——`needs_price_confirmation`、`support_line_unreachable`、`buying_intent_confirmed` 都是代码算好、以布尔字段形式喂给模型,模型只需要服从/引用这个字段,不需要自己判断"这个情况该不该设"。这条规则应该走同一条路。

### 改动

在 `deploy/apsales-live-draft/bridge.mjs` 里,构造喂给模型的结构化 context 那一段(`needs_price_confirmation` 等字段所在的地方,大约在 prompt 数组末尾拼 JSON context 的位置),新增一个代码计算出的字段:

```js
const hasIdentifyingInfo = Boolean(
  dealState?.vin || dealState?.frame_no || (dealState?.year && dealState?.engine_code)
);
const mustQualifyBeforePrice = Boolean(dealState?.part_intent) && !hasIdentifyingInfo;
```

(具体字段名以 `deal_state` 现有 schema 为准——先确认 `year`/`engine_code` 这两个字段现在是否已经在 `deal_state` 里被结构化提取和保存;如果目前只有 `vin`/`frame_no`/`part_intent`/`transmission` 这几个字段、`year`/`engine_code` 还没被单独提取保存,这一步需要先补上——参照 `apsales-closing-memory.mjs` 里 `extractClosingFieldsFromText()` 那一类文本提取逻辑,加一个 `year`/`engine_code` 的提取规则,写进 `deal_state`。这个前置工作如果发现工作量超出预期,先在实施报告里说清楚,不要为了赶进度囫囵吞枣。)

把这个字段传给模型(和 `needs_price_confirmation` 那些字段放在同一个 JSON context 里),然后在 "Hard style rules" 里只加**一条**、紧挨着解释这个字段怎么用的指令(不是新增一条独立判断逻辑的规则,是"服从一个已经算好的旗标"):

> `must_qualify_before_price` is a precomputed flag. If true, your ONLY question this turn must ask for year + engine code (or VIN) — do NOT say you will check price/availability with the team this turn. If false, proceed normally per the other rules above.

**不要删除或改写 `liveRules` 那段大文本的拼接逻辑**,那段文本仍有细节措辞/例外情况的参考价值,不用去重。

### 验证

- 构造一个 mock 场景:`deal_state` 为空(全新客户),customer 消息只给了"品牌+车型"(没有年份/发动机代码/VIN,比如复现今天这个真实案例"Mercedes Benz C180 diesel engine"),断言算出的 `mustQualifyBeforePrice` 为 `true`,且模型回复里包含"年份"或"发动机代码"或"VIN"相关的追问,而不是直接说"我去确认价格/库存"。
- 再测一个 `deal_state` 已经有 `vin` 的场景,断言 `mustQualifyBeforePrice` 为 `false`,不会被误伤要求重新问 VIN(复用现有"NEVER ask for VIN again"的测试用例,确认新字段和这条不冲突)。
- 用今天这个真实案例(+233264138814,"Mercedes Benz C 180 diesel engine")做一次真实回归测试,确认新逻辑生效后,同样的输入不会再复现今天这个事故。
- 跑一遍现有 sales_coach / regression_rules 相关测试,确认没有破坏已有的 A/B/D 类检测(见 `sales_coach/regression_rules.py`)。

## C. $50 检测费只适用于发动机/变速箱(优先级最高,真实事故)

### Context

2026-07-17,客户 +212660203497 询问 "rétroviseur droit de Honda Civic 2007"(Honda Civic 后视镜),团队手工报价后,子敬在 13:11 的回复里说:"Les 50 USD couvrent les frais d'inspection. Après paiement, nous filmerons la pièce et ferons une inspection sur place avant l'envoi"——把 $50 检测费流程套到了一个后视镜上。龙哥当场指出:"检测费仅使用于发动机变速箱"。

排查确认根因在规则本身,不是模型编的:`docs/zijing-training/LIVE-RULES.md`(约第 94 行)和 `bridge.mjs` 里对应的硬规则("Payment and fulfillment are parallel: $50 inspection fee OR pay-in-full...")都是**无差别适用于任何报价成交场景**,完全没有按配件类型区分——发动机/变速箱这种几千上万美元的大件,$50 检测费合理;后视镜这种几十上百美元的小件,$50 检测费本身就不成比例,规则写的时候没考虑这个区别。

### 改动

跟 A 用同一套模式,不是改规则文字,是加一个代码算好的字段:

```js
const HIGH_VALUE_PARTS = new Set(["engine", "gearbox"]); // 与 PARTS 定义/deal_state.part_intent 的取值对齐,具体值以现有 part_intent 枚举为准
const inspectionFeeApplicable = HIGH_VALUE_PARTS.has(String(dealState?.part_intent || "").toLowerCase());
```

(`part_intent` 的具体枚举值——是不是就是 "engine"/"gearbox" 这两个,还是有别的写法——以 `bridge.mjs`/`apsales-closing-memory.mjs` 里现有 `extractClosingFieldsFromText()` 或类似字段提取逻辑的真实取值为准,不要凭空假设,先读代码确认。)

把这个字段加进喂给模型的结构化 context(和 `must_qualify_before_price`、`needs_price_confirmation` 放一起),然后把 "Payment and fulfillment are parallel: $50 inspection fee..." 这条硬规则改成引用这个字段,大意:

> `inspection_fee_applicable` is a precomputed flag. Only mention the $50 inspection fee / pay-in-full choice when this is true. If false (part is not engine/gearbox), skip the $50 inspection fee language entirely — after quote acceptance, proceed with normal payment-in-full flow, still keep video confirmation before shipment (that part is not being removed, only the $50-fee-specific language is gated by this flag).

**注意**:视频确认这一条("video confirmation before shipment...never skipped")龙哥没有说要改,只是说 $50 检测费不该用在小件上——不要把整条"视频确认+上门检测"规则也一起限定成只有发动机/变速箱才做,只限定 $50 检测费这一个具体动作。如果对这个边界有疑问(比如视频确认要不要也按件值分级),实施报告里写清楚问题,不要自己猜一个答案改掉。

**同步更新 `docs/zijing-training/LIVE-RULES.md` 第 94 行附近那条规则的文字**,加上"仅发动机/变速箱适用"这个限定,保持文档和代码逻辑一致(呼应今天前面发现的"LIVE-RULES.md 和代码不同步"这个教训,不要只改代码不改文档)。

### 验证

- 构造 mock 场景:`part_intent` 为 `"mirror"`(或其它非发动机/变速箱配件)、报价已确认成交,断言 `inspectionFeeApplicable` 为 `false`,回复里不出现 "$50"/"inspection fee" 字样。
- 构造 mock 场景:`part_intent` 为 `"engine"`,同样场景,断言 `inspectionFeeApplicable` 为 `true`,$50 检测费话术正常出现。
- 用今天这个真实案例(+212660203497,Honda Civic 后视镜)做回归测试,确认新逻辑生效后不再复现。
- 确认视频确认/上门检测那部分规则没有被误伤,发动机/变速箱和小件都还是要走视频确认(除非龙哥后续明确说要改)。

## D. 报价前必须先问数量(只做一半,批发定价数值等龙哥给)

### Context

龙哥 2026-07-17 指出:"为什么还是没有问客户需要的数量,这是报价前的关键环节,决定是否给客户批发价还是零售价"。查了 `LIVE-RULES.md`:

- 第 22 行(成交三段论第三段):"目的地/付款方式/数量,临门一脚。通常客户自己会在这个阶段主动问...**不要子敬硬拽**"——现在写的是"等客户自己提",跟龙哥要的"报价前必须问"是反方向。
- 第 112 行:"如果确实没有别的可问,改问数量"——数量现在是**兜底问题**,不是前置问题。
- 全代码库搜索确认:`deal_state.quantity` 字段存在,但只是被动记录客户自己说的数量,**没有任何代码逻辑会根据数量切换批发价/零售价**——批发/零售两档定价这件事目前完全不存在。
- 现有唯一的"批发信号"识别规则(第 19 行:"客户同一对话里问了 3 个以上不同型号 → 批发信号")判断的是"问了几种型号",跟"要几个同一个东西"是两回事,不能互相替代。

### 改动(只做这一半)

1. 把 `LIVE-RULES.md` 第 22 行那条改成:报价前(或报价的同一轮)必须问数量,不要等客户自己提——具体措辞参照 A/C 的模式,不要写成一条孤立的规则文本,按现有 `needs_price_confirmation` 那套路数,加一个类似 `quantity_confirmed`(或类似命名,以 `deal_state.quantity` 是否已有值为准)的字段,模型服从这个字段决定要不要问。
2. 第 112 行"没别的可问才问数量"这句需要同步改掉或者删除,不然会跟新加的"报价前必问"自相矛盾。

### 明确不做的部分(等龙哥给规则,不要自己编)

**批发价 vs 零售价具体怎么算,这次不做**——多少件起算批发、批发价是打几折还是有独立的价格表、跟现有"自主最多降价 5%"这条规则是什么关系,这些数值和规则龙哥没有给,**不要猜一个逻辑填上去**。这一部分只需要在实施报告里写清楚"数量已经能问到并且存进 `deal_state.quantity`,批发定价规则等龙哥后续提供后再做第二阶段",把接口(`deal_state.quantity` 这个字段)留好、能被下一阶段直接读取到就行。

### 验证

- 构造 mock 场景:`deal_state.quantity` 为空、报价条件已经具备(比如库存匹配到了、或者团队已经手工报了单价),断言模型这轮会问数量,不会跳过直接报价确认。
- 构造 mock 场景:客户已经说过数量(`deal_state.quantity` 有值),断言不会重复问。
- 确认第 19 行"3 个以上不同型号 = 批发信号"这条没有被误改,数量和型号数是两条独立信号,不要合并成一条。

## B. bridge.mjs 崩溃看护

### Context

`bridge.mjs` 目前是裸 `node bridge.mjs` 进程(今天排查时确认过:没有 pm2,没有 systemd service),今天为了修复 WhatsApp 掉线问题手动 kill 过一次、又手动重启过一次——如果它自己意外崩溃(不是掉线,是进程本身挂掉,比如未捕获异常),不会自动恢复,也不会有人知道,客户消息会在没人察觉的情况下完全没有回复。

**注意区分三种不同故障,不要用同一套逻辑处理:**

1. **进程崩溃**(node 进程本身退出/未捕获异常):应该自动重启,重启后能自愈,不需要人工介入,但应该通知一下(避免频繁崩溃被忽略)。
2. **WhatsApp 会话掉线/被登出**(进程本身没死,但连不上 WhatsApp,比如今天这次"关联设备被清空"):自动重启**没用**——旧凭证已失效,重启只会不断重连失败,必须人工重新扫码关联(参照今天的处理过程)。这种情况不能被当成"进程崩了自动重启"来处理,必须单独识别并发出"需要人工重新关联"这种明确提示,不要让看护脚本陷入无意义的重启死循环。
3. **会话冲突(status 440 / "Stream Errored (conflict)")**:同一个 +233 账号被第二个会话(比如某台电脑上开着的 web.whatsapp.com 或桌面版)顶替,`bridge.mjs` 每次被顶掉后会自己在几秒内重连成功——**这一种进程本身没死、也不需要重新扫码**,和前两种都不一样,但也不能什么都不做:重连的几秒空档期内到达的客户消息会失败且**不会自动补发**,今天真实发生过(2026-07-17 12:20-12:25,6 条客户消息在冲突期间彻底丢失,人工手动回复兜底的)。

### 要做的事

1. 给 `bridge.mjs` 配一个 systemd service(单元文件放 `/etc/systemd/system/`,命名建议 `apsales-bridge.service`),`Restart=on-failure`,加合理的重启间隔限制(比如 `RestartSec=10`、`StartLimitBurst`/`StartLimitIntervalSec` 防止死循环狂重启)。
2. 把当前手动裸跑的进程迁移到这个 systemd service 管理,确认 `authDir`、环境变量(参照 `bridge.mjs` 启动时打的那些 flag,比如 `APSALES_QUOTE_FOLLOWUP_SEND` 等)在 systemd 环境下能正确传递(检查现有是否有 `.env` 文件或者需要写进 unit 文件的 `Environment=`)。
3. 加崩溃通知:进程被 systemd 重启时(`OnFailure=` 或者简单在 unit 里加一个通知脚本),发一条 Telegram 消息给龙哥(复用现有 Telegram bridge,比如 `asia-power-telegram-whatsapp.log` / `@weylonbot` 那条通道,不需要新建通知渠道)。
4. 加"WhatsApp 会话掉线"专项检测:`bridge.mjs` 现有代码里应该能拿到 Baileys 的 `connection.update` 事件(参照今天排查时看到的 `getStatusCode(lastDisconnect?.error) === LOGGED_OUT_STATUS` 这个判断逻辑,在 `/root/.openclaw/extensions/whatsapp/dist/session-CoxlXm2K.js` 里能看到类似写法)。如果检测到状态码 401(logged out),不要让 systemd 无脑重启进程,而是发一条**明确写清楚"需要人工重新扫码关联,不是进程故障"**的 Telegram 通知,附上今天验证过可行的重新关联操作方式(SSH 到服务器跑重新生成二维码的脚本,人工用手机扫)。
5. 加"会话冲突"专项检测:识别状态码 440(参照 `bridge.mjs` 现有日志里 `"WhatsApp QA driver connection closed (status 440): Stream Errored (conflict)"` 这条真实日志),如果短时间内(比如 10 分钟内)反复出现多次 440,发一条 Telegram 通知,内容明确写清楚"疑似有人在其他设备/浏览器登着同一个 WhatsApp 账号,请检查并登出多余会话",不要和"需要重新扫码关联"那条通知混为一谈——这条是"找到并登出多余会话"，不是"重新配对"。
6. **失败消息自动补发**:`bridge.mjs` 现在 "handler failed" / "fallback send failed" 之后,这条客户消息就彻底丢了,重连成功后不会自动重新处理。改成:断线期间(或发送失败时)记录下失败的 `messageId`/`senderId`(简单写一个内存队列或者小文件都行,不用做复杂持久化),`listener connected` 事件触发、确认连接恢复正常后,自动对队列里的消息重新走一次正常回复流程(相当于当作这条消息刚刚才到达)。今天这 6 条消息如果有这个机制,应该能自动补上,不需要人工手动回复兜底。

### 验证

- 手动 `kill -9` 一次 bridge.mjs 进程,确认 systemd 在几秒内自动拉起,且 Telegram 收到通知。
- 模拟(或者等下次真实复现)WhatsApp 会话掉线场景,确认走的是"发通知要求人工重新关联"这条路径,而不是无意义的无限重启。
- 模拟连续多次 440 冲突,确认走的是"检查多余会话"这条独立通知路径,不跟前两种混淆。
- 模拟一条消息在断线窗口期到达并失败,确认 `listener connected` 之后这条消息被自动补发处理(有正常的 openclaw reply sent 记录),不需要人工介入。
- 确认 systemd service 开机自启(`systemctl enable`),避免服务器重启后忘记手动拉起。

## Cursor 实施报告

<!-- 追加,不要覆盖之前记录 -->

- 已开始 2026-07-17 ~23:08 Asia/Shanghai（Cursor；做 A+C+D+B 全项）
