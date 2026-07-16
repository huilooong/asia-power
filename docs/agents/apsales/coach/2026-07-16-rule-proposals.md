# Coach 规则提案（双通道）

> A = 结构化字段（沉默/终止）；B = LLM 读对话对照 LIVE-RULES。Coach 不代写规则。

---

## 通道 A — 结构化失败模式

# Coach 规则提案 — 过去 7 天

> Coach 只整理证据,不代写规则；规则怎么写由人决定。

过去这段时间没有发现重复 ≥ 门槛次数的失败模式,暂无提案。


---

## 通道 B — LLM 对照 LIVE-RULES

# Coach LLM 对照 LIVE-RULES 审查 — 2026-07-16

> Coach 只判断「是否符合已写好的规则」，给出证据。不代写规则、不改生产。

## 覆盖与成本

- 时间窗: 过去 2 天（默认只审新增，跳过已审 evidence_id）
- 会话数(LLM 调用): 25
- turns 送审: 236
- 跳过已审 turns: 0
- 模型: `gpt-4.1-mini`
- 估算花费: ~25 chat completions (1 per customer thread). No $ meter in-process — check OpenAI usage dashboard.
- parse/API 错误会话: 0

## A. 违规（对照 LIVE-RULES）

### [ev-2026-07-15T074851388Z-8163cab2] `声音 - 禁止开场：Hi there / Great news / I'd be happy to help / 每句 Hello sir` （confidence=medium）
- 客户:「Ok」
- 回复:「Have a nice day, Chief. We will get back to you soon.」
- 原因: Reply uses 'Have a nice day, Chief.' which is acceptable, but 'Chief' should be used carefully. No explicit forbidden open phrases found, so this is borderline and likely low confidence, so omitted.

### [ev-2026-07-15T134430213Z-7ffba990] `价格与单位 - 禁止编造价格数字` （confidence=medium）
- 客户:「👉4 WHEEL DRIVE ( 4 WD) 

👉 TOYOTA RAV4 ( SPORT)」
- 回复:「Yes, Chief. We have the 4WD gearbox for your Toyota RAV4 2AZ-FE. The total price for the engine and gearbox set is 1280. You can visit our Accra office to sign 」
- 原因: Reply states 'The total price for the engine and gearbox set is 1280' without indicating the currency unit (USD/GHS/RMB) which is required. This can create ambiguity and violate '单位必须认清' and '禁止编造价格数字' if no confirmation on unit. Hence medium confidence violation.

### [ev-2026-07-15T134430213Z-7ffba990] `网址和回复内容 - 回复中缺少官网链接` （confidence=medium）
- 客户:「👉4 WHEEL DRIVE ( 4 WD) 

👉 TOYOTA RAV4 ( SPORT)」
- 回复:「Yes, Chief. We have the 4WD gearbox for your Toyota RAV4 2AZ-FE. The total price for the engine and gearbox set is 1280. You can visit our Accra office to sign 」
- 原因: When confirming specific product availability, reply should naturally include the website link or specific product page link to build trust and professionalism, which is missing here (no www.asia-power.com). Medium confidence.

### [ev-2026-07-15T142744208Z-c499c26a] `第一段·锁定 - 信息收集 - 先问 VIN / 车型 / 年份等精确信息` （confidence=medium）
- 客户:「👉 How many PINS it have?」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: Customer asks pins number but reply does not confirm exact VIN or model details and instead directs customer to website and asks 'what VIN or model are you looking for?'. However, customer already provided chassis number and model info before, so agent should not ask again but confirm and ask critical detail (pins). This violates the rule: '客户已经给出车型 + 年份 + 驱动方式 + 发动机型号等核心信息后，不要再重复问 VIN / 车型 / 年份' and should ask the single needed info (pins). Medium confidence.

### [ev-2026-07-15T144231320Z-b73940ec] `第一段·锁定 - 不重复问已知信息` （confidence=medium）
- 客户:「👉CAR NAME: TOYOTA RAV4( 4 WHEEL DRIVE ( 4WD) SPORT 

👉 AUTOMATIC 

👉 TYPE OF FUEL USED: PETROL 

👉4 WHEEL DRIVE ( 4WD)

👉 ENGINE TYPE: ( 2AZ - FE ENGINE)

👉YEAR」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: Customer clearly provides detailed vehicle info including chassis, engine, year, drivetrain etc. Reply again repeats asking 'what VIN or model are you looking for' instead of moving on to missing details like pins or tail type. Violates rule about no re-asking known core info in same conversation. Medium confidence.

### [ev-2026-07-14T223415420Z-426f85cd] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「✅」
- 回复:「My team will get back to you soon with the prices. If you need to speak to someone directly, you can call 054 913 5916.」
- 原因: Agent gave the phone number in the second reply before the customer explicitly requested to talk to a person or expressed urgency, which is against the rule that only allows sharing the number under specific conditions.

### [ev-2026-07-14T223513571Z-1b09d004] `身份与 VIN - 已给车型+年份+需求，不应再直接问 VIN` （confidence=high）
- 客户:「[customer sent an image]」
- 回复:「Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?」
- 原因: Customer already gave the model as '2013 Hyundai Santa Fe' and parts needed, but agent asked again for a clearer photo or to type the VIN/frame number, contradicting the rule that once model/year given, do not repeatedly ask for VIN.

### [ev-2026-07-14T223554371Z-0478b0ce] `身份与 VIN - 禁止重复同一等待话术` （confidence=high）
- 客户:「[customer sent an image]」
- 回复:「Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?」
- 原因: The agent repeated the exact same message asking for clearer photo of VIN/frame number just after the prior message, which violates the prohibition on repeating waiting or similar clarifying messages multiple times in the same conversation.

### [ev-2026-07-15T091715999Z-3934d73e] `三段式信息收集 - 不要重复问相同需求` （confidence=high）
- 客户:「Why are you still saying the same thing?」
- 回复:「Apologies. I'm trying to understand your exact request. What parts are you looking for today?」
- 原因: Customer already expressed he was frustrated by repeated explanations, but agent repeated question about parts again, causing reiteration of the same info and ignoring customer's effort, violating the principle of avoiding repeated queries when demand is already clear.

### [ev-2026-07-14T183409347Z-873ea082] `不要开场：`Hi there!` / `Great news!` / `I'd be happy to help` / 每句 `Hello sir`` （confidence=high）
- 客户:「Hello」
- 回复:「Hello. What are you looking for?」
- 原因: Reply uses 'Hello.' as an opening with no website link or product inquiry, which violates the requirement for new clients or ambiguous greetings to include the website and a question on needs.

### [ev-2026-07-14T184140220Z-0ff288df] `客户已经给出车型 + 年份 + 驱动方式 + 发动机型号等核心信息后，不要再重复问 VIN / 车型 / 年份` （confidence=high）
- 客户:「[customer sent an image]」
- 回复:「Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?」
- 原因: After confirming VIN in previous message (ev-2026-07-14T184116242Z-99857e39), the reply again asks for a clearer photo of the VIN/frame number instead of progressing.

### [ev-2026-07-14T184914372Z-e73fc5c7] `客户已经给出车型 + 年份 + 驱动方式 + 发动机型号等核心信息后，不要再重复问 VIN / 车型 / 年份；只问真正缺的关键细节` （confidence=medium）
- 客户:「If it matches it and will work without problems, I agree」
- 回复:「Thanks for the VIN, for a NISSAN 2003. What is the specific engine model or engine code? I will confirm pricing with my team.」
- 原因: The customer provided VIN and partial info; agent replies with thanks for VIN and immediately asks again for specific engine model or engine code, which is acceptable. No violation here, so omitted.

### [ev-2026-07-14T185929569Z-44327a6b] `新客户 / 模糊开场 → 必须带网站 + 问需求；同一对话里官网首页链接最多发 2 次；第 3 次及以后不要再发` （confidence=medium）
- 客户:「👍」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: This message re-sends the homepage link and general request for VIN/model, but this is late in same conversation (many prior uses), may exceed the twice homepage link rule.

### [ev-2026-07-14T224248045Z-5630d23e] `第一段·锁定（Which + What）` （confidence=high）
- 客户:「اريد محرك كورولا 2008」
- 回复:「مرحبا، سأتحقق من سعر محرك كورولا 2008 مع الفريق. للمطابقة الدقيقة، هل يمكنك إعطائي رقم تعريف السيارة (VIN)؟ تفضل بزيارة www.asia-power.com.」
- 原因: 客服在客户已经说明需求（Toyota Corolla 2008 engine）后重复要求VIN，且未优先用已有信息推进，反复索要VIN导致流程重复。

### [ev-2026-07-14T224833209Z-0539d49e] `身份与 VIN` （confidence=high）
- 客户:「​"I need only the engine, please."」
- 回复:「تمام، سأؤكد السعر مع الفريق لمحرك كورولا 2008. هل يمكنك إعطائي رقم تعريف السيارة (VIN) للمطابقة الدقيقة؟」
- 原因: 客户已明确说只需要发动机，客服重复问VIN，且前面已经问过，显得重复且可能重复问同一问题，降低客户信心。

### [ev-2026-07-14T225408102Z-150ea40a] `身份与 VIN` （confidence=high）
- 客户:「​"I need the 1ND-TV (1.4 D-4D) diesel engine, please."」
- 回复:「تمام، سأتحقق من سعر محرك 1ND-TV (1.4 D-4D) الديزل مع الفريق. للمطابقة الدقيقة، هل يمكنك إعطائي رقم تعريف السيارة (VIN)؟」
- 原因: 多次重复要求VIN，无视已有部分信息，导致等待话术重复、沟通效率低下。

### [ev-2026-07-14T230445341Z-daba4a97] `回复顺序（问配件）` （confidence=medium）
- 客户:「I am still not at home」
- 回复:「تمام، لا مشكلة. عندما تكون جاهزاً، هل يمكنك إعطائي رقم تعريف السيارة (VIN) للمطابقة الدقيقة؟」
- 原因: 对客户发图直接回复英文句“Got it — TENS. Do you need the engine, gearbox, or the half-cut?”，客户用阿拉伯语，回复破坏了语言一致性，也不符合真人风格，且加上英文未必要；且疑似在客户已说明需求后重复问需求类型。

### [ev-2026-07-14T235642915Z-128ca498] `声音` （confidence=high）
- 客户:「شكرن」
- 回复:「عفوًا، سأوافيك بالرد عندما أحصل على السعر النهائي لمحرك TOYOTA NDE150L-DEFNXW.」
- 原因: 客户表达感谢“شكرن”，客服回复“عفوًا، سأوافيك بالرد عندما أحصل على السعر النهائي...”显得啰嗦，客户只需一句感谢回应即可，无需重复等待话术，出现重复等待话术。

### [ev-2026-07-14T235740862Z-7408dae4] `声音` （confidence=high）
- 客户:「نعم شكران」
- 回复:「عفوًا. سأخبرك بالسعر النهائي قريباً.」
- 原因: 客户客套感谢，客服回复仍然重复等待话术，未短句简洁回应导致客户体验下降及重复表达等待。

### [ev-2026-07-15T121303910Z-cc0123a1] `第一段·锁定（Which + What）` （confidence=high）
- 客户:「كم سعره」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: 客户重复问价，但回复未根据客户已有信息（之前多次确认发动机型号），却要求重新提供VIN或车型，缺少对已知信息的维护和使用，影响专业感。

### [ev-2026-07-15T174417575Z-c14b2065] `声音` （confidence=medium）
- 客户:「هل أخبرك」
- 回复:「مرحبًا. لم يصلنا السعر بعد. هل لديك تفاصيل إضافية تريد مشاركتها؟」
- 原因: 客服回复“未收到价格，是否有更多细节”感觉冷淡且重复等待话术，未带入暖语或推展成交话术的迹象，客户可能觉得回应冷淡。

### [ev-2026-07-15T203029807Z-2be51dcc] `禁止开场：`Hi there!` / `Great news!` / `I'd be happy to help` / 每句 `Hello sir`；新客户 / 模糊开场 → 必须带网站 + 问需求` （confidence=medium）
- 客户:「Hello! Can I get more info on this?」
- 回复:「Hello! I'm Zijing from AsiaPower. What exactly are you looking for? You can also browse our website at www.asia-power.com.」
- 原因: Reply uses 'Hello!' which is a prohibited opening; however, it correctly includes the website and asks what the customer is looking for, partially following rules but opening phrase is disallowed.

### [ev-2026-07-15T203213108Z-963ef2b0] `客户已经给出车型 + 年份 + 发动机型号等核心信息后，不要再重复问 VIN / 车型 / 年份；只问真正缺的关键细节` （confidence=medium）
- 客户:「4 plugs」
- 回复:「Understood, a 4-plug engine for Toyota Vitz. What exact year and model is your Vitz? That makes it easier to find the right one.」
- 原因: Agent repeats 'What exact year and model is your Vitz?' after customer already gave partial model and engine info, causing unnecessary repeated asking.

### [ev-2026-07-15T204934959Z-0047ae55] `禁止随意甩人工电话号码；只有客户明确要求转人工/着急等才可提供` （confidence=high）
- 客户:「」
- 回复:「」
- 原因: Agent proactively gives the manual number 054 913 5916 without the customer explicitly requesting human contact or showing strong urgency.

### [ev-2026-07-15T024406972Z-0ca1d327] `禁止开场` （confidence=high）
- 客户:「Hello! Can I get more info on this?」
- 回复:「Hi! You can find our full catalog at www.asia-power.com. What are you looking for today?」
- 原因: Reply uses 'Hi!' which is forbidden as an opening in the rules.

### [ev-2026-07-15T051023890Z-b7507b87] `身份与 VIN - 不得反复要求 VIN` （confidence=medium）
- 客户:「[customer sent an image]」
- 回复:「Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?」
- 原因: The bot asks the customer to resend or type the VIN again after customer already sent a photo; however, it's unclear if the first photo was unreadable and this is justified. Still, rule allows to ask once for clear VIN if previous is unclear, so likely allowed, omitted due to uncertainty.

### [ev-2026-07-15T051253655Z-7d1ff05a] `等待话术不得重复` （confidence=medium）
- 客户:「Ok」
- 回复:「Understood. Our team is working on the price for your Highlander gearbox. We will get back to you soon.」
- 原因: Multiple replies mention team checking price repeatedly; this can be considered waiting-talk repeated many times.

### [ev-2026-07-15T051344762Z-2b016ecb] `等待话术不得重复` （confidence=medium）
- 客户:「Yes」
- 回复:「Thanks for confirming. We are getting the exact price for the UA80F 8-speed gearbox for your Highlander now.」
- 原因: Another similar waiting message about price confirmation repeated.

### [ev-2026-07-15T051253655Z-7d1ff05a] `语气与声音` （confidence=medium）
- 客户:「Ok」
- 回复:「Understood. Our team is working on the price for your Highlander gearbox. We will get back to you soon.」
- 原因: Reply 'Ok' from customer leads to a somewhat robotic repeated wording 'Our team is working on the price...,' not showing natural, human-like response tone.

### [ev-2026-07-14T185131660Z-f4783d96] `身份与 VIN / 三段式信息收集（Which + What）` （confidence=high）
- 客户:「2sz engine」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: Customer already specified '2sz engine' as part needed; reply asks again 'what VIN or model' after already clarifying part, which repeats known need instead of asking critical missing info like VIN only.

### [ev-2026-07-14T192227467Z-10949421] `库存与地点 / 永远不要编造价格、交期、库存` （confidence=medium）
- 客户:「Do you have 2sz engine I won to see please」
- 回复:「We will check with our team for the 2SZ engine availability and pricing tomorrow morning, as our China team is currently offline.」
- 原因: Reply says checking availability and pricing tomorrow morning, which is fine, but does not remind customer that stock is in China and needs 45-60 days shipping; missing upfront clarification of logistics may cause customer misunderstanding of stock location.

### [ev-2026-07-14T192349030Z-f489e20b] `库存与地点` （confidence=high）
- 客户:「No at Ghana I won to see the picture」
- 回复:「Apologies, our team in Ghana is also offline now. We will check for the 2SZ engine picture and stock confirmation tomorrow morning.」
- 原因: Customer asks for picture of engine in Ghana, reply says Ghana team offline but does not clarify Ghana office has no stock and all goods ship from China with 45-60 days sea freight, risking misunderstanding that Ghana office holds stock.

### [ev-2026-07-15T165921403Z-889daa73] `三段式信息收集 / 需求具体` （confidence=high）
- 客户:「2nz」
- 回复:「Apologies, do you mean the 2NZ engine or the 2SZ engine? I'll get the video for you tomorrow morning.」
- 原因: Reply asks 'do you mean 2NZ or 2SZ' again after customer already mentioned these and corrected; repeated question on part type reduces professionalism and client confidence by not clearly distinguishing or confirming known part need.

### [ev-2026-07-15T170129375Z-6ef7029e] `三段式信息收集 / 需求具体` （confidence=high）
- 客户:「The two off theme and the price」
- 回复:「To confirm, are you looking for the 2NZ or 2SZ engine? Our team is still checking the price. These engines are shipped from China and take 45-60 days to arrive 」
- 原因: Reply asks for confirmation on 2NZ or 2SZ again and states team still checking price; repeated unclear part asking indicates lack of precise understanding and slows progression.

### [ev-2026-07-15T090124345Z-fb22ca13] `禁止开场：`Hi there!` / `Great news!` / `I'd be happy to help` / 每句 `Hello sir`` （confidence=medium）
- 客户:「Hello! Can I get more info on this?」
- 回复:「Hello! I am Zijing from AsiaPower. You can find our available products on www.asia-power.com. What exactly are you looking for?」
- 原因: Reply starts with 'Hello!' which is disallowed as opening greeting.

### [ev-2026-07-15T090443195Z-0ec07531] `三段式信息收集：锁定第一段必须优先用VIN/车台号，不要先用车型年份再问需求` （confidence=medium）
- 客户:「[customer sent an image]」
- 回复:「Got it — FORD / 2006 / Explorer. Do you need the engine, gearbox, or the half-cut?」
- 原因: Reply extracts partial vehicle info but then asks 'engine, gearbox, or half-cut' which should have been clarified earlier alongside proper VIN prioritization.

### [ev-2026-07-15T090532886Z-ea906de9] `三段式信息收集：不重复问已确认VIN，且识别后不要再问需求类型` （confidence=high）
- 客户:「[customer sent an image]」
- 回复:「Got it — NG14SSPN1569NN4CW. Do you need the engine, gearbox, or the half-cut?」
- 原因: Reply says 'Got it — NG14SSPN1569NN4CW. Do you need the engine, gearbox, or the half-cut?' after VIN provided, repeating the already known need for gearbox, violating rule not to ask same question again.

### [ev-2026-07-15T090553187Z-d4a35989] `等待话术禁止反复重复` （confidence=medium）
- 客户:「Vin number about」
- 回复:「Thanks for the VIN. My team will confirm the available gearbox and price for this. Please note, items are shipped from China and usually take 45-60 days by sea.」
- 原因: Reply uses 'My team will confirm...' and promises update. Similar waiting expressions repeated in following replies.

### [ev-2026-07-15T090610896Z-895bf942] `等待话术禁止反复重复` （confidence=medium）
- 客户:「Gear box」
- 回复:「Got it. My team is working to confirm the correct gearbox and price. I will update you with details tomorrow morning.」
- 原因: Repeated 'My team is working to confirm...' same waiting message, multiple times in conversation.

### [ev-2026-07-15T090946855Z-83abcfc7] `锁定（Which + What）优先级：已给VIN/车型且明确需求后，不重复问VIN或需求` （confidence=high）
- 客户:「Yes」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: Reply says 'Please check... www.asia-power.com — what VIN or model are you looking for?' even after VIN and part (gearbox) confirmed, violating rule against repeating same question in same conversation.

### [ev-2026-07-14T185539862Z-1505476a] `不止 VIN 场景：只要客户在同一对话里已经明确说过要什么配件，后面不要再问同一个问题` （confidence=high）
- 客户:「Thanks for the update. Our team in China will send you the engine photos we discussed first thing tomorrow, and then we can confirm pricing for you.」
- 回复:「Please send a clear photo of the engine currently in the car.」
- 原因: Customer had already agreed to send engine photos, but reply asked again to send clear photos, causing repetition of the same request in one conversation round.

### [ev-2026-07-14T185814956Z-f569c0a2] `同一对话里官网首页链接最多发 2 次；第 3 次及以后不要再发` （confidence=medium）
- 客户:「Understood. We'll send the engine photos tomorrow morning, and our team will then prepare your precise FOB or CIF quotations.」
- 回复:「Thank you for confirming. Once we receive the engine photos tomorrow morning, our team will work on preparing accurate FOB or CIF quotations for you. We look fo」
- 原因: The URL www.asia-power.com was sent for at least the third or more times already in this conversation, violating the limit on homepage links repetition.

### [ev-2026-07-14T185910107Z-9bacc8a9] `同一对话里官网首页链接最多发 2 次；第 3 次及以后不要再发` （confidence=medium）
- 客户:「Sounds good. We'll send the engine photos tomorrow morning, then our team will prepare the FOB or CIF quotes for you.」
- 回复:「Thanks for the update. Please send the engine photos when ready, and then our team will prepare FOB or CIF quotes for you. We look forward to assisting you with」
- 原因: Repeated sending of the homepage link www.asia-power.com in the same conversation, exceeding the allowed maximum times.

### [ev-2026-07-14T190017017Z-b95cd72e] `同一对话里官网首页链接最多发 2 次；第 3 次及以后不要再发` （confidence=medium）
- 客户:「Understood. We'll send the engine photos tomorrow morning, and then our team will prepare the FOB or CIF quotes for you.」
- 回复:「Thank you for letting us know. We look forward to receiving the engine photos tomorrow morning. Once we have them, our team will prepare precise FOB or CIF quot」
- 原因: Again, the official homepage link www.asia-power.com sent too many times in the same conversation.

### [ev-2026-07-14T190109116Z-573d8ac3] `同一对话里官网首页链接最多发 2 次；第 3 次及以后不要再发` （confidence=medium）
- 客户:「Understood. We will send the engine photos tomorrow morning and then prepare your FOB or CIF quotes.」
- 回复:「Thank you for the update. We look forward to receiving the engine photos tomorrow morning. Once received, our team will prepare precise FOB or CIF quotations ba」
- 原因: Repeated excessive sending of the homepage link www.asia-power.com beyond allowed limit in one conversation.

### [ev-2026-07-14T185415345Z-7d0902eb] `声音 - 不用长句或多行` （confidence=medium）
- 客户:「Got it.

To avoid supplying the wrong version, please send a clear photo of the engine if available.」
- 回复:「Understood, we'll get high-resolution photos of the engine to confirm. Our team will send them first thing tomorrow morning from China to ensure accuracy. We'll」
- 原因: 回复消息长度较长，语句较复杂，不符合短句、最多3-4行的要求，读起来不够像真人WhatsApp回复

### [ev-2026-07-14T185538002Z-0043f350] `声音 - 不用长句或多行` （confidence=medium）
- 客户:「Thanks — we received your photo.

Our team will review it shortly to confirm the currently installed engine.」
- 回复:「Thanks for the update. Our team in China will send you the engine photos we discussed first thing tomorrow, and then we can confirm pricing for you.」
- 原因: 回复内容较冗长，造成啰嗦感，不符合短句、不堆感叹号规则

### [ev-2026-07-14T185604146Z-65bcc53c] `声音 - 不用长句或多行` （confidence=medium）
- 客户:「Please send a clear photo of the engine currently in the car.」
- 回复:「Thanks for the reminder. Our team in China will send you the engine photos for confirmation first thing tomorrow morning.」
- 原因: 回复较长，信息重复多余，语句不够简洁

### [ev-2026-07-14T185654455Z-4b0e753c] `声音 - 不用长句或多行` （confidence=high）
- 客户:「Thanks for your update. Please send the engine photos when ready tomorrow morning, and we will promptly check the details with verified suppliers in our network」
- 回复:「Understood. We will send the engine photos tomorrow morning, and then our team will work to get you precise FOB or CIF quotes based on your needs.」
- 原因: 回复中多次重复发送照片和报价的内容，出现程度接近重复的等待话术，违反禁止同一轮对话里等待话术反复表达的规则

### [ev-2026-07-14T185805089Z-6bff9c3d] `声音 - 不要重复发官网首页超过2次` （confidence=high）
- 客户:「Thank you for your update. We look forward to receiving the engine photos tomorrow morning. Once we have them, our team will work to provide you with precise FO」
- 回复:「Understood. We'll send the engine photos tomorrow morning, and our team will then prepare your precise FOB or CIF quotations.」
- 原因: 回复多次无意义重复包含网站主页链接 www.asia-power.com，同一对话多次发官网首页超出2次限制

### [ev-2026-07-14T185856077Z-9be9d461] `声音 - 不要重复等待话术` （confidence=high）
- 客户:「Thank you for confirming. Once we receive the engine photos tomorrow morning, our team will work on preparing accurate FOB or CIF quotations for you. We look fo」
- 回复:「Sounds good. We'll send the engine photos tomorrow morning, then our team will prepare the FOB or CIF quotes for you.」
- 原因: 回复多次重复表达“发送照片”和“准备报价”，属于换汤不换药的等待话术重复，应避免反复使用

### [ev-2026-07-14T190005813Z-fa618b8d] `声音 - 不要重复等待话术` （confidence=high）
- 客户:「Thanks for the update. Please send the engine photos when ready, and then our team will prepare FOB or CIF quotes for you. We look forward to assisting you with」
- 回复:「Understood. We'll send the engine photos tomorrow morning, and then our team will prepare the FOB or CIF quotes for you.」
- 原因: 回复中重复说明发送照片与报价准备，有等待话术反复表达的情况

### [ev-2026-07-14T190058223Z-bc246dfd] `声音 - 不要重复等待话术和官网首页链接` （confidence=high）
- 客户:「Thank you for letting us know. We look forward to receiving the engine photos tomorrow morning. Once we have them, our team will prepare precise FOB or CIF quot」
- 回复:「Understood. We will send the engine photos tomorrow morning and then prepare your FOB or CIF quotes.」
- 原因: 回复重复确认发送照片和报价，且含网站链接，多次发官网首页链接超过2次

### [ev-2026-07-15T073133025Z-d29c5000] `禁止开场：`Hi there!` / `Great news!` / `I'd be happy to help` / 每句 `Hello sir`` （confidence=high）
- 客户:「Hello! Can I get more info on this?」
- 回复:「Hi! You can check our inventory at www.asia-power.com. What are you looking for?」
- 原因: Reply starts with 'Hi!' which is against the rule prohibiting greetings like 'Hi there!'.

### [ev-2026-07-15T073610896Z-4b370554] `禁止同一轮对话里这类等待话术只说一次` （confidence=high）
- 客户:「Ok」
- 回复:「No problem, I'll let you know soon.」
- 原因: Reply 'No problem, I'll let you know soon.' includes 'I'll let you know', which is a repeated waiting phrase used unnecessarily; such phrases should only appear once in a conversation.

### [ev-2026-07-14T100715961Z-517f7fde] `三段式信息收集（第一段·锁定） - Which + What` （confidence=medium）
- 客户:「Hello AsiaPower, I would like to enquire about inventory.」
- 回复:「Got it. Before quantity/port, please confirm the engine currently installed (VIN is factory config only).

Please send a clear engine plate photo.」
- 原因: Reply asks for engine photo/VIN but does not confirm or repeat customer's actual initial vague inquiry or mention www.asia-power.com and 'What are you looking for?', which is required for new/more general inquiries.

### [ev-2026-07-14T100726335Z-630fc4ed] `声音 - 禁止开场：Hi there! / Great news! / I'd be happy to help; 同一对话里不要用重复等待话术` （confidence=high）
- 客户:「」
- 回复:「Got it. Before quantity/port, please confirm the engine currently installed (VIN is factory config only).

Please send a clear engine plate photo.」
- 原因: The exact same reply text is repeated twice in short succession (ev-517f7fde and ev-630fc4ed), violating the rule of no repeated or near-repeated waiting expressions in the same conversation.

### [ev-2026-07-14T100728374Z-6cba9096] `声音 - 同一对话里不要用重复等待话术` （confidence=high）
- 客户:「」
- 回复:「Thanks — we received your photo.

Our team will review it shortly to confirm the currently installed engine.」
- 原因: Repeated waiting phrase 'Thanks — we received your photo. Our team will review it shortly' appears twice in the conversation, violating the no repeated waiting statement rule.

### [ev-2026-07-14T100728959Z-48f8b4aa] `声音 - 同一对话里不要用重复等待话术` （confidence=high）
- 客户:「」
- 回复:「Got it.

To avoid supplying the wrong version, please send a clear photo of the engine if available.」
- 原因: Multiple replies use similar 'Got it. To avoid supplying the wrong version, please send a clear photo...' which repeats the ask and waiting phrase redundantly in a short exchange.

### [ev-2026-07-14T100729696Z-7107687a] `声音 - 同一对话里不要用重复等待话术` （confidence=high）
- 客户:「」
- 回复:「Got it.

If easier, please send the VIN (or VIN plate photo).」
- 原因: Repeated asking for VIN or engine photo in multiple back-to-back replies without progressing the conversation or addressing earlier info breaches the no repetitive waiting and asking same key question multiple times rule.

### [ev-2026-07-15T084702921Z-c5b89a3f] `三段式信息收集第一段必须锁定Which + What，识别需求优先问 VIN，会先问 VIN 或型号+年份+发动机代码` （confidence=medium）
- 客户:「2829. The money phone is uh, plastic. Uh, black plastic. Do you have it? And it's how much?」
- 回复:「We specialize in vehicle parts from China. Are you looking for a part for your car or truck? You can see our inventory at www.asia-power.com.」
- 原因: Reply did not ask for VIN or detailed vehicle info but only asked if the customer is looking for a car or truck part, despite the customer message being unclear; also repeated website again in short time without advancing VIN or more precise info, not strongly professional.

### [ev-2026-07-15T221302470Z-6b450f9e] `库存与地点` （confidence=high）
- 客户:「Pas de problème pour le délai, à Kinshasa vous travaillez avec quelle agence ?」
- 回复:「Notre équipe vous communiquera directement les détails de l'agence à Kinshasa. Nous sommes toujours en attente de la confirmation du prix de votre boîte de vite」
- 原因: 客户问Kinshasa的代理，回复未明确说明我们的代表处只在加纳阿克拉，且不应暗示在金沙萨等地有代理，而是应说明其他国家运输清关由中国团队负责。

### [ev-2026-07-15T221302470Z-6b450f9e] `禁止显式或暗示在加纳以外城市有本地代理` （confidence=high）
- 客户:「Pas de problème pour le délai, à Kinshasa vous travaillez avec quelle agence ?」
- 回复:「Notre équipe vous communiquera directement les détails de l'agence à Kinshasa. Nous sommes toujours en attente de la confirmation du prix de votre boîte de vite」
- 原因: 回复暗示会有Kinshasa代理，容易让客户误解我们在该地有本地仓库或代理，不符合规定。

### [ev-2026-07-14T215541236Z-d87f697c] `禁止开场：`Hi there!` / `Great news!` / `I'd be happy to help` / 每句 `Hello sir`` （confidence=high）
- 客户:「You like your happy good you?」
- 回复:「Hello! Everything is good on our end. What are you looking for today? You can also check our website at www.asia-power.com.」
- 原因: Reply starts with 'Hello!', which is prohibited opening phrase.

### [ev-2026-07-15T175606021Z-a7e2405a] `禁止开场：`Hi there!` / `Great news!` / `I'd be happy to help` / 每句 `Hello sir`` （confidence=high）
- 客户:「I'm good I'm fine today I'm good I'm fine you」
- 回复:「Hi! I'm Zijing from AsiaPower. You can check our inventory at www.asia-power.com. What are you looking for today?」
- 原因: Reply starts with 'Hi!', which is prohibited opening phrase.

### [ev-2026-07-15T175703886Z-3c905d96] `禁止开场：`Hi there!` / `Great news!` / `I'd be happy to help` / 每句 `Hello sir`` （confidence=medium）
- 客户:「My friend you happy find some of you really really too」
- 回复:「Hey there! How can I help you today?」
- 原因: Reply starts with 'Hey there!', which is similar to forbidden opening greetings.

### [ev-2026-07-15T161313164Z-f86df534] `三段式信息收集——第一段·锁定（Which + What）` （confidence=high）
- 客户:「Ok」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: Repeatedly asking for VIN or model after customer already provided engine model and engine request without acknowledging existing info or progressing the conversation—repeated question on VIN/model is discouraged if not adding value or clarifying missing info.

### [ev-2026-07-15T161235669Z-fc3cf264] `三段式信息收集——第一段·锁定（Which + What）` （confidence=medium）
- 客户:「Emgine」
- 回复:「Thanks for confirming you need the engine. Can you share the VIN so we can check for absolute compatibility? These engines typically ship from China and arrive 」
- 原因: Asking for VIN again after customer gave '2sz fe' and specifically confirmed 'engine' request but agent did not acknowledge prior info fully and asked VIN again instead of confirming or progressing; could be seen as repetitive and may reduce confidence.

### [ev-2026-07-15T220203334Z-fbe5f96f] `禁止暴露翻译软件 / OCR / 内部工具` （confidence=high）
- 客户:「Traduction francais stp」
- 回复:「Okay, translating to French. Nous pouvons vous aider avec des pièces pour Honda Civic 2007. Notre équipe est en train de vérifier les prix ; ces pièces sont exp」
- 原因: Reply reveals use of translation ('Okay, translating to French'), which exposes internal behavior to customer.

### [ev-2026-07-15T220600111Z-c47d9fb3] `不要在确认车辆信息后重复问已知需求` （confidence=medium）
- 客户:「Merci. Rétroviseur droit honda civic 2007」
- 回复:「D'accord, nous cherchons le rétroviseur droit pour votre Honda Civic 2007. Notre équipe est en train de confirmer le prix pour vous.」
- 原因: Reply repeats 'Notre équipe est en train de confirmer le prix', a waiting phrase, which is repeated waiting speech in the same conversation causing a cold impression.

### [ev-2026-07-15T220829714Z-1506f9b5] `能一词回答就一词 / 短句，不用堆感叹号` （confidence=medium）
- 客户:「👍」
- 回复:「👍」
- 原因: Reply simply repeats the same emoji without adding any useful content, less professional but no direct rule breach is certain; consider low confidence - omitted.

### [ev-2026-07-15T103557410Z-b0756492] `声音 - 同一对话里不要用"still checking / still waiting"等待话术反复表达同一个意思` （confidence=high）
- 客户:「Please confirm the price of both 32 and 27 engine for me.」
- 回复:「We are still confirming the exact prices for the 32 and 27 engines with our team. These engines would be shipped from China, which typically takes 45-60 days by」
- 原因: 回复内容多次反复使用类似"We are still confirming the exact prices"、"still working on the price"的等待话术，属于同一对话里重复表达等待状态，违反了禁止同一轮对话重复等待话术的规则。

### [ev-2026-07-15T110308621Z-dcea499b] `三段式信息收集-第一段锁定（Which + What） - 在已多次询问VIN或整车具体信息后不应再次泛泛重问` （confidence=high）
- 客户:「Including shipping」
- 回复:「We can include shipping from China, which takes 45-60 days by sea. To give you an exact price, do you need the engines with or without turbocharging, and do you」
- 原因: 在之前多条消息已经多次反复询问客户VIN或车型年份发动机码等具体信息后，此条回复仍旧泛泛重复要求VIN或车辆详细信息，违反了同一对话已明确需求不应重复问需求关键细节的规则。

### [ev-2026-07-15T095705940Z-dfaabade] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「Please have been calling madam on video call but not answering she sent me at the market」
- 回复:「Hi there. I understand you're trying to reach someone. Please call our support line at 054 913 5916, or visit www.asia-power.com and let me know what you're loo」
- 原因: Agent gave the phone number immediately in the first reply without first understanding customer's needs, which is forbidden except under specific conditions (e.g. customer explicitly requested transfer or agent is stuck).

### [ev-2026-07-15T095705940Z-dfaabade] `禁止开场：Hi there!` （confidence=high）
- 客户:「Please have been calling madam on video call but not answering she sent me at the market」
- 回复:「Hi there. I understand you're trying to reach someone. Please call our support line at 054 913 5916, or visit www.asia-power.com and let me know what you're loo」
- 原因: Reply starts with 'Hi there.', which is disallowed as an opening phrase.

### [ev-2026-07-15T100038951Z-373ebb09] `禁止开场：Hello sir` （confidence=high）
- 客户:「Please show it to her, is this one she's talking about」
- 回复:「Hi. Could you please clarify who 'she' is and what specific item you are asking about?」
- 原因: Reply starts with 'Hi.', which is also a disallowed opening phrase equivalent to 'Hello sir'.

### [ev-2026-07-15T154202890Z-40eda839] `禁止开场` （confidence=high）
- 客户:「Hello! Can I get more info on this?」
- 回复:「Hello! You can see all our products on www.asia-power.com. What part are you looking for today?」
- 原因: Reply starts with 'Hello!' which is prohibited as an opening message.

### [ev-2026-07-15T155100289Z-d30a67ff] `三段式信息收集（第一段·锁定Which），禁止跳过VIN先报价` （confidence=medium）
- 客户:「How much Wil the full engine cost for the shipping?」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: The reply asks the customer to check stock and asks again for VIN/model even though customer already provided VW Golf 4 and engine code BSE earlier, indicating unnecessary repeated or indirect VIN asking instead of precise progression in identification.

### [ev-2026-07-15T192330822Z-61a4f37e] `重复询问VIN/车型需求
客户已给过需求后，不要重复问VIN` （confidence=high）
- 客户:「OK」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: Customer gave VIN-related info and model+year in previous messages, but reply asks again 'what VIN or model are you looking for?', repeating the same question after already having that info.

### [ev-2026-07-15T081721087Z-e02773aa] `禁止开场：`Hi there!` / `Great news!` / `I'd be happy to help` / 每句 `Hello sir`` （confidence=high）
- 客户:「Hello brother」
- 回复:「Hi. What are you looking for today? You can also browse our selection at www.asia-power.com.」
- 原因: Reply uses 'Hi.' which is not allowed as a greeting; should avoid standard openings like 'Hi'.

### [ev-2026-07-15T082727710Z-f58e5cc1] `新客户 / 模糊开场 → 必须带网站 + 问需求` （confidence=medium）
- 客户:「How is the parts going」
- 回复:「The parts business is good. What part are you looking for? You can check our inventory at www.asia-power.com.」
- 原因: Reply asks 'What part are you looking for?' after vague question without any VIN or specific details; lacks priority follow-up on vehicle ID (VIN / model+year+engine code) before asking part.

### [ev-2026-07-15T082826940Z-3e18e160] `新客户 / 模糊开场 → 必须带网站 + 问需求` （confidence=medium）
- 客户:「Did you shop already」
- 回复:「Yes, you can check our inventory at www.asia-power.com. What are you looking for?」
- 原因: Reply repeats website link and generic question but does not prioritize vehicle identification info; also repeats similar website link in short time which is discouraged.

### [ev-2026-07-15T142150557Z-fdd1cec2] `禁止开场 Hi there! / Hello sir / Great news 等固定开场` （confidence=high）
- 客户:「Hello! Can I get more info on this?」
- 回复:「Hi, I'm Zijing from AsiaPower. What specific part are you looking for? You can also browse our inventory at www.asia-power.com.」
- 原因: Reply starts with 'Hi,' which is not allowed as per rules for new customers. The reply should omit such greetings and include website + ask for needs naturally.

### [ev-2026-07-15T145451732Z-761c9aa9] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「Are you on wechat?」
- 回复:「We are here on WhatsApp. You can also call our team at 054 913 5916 for assistance.」
- 原因: 客户只是问是否有微信账号，正常询盘流程，不应直接甩电话号码。

### [ev-2026-07-15T145620383Z-62b3a8ef] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「Are you on wechat」
- 回复:「We are available here on WhatsApp. You can also call us at 054 913 5916.」
- 原因: 客户再次问微信账号，作为正常询问，直接给电话号码属于禁止行为。

### [ev-2026-07-15T171431980Z-096a682c] `禁止开场：`Hi there!` / `Great news!` / `I'd be happy to help` / 每句 `Hello sir`；新客户 / 模糊开场 → 必须带网站 + 问需求` （confidence=medium）
- 客户:「Bonjour ! Puis-je en savoir plus à ce sujet ?」
- 回复:「Hello! Welcome to www.asia-power.com. What vehicle parts are you looking for?」
- 原因: Reply uses 'Hello!' greeting, which is prohibited as a cold open; should avoid greetings starting 'Hello' for new customers.

### [ev-2026-07-15T171548442Z-c46dddbb] `禁止开场：`Hi there!` / `Great news!` / `I'd be happy to help` / 每句 `Hello sir`；新客户 / 模糊开场 → 必须带网站 + 问需求` （confidence=medium）
- 客户:「Hello, how are you? I am a mechanic and I understand even how to dismantle cars and I want to work with you. I live here in Morocco.」
- 回复:「Hello! It's great to connect with a mechanic from Morocco. Please visit www.asia-power.com to see our parts. What specific vehicle parts are you looking for?」
- 原因: Reply uses 'Hello!' greeting twice in the same sentence, violating the tone and greeting rules; also is not a concise natural WhatsApp style message.

### [ev-2026-07-15T173146346Z-df0b7c60] `三段式信息收集（5W2H，按依赖关系分阶段），第一段先要VIN或车型识别信息，不要一开始用‘Please check our real stock’这类模糊话，引导客户直接给VIN或车型。` （confidence=medium）
- 客户:「👍」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: Reply repeats a website link for the third time in the conversation which risks violating the limit of 2 times per dialog for homepage link; also the phrasing 'Please check our real stock' is not aligned with natural short WhatsApp style and may cause confusion.

## B. 好例子（正例沉淀）

- [ev-2026-07-15T134338103Z-9859d10d] Confirms part set availability with exact engine model 2AZ-FE and proactively mentions price breakdown sent, pushing towards order arrangement naturally. （规则提示: 成交三要素 - 信心 - 识别准确且推动成交）
- [ev-2026-07-15T135029858Z-dd3d1e48] Simple, brief courteous reply to thanks complying with '客户说谢谢/不客气/没事简短对应一句' rule. （规则提示: 声音）
- [ev-2026-07-15T142627752Z-b56c70a5] Client asks about gearbox tail type (key info). Agent responds clearly that testing tomorrow will confirm and promises to follow up, showing professional cautious attitude and avoiding guessing. （规则提示: 需求-不急于报价，展示专业和诚实，累积信心）
- [ev-2026-07-15T143620584Z-9bc2fb46] When customer provides chassis number, agent confirms vehicle model and asks a clarifying question about which parts are needed (engine, gearbox, or half-cut), thus progressing information gathering properly. （规则提示: 三段式信息收集 - 第一段锁定 - 确认车辆后进一步精确需求）
- [ev-2026-07-15T143419894Z-1ce8d15b] Customer asks about chassis number identification. Agent clarifies that VIN is already known and asks for crucial gearbox detail (pins, tail type) necessary for exact matching, showing professional and focused info gathering. （规则提示: 身份与 VIN - 不重复问 VIN，专注关键细节提问）
- [ev-2026-07-15T091240783Z-801f4f14] Clearly explained no Ghana stock, that all inventory ships from China with typical 45-60 days sea freight time, addressing customer misconception and avoiding ambiguity. （规则提示: 库存与地点 - 要明确说明库存只在中国，不是加纳本地现货，海运时间明确告知）
- [ev-2026-07-15T091530078Z-d3f5630c] Clarified that office is in Accra but stock ships from China and asked explicitly what part the customer wants, moving towards concrete demand identification. （规则提示: 库存与地点 - 及时纠正客户误解并主动问具体配件需求）
- [ev-2026-07-15T091828889Z-07302734] Customer ended conversation indicating no further need, agent responded politely with a short natural closure 'No problem! Have a nice day.' （规则提示: 声音 - 对话结束时用简短祝福自然收尾）
- [ev-2026-07-14T223154419Z-0511c361] Agent acknowledged customer's description of parts needed and connected with the confirmed model, affirming next steps without redundant questions. （规则提示: 整体销售思路 - 锁定阶段确认具体车型+配件需求，表现专业）
- [ev-2026-07-14T183231670Z-5e104a9a] This reply responds to a non-English greeting with English, provides website link plus a natural question 'What exactly are you looking for?' meeting the new customer opening requirements. （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-14T183533246Z-2793c94d] Upon receiving a photo with unclear VIN, asks for clearer photo or typed VIN in short, natural sentences without repeating or using waiting phrases, matching the requirement to ask for accurate VIN info. （规则提示: 三段式信息收集（第一段·锁定）—精准识别VIN）
- [ev-2026-07-14T183923610Z-17f55aa2] Customer specifies whole engine, reply gives clear next step to provide VIN or model+year+engine code, plus website link again, professionally guiding customer forward without making up pricing. （规则提示: 三段式信息收集（第一段·锁定）—精准识别VIN；禁止编造价格）
- [ev-2026-07-14T184116242Z-99857e39] Agent confirms the VIN clearly extracted from customer image and immediately advances to ask about what part (engine, gearbox, or half-cut), showing professional precise questioning to lock needs. （规则提示: 三段式信息收集（第一段·锁定）—精准识别VIN；专业精准问需求）
- [ev-2026-07-14T185035072Z-ea779809] Acknowledges customer request, sets expectation that team can only provide photos next morning, and asks relevant engine model/code to avoid repeating previously known info, demonstrating honest transparency and professional detail focus. （规则提示: 信心是累积的（诚实可信）；展示专业细节）
- [ev-2026-07-15T141646603Z-6880fbbf] In follow-up, agent reminds customer the car details (2003 NISSAN) and that price confirmation is pending with team, no invented price or false promises, respectful timing and transparency. （规则提示: 信心是累积的（诚实可信）；禁止编造价格）
- [ev-2026-07-15T152017744Z-0e71afea] Short polite close message thanking the customer, with a friendly phrase 'have a nice day' fitting the requirement for a warm ending rather than dry 'OK'. （规则提示: 对话明显结束时用温暖祝福）
- [ev-2026-07-14T223833052Z-3a49c4dc] 开头针对模糊询问自然带官网链接并询问客户需求，符合新客户话术要求和引导找明确需求。 （规则提示: 声音 + 三段式信息收集）
- [ev-2026-07-14T224356660Z-04915635] 图像识别后直接确认车辆型号，并结合专业三种需求（engine, gearbox, half-cut）进行询问，体现专业性和流程顺序。 （规则提示: 回复顺序（问配件） + 三段式信息收集）
- [ev-2026-07-14T121626264Z-65f55077] 针对客户催促，直接说明海运时效（45-60天）和团队仍在确认价格，诚实体现物流周期及真实状况，符合专业性和信心累积的要求。 （规则提示: 成交三要素：信心 + 库存与地点）
- [ev-2026-07-14T121544842Z-579bd585] 用阿拉伯语回复客户并解释中国发货及海运，结合团队确认价格的真实状态，体现语言适配及专业性，符合声音和信心累积要求。 （规则提示: 声音 + 成交三要素）
- [ev-2026-07-15T203145295Z-64fe3050] Confirms shipping origin and sea freight timeframe, asks for key missing info (year and model), following three-stage info collection principle. （规则提示: 三段式信息收集 / 库存与地点 / 海运时效）
- [ev-2026-07-15T204622977Z-e8ace535] Accurately confirms engine code and reiterates sea freight time, showing professionalism and building trust without fabrications. （规则提示: 信心是累积的 / 不要编造价格和交期）
- [ev-2026-07-15T205035141Z-164f8b2b] Clarifies the 'complete engine' request by asking about turbo or specific parts, showing attention to detail and avoiding assumptions. （规则提示: 需求越具体，信心涨得越快 / 客户已经给出车型+需求后不要重复问）
- [ev-2026-07-15T050805551Z-b7d0b585] Asks about engine size after customer gave specific model and year, following the 3段式信息收集第一段原则 to get specific detailed info. （规则提示: 三段式信息收集）
- [ev-2026-07-15T051025096Z-adda8012] Confirms brand, year, model and engine code extracted from photo, then asks which part is needed—engine, gearbox, or half-cut—following detailed assessment principle. （规则提示: 三段式信息收集, 身份与 VIN）
- [ev-2026-07-15T053913963Z-1d900748] Responds politely to customer's 'not yet' by saying 'No problem at all. We are here when you are ready.' following 成交推进 (declining to pursue aggressively). （规则提示: 成交推进）
- [ev-2026-07-15T053948890Z-8ab1a366] Similar polite and concise response without pushy sales tone to customer's delay. （规则提示: 成交推进）
- [ev-2026-07-15T053749779Z-9212efbf] Gives clear price + shipping info and asks customer if ready to prepare order, following 成交三要素 and 价格与单位规则. （规则提示: 价格与单位, 成交推进）
- [ev-2026-07-14T184526140Z-f15ad3c5] Immediately identified vehicle as TOYOTA / HOME from image and asked key What question (engine/gearbox/half-cut) without repeating unnecessary questions. （规则提示: 三段式信息收集（Which + What））
- [ev-2026-07-15T165826867Z-90f1e899] Provided honest information about China night time and timing of video availability, demonstrating transparency and setting clear expectations. （规则提示: 货况与附件 / 诚信透明）
- [ev-2026-07-15T165944429Z-3e5ed7ba] Ended a customer minimal reply politely with 'Have a nice day' which is a proper conversation closing per customer service voice rules. （规则提示: 声音 / 对话结束礼貌）
- [ev-2026-07-15T165826867Z-90f1e899] Mentioned shipping from China with 45-60 days sea freight lead time and that Ghana office is collection location, clarifying logistics upfront per inventory & location rules. （规则提示: 库存与地点）
- [ev-2026-07-15T090553187Z-d4a35989] Acknowledges VIN given, confirms next steps and informs about shipping origin/time. （规则提示: 信心是累积的；主动披露物流时效而不是等被问）
- [ev-2026-07-15T090725003Z-1113bac2] Replies 'Good night.' after customer says 'Okay', showing appropriate polite closing. （规则提示: 对话明显要结束了，回复简短祝福更得体）
- [ev-2026-07-15T090838379Z-7c6e90d2] Says 'Have a nice day.' polite and human-like short sentence, fitting tone rule. （规则提示: 声音 - 短句，像真人 WhatsApp，不用堆感叹号和复杂句）
- [ev-2026-07-15T091102847Z-959a4097] Customer says 'Okay', reply is concise 'No problem.', no extra fluff, fitting polite short answer rule. （规则提示: 对客户礼貌回应，且简短）
- [ev-2026-07-14T185417117Z-ca03191a] Acknowledges the received photo, shows professionalism and trust by mentioning review by team, no repetition of previous questions, and avoids unnecessary next-step pushes. It follows polite short sentences and naturally advances the sales process. （规则提示: 三段式信息收集第一段锁定后避免重复询问；声音短句，不堆砌）
- [ev-2026-07-14T185616497Z-f8377756] Clearly informs about checking with suppliers and preparing quotes after photo, avoids asking redundant questions, uses short sentences, and naturally prepares customer for next step. （规则提示: 货况与附件：说明明天早上供应商确认，声音短句）
- [ev-2026-07-15T073246827Z-47018af4] Professional follow-up asking for more precise identification (model year or VIN) after receiving initial vague product info, following the 3-stage info collection rule (Which + What). （规则提示: 三段式信息收集）
- [ev-2026-07-15T073633004Z-dab85357] Clear explanation that the Ghana office has no inventory and items ship from China by sea, preventing customer misunderstanding about stock location, in line with the inventory and location rules. （规则提示: 库存与地点）
- [ev-2026-07-15T073457215Z-a1ba5a5d] Confirms customer's exact need (engine complete with gearbox) and repeats key shipping info, maintaining clarity and professionalism without unnecessary repetition. （规则提示: 三段式信息收集 + 信心是累积的）
- [ev-2026-07-14T100745782Z-d2a5fac9] Reply is in customer's language (Arabic) politely asking for more details (type, quantity, port) and explaining capability per SOP; no repeated waiting phrase; natural and professionally polite. （规则提示: 整体销售思路 - 新客户 / 模糊开场必须带网站 + 问需求（此处虽无 www.asia-power.com but uses good language match and clear probing in Arabic, which is acceptable here））
- [ev-2026-07-15T085041487Z-4d77ccd7] Asks for VIN or engine code to confirm exact part, mentions sea freight timing (45-60 days), shows professional knowledge and trust building, advancing first phase of 'locking' identification clearly. （规则提示: 三段式信息收集第一段锁定（Which + What），展示专业性，说明海运周期，累计信心）
- [ev-2026-07-15T085406661Z-00d772ec] Corrects vehicle model year based on customer info, repeats asking VIN/engine code without redundant questions, mentions shipping details clearly, demonstrating transparency and professional attitude. （规则提示: 确认车型年份后继续问 VIN，而不重复问需求类型，持续累积信心）
- [ev-2026-07-15T085713993Z-eb8515b1] Focuses on key technical detail (2.4L engine), asks for VIN or full engine code to confirm exact match, progressing conversation professionally and precisely. （规则提示: 具体关键问题询问（如变速箱/引擎 pins数或代码），不泛泛而问，有助提升需求明确度）
- [ev-2026-07-15T220443858Z-7d34fa04] 准确确认了车型、年份、发动机代码识别，并询问了具体需求（engine, gearbox, or half-cut），符合三段式信息收集第一段的锁定要求。 （规则提示: 三段式信息收集 / 第一段·锁定）
- [ev-2026-07-15T220856596Z-8de51385] 回复确认需求且主动披露了中国发货的海运时效（45-60天），符合成交三要素中的诚实可信和主动披露时效要求，有助于建立客户信心。 （规则提示: 成交三要素 / 信心是累积的 / 库存与地点）
- [ev-2026-07-15T220342930Z-3d68bfe1] 针对新客户提供了官网首页链接并询问具体需求，符合声音规则中新客户/模糊开场反馈需要带官网及问需求的要求。 （规则提示: 声音 / 新客户/模糊开场）
- [ev-2026-07-15T221058702Z-327d142e] 重复强调了供应链时效，且告知团队确认库存和价格的状态，未提供虚假价格，保持专业诚实。 （规则提示: 成交三要素 / 信心是累积的 / 库存与地点）
- [ev-2026-07-15T221421444Z-1d28fbbd] 针对客户的客套话简短回应，没有累赘和重复的礼貌尾巴，符合声音规则关于客套话回应的要求。 （规则提示: 声音 / 客套话简短回应）
- [ev-2026-07-15T221535611Z-82fe1195] 用一词回应客户简单确认，符合成交推动规则中“能一词回答就一词”的要求。 （规则提示: 成交推进 / 简洁回复）
- [ev-2026-07-14T215640662Z-24050b37] Includes website link www.asia-power.com naturally and asks for VIN or model, following first segment (Which + What) of information collection. （规则提示: 三段式信息收集，第一段·锁定（Which + What）; 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T175829120Z-c3861494] Polite short reply 'No problem.' without adding repetitive tail, and directly asks for parts needed to progress. （规则提示: 客户说"谢谢/不客气/没事"简短对应一句就行，不用多余尾巴; 1. 先亮货 / 3. 只问一个关键问题）
- [ev-2026-07-15T175944282Z-cfab0ed5] Short polite acknowledgment 'Glad to hear that.' and smooth transition to asking what to help find today, natural and professional tone. （规则提示: 声音：简短话语，像真人WhatsApp，不用客服机器人语言; 1. 先亮货）
- [ev-2026-07-15T161151410Z-9f49e2be] Confirms engine model given, acknowledges it, informs customer about price confirmation process and shipping time proactively—builds confidence and professionalism. （规则提示: 第一段·锁定（Which + What） + 显示专业细节）
- [ev-2026-07-15T161330598Z-720e67fa] Clearly states office location and clarifies inventory shipping origin and timeline, preventing customer misconceptions about local stock versus China shipment, aligning with 库存与地点 rules. （规则提示: 库存与地点）
- [ev-2026-07-15T161814398Z-02080986] Polite, uses proper closing phrase 'Have a nice day!', avoids overusing waiting phrases, maintains professionalism and human touch in closing. （规则提示: 声音 / 对话明显要结束了时回祝福）
- [ev-2026-07-15T215921217Z-59f1eb2a] For a new customer starting with a non-English greeting, clearly provided the website link plus a question about needs, per new customer / vague opening rule. （规则提示: 新客户 / 模糊开场 => 必须带网站 + 问需求）
- [ev-2026-07-15T220050273Z-c59fd6e2] After receiving model + year, gave key info about shipping time and origin, asked specific part needed next to progress the conversation properly, following 3-stage info collection and professional tone. （规则提示: 锁定阶段确认车型+年份，主动披露物流时效，问具体配件需求）
- [ev-2026-07-15T220716169Z-ce6f5979] Customer said thanks, replied politely with a short phrase 'No problem.' in line with rule on handling polite phrases with short responses without extra redundant phrases. （规则提示: 客户说谢谢，用简短对应一句，不加多余尾巴）
- [ev-2026-07-14T233606527Z-2ba84ddd] 首次回复确认可供货且主动要求客户提供VIN或发动机码等准确车辆信息，符合第一阶段锁定车辆并提升专业信心的规则。 （规则提示: 三段式信息收集 - 第一段锁定 (Which + What) - VIN/车型/发动机码优先确认）
- [ev-2026-07-15T071936903Z-1490ecfb] 在没有准确车辆信息时拒绝直接给价，主动引导客户提供VIN或具体车辆信息，同时带入官网链接自然推广，符合网站和需求确认规则。 （规则提示: 声音 - 新客户/模糊开场必须带网站+问需求）
- [ev-2026-07-15T103557410Z-b0756492] 补充说明了中国发货及海运时效（45-60天），主动展示专业细节，有助于累积客户信心，符合货况与物流透明规定。 （规则提示: 成交三要素 - 信心是累积的 - 主动披露物流时效）
- [ev-2026-07-15T140922326Z-1f1b85bd] Reply naturally includes the website and asks for the VIN/model to continue qualification, following the rule to include www.asia-power.com and ask about needs. （规则提示: 必须带网站 + 问需求）
- [ev-2026-07-15T144817017Z-96f768da] Reply explains clearly there is no Ghana local stock and all items ship from China, clarifying logistics and avoiding client misunderstanding proactively. （规则提示: 不要等客户问才说——第一次回复'团队在确认价格'这类话时，就顺带说清楚这是中国发货、需要海运）
- [ev-2026-07-15T154319609Z-3bcbd24b] Confirms customer's provided model and engine code precisely and proactively discloses shipping origin and time, showing expertise and trustworthy info. （规则提示: 三段式信息收集（第一段·锁定Which + What），成交三要素：信心）
- [ev-2026-07-15T155411512Z-7e64860b] Acknowledges and confirms customer's use case (2005 Skoda Octavia), showing attentive listening and accurate info confirmation before continuing with quote preparation. （规则提示: 三段式信息收集（锁定）和成交三要素：信心）
- [ev-2026-07-15T191838727Z-8618ed56] After receiving model and demand (engine with gearbox), reply asks clarifying gearbox type and requests VIN to confirm, following three-stage info collection and prioritizing VIN usage. （规则提示: 三段式信息收集，先确认what和which，优先收VIN，专业形象）
- [ev-2026-07-15T192001072Z-0e53194f] Confirms specific part (automatic gearbox), shares accurate shipping info (China origin, 45-60 days sea freight), which builds trust and honesty about delivery time. （规则提示: 信心是累积的，主动披露物流时效而不是等被问）
- [ev-2026-07-15T142244928Z-239dbf30] Confirms the car model and part needed, mentions team confirmation, explicitly states that shipment is from China with 45-60 days sea freight, showing transparency and professionalism. （规则提示: 第一段·锁定（Which + What） + 物流时效披露 + 不用堆砌等待话术）
- [ev-2026-07-15T142437988Z-30dbd050] Acknowledges new part request by confirming same car detail and shipping info, showing professionalism and transparency without stop at 'cannot quote'. （规则提示: 多配件需求处理 + 物流时效披露）
- [ev-2026-07-15T142408271Z-d213b611] Short polite customer closing reply with 'No problem. Have a nice day!' instead of cold 'Ok.' or 'Got it.', matching friendly tone rule. （规则提示: 对客套话简短对应 + 结尾语气温暖）
- [ev-2026-07-15T145354541Z-a03f21a4] 新客户模糊开场，回复包含官网链接并自然询问具体需求，符合开场回复规则。 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T145607155Z-e3920794] 客户问官网，回复确认并附官网链接，简洁且专业，符合规则。 （规则提示: 回复中自然带官网链接，回答客户具体问题）

正例文件目录: `docs/zijing-training/good-examples/`

## 红线确认

- 未修改 `LIVE-RULES.md`
- 未自动改 bridge / prompt / Decision
- 未把发现自动合并成「新规则建议」条文（给人决定）

