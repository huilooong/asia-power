# Coach LLM 对照 LIVE-RULES 审查 — 2026-07-16（greeting 误报修正重跑）

> Coach 只判断「是否符合已写好的规则」，给出证据。不代写规则、不改生产。

## 对比（修前 round1 → 本报告）

| 指标 | round1 | 本报告（greeting-fix） |
|---|---:|---:|
| LLM 调用 / turns 送审 | 25 / 236 | 25 / 236 |
| 违规总数 | 88 | 68 |
| 标题含「禁止开场」 | 16 | 1 |
| 其中对「Hi!/Hello!」等裸问候的过宽误报 | ~15 | 0 |
| 真实命中所列短语（如 `Hi there.`） | 1 | 1（保留） |

对照基线：`docs/agents/apsales/coach/2026-07-16-llm-audit-round1.md`

其它类别扫一眼：未见「每条报价必须带官网」这类发明规则的新误报潮；电话/VIN 重问/等待话术等高价值类仍在。

## 覆盖与成本

- 时间窗: 过去 2 天（默认只审新增，跳过已审 evidence_id）
- 会话数(LLM 调用): 25
- turns 送审: 236
- 跳过已审 turns: 0
- 模型: `gpt-4.1-mini`
- 估算花费: ~25 chat completions (1 per customer thread). No $ meter in-process — check OpenAI usage dashboard.
- parse/API 错误会话: 0

## A. 违规（对照 LIVE-RULES）

### [ev-2026-07-15T134430213Z-7ffba990] `禁止编造价格、付款、地址` （confidence=high）
- 客户:「👉4 WHEEL DRIVE ( 4 WD) 

👉 TOYOTA RAV4 ( SPORT)」
- 回复:「Yes, Chief. We have the 4WD gearbox for your Toyota RAV4 2AZ-FE. The total price for the engine and gearbox set is 1280. You can visit our Accra office to sign 」
- 原因: 回复中给出了具体价格数字1280且包含付款地址，但规则要求‘禁止编造价格’和‘报价时禁止透露未确认的价格数字’；同时未明确说明是FOB/EXW等条件，存在价格信息不规范风险。

### [ev-2026-07-15T134755506Z-b440ebfa] `库存与地点` （confidence=medium）
- 客户:「In Ghana,  we are in the Afternoon time....the time is ( 1:46 pm) in the afternoon」
- 回复:「Got it, Chief. Our team in China will prepare for testing the 2AZ-FE engine for you tomorrow morning and send a video. Your local time in Ghana is noted.」
- 原因: 回复中未明确说明货品在中国发货、需海运45-60天，暗示可以当下准备测试视频，但未说明物流情况，存在客户对货源和时效误解的风险。

### [ev-2026-07-15T142624208Z-c499c26a] `三段式信息收集 - 第一段锁定（Which + What）` （confidence=high）
- 客户:「」
- 回复:「」
- 原因: 客户询问‘pins数量’，代理回复要求客户提供VIN或型号，这重复问VIN或模糊需求，客户已经给出车型和发动机类型，应直接推进具体关键细节确认而非重复请求VIN，容易降低客户信心。

### [ev-2026-07-15T144231320Z-b73940ec] `三段式信息收集 - 第一段锁定（Which + What）` （confidence=high）
- 客户:「👉CAR NAME: TOYOTA RAV4( 4 WHEEL DRIVE ( 4WD) SPORT 

👉 AUTOMATIC 

👉 TYPE OF FUEL USED: PETROL 

👉4 WHEEL DRIVE ( 4WD)

👉 ENGINE TYPE: ( 2AZ - FE ENGINE)

👉YEAR」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: 客户已给出详细车型、年份及发动机信息，代理仍旧回复要求客户提供VIN或车型重复询问，存在重复问VIN问题，违反‘客户明确车型+发动机+年份后不要再问VIN’规则。

### [ev-2026-07-14T223415420Z-426f85cd] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「✅」
- 回复:「My team will get back to you soon with the prices. If you need to speak to someone directly, you can call 054 913 5916.」
- 原因: Agent prematurely gave the local phone number (054 913 5916) without the customer explicitly requesting direct contact or the agent being stuck after attempts to understand the customer's needs, violating the rule forbidding casually giving the phone number as first reaction.

### [ev-2026-07-14T223513571Z-1b09d004] `身份与 VIN - 不要重复问 VIN 或车型等已确认信息` （confidence=high）
- 客户:「[customer sent an image]」
- 回复:「Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?」
- 原因: Customer already provided model and year (2013 Hyundai Santa Fe), and requested parts before; agent asks again for a clearer photo of the VIN/frame number repeatedly (also in ev-2026-07-14T223554371Z), which is discouraged once sufficient vehicle identification info is given.

### [ev-2026-07-14T223554371Z-0478b0ce] `身份与 VIN - 不要重复问 VIN 或车型等已确认信息` （confidence=high）
- 客户:「[customer sent an image]」
- 回复:「Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?」
- 原因: Agent repeated the request for a clearer photo of the VIN/frame number just after the previous message, causing redundant questioning that may annoy customer.

### [ev-2026-07-14T223918984Z-dcceed14] `声音 - 同一对话里不要用"still checking / still waiting"这类等待话术反复表达同一个意思` （confidence=medium）
- 客户:「I need the picture」
- 回复:「Yes, I understand. My team is working on getting both the pictures and the prices for you.」
- 原因: Agent repeats similar waiting phrases about team working on pictures and prices, adding redundancy without progressive info, which is disallowed.

### [ev-2026-07-15T000433872Z-56c1b9ce] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「I don’t need this please」
- 回复:「Okay, we will let you know when we have information for your requested parts. You can call 054 913 5916 if anything changes.」
- 原因: Agent gives local phone number again without clear customer request or indication that escalation is needed, violating the phone number sharing rule.

### [ev-2026-07-15T091530078Z-d3f5630c] `库存与地点 - 要明确说明库存在中国海运，不能让客户误以为本地有货` （confidence=medium）
- 客户:「I will go and get it myself in Accra」
- 回复:「Our inventory is in China, not Accra, so parts ship by sea freight, which takes 45-60 days. You can check our stock at www.asia-power.com. What part are you loo」
- 原因: Agent correctly clarifies no local stock and that parts ship from China with 45-60 days sea freight, which aligns with the rule to avoid misleading customers about local stock.

### [ev-2026-07-14T183650599Z-6abd75f6] `身份与 VIN` （confidence=high）
- 客户:「You have this ☝️」
- 回复:「Hello. What specific item are you looking for?」
- 原因: 客户已提供车架号，且之前已明确需求整车发动机，不应再次问‘Hello. What specific item are you looking for?’重复确认需求，导致客户可能不耐烦。

### [ev-2026-07-14T184140220Z-0ff288df] `身份与 VIN` （confidence=high）
- 客户:「[customer sent an image]」
- 回复:「Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?」
- 原因: 客户刚刚确认了车架号且明确了需求，回复却重复请求清晰VIN照片，等于重复问VIN，违反已确认VIN后不再追问VIN规则。

### [ev-2026-07-14T185238842Z-35cbf677] `身份与 VIN` （confidence=high）
- 客户:「[customer sent an image]」
- 回复:「Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?」
- 原因: 客户多次已给车架号，但回复再次说‘I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number?’重复要求VIN，容易造成客户不耐烦且是规则禁止的行为。

### [ev-2026-07-15T141757850Z-3a4bbaab] `声音` （confidence=medium）
- 客户:「What the new ?」
- 回复:「I'm still confirming the engine price for your 2003 Nissan with the team. I will send it once it's ready.」
- 原因: 多次使用等待话术‘still confirming the engine price’，重复表达‘确认中’语义，违反‘同一对话轮次避免重复等待话术’规则。

### [ev-2026-07-15T141811728Z-6983b2ed] `声音` （confidence=medium）
- 客户:「More tomorrow」
- 回复:「Understood. I will follow up with the team tomorrow morning for the engine price and let you know.」
- 原因: 再次重复类似‘follow up with the team tomorrow morning’，属于换汤不换药的等待话术重复，违反‘等待话术同轮只说一次’规则。

### [ev-2026-07-14T224833209Z-0539d49e] `身份与 VIN: VIN识别成功后，不要重新问已说过的需求` （confidence=high）
- 客户:「​"I need only the engine, please."」
- 回复:「تمام، سأؤكد السعر مع الفريق لمحرك كورولا 2008. هل يمكنك إعطائي رقم تعريف السيارة (VIN) للمطابقة الدقيقة؟」
- 原因: 客户已经多次说明需要引擎，代理再次问客户是否需要engine, gearbox, or half-cut，重复问需求类型，违反规则

### [ev-2026-07-14T230445341Z-daba4a97] `身份与 VIN: 已明显说明需求后不要重复问配件` （confidence=high）
- 客户:「I am still not at home」
- 回复:「تمام، لا مشكلة. عندما تكون جاهزاً، هل يمكنك إعطائي رقم تعريف السيارة (VIN) للمطابقة الدقيقة؟」
- 原因: 两次客户均已说明车和发动机需求，代理仍反复问需要engine, gearbox, or half-cut，重复等待话术+问配件，违反规则

### [ev-2026-07-14T235642915Z-128ca498] `声音: 避免等待话术反复表达同一个意思` （confidence=high）
- 客户:「شكرن」
- 回复:「عفوًا، سأوافيك بالرد عندما أحصل على السعر النهائي لمحرك TOYOTA NDE150L-DEFNXW.」
- 原因: 代理多次用不同方式说还在确认价格和反馈结果，包含“سأوافيك بالرد عندما أحصل على السعر النهائي”，“سأخبرك بالسعر النهائي قريباً”，反复表达等待，违反等待话术限制

### [ev-2026-07-14T235740862Z-7408dae4] `声音: 避免等待话术反复表达同一个意思` （confidence=high）
- 客户:「نعم شكران」
- 回复:「عفوًا. سأخبرك بالسعر النهائي قريباً.」
- 原因: 代理再次重复相似等待话术，显示专业度和效率不足，违反规则

### [ev-2026-07-15T174417575Z-c14b2065] `声音: 不简单回复无关结束祝福时机` （confidence=medium）
- 客户:「هل أخبرك」
- 回复:「مرحبًا. لم يصلنا السعر بعد. هل لديك تفاصيل إضافية تريد مشاركتها؟」
- 原因: 客户明显询价仍回复简单的“未收到价格”且无积极推进，缺少更多关键信息或祝福，导致交流冷淡

### [ev-2026-07-15T215102507Z-54405fae] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「please am still waiting」
- 回复:「I understand you are waiting. Our team is working on securing the exact price for your complete 2SZ-FE engine. Would you like to speak to someone directly? You 」
- 原因: Agent gave the phone number unsolicited without the customer explicitly requesting direct contact, and not because the agent was stuck or unable to proceed. This violates the rule that only under clear conditions (customer asks for direct contact or agent is stuck) should the number be given.

### [ev-2026-07-15T203213108Z-963ef2b0] `三段式信息收集 - 锁定阶段（Which + What）` （confidence=medium）
- 客户:「4 plugs」
- 回复:「Understood, a 4-plug engine for Toyota Vitz. What exact year and model is your Vitz? That makes it easier to find the right one.」
- 原因: Agent asked repeatedly for the exact year and model after the customer already gave a model and years ('can I get toyota vitz engine' → then '4 plugs' → then '2006 2008'). This shows the agent did not sufficiently prioritize VIN or clear model+year recognition before repeatedly asking for the same info, which reduces perceived professionalism.

### [ev-2026-07-15T051344762Z-2b016ecb] `等待话术禁止重复使用` （confidence=high）
- 客户:「Yes」
- 回复:「Thanks for confirming. We are getting the exact price for the UA80F 8-speed gearbox for your Highlander now.」
- 原因: 该回复内容与前条消息重复表达了“团队确认价格”的等待状态，和之前回复类似“我们正在确认价格”，属于同一轮对话中的等待话术重复，违反“同一对话里不要用‘still checking / still waiting’这类等待话术反复表达同一个意思”。

### [ev-2026-07-15T051253655Z-7d1ff05a] `等待话术禁止重复使用` （confidence=high）
- 客户:「Ok」
- 回复:「Understood. Our team is working on the price for your Highlander gearbox. We will get back to you soon.」
- 原因: 该回复内容重复强调“团队正在确认价格”，与前条消息“我们正在确认价格”，同一对话轮次多次重复等待话术，不符合规则。

### [ev-2026-07-15T053913963Z-1d900748] `客套话简短回应即可，不要附加冗余尾巴` （confidence=medium）
- 客户:「Not yet. I'm looking at the price in town too before, so I can compare」
- 回复:「No problem at all. We are here when you are ready.」
- 原因: 客户说“Not yet”，回复“No problem at all. We are here when you are ready.”，回复内容有多余的尾巴“我们随时在”，符合规则但应注意避免频繁使用，此处只出现一次无须处罚；但结合接下来一条完全相同回复，后续重复违反该规则。

### [ev-2026-07-15T053948890Z-8ab1a366] `不要对客套话重复附加相同尾巴` （confidence=high）
- 客户:「I'll get back to you」
- 回复:「No problem at all. We are here when you are ready.」
- 原因: 对客户“ I'll get back to you”的回复和上一条完全重复“ No problem at all. We are here when you are ready.”，属于对客套话回复的重复，应简短且避免重复相同尾巴，违反规则中“客户说谢谢/没事，简短对应一句就行”，多次重复不当。

### [ev-2026-07-14T185131660Z-f4783d96] `三段式信息收集（第一段锁定 Which + What）+ VIN确认相关` （confidence=high）
- 客户:「2sz engine」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: 客户已经明确说是2SZ发动机需求，回复中却再问“what VIN or model are you looking for？”，本该先确认VIN或车型而不是重复问配件需求，且之前已确认需求，重复问What part violates规则中“确认车辆信息的同一条回复里不要重新问已经说过需求”，没有提升专业感。

### [ev-2026-07-14T185020092Z-0c71664a] `三段式信息收集（第一段锁定 What）+ 禁止编造价格` （confidence=medium）
- 客户:「My money  be 8000 please can I bring it please」
- 回复:「We can help you find something for 8000. What part are you looking for?」
- 原因: 客户问价后，回复“We can help you find something for 8000.”含有可能暗示接受此价格的模糊承诺，存在误导嫌疑。严格来说，不应先给出价格数字或暗示价格匹配，应先锁定VIN或车型详细信息再报价。

### [ev-2026-07-14T192227467Z-10949421] `库存与地点说明 + 不重复等待话术` （confidence=medium）
- 客户:「Do you have 2sz engine I won to see please」
- 回复:「We will check with our team for the 2SZ engine availability and pricing tomorrow morning, as our China team is currently offline.」
- 原因: 回复中仅说团队明天确认，而未主动说明货物确实从中国发货、45-60天海运时间、加纳办公室没有库存且支持付款后取货，未满足库存与地点说明规则，导致客户以为本地有现货。这可能造成误解。

### [ev-2026-07-15T165826867Z-90f1e899] `身份与VIN + 明确需求确认` （confidence=medium）
- 客户:「No, I make mistake is 2x 2 exit, 2x Z with 2x engine. I send you the video yesterday. And you know, send me your own. I want to end it engine. In Ghana. In Ghan」
- 回复:「I understand you want the 2SZ engine. Our team is checking the current price and availability for you. The engines are shipped from China and take 45-60 days, b」
- 原因: 客户明确说错型号是2SZ发动机，回复虽确认2SZ需求并说明库存物流，但仍在回复中反复提“checking”，存在等待话术重复风险，未提升成交信心。

### [ev-2026-07-15T090946855Z-83abcfc7] `新客户 / 模糊开场 → 必须带网站 + 问需求` （confidence=high）
- 客户:「Yes」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: After having confirmed VIN and detailed request earlier, agent re-asks 'what VIN or model are you looking for?' and repeats website link, causing inefficiency and violating '客户已经给出车型 + 年份 + 驱动方式 + 发动机型号等核心信息后，不要再重复问 VIN / 车型 / 年份' and '不要反复问同一个问题' rules.

### [ev-2026-07-14T185539862Z-1505476a] `重复问已知需求` （confidence=high）
- 客户:「Thanks for the update. Our team in China will send you the engine photos we discussed first thing tomorrow, and then we can confirm pricing for you.」
- 回复:「Please send a clear photo of the engine currently in the car.」
- 原因: 客户之前已经明确表示会发送发动机照片，后续多条消息仍反复要求客户发送发动机照片，属于同一轮对话里重复使用等待话术/同义反复表达，导致客户不耐烦并丧失信心

### [ev-2026-07-14T185814956Z-f569c0a2] `官网首页链接连续重复发送` （confidence=high）
- 客户:「Understood. We'll send the engine photos tomorrow morning, and our team will then prepare your precise FOB or CIF quotations.」
- 回复:「Thank you for confirming. Once we receive the engine photos tomorrow morning, our team will work on preparing accurate FOB or CIF quotations for you. We look fo」
- 原因: 同一对话里官网首页链接超过2次发送，多次直接重复分享www.asia-power.com，违反同对话最多发2次的规则

### [ev-2026-07-14T185910107Z-9bacc8a9] `官网首页链接连续重复发送` （confidence=high）
- 客户:「Sounds good. We'll send the engine photos tomorrow morning, then our team will prepare the FOB or CIF quotes for you.」
- 回复:「Thanks for the update. Please send the engine photos when ready, and then our team will prepare FOB or CIF quotes for you. We look forward to assisting you with」
- 原因: 同一对话重复发送官网首页链接www.asia-power.com，超过2次限制

### [ev-2026-07-14T190017017Z-b95cd72e] `官网首页链接连续重复发送` （confidence=high）
- 客户:「Understood. We'll send the engine photos tomorrow morning, and then our team will prepare the FOB or CIF quotes for you.」
- 回复:「Thank you for letting us know. We look forward to receiving the engine photos tomorrow morning. Once we have them, our team will prepare precise FOB or CIF quot」
- 原因: 未判断是否超限，若此条为第3次或以上发送官网首页链接，则违反了最多发2次规则

### [ev-2026-07-14T185415345Z-7d0902eb] `重复等待话术` （confidence=high）
- 客户:「Got it.

To avoid supplying the wrong version, please send a clear photo of the engine if available.」
- 回复:「Understood, we'll get high-resolution photos of the engine to confirm. Our team will send them first thing tomorrow morning from China to ensure accuracy. We'll」
- 原因: 对话多次重复表达“明天早上发送发动机照片”及类似等待内容，属于同一轮对话反复多次使用等待话术，违反“同一对话里这类等待话术只说一次就够”的规则。

### [ev-2026-07-14T185538002Z-0043f350] `重复等待话术` （confidence=high）
- 客户:「Thanks — we received your photo.

Our team will review it shortly to confirm the currently installed engine.」
- 回复:「Thanks for the update. Our team in China will send you the engine photos we discussed first thing tomorrow, and then we can confirm pricing for you.」
- 原因: 同上，重复“团队明天早上发发动机照片”，多处近义表达等待信息，属于同一轮对话反复用等待话术。

### [ev-2026-07-14T185604146Z-65bcc53c] `重复等待话术` （confidence=high）
- 客户:「Please send a clear photo of the engine currently in the car.」
- 回复:「Thanks for the reminder. Our team in China will send you the engine photos for confirmation first thing tomorrow morning.」
- 原因: 连续回复重复承诺发照片，换汤不换药。

### [ev-2026-07-14T185654455Z-4b0e753c] `重复等待话术` （confidence=high）
- 客户:「Thanks for your update. Please send the engine photos when ready tomorrow morning, and we will promptly check the details with verified suppliers in our network」
- 回复:「Understood. We will send the engine photos tomorrow morning, and then our team will work to get you precise FOB or CIF quotes based on your needs.」
- 原因: 继续重复发送发动机照片明天上午这一点，构成等待话术重复。

### [ev-2026-07-14T185805089Z-6bff9c3d] `重复等待话术` （confidence=high）
- 客户:「Thank you for your update. We look forward to receiving the engine photos tomorrow morning. Once we have them, our team will work to provide you with precise FO」
- 回复:「Understood. We'll send the engine photos tomorrow morning, and our team will then prepare your precise FOB or CIF quotations.」
- 原因: 同样回复中反复重复类似等待文字，未简短有效回复客户，同一对话中多次陈述发图时间和报价动作。

### [ev-2026-07-14T185856077Z-9be9d461] `重复等待话术` （confidence=high）
- 客户:「Thank you for confirming. Once we receive the engine photos tomorrow morning, our team will work on preparing accurate FOB or CIF quotations for you. We look fo」
- 回复:「Sounds good. We'll send the engine photos tomorrow morning, then our team will prepare the FOB or CIF quotes for you.」
- 原因: 再次重复相同“明天发送照片，随后报价”的话术，属于等待话术重复。

### [ev-2026-07-14T190005813Z-fa618b8d] `重复等待话术` （confidence=high）
- 客户:「Thanks for the update. Please send the engine photos when ready, and then our team will prepare FOB or CIF quotes for you. We look forward to assisting you with」
- 回复:「Understood. We'll send the engine photos tomorrow morning, and then our team will prepare the FOB or CIF quotes for you.」
- 原因: 持续重复同一等待话术，缺乏实质推进和新信息。

### [ev-2026-07-14T190058223Z-bc246dfd] `重复等待话术` （confidence=high）
- 客户:「Thank you for letting us know. We look forward to receiving the engine photos tomorrow morning. Once we have them, our team will prepare precise FOB or CIF quot」
- 回复:「Understood. We will send the engine photos tomorrow morning and then prepare your FOB or CIF quotes.」
- 原因: 依然在重复承诺“明天上午发送发动机照片，之后报价”，整轮回复相似内容反复出现。

### [ev-2026-07-15T073610896Z-4b370554] `声音 / 禁止结尾冷淡` （confidence=high）
- 客户:「Ok」
- 回复:「No problem, I'll let you know soon.」
- 原因: The reply 'No problem, I'll let you know soon.' adds unnecessary trailing phrase 'I'll let you know soon' after a polite acknowledgment, violating the rule that simple acknowledgments should be brief and not repeatedly appended with extra tail phrases.

### [ev-2026-07-15T073457215Z-a1ba5a5d] `等待话术限制` （confidence=medium）
- 客户:「Engine complete with gearbox」
- 回复:「Got it. My team will check for a complete Toyota Prado engine and automatic gearbox. Prices take a moment to confirm, it ships from China by sea.」
- 原因: The reply uses 'Prices take a moment to confirm, it ships from China by sea.' after similar previous waiting phrases in the conversation, amounting to repeated waiting speech that should only appear once per conversation round.

### [ev-2026-07-15T073437660Z-1ce87f54] `等待话术限制` （confidence=medium）
- 客户:「With this you'll know exactly what I want please」
- 回复:「Thanks, the VIN helps us confirm. My team will check for a Toyota Prado engine. Prices will be confirmed soon, it will ship from China by sea.」
- 原因: The reply contains 'Prices will be confirmed soon, it will ship from China by sea.', repeating a waiting phrase similar to other messages in the conversation, violating the rule of saying waiting phrases only once per conversation.

### [ev-2026-07-14T100715961Z-517f7fde] `三段式信息收集 / 第一段·锁定（Which + What） / 首先确认 VIN/车型等核心信息` （confidence=high）
- 客户:「Hello AsiaPower, I would like to enquire about inventory.」
- 回复:「Got it. Before quantity/port, please confirm the engine currently installed (VIN is factory config only).

Please send a clear engine plate photo.」
- 原因: 回复没有带官网首页链接“www.asia-power.com”且未在新客户模糊开场时询问需求，不符合新客户模糊开场规则

### [ev-2026-07-14T100726335Z-630fc4ed] `同一对话里官网首页链接最多发 2 次；新客户 / 模糊开场必须带网站 + 问需求` （confidence=medium）
- 客户:「」
- 回复:「Got it. Before quantity/port, please confirm the engine currently installed (VIN is factory config only).

Please send a clear engine plate photo.」
- 原因: 对话开始未带 www.asia-power.com 网站链接，且多次重复相似询问，造成部分重复感

### [ev-2026-07-15T084702921Z-c5b89a3f] `整体销售思路 - 三段式信息收集 - 锁定（Which + What）` （confidence=medium）
- 客户:「2829. The money phone is uh, plastic. Uh, black plastic. Do you have it? And it's how much?」
- 回复:「We specialize in vehicle parts from China. Are you looking for a part for your car or truck? You can see our inventory at www.asia-power.com.」
- 原因: The reply does not ask for model, year, or engine code before trying to quote or confirm parts. It only asks if it's for car or truck and directs to website again, lacking progressive identification.

### [ev-2026-07-15T221302470Z-6b450f9e] `库存与地点 - 不要暗示有加纳以外代理点` （confidence=high）
- 客户:「Pas de problème pour le délai, à Kinshasa vous travaillez avec quelle agence ?」
- 回复:「Notre équipe vous communiquera directement les détails de l'agence à Kinshasa. Nous sommes toujours en attente de la confirmation du prix de votre boîte de vite」
- 原因: 回复中提到“Notre équipe vous communiquera directement les détails de l'agence à Kinshasa”，暗示有金沙萨地区代理，违反规则中禁止暗示其他国家有本地代理点的规定。

### [ev-2026-07-15T161313164Z-f86df534] `新客户 / 模糊开场 → 必须带网站 + 问需求` （confidence=high）
- 客户:「Ok」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: 第二次询问VIN或车型时重复发了官网首页链接和同一问题，存在等待话术重复的问题。

### [ev-2026-07-15T161235669Z-fc3cf264] `VIN识别成功后，再问VIN为禁止行为` （confidence=medium）
- 客户:「Emgine」
- 回复:「Thanks for confirming you need the engine. Can you share the VIN so we can check for absolute compatibility? These engines typically ship from China and arrive 」
- 原因: 客户已多次说明2SZ-FE发动机需求，问发动机后再次要求VIN，因客户未给VIN但已明确需求，应避免重复问VIN，尤其已回复过类似内容时。

### [ev-2026-07-15T220600111Z-c47d9fb3] `禁止用“团队在确认价格”这类等待话术反复表达` （confidence=high）
- 客户:「Merci. Rétroviseur droit honda civic 2007」
- 回复:「D'accord, nous cherchons le rétroviseur droit pour votre Honda Civic 2007. Notre équipe est en train de confirmer le prix pour vous.」
- 原因: 回复中多次使用“团队在确认价格”，属于同一轮对话里重复表达等待话术。

### [ev-2026-07-15T220600111Z-c47d9fb3] `禁止编造库存、价格、交期、付款、地址` （confidence=medium）
- 客户:「Merci. Rétroviseur droit honda civic 2007」
- 回复:「D'accord, nous cherchons le rétroviseur droit pour votre Honda Civic 2007. Notre équipe est en train de confirmer le prix pour vous.」
- 原因: 回复中没有明确说明货品是从中国发货，未清楚告知海运时效为45-60天，而是笼统说团队确认价格，缺少对库存和物流信息的明确说明，可能导致客户误解库存。

### [ev-2026-07-15T103557410Z-b0756492] `声音 - 同一对话里不要用"still checking / still waiting"这类等待话术反复表达同一个意思` （confidence=high）
- 客户:「Please confirm the price of both 32 and 27 engine for me.」
- 回复:「We are still confirming the exact prices for the 32 and 27 engines with our team. These engines would be shipped from China, which typically takes 45-60 days by」
- 原因: Reply repeats 'still confirming'/'still working on' price information multiple times in the same dialogue, which counts as repeated waiting speech, disallowed by the rule.

### [ev-2026-07-15T110308621Z-dcea499b] `三段式信息收集 - 问价时禁止编造价格数字，单位必须认清；` （confidence=medium）
- 客户:「Including shipping」
- 回复:「We can include shipping from China, which takes 45-60 days by sea. To give you an exact price, do you need the engines with or without turbocharging, and do you」
- 原因: Reply mentions shipping time and terms accurately but does not confirm price or unit; no fabricated price found, but it continues to ask for VIN again despite prior requests.

### [ev-2026-07-15T095705940Z-dfaabade] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「Please have been calling madam on video call but not answering she sent me at the market」
- 回复:「Hi there. I understand you're trying to reach someone. Please call our support line at 054 913 5916, or visit www.asia-power.com and let me know what you're loo」
- 原因: Agent immediately gave the phone number without attempting to understand customer's need; rule forbids giving this number as a first response to normal inquiries.

### [ev-2026-07-15T095705940Z-dfaabade] `禁止开场：'Hi there!'` （confidence=high）
- 客户:「Please have been calling madam on video call but not answering she sent me at the market」
- 回复:「Hi there. I understand you're trying to reach someone. Please call our support line at 054 913 5916, or visit www.asia-power.com and let me know what you're loo」
- 原因: Reply starts with 'Hi there.' which is explicitly prohibited as an opening.

### [ev-2026-07-15T155100289Z-d30a67ff] `三段式信息收集（第一段） & 价格与单位` （confidence=high）
- 客户:「How much Wil the full engine cost for the shipping?」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: 客户已经明确了车型和引擎代码（VW Golf 4, BSE engine），回复却重复问“what VIN or model are you looking for?”，属于重复问已知的车辆信息，不符合第一段锁定优先级，也不符合价格推进要求，不应在清楚需求后再反复问车型和VIN。

### [ev-2026-07-15T192215901Z-55d618f3] `客户说"谢谢/不客气/没事"这类客套话，简短对应一句就行（No problem. / You're welcome.），不用每次都在后面加"I'll let you know"这类重复的尾巴。` （confidence=high）
- 客户:「OK」
- 回复:「No problem. I will let you know once my team confirms the price.」
- 原因: 回复中 'No problem. I will let you know once my team confirms the price.' 包含多余的尾巴，不符合简短对应客套话的要求。

### [ev-2026-07-15T192330822Z-61a4f37e] `客户车型/需求确认下来后，不要再重复问 VIN / 车型 / 年份；只问真正缺的关键细节。` （confidence=high）
- 客户:「OK」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: 前面已经确认Honda Odyssey 2009年车型并询问VIN，此处回复又重复问"what VIN or model are you looking for?"，违反不重复问VIN/车型规则。

### [ev-2026-07-15T082727710Z-f58e5cc1] `新客户 / 模糊开场 → 必须带网站 + 问需求` （confidence=medium）
- 客户:「How is the parts going」
- 回复:「The parts business is good. What part are you looking for? You can check our inventory at www.asia-power.com.」
- 原因: 该条回复虽带有网站链接和问需求，但整体回复中重复带网站链接与问需求，显得不够自然，应避免多次重复发送相同官网首页链接

### [ev-2026-07-15T082826940Z-3e18e160] `同一对话里官网首页链接最多发 2 次；第 3 次及以后不要再发，直接回应客户的问题` （confidence=high）
- 客户:「Did you shop already」
- 回复:「Yes, you can check our inventory at www.asia-power.com. What are you looking for?」
- 原因: 该条回复中再次发送官网首页链接，已经超过对话中允许的2次限制，属于不合规行为

### [ev-2026-07-15T142244928Z-239dbf30] `第二段·摸底 & 成交三要素` （confidence=medium）
- 客户:「I need Hyundai sonata 2008 model  dashboard」
- 回复:「Okay, I understand you need a dashboard for a Hyundai Sonata 2008 model. I will confirm the price with our team. Please note, items ship from China and sea frei」
- 原因: Reply confirms the part and adds shipping time, which is good, but did not ask for VIN or engine code, which is required per '三段式信息收集' First phase - passenger car identification (VIN/车台号 > model+year+engine code ...). The response should ask for more precise vehicle identification such as VIN or engine code rather than directly confirm and promise to check price.

### [ev-2026-07-15T142437988Z-30dbd050] `三段式信息收集（锁定） & 成交三要素信心累积` （confidence=medium）
- 客户:「Also check the price of the engine for same Hyundai sonata 2008」
- 回复:「I will also confirm the price for the engine for your Hyundai Sonata 2008 model with the team. This will ship from China and delivery typically takes 45-60 days」
- 原因: Customer asked about price for engine on the same car, but the reply did not confirm the exact engine code or PIN number to establish precise identification, missing professional detail to increase customer confidence.

### [ev-2026-07-15T145451732Z-761c9aa9] `严禁随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「Are you on wechat?」
- 回复:「We are here on WhatsApp. You can also call our team at 054 913 5916 for assistance.」
- 原因: 回复中直接给出电话号码作为默认回应，不符合规则中‘客户随便打个招呼、问价格、发照片这些正常询盘流程，一律先按本文件其它规则正常推进对话’的要求，只有客户明确要求或无法推进时才能给。

### [ev-2026-07-15T145620383Z-62b3a8ef] `严禁随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「Are you on wechat」
- 回复:「We are available here on WhatsApp. You can also call us at 054 913 5916.」
- 原因: 重复默认给电话号码，未判断客户是否有明确要求，属于禁忌行为。

### [ev-2026-07-15T173146346Z-df0b7c60] `新客户 / 模糊开场 → 必须带网站 + 问需求` （confidence=medium）
- 客户:「👍」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: 客户只发了一个👍表示确认，没有新问题，回复应该回Hi，不应该直接推进并问VIN，尤其客户没有提供车型或需求信息，且之前已说明只做零件销售不做招聘，继续推进销售流程显得不够精准专业。

## B. 好例子（正例沉淀）

- [ev-2026-07-15T142310623Z-0b91dc37] 清晰确认价格包含哪些内容（EXW价格、运输、清关和检测），体现专业和诚信，增加信心。 （规则提示: 价格与单位 - 价格包含清楚说明）
- [ev-2026-07-15T142627752Z-b56c70a5] 主动告诉客户后续团队将确认长尾短尾并会告知，展示专业性并给予承诺。 （规则提示: 可适当展示专业性）
- [ev-2026-07-15T135029858Z-dd3d1e48] 客户说谢谢时简短回应‘You're welcome’符合规则，避免后续多余拖沓回复。 （规则提示: 客户说谢谢/不客气用简短对应）
- [ev-2026-07-14T223154419Z-0511c361] Agent identified the specific car model and year (2013 Hyundai Santa Fe) and the requested parts accurately, showing good 'Which + What' information collection to build confidence. （规则提示: 三段式信息收集 - 第一段·锁定（Which + What））
- [ev-2026-07-15T091240783Z-801f4f14] Agent proactively explained the office location and stock situation clearly, emphasizing no local inventory and shipping time from China, aligned with the inventory and location rule requiring clear explanation to avoid misperception. （规则提示: 库存与地点）
- [ev-2026-07-15T091828889Z-07302734] Agent responded to customer's ending signals ('I don’t need it again') with a polite, simple closing 'No problem! Have a nice day.', showing appropriate human tone and proper conversation closure. （规则提示: 声音 - 对话明显要结束了时，用简单祝福结束）
- [ev-2026-07-14T183231670Z-5e104a9a] 符合新客户模糊开场规则，附带官网www.asia-power.com，且带询问具体需求，专业且合规。 （规则提示: 声音 / 新客户模糊开场）
- [ev-2026-07-14T183533246Z-2793c94d] 收到图片后主动请求清晰VIN照片或手动输入，符合第一段锁定规则中争取精准VIN的原则。 （规则提示: 三段式信息收集（锁定））
- [ev-2026-07-14T183923610Z-17f55aa2] 收到客户需求“整车发动机”后，主动请求最优先VIN或车型/年份/发动机代码，精准确认需求，体现专业性和信心累积。 （规则提示: 三段式信息收集（锁定））
- [ev-2026-07-14T223833052Z-3a49c4dc] 新客户模糊开场，首次主动附上官网首页+问需求，符合新人开场规则 （规则提示: 声音+三段式信息收集）
- [ev-2026-07-14T224248045Z-5630d23e] 确认车型年份及具体需求方向，主动要求VIN提高识别准确性，体现专业和信心 （规则提示: 三段式信息收集（锁定）+ 成交三要素中的信心）
- [ev-2026-07-15T121303910Z-cc0123a1] 客户问价后，代理先引导客户给VIN或车型，不随意说价格，符合禁止编造价格和要求VIN规定 （规则提示: 价格与单位和三段式信息收集）
- [ev-2026-07-15T203029807Z-2be51dcc] Good new customer opening: introduced self, gave website link, and asked 'What exactly are you looking for?'. This follows rule for new/unclear inquiries: include website and ask for specific demand. （规则提示: 声音 - 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T204622977Z-e8ace535] Confirmed engine 1NZ and years (2006-2008 Toyota Vitz), specified freight time (45-60 days from China), and promised to check price honestly without fabricating numbers. Shows professional info and sets proper customer expectations. （规则提示: 成交三要素 - 信心是累积的; 价格与单位）
- [ev-2026-07-15T204834959Z-0047ae55] Agent recognized VIN info from customer photo and asked a precise technical question about the part needed (engine, gearbox or half-cut), demonstrating professional knowledge and narrowing down the customer's real needs. （规则提示: 身份与 VIN - VIN 识别成功后不要重复问已知需求，只问缺失的关键细节；可适当展示专业性）
- [ev-2026-07-15T024406972Z-0ca1d327] 首次回复客户使用了www.asia-power.com官网首页链接，并加问需求，符合新客户模糊开场必须带网站和问需求的规则，体现专业和规范 （规则提示: 新客户/模糊开场带官网首页链接+问需求）
- [ev-2026-07-15T051025096Z-adda8012] 客户发来图片确认VIN后，回复中确认了车型、年份、发动机代码等详细车辆信息，并直接问客户需要哪个部分（engine/gearbox/half-cut），展现了精准需求确认，符合三段式信息收集第一段锁定规则 （规则提示: 三段式信息收集-锁定(Which + What)，精准确认车型和配件需求）
- [ev-2026-07-15T053749779Z-9212efbf] 明确报价，包含具体价格（USD，EXW China），明确说明了运输和清关费用（500 USD至Tema，Ghana），并主动询问是否准备下单，符合价格与单位要求和成交推进规范 （规则提示: 报价必须写清价格、单位和运输费用，主动推进成交）
- [ev-2026-07-14T184526140Z-f15ad3c5] 第一次收到图片时，基于已有内容直接简单确认品牌和车型，同时带上关键配件需求引导询问（engine, gearbox, half-cut），体现三段式锁定阶段正确推进。 （规则提示: 三段式信息收集（第一段锁定 Which + What））
- [ev-2026-07-14T184644441Z-c1f1a056] 在客户发送视频后，回复包含了官网链接引导客户查看库存，符合要求在询盘中自然带www.asia-power.com，符合声音规则短句且无多余堆砌。 （规则提示: 声音 + 三段式信息收集）
- [ev-2026-07-15T165944429Z-3e5ed7ba] 客户回复简单OK时，服务方回复‘Have a nice day.’，符合语气要求：当对话即将结束时回复带人情味的祝福，而非冷冰冰简单`Ok.`或`Got it.`。 （规则提示: 声音）
- [ev-2026-07-15T090124345Z-fb22ca13] Polite greeting without banned phrase, includes website link plus asks 'What exactly are you looking for?' to identify customer needs clearly for new/mixed customers. （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T090553187Z-d4a35989] After receiving VIN, agent confirms team is checking price, clearly states inventory location and shipping time (China origin, 45-60 days sea), demonstrating transparency and building confidence. （规则提示: 信心是累积的 / 库存与地点）
- [ev-2026-07-15T090725003Z-1113bac2] Conversation ending with a polite 'Good night' rather than dry 'Ok.' shows appropriate human tone and respects African client culture. （规则提示: 对话明显要结束了，回一句简单祝福更得体）
- [ev-2026-07-14T185417117Z-ca03191a] 简洁回应客户已发送的发动机照片，告知团队会尽快确认发动机信息，符合等待客户提供关键信息后再报价的思路，避免重复问配件需求 （规则提示: 三段式信息收集及避免重复问需求）
- [ev-2026-07-14T185350434Z-ea9be911] 主动提醒客户提供发动机清晰照片以避免提供错误产品，体现专业且精准询问需求，体现三段式信息收集的‘Which+What’阶段应有的专业表现 （规则提示: 三段式信息收集及展示专业性）
- [ev-2026-07-15T073133025Z-d29c5000] Proper new customer opening with website link and a demand question to collect specific needs. （规则提示: 声音 / 新客户必须带官网+问需求）
- [ev-2026-07-15T073246827Z-47018af4] Good first-stage info collection asking for model year or VIN after initial vehicle and parts info provided, showing correct three-stage info collection. （规则提示: 整体销售思路 / 三段式信息收集）
- [ev-2026-07-15T073633004Z-dab85357] Clear explanation about office location and shipping origin, avoiding customer misconception about local stock. （规则提示: 库存与地点 / 介绍办公室和库存在中国）
- [ev-2026-07-14T100745782Z-d2a5fac9] 对阿拉伯语客户回复用阿拉伯语，且礼貌回复并引导客户提供具体需求和数量，展示专业跟进 （规则提示: 像真人 WhatsApp，短句，表达清晰；并主动询问需求）
- [ev-2026-07-15T085041487Z-4d77ccd7] Confirms vehicle model and year correction, asks specifically for VIN or engine code, mentions shipping from China and delivery time, showing professional detail and building confidence. （规则提示: 整体销售思路 - 三段式信息收集 - 锁定（Which + What）; 库存与地点 - 说明货品从中国海运和时间）
- [ev-2026-07-15T085406661Z-00d772ec] Corrects previously mistaken model year from 2028 to 2008, repeats request for VIN or engine code, and reaffirms shipping details; clear and professional handling of customer correction. （规则提示: 整体销售思路 - 三段式信息收集 - 锁定（Which + What）; 库存与地点 - 说明货品从中国海运和时间）
- [ev-2026-07-15T085713993Z-eb8515b1] After customer clarifies engine size, reply precisely restates specs and asks specifically for VIN or full engine code for exact matching, showing professionalism and detailed info gathering. （规则提示: 整体销售思路 - 三段式信息收集 - 锁定（Which + What））
- [ev-2026-07-15T220342930Z-3d68bfe1] 对新客户自然带上官网首页链接，并询问需求，符合“新客户 / 模糊开场 → 必须带网站 + 问需求”规则。 （规则提示: 声音 - 新客户 / 模糊开场带官网链接 + 询问需求）
- [ev-2026-07-15T220443858Z-7d34fa04] 确认了VIN + 车型信息，并进一步精准问询客户需要的配件类型，符合“三段式信息收集-第一段锁定”规则，展示专业性。 （规则提示: 三段式信息收集 - 第一段锁定（Which + What））
- [ev-2026-07-15T220856596Z-8de51385] 主动披露海运时效 45-60 天，并确认客户是否接受，体现诚实可信，符合“成交三要素-信心是累积的”及“库存与地点-海运时效明确”规则。 （规则提示: 成交三要素-信心；库存与地点-海运时效明确披露）
- [ev-2026-07-14T215640662Z-24050b37] Includes website www.asia-power.com and asks specific 'what VIN or model are you looking for?', aligning with first phase '锁定' of sales process. （规则提示: 声音 / 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T175606021Z-a7e2405a] Proper self-introduction ('I'm Zijing from AsiaPower'), provides website link, and asks what customer is looking for. （规则提示: 声音 / 客户自我介绍时，像人类一样欢迎 + 自我介绍自己是「鲁子敬」）
- [ev-2026-07-15T161036944Z-6fa8871f] 新客户开场首次回复中正确发了官网首页链接并自然询问需求（VIN或车型），符合新客户模糊开场规则 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T161330598Z-720e67fa] 对客户关于是否在加纳提问清晰作答，说明了有加纳办公室但库存在中国，物流时效也明确说明，符合库存与地点相关规则 （规则提示: 网站目录货品在中国，办公室服务本地但无库存，须说明海运45-60天）
- [ev-2026-07-15T161814398Z-02080986] 客户说Ok时，回复简短并带有人情味的祝福“Have a nice day”结尾，符合对话结束礼貌回应规则 （规则提示: 对话结束时带一句简单祝福，比干巴巴的回复更得体）
- [ev-2026-07-15T215921217Z-59f1eb2a] 提供官网首页链接且加了询问需求，符合新客户/模糊开场的回复规则。 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T220050273Z-c59fd6e2] 确认车型年份，说明货物来源中国及海运时效，体现专业和透明，且问具体配件，信息收集符合销售三段式锁定和推进成交思路。 （规则提示: 第一段·锁定（Which + What）；第二段·摸底（Why + When）；永远不要编造价格；货况与附件）
- [ev-2026-07-15T220716169Z-ce6f5979] 客户说谢谢，回复简洁且只用了‘No problem.’，符合礼貌对应规则，无多余尾巴。 （规则提示: 客户说谢谢/不客气，简短对应一句就行）
- [ev-2026-07-14T233606527Z-2ba84ddd] First reply confirms capability to source Nissan Hardbody engines and immediately asks for VIN or engine code to identify exact price and availability, following first phase of information gathering (Which+What). （规则提示: 三段式信息收集 - 第一段锁定（Which + What））
- [ev-2026-07-15T071936903Z-1490ecfb] Reply appropriately requests VIN or full vehicle details after price inquiry and provides official website link naturally, conforming with providing www.asia-power.com on specific inquiries. （规则提示: 声音 - 新客户/具体询盘要自然带官网链接）
- [ev-2026-07-15T105956896Z-3366fe36] Includes key information about shipping time from China (45-60 days sea freight), complying with inventory and logistics disclosure requirements, while prompting for vehicle details to specify price. （规则提示: 库存与地点 - 海运时效明确告知）
- [ev-2026-07-15T140922326Z-1f1b85bd] Includes website link and asks for VIN or model as priority for vehicle identification, showing professionalism and following the 3-step info collection rule. （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求；三段式信息收集第一段锁定（Which + What））
- [ev-2026-07-15T095922876Z-4841d619] Asks for clearer VIN/frame photo or typed input to confirm vehicle identification, demonstrating professional info collection. （规则提示: 三段式信息收集第一段锁定（Which + What）；VIN确认后不重复问）
- [ev-2026-07-15T144817017Z-96f768da] Clarifies customer's unclear price reference and informs about stock location, helping to manage customer expectations professionally. （规则提示: 库存与地点：首次回复要说明是中国发货、没有加纳现货）
- [ev-2026-07-15T154202890Z-40eda839] 新客户模糊开场，回复包含官网首页链接并自然带问需求，符合规则要求 （规则提示: 声音 & 新客户/模糊开场回复带www.asia-power.com + 问需求）
- [ev-2026-07-15T154319609Z-3bcbd24b] 客户确认了车型和引擎代码，回复显示专业且披露物流时效，提升信心 （规则提示: 三段式信息收集（锁定和信心） & 库存与地点 & 成交三要素（信心））
- [ev-2026-07-15T155331481Z-48b789d7] 确认了客户需求，说明正在确认价格，避免重复问已知信息，表现专业 （规则提示: 身份与 VIN & 三段式信息收集）
- [ev-2026-07-15T191528608Z-239d2938] 新客户开场，带了官网链接并问需求，符合新客户/模糊开场规则。 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T191838727Z-8618ed56] 客户给了车型年份，回复合理推进询问自动或手动变速箱并请求具体VIN，以便匹配正确配件，体现专业和信息收集思路。 （规则提示: 三段式信息收集中第一段锁定（Which + What）和展示专业性询问VIN）
- [ev-2026-07-15T192001072Z-0e53194f] 确认自动变速箱后，主动说明货物从中国海运，时效45-60天，体现诚信和可信度，符合成交三要素中信心累积规则。 （规则提示: 信心是累积的：主动披露物流时效而不是等被问）
- [ev-2026-07-15T081721087Z-e02773aa] 开场对新客户进行了问需求并附上官网首页链接，符合新客户开场规则 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T142150557Z-fdd1cec2] The reply properly introduces the agent with name and company, asks a specific question about the needed part, and includes the www.asia-power.com website link as required for new or vague inquiries. （规则提示: 声音 & 三段式信息收集）
- [ev-2026-07-15T142408271Z-d213b611] The reply gives a brief polite response to a customer message with just 'Ok', using 'No problem. Have a nice day!' which is a warm closing line and meets the requirement to close with a nice wish. （规则提示: 声音/对话明显要结束了）
- [ev-2026-07-15T145354541Z-a03f21a4] 新客户首次消息，带了官网链接并主动问客户需求，符合新客户开场标准。 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T145607155Z-e3920794] 确认官网链接时礼貌回答并重复官网链接，符合要求。 （规则提示: 具体询盘也要自然带 www.asia-power.com）
- [ev-2026-07-15T171431980Z-096a682c] 回复包含官网首页链接并且询问客户具体需求，符合新客户模糊开场规则，流程专业且简洁。 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T171548442Z-c46dddbb] 在确认是客户介绍身份后，仍带官网首页链接并询问具体零件需求，且保持亲切自然，符合寒暄及网址+需求问法要求。 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求；客户自我介绍时，像人类一样欢迎 + 自我介绍自己是「鲁子敬」）
- [ev-2026-07-15T172842436Z-33839989] 当客户明确说明需求与销售方向不符时，及时说明渠道用途，清晰直接，表明销售范围，没有编造信息。 （规则提示: 禁止编造库存、价格、交期、付款、地址；明确说明销售范围，不要误导）

正例文件目录: `docs/zijing-training/good-examples/`

## 红线确认

- 未修改 `LIVE-RULES.md`
- 未自动改 bridge / prompt / Decision
- 未把发现自动合并成「新规则建议」条文（给人决定）
