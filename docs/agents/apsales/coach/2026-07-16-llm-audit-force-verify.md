# Coach LLM 对照 LIVE-RULES 审查 — 2026-07-16

> Coach 只判断「是否符合已写好的规则」，给出证据。不代写规则、不改生产。

## 覆盖与成本

- 时间窗: 过去 2 天（**FORCE**：忽略已审缓存，整窗重判 — `--force` / COACH_AUDIT_FORCE=1 / COACH_AUDIT_SKIP_AUDITED=0）
- 会话数(LLM 调用): 25
- turns 送审: 236
- 跳过已审 turns: 0
- 模型: `gpt-4.1-mini`
- 估算花费: ~25 chat completions (1 per customer thread). No $ meter in-process — check OpenAI usage dashboard.
- parse/API 错误会话: 0

## A. 违规（对照 LIVE-RULES）

### [ev-2026-07-15T134744208Z-c499c26a] `三段式信息收集-第一段锁定-Which+What` （confidence=high）
- 客户:「」
- 回复:「」
- 原因: 客服回复未充分利用已确认的车辆信息继续推进销售逻辑，反而回避了具体配件关键问题，问客户What VIN or model are you looking for? 但客户前面多次已明确给出车型和VIN，且该问题重复出现，可能造成客户不满。

### [ev-2026-07-15T144231320Z-b73940ec] `身份与 VIN-确认车辆信息后不要重复问VIN/车型/年份` （confidence=high）
- 客户:「👉CAR NAME: TOYOTA RAV4( 4 WHEEL DRIVE ( 4WD) SPORT 

👉 AUTOMATIC 

👉 TYPE OF FUEL USED: PETROL 

👉4 WHEEL DRIVE ( 4WD)

👉 ENGINE TYPE: ( 2AZ - FE ENGINE)

👉YEAR」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: 客户已多次提供完整车型和VIN信息，客服仍回复要求客户提供VIN或车型，重复问同一问题，导致客户可能不耐烦且流失订单风险。

### [ev-2026-07-14T223415420Z-426f85cd] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「✅」
- 回复:「My team will get back to you soon with the prices. If you need to speak to someone directly, you can call 054 913 5916.」
- 原因: 在正常询盘流程中，未能确认客户明确要求转人工或明确着急时，直接甩出人工电话号码，违背规定禁止默认第一反应甩号码。

### [ev-2026-07-15T000433872Z-56c1b9ce] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「I don’t need this please」
- 回复:「Okay, we will let you know when we have information for your requested parts. You can call 054 913 5916 if anything changes.」
- 原因: 在未确认客户要求转人工或明确着急情况下，随意提供人工电话号码作为回复尾巴，属于对话流程中的偷懒行为，规则中明确禁止。

### [ev-2026-07-14T223513571Z-1b09d004] `三段式信息收集 - 第一段锁定（Which+What）` （confidence=medium）
- 客户:「[customer sent an image]」
- 回复:「Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?」
- 原因: 客户已经明确表达了配件需求，回复中继续要客户重复或者确认VIN，且回复内容两次重复（ev-0478b0ce重复同样请求），且不是优先利用已有具体需求推进报价，流程不够专业。

### [ev-2026-07-15T091715999Z-3934d73e] `声音 - 不用重复等待话术` （confidence=medium）
- 客户:「Why are you still saying the same thing?」
- 回复:「Apologies. I'm trying to understand your exact request. What parts are you looking for today?」
- 原因: 在客户表示不耐烦时，回复继续以“trying to understand your exact request”被视为重复等待话术，未有效推进对话，可能引发客户流失。

### [ev-2026-07-14T184140220Z-0ff288df] `VIN识别成功后，不要再问 VIN` （confidence=high）
- 客户:「[customer sent an image]」
- 回复:「Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?」
- 原因: After confirming the VIN in ev-2026-07-14T184116242Z-99857e39, the reply at ev-2026-07-14T184140220Z-0ff288df repeats asking for a clearer photo of the VIN, which violates the rule not to ask VIN again after confirmation.

### [ev-2026-07-14T184914372Z-e73fc5c7] `确认车型后，不要重复问 VIN/车型/年份，只问缺失关键细节` （confidence=medium）
- 客户:「If it matches it and will work without problems, I agree」
- 回复:「Thanks for the VIN, for a NISSAN 2003. What is the specific engine model or engine code? I will confirm pricing with my team.」
- 原因: At this point, the reply asks for a specific engine code after already confirming VIN and model/year, which is acceptable. However, it confusingly says 'Thanks for the VIN, for a NISSAN 2003.' but the customer just gave a brand 'SAMSUNG' and frame number. The reply misidentifies the brand and model, which reduces professionalism and trust.

### [ev-2026-07-14T183650599Z-6abd75f6] `配件需求已经确认后，不要重复问需要什么配件` （confidence=medium）
- 客户:「You have this ☝️」
- 回复:「Hello. What specific item are you looking for?」
- 原因: The reply 'Hello. What specific item are you looking for?' repeats a question about the part after the customer implied a part with 'You have this ☝️', which shows a repeated question about the part need, potentially risking customer frustration.

### [ev-2026-07-14T224833209Z-0539d49e] `身份与 VIN` （confidence=high）
- 客户:「​"I need only the engine, please."」
- 回复:「تمام، سأؤكد السعر مع الفريق لمحرك كورولا 2008. هل يمكنك إعطائي رقم تعريف السيارة (VIN) للمطابقة الدقيقة؟」
- 原因: 客户已多次提供明确需求（发动机1ND-TV），但回复再次重复询问 VIN，且对同一需求反复问 VIN，存在重复提问风险，可能导致客户不耐烦。

### [ev-2026-07-14T225408102Z-150ea40a] `身份与 VIN` （confidence=high）
- 客户:「​"I need the 1ND-TV (1.4 D-4D) diesel engine, please."」
- 回复:「تمام، سأتحقق من سعر محرك 1ND-TV (1.4 D-4D) الديزل مع الفريق. للمطابقة الدقيقة، هل يمكنك إعطائي رقم تعريف السيارة (VIN)؟」
- 原因: 同一对话中重复多次问 VIN，未根据已有信息合理推进，重复等待同时提问同一关键问题，属于明显重复等待话术和重复提问。

### [ev-2026-07-14T230445341Z-daba4a97] `回复顺序` （confidence=medium）
- 客户:「I am still not at home」
- 回复:「تمام، لا مشكلة. عندما تكون جاهزاً، هل يمكنك إعطائي رقم تعريف السيارة (VIN) للمطابقة الدقيقة؟」
- 原因: 虽然识别出车型与编码，但回复中用英文直接问 'Do you need the engine, gearbox, or the half-cut?'，未根据前文确认客户需求就重复提问配件类型，缺少专业信息展示，未体现询价顺序的先亮货再问关键问题原则。

### [ev-2026-07-14T234117527Z-3dbd0344] `回复顺序` （confidence=medium）
- 客户:「[customer sent an image]」
- 回复:「Got it — TOYOTA / NDE150L-DEFNXW. Do you need the engine, gearbox, or the half-cut?」
- 原因: 再次收到客户图片信息，回复仍用英文重复问配件需求，与前文已确认的需求信息重复，缺乏专业积累和推进，不符合理想的问价流程。

### [ev-2026-07-14T235219357Z-e9d73ccb] `价格与单位` （confidence=medium）
- 客户:「​"I want the complete engine."」
- 回复:「تمام، سأتحقق من سعر محرك TOYOTA NDE150L-DEFNXW الكامل مع الفريق. سأوافيك بالرد قريباً.」
- 原因: 回复中说“سأوافيك بالرد قريباً”且未明示海运时效或者库存情况，价格未确认但没有主动披露约45-60天海运时效，缺少对客户信心的专业信息补充。

### [ev-2026-07-15T174417575Z-c14b2065] `声音` （confidence=medium）
- 客户:「هل أخبرك」
- 回复:「مرحبًا. لم يصلنا السعر بعد. هل لديك تفاصيل إضافية تريد مشاركتها؟」
- 原因: 对客户 ‘هل أخبرك’ 回复为较冷淡的 ‘مرحبًا. لم يصلنا السعر بعد. هل لديك تفاصيل إضافية تريد مشاركتها؟’，缺少人情味，交流口吻偏官方干巴巴。

### [ev-2026-07-15T215102507Z-54405fae] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「please am still waiting」
- 回复:「I understand you are waiting. Our team is working on securing the exact price for your complete 2SZ-FE engine. Would you like to speak to someone directly? You 」
- 原因: 在正常询盘流程中，回复中直接给出人工电话号码，未见客户明确要求转人工或表示急需更快沟通方式。

### [ev-2026-07-15T051253655Z-7d1ff05a] `Waiting phrase repetition` （confidence=high）
- 客户:「Ok」
- 回复:「Understood. Our team is working on the price for your Highlander gearbox. We will get back to you soon.」
- 原因: Multiple replies repeatedly say 'team is confirming the price' or 'working on the price' (e.g. ev-2026-07-15T051141509Z and ev-2026-07-15T051253655Z). Rules forbid repeated waiting expressions with near synonyms in the same dialogue round. This is a repetition and violates the rule against repeat waiting phrases.

### [ev-2026-07-15T051344762Z-2b016ecb] `Waiting phrase repetition` （confidence=high）
- 客户:「Yes」
- 回复:「Thanks for confirming. We are getting the exact price for the UA80F 8-speed gearbox for your Highlander now.」
- 原因: Same as just above, continuing to use similar 'getting the exact price' wording adds to repetitive waiting phrases violating the rule.

### [ev-2026-07-15T052844236Z-8391371e] `Waiting phrase repetition` （confidence=high）
- 客户:「No」
- 回复:「Understood, your Highlander does not have automatic start/stop. Our team is still confirming the price for the UA80F 8-speed gearbox.」
- 原因: Again uses 'team is still confirming the price' equivalent waiting phrase repetitively violating the rule.

### [ev-2026-07-14T192227467Z-10949421] `库存与地点` （confidence=high）
- 客户:「Do you have 2sz engine I won to see please」
- 回复:「We will check with our team for the 2SZ engine availability and pricing tomorrow morning, as our China team is currently offline.」
- 原因: 未及时明确告知客户库存均在中国，需要海运45-60天，回复中没有清楚说明目前是从中国发货。

### [ev-2026-07-14T192349030Z-f489e20b] `库存与地点` （confidence=high）
- 客户:「No at Ghana I won to see the picture」
- 回复:「Apologies, our team in Ghana is also offline now. We will check for the 2SZ engine picture and stock confirmation tomorrow morning.」
- 原因: 客户问是否能在加纳看到照片时，回复称“加纳团队也下班”，没有直接说明网站目录货源在中国，需要海运发货；未充分说明可付款后运到加纳办公室取货的规则。

### [ev-2026-07-14T192444795Z-2ce103e2] `声音` （confidence=high）
- 客户:「Ok」
- 回复:「We will update you tomorrow morning.」
- 原因: 对话明显要结束，客户回复“Ok”，代理回复“We will update you tomorrow morning.”缺乏得体的人情味结尾，违反避免结尾冷淡的规则。

### [ev-2026-07-15T165921403Z-889daa73] `三段式信息收集 - 第一段锁定（Which + What）` （confidence=high）
- 客户:「2nz」
- 回复:「Apologies, do you mean the 2NZ engine or the 2SZ engine? I'll get the video for you tomorrow morning.」
- 原因: 客户已多次明确说明想要2NZ或2SZ发动机，代理仍反复问“你是2NZ还是2SZ？”属于对已明确需求的重复确认，破坏专业感和信心累计。

### [ev-2026-07-15T090946855Z-83abcfc7] `三段式信息收集（第一段） + 身份与 VIN + 价格与单位` （confidence=high）
- 客户:「Yes」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: 客户之前已经明确给出 VIN 和明确需求（engine and gearbox），后续不应该再问 What part do you need？此条消息中 'what VIN or model are you looking for?' 是重复问 VIN/车型，违反规则禁止重复询问已知配件需求和 VIN 信息。

### [ev-2026-07-14T185539862Z-1505476a] `三段式信息收集 - 不用重复问已确认信息` （confidence=high）
- 客户:「Thanks for the update. Our team in China will send you the engine photos we discussed first thing tomorrow, and then we can confirm pricing for you.」
- 回复:「Please send a clear photo of the engine currently in the car.」
- 原因: 客户已明确表示会发送发动机照片，回复再次要求发送发动机照片，属于重复问已知问题，可能导致客户不耐烦。

### [ev-2026-07-14T185814956Z-f569c0a2] `网站链接发放数量控制` （confidence=medium）
- 客户:「Understood. We'll send the engine photos tomorrow morning, and our team will then prepare your precise FOB or CIF quotations.」
- 回复:「Thank you for confirming. Once we receive the engine photos tomorrow morning, our team will work on preparing accurate FOB or CIF quotations for you. We look fo」
- 原因: 多次回复反复发送官网首页链接www.asia-power.com，虽然频率未超两次，但比较集中，可考虑优化链接发放策略以避免过度链接重复。

### [ev-2026-07-14T185910107Z-9bacc8a9] `网站链接发放数量控制` （confidence=medium）
- 客户:「Sounds good. We'll send the engine photos tomorrow morning, then our team will prepare the FOB or CIF quotes for you.」
- 回复:「Thanks for the update. Please send the engine photos when ready, and then our team will prepare FOB or CIF quotes for you. We look forward to assisting you with」
- 原因: 同一对话中已经多次发出官网首页链接www.asia-power.com，提醒尽量控制发官网首页链接数量，避免第3次以上重复发。

### [ev-2026-07-14T190017017Z-b95cd72e] `网站链接发放数量控制` （confidence=high）
- 客户:「Understood. We'll send the engine photos tomorrow morning, and then our team will prepare the FOB or CIF quotes for you.」
- 回复:「Thank you for letting us know. We look forward to receiving the engine photos tomorrow morning. Once we have them, our team will prepare precise FOB or CIF quot」
- 原因: 已经反复发送官网首页链接，三次出现，超过推荐的两次限制，应避免继续用同一链接回应客户。

### [ev-2026-07-14T185538002Z-0043f350] `声音 - 不用每条消息堆感叹号` （confidence=medium）
- 客户:「Thanks — we received your photo.

Our team will review it shortly to confirm the currently installed engine.」
- 回复:「Thanks for the update. Our team in China will send you the engine photos we discussed first thing tomorrow, and then we can confirm pricing for you.」
- 原因: 回复含多条重复表达，将同样内容多次回复，显得冗长。回复应该简短，有效，不堆砌重复信息。

### [ev-2026-07-14T185604146Z-65bcc53c] `声音 - 不用每条消息堆感叹号` （confidence=medium）
- 客户:「Please send a clear photo of the engine currently in the car.」
- 回复:「Thanks for the reminder. Our team in China will send you the engine photos for confirmation first thing tomorrow morning.」
- 原因: 回复重复类似意思，缺乏实质性推进，感到啰嗦重复。

### [ev-2026-07-14T185805089Z-6bff9c3d] `声音 - 短句；一条消息最多 3–4 行` （confidence=medium）
- 客户:「Thank you for your update. We look forward to receiving the engine photos tomorrow morning. Once we have them, our team will work to provide you with precise FO」
- 回复:「Understood. We'll send the engine photos tomorrow morning, and our team will then prepare your precise FOB or CIF quotations.」
- 原因: 回复显得很啰嗦，重复客户内容而无有效信息增益，违反短句简明原则。

### [ev-2026-07-15T073610896Z-4b370554] `声音 - 客户说"谢谢/不客气/没事"，简短对应一句就行（No problem. / You're welcome.），不用每次都在后面加"I'll let you know"这类重复的尾巴` （confidence=high）
- 客户:「Ok」
- 回复:「No problem, I'll let you know soon.」
- 原因: Reply adds 'I'll let you know soon.' after a simple OK from customer, which is unnecessary repetition and violates minimal polite response rule.

### [ev-2026-07-15T073437660Z-1ce87f54] `身份与 VIN - VIN识别成功后后续禁止再问VIN` （confidence=high）
- 客户:「With this you'll know exactly what I want please」
- 回复:「Thanks, the VIN helps us confirm. My team will check for a Toyota Prado engine. Prices will be confirmed soon, it will ship from China by sea.」
- 原因: Reply says 'My team will check for a Toyota Prado engine' and mentions price confirmation but 'ask_vin' is set as next_action again, implying VIN is asked again, violating the rule that after VIN is given, do not ask VIN again.

### [ev-2026-07-14T100715961Z-517f7fde] `整体销售思路 - 三段式信息收集 - 第一段·锁定（Which + What）` （confidence=medium）
- 客户:「Hello AsiaPower, I would like to enquire about inventory.」
- 回复:「Got it. Before quantity/port, please confirm the engine currently installed (VIN is factory config only).

Please send a clear engine plate photo.」
- 原因: 回复先问发动机信息和要求照片，但未主动确认或利用客户最优先提供的 VIN 信息（客户未提供，但规则要求优先锁定VIN再问发动机），给客户的回复对 Which 和 What 信息收集不够清晰明确。

### [ev-2026-07-14T100726335Z-630fc4ed] `声音 - 像真人 WhatsApp，不像客服机器人 - 不用感叹号` （confidence=high）
- 客户:「」
- 回复:「Got it. Before quantity/port, please confirm the engine currently installed (VIN is factory config only).

Please send a clear engine plate photo.」
- 原因: 重复回复完全一样的内容，显得机器人且啰嗦，违反了避免重复等待话术规则。

### [ev-2026-07-14T100729696Z-7107687a] `整体销售思路 - 三段式信息收集 - 第一段·锁定（Which + What）` （confidence=medium）
- 客户:「」
- 回复:「Got it.

If easier, please send the VIN (or VIN plate photo).」
- 原因: 回复中要求客户再发VIN信息，实际上VIN是最高优先级信息，但之前未初步确认VIN或客户需求，存在重复询问或顺序不当的问题。

### [ev-2026-07-15T084702921Z-c5b89a3f] `三段式信息收集 - 三段式信息收集（第一段锁定） - First ask for VIN/车台号 > model+year+engine code > etc.` （confidence=medium）
- 客户:「2829. The money phone is uh, plastic. Uh, black plastic. Do you have it? And it's how much?」
- 回复:「We specialize in vehicle parts from China. Are you looking for a part for your car or truck? You can see our inventory at www.asia-power.com.」
- 原因: Reply does not ask for any vehicle identification (VIN, model, year). Instead, it gives a generic reply and sends website link again, despite customer asking about a specific part (money phone plastic).

### [ev-2026-07-15T084920230Z-210dd66a] `声音 - 短句；一条消息最多 3–4 行` （confidence=medium）
- 客户:「Hello please  are you there?」
- 回复:「Yes, I'm here. What vehicle parts do you need?」
- 原因: Reply is a short sentence asking what vehicle parts customer needs, which is correct to ask but lacks website link for new customer or unclear demand per rule that new/unclear customers must be given www.asia-power.com and demand asked.

### [ev-2026-07-15T085041487Z-4d77ccd7] `整体销售思路 - 第一段锁定 - VIN优先及需求确认` （confidence=high）
- 客户:「I want crv 2028 engine and gearbox」
- 回复:「We can help with CRV parts. The 2028 model is very new. For the engine and gearbox, can you share the VIN or engine code? Our stock ships from China and takes a」
- 原因: Reply correctly confirms model and year with correction from 2028 to 2008 later, asks for VIN or engine code, gives shipping info and set expectation for lead time. Shows good professional behavior and confidence building.

### [ev-2026-07-15T085406661Z-00d772ec] `整体销售思路 - 第一段锁定 - 继续确认并问VIN` （confidence=high）
- 客户:「Is 2008 please 🙏」
- 回复:「Understood, for a 2008 CRV. Can you share the VIN or engine code so I can confirm the correct part? Our stock still ships from China and takes about 45-60 days 」
- 原因: Reply correctly adjusts to corrected year 2008 and repeats request for VIN or engine code and shipping info, showing clarity and professionalism.

### [ev-2026-07-15T085713993Z-eb8515b1] `整体销售思路 - 第一段锁定 - 针对关键细节（发动机尺寸）继续确认并正式请求VIN` （confidence=high）
- 客户:「Is 2.4」
- 回复:「Yes, for a 2.4L engine and gearbox for the 2008 CRV. Can you provide the VIN or full engine code to ensure we find the exact match?」
- 原因: Reply confirms engine size and reiterates asking VIN/engine code to ensure exact match, following professional procedure.

### [ev-2026-07-15T221302470Z-6b450f9e] `库存与地点` （confidence=high）
- 客户:「Pas de problème pour le délai, à Kinshasa vous travaillez avec quelle agence ?」
- 回复:「Notre équipe vous communiquera directement les détails de l'agence à Kinshasa. Nous sommes toujours en attente de la confirmation du prix de votre boîte de vite」
- 原因: 客户问加纳以外的城市（Kinshasa），要明确说明不是在当地有代理，不能暗示有当地代理，但回复中未说明这一点，反而模糊称“团队会告知当地代理”，容易让客户误会

### [ev-2026-07-15T161235669Z-fc3cf264] `身份与 VIN: 客户给的 VIN/车台号/铭牌：当作已确认事实保存，后续禁止再问 VIN` （confidence=high）
- 客户:「Emgine」
- 回复:「Thanks for confirming you need the engine. Can you share the VIN so we can check for absolute compatibility? These engines typically ship from China and arrive 」
- 原因: 客户已经明确表明需要发动机，后续回复中不应再重复问客户提供 VIN，重复问 VIN 会导致客户不耐烦。

### [ev-2026-07-15T220203334Z-fbe5f96f] `永远不要 暴露翻译软件 / OCR / 内部工具 / JSON / 审批流程` （confidence=high）
- 客户:「Traduction francais stp」
- 回复:「Okay, translating to French. Nous pouvons vous aider avec des pièces pour Honda Civic 2007. Notre équipe est en train de vérifier les prix ; ces pièces sont exp」
- 原因: Reply contains 'Okay, translating to French.', which exposes translation action to customer, violating the rule forbidding revealing translation or internal tool processes.

### [ev-2026-07-15T103557410Z-b0756492] `声音 / 禁止重复等待话术` （confidence=high）
- 客户:「Please confirm the price of both 32 and 27 engine for me.」
- 回复:「We are still confirming the exact prices for the 32 and 27 engines with our team. These engines would be shipped from China, which typically takes 45-60 days by」
- 原因: 重复使用“still confirming the exact prices”等待话术超过一次，违反“同一对话里等待话术只说一次就够”的规则。

### [ev-2026-07-15T110308621Z-dcea499b] `三段式信息收集（第一段锁定 Which+What）` （confidence=high）
- 客户:「Including shipping」
- 回复:「We can include shipping from China, which takes 45-60 days by sea. To give you an exact price, do you need the engines with or without turbocharging, and do you」
- 原因: 客户已明确需要发动机，且之前多次问价格，最后一句回复又再次重复问VIN或完整车辆细节，且未明确确认之前客户有效需求，违反“不在同一对话里重复问配件需求”的规则，且需求已明确，应避免重复问同一个问题。

### [ev-2026-07-15T095705940Z-dfaabade] `禁止开场：`Hi there!`` （confidence=high）
- 客户:「Please have been calling madam on video call but not answering she sent me at the market」
- 回复:「Hi there. I understand you're trying to reach someone. Please call our support line at 054 913 5916, or visit www.asia-power.com and let me know what you're loo」
- 原因: Reply starts with 'Hi there.' which is explicitly forbidden as an opening phrase.

### [ev-2026-07-15T095705940Z-dfaabade] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「Please have been calling madam on video call but not answering she sent me at the market」
- 回复:「Hi there. I understand you're trying to reach someone. Please call our support line at 054 913 5916, or visit www.asia-power.com and let me know what you're loo」
- 原因: Reply gives the support phone number on a message that is not a direct request for human contact or urgent communication, violating the rule that only allows giving the number when customer explicitly asks or when stuck.

### [ev-2026-07-15T155100289Z-d30a67ff] `三段式信息收集 / 锁定Which + What / 价格与单位` （confidence=high）
- 客户:「How much Wil the full engine cost for the shipping?」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: 客户已经明确提供了车型、年份和发动机代码（VW Golf 4, BSE engine），已具备准确需求信息，不应再用泛泛的问法“Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?”重新问VIN或车型，属于重复无效的询问，容易引起客户不耐烦。

### [ev-2026-07-15T192215901Z-55d618f3] `声音 - 不用每次都在后面加`I'll let you know`这类重复的尾巴` （confidence=high）
- 客户:「OK」
- 回复:「No problem. I will let you know once my team confirms the price.」
- 原因: Reply adds 'I will let you know once my team confirms the price.' after 'No problem.', which is a repetitive tail phrase discouraged by the rules.

### [ev-2026-07-15T192330822Z-61a4f37e] `三段式信息收集 - 不要跳过 Which/What 直接进入报价；已给车型年份配件需求后，不再重复问VIN/model` （confidence=high）
- 客户:「OK」
- 回复:「Please check our real stock, photos, VIN and custom half-cuts at www.asia-power.com — what VIN or model are you looking for?」
- 原因: After customer already gave 'Honda Odyssey 2009' and 'engine with gearbox', agent again asks 'what VIN or model are you looking for?', repeating a known question without new info.

### [ev-2026-07-15T082727710Z-f58e5cc1] `官网链接重复使用次数限制` （confidence=high）
- 客户:「How is the parts going」
- 回复:「The parts business is good. What part are you looking for? You can check our inventory at www.asia-power.com.」
- 原因: 在同一对话里，这是第3次发送官网链接www.asia-power.com，规则限制同一对话官网首页链接最多发2次，超过后应直接回应客户问题。

### [ev-2026-07-15T082826940Z-3e18e160] `官网链接重复使用次数限制` （confidence=high）
- 客户:「Did you shop already」
- 回复:「Yes, you can check our inventory at www.asia-power.com. What are you looking for?」
- 原因: 在同一对话里，这是第4次发送官网链接www.asia-power.com，规则限制同一对话官网首页链接最多发2次，超过后应直接回应客户问题，不重复发 homepage 链接。

### [ev-2026-07-15T142244928Z-239dbf30] `整体销售思路 > 三段式信息收集（5W2H） > 第一段锁定 Which + What` （confidence=medium）
- 客户:「I need Hyundai sonata 2008 model  dashboard」
- 回复:「Okay, I understand you need a dashboard for a Hyundai Sonata 2008 model. I will confirm the price with our team. Please note, items ship from China and sea frei」
- 原因: 客户提供了车型和年份，但代理未进一步确认发动机代码或具体配件详细需求（例如变速箱pin数等），没有按照优先级继续精准锁定需求

### [ev-2026-07-15T142437988Z-30dbd050] `整体销售思路 > 三段式信息收集（5W2H） > 第一段锁定 Which + What` （confidence=medium）
- 客户:「Also check the price of the engine for same Hyundai sonata 2008」
- 回复:「I will also confirm the price for the engine for your Hyundai Sonata 2008 model with the team. This will ship from China and delivery typically takes 45-60 days」
- 原因: 客户已明确是 Hyundai Sonata 2008，代理重复只说会确认价格，没有确认发动机详细编码或具体零件细节，没有提升需求清晰度

### [ev-2026-07-15T145451732Z-761c9aa9] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「Are you on wechat?」
- 回复:「We are here on WhatsApp. You can also call our team at 054 913 5916 for assistance.」
- 原因: 客服在客户仅问是否使用WeChat时直接提供人工电话号码，违反了禁止在正常询盘流程中随意甩电话号码的规则。

### [ev-2026-07-15T145620383Z-62b3a8ef] `禁止随意甩人工电话号码（054 913 5916）` （confidence=high）
- 客户:「Are you on wechat」
- 回复:「We are available here on WhatsApp. You can also call us at 054 913 5916.」
- 原因: 同样的，客户再一次询问是否有微信时，回复又直接甩电话号码，违反规则中明确禁止在正常询盘流程先直接给号码的规定。

### [ev-2026-07-15T171548442Z-c46dddbb] `声音 / 不用感叹号` （confidence=high）
- 客户:「Hello, how are you? I am a mechanic and I understand even how to dismantle cars and I want to work with you. I live here in Morocco.」
- 回复:「Hello! It's great to connect with a mechanic from Morocco. Please visit www.asia-power.com to see our parts. What specific vehicle parts are you looking for?」
- 原因: Reply uses 'Hello! It's great to connect...' with an exclamation mark, violating the '不用感叹号' (no exclamation mark) rule in reply tone.

## B. 好例子（正例沉淀）

- [ev-2026-07-15T134338103Z-9859d10d] 根据客户明确需求（engine with gearbox set）直接回复确认库存并主动跟进报价与订单安排，显示专业推动成交思路 （规则提示: 三段式信息收集-第一段锁定-What; 成交三要素-信心累积）
- [ev-2026-07-15T142310623Z-0b91dc37] 清楚说明价格包含细节（EXW、shipping、customs、inspection），增强信心，避免含糊其辞 （规则提示: 价格与单位-价格细节说明; 三段式信息收集-成交推进-清晰介绍价格细节）
- [ev-2026-07-15T134755506Z-b440ebfa] 对客户时区及时间表达及时反馈，并明确后续实际操作安排（中国明早测试发动机并发送视频），展示专业和诚实可信 （规则提示: 三段式信息收集-信心累积-主动披露物流与操作时效）
- [ev-2026-07-15T091240783Z-801f4f14] 清晰说明加纳办公室位置和库存实际情况，明确告知库存在中国发货及运输时间，符合库存与地点规则，提高客户信心。 （规则提示: 库存与地点 - 明确解释加纳办公室非库存地，物流时效说明）
- [ev-2026-07-15T091530078Z-d3f5630c] 耐心且明确告知库存不在阿克拉，说明海运时间，主动引导客户通过官网查看库存，并继续询问具体需求，有效推进成交。 （规则提示: 库存与地点 + 三段式信息收集（Which+What））
- [ev-2026-07-14T223154419Z-0511c361] 回复中确认客户车辆（车型+年份+型号）和具体需求配件，展示专业性和信心，符合第一段锁定规则。 （规则提示: 三段式信息收集 - 第一段锁定（Which+What））
- [ev-2026-07-14T183231670Z-5e104a9a] Starts new customer conversation with website link plus a natural question about customer's need, in compliance with the new customer / fuzzy opening requirement. （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-14T183533246Z-2793c94d] Politely asks for clearer VIN photo after customer sends image, following the step of locking down Which (VIN) before quoting price. （规则提示: 三段式信息收集：第一段·锁定（Which + What））
- [ev-2026-07-14T184116242Z-99857e39] Confirms the VIN received and asks for the exact part needed (engine, gearbox, half-cut), showing professional and precise demand clarification. （规则提示: 确认车辆信息后，只问缺失关键细节）
- [ev-2026-07-14T223833052Z-3a49c4dc] 首次对话以客户语言回复，并且符合新客户/模糊开场规则，主动附上官网链接并询问客户需求，自然顺畅。 （规则提示: 声音; 新客户 / 模糊开场）
- [ev-2026-07-15T121303910Z-cc0123a1] 客户问价格时，先未编造价格，先引导客户先确认车型/VIN，提醒查看官网，符合禁止编造价格及正确询问VIN的规则。 （规则提示: 价格与单位; 三段式信息收集）
- [ev-2026-07-15T121626264Z-65f55077] 针对客户表达急迫，主动披露物流时效45-60天，体现真实存在的紧迫感提示，符合成交三要素和库存与地点规则。 （规则提示: 库存与地点; 成交推进）
- [ev-2026-07-15T203029807Z-2be51dcc] 对新客户开场，带上了官网链接并询问具体需求，符合“新客户 / 模糊开场 → 必须带网站 + 问需求”规则。 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T204622977Z-e8ace535] 确认了客户给的具体车型、年份和发动机代码，体现专业细节，并说明海运时效45-60天，增强信心。 （规则提示: 三段式信息收集 / 信心是累积的 / 海运时效规则）
- [ev-2026-07-15T203935588Z-534ec47d] 主动问发动机代码细节，避免泛泛询问车型年份，精准询问专业关键参数。 （规则提示: 三段式信息收集（第一段）/ 展示专业性）
- [ev-2026-07-15T024406972Z-0ca1d327] Good new customer opening with website link and demand question as per rules (website + ask what looking for). （规则提示: New customer opening + website + asking demand）
- [ev-2026-07-15T050805551Z-b7d0b585] Prioritized specific vehicle info (model + year + drivetrain) before price quoting, asked engine size for precision, showing professional VIN/part info gathering. （规则提示: Three-stage info gathering: prioritize vehicle details before quoting）
- [ev-2026-07-15T053749779Z-9212efbf] Clear detailed quote with correct FOB China and shipping cost separately, asking for order confirmation to advance sale. （规则提示: Price & unit clarity + price + shipping + asking for order）
- [ev-2026-07-14T184526140Z-f15ad3c5] 主动引导客户确认具体部件需求（engine, gearbox, half-cut），符合第一段锁定阶段要求，提升专业感和信心。 （规则提示: 三段式信息收集·第一段锁定（Which + What））
- [ev-2026-07-15T165826867Z-90f1e899] 详细解释库存发货流程（45-60天海运，客户可在加纳办事处提货），清晰说明中国发货且有当地收货方案，符合库存与地点规则，加深客户信任。 （规则提示: 库存与地点）
- [ev-2026-07-15T165944429Z-3e5ed7ba] 客户回复“Ok”时，代理回一句“Have a nice day.”，展现出人情味和得体结尾，符合声音规则中避免干巴巴结尾的要求。 （规则提示: 声音）
- [ev-2026-07-15T090124345Z-fb22ca13] 在客户新开场时，符合新客户开场规则，提供了官网链接并主动询问具体需求，符合规则要求。 （规则提示: 声音 + 三段式信息收集）
- [ev-2026-07-15T090443195Z-0ec07531] 准确识别车辆：FORD / 2006 / Explorer，进一步精准询问需求（发动机，变速箱，半切），符合第一段锁定信息原则，体现专业性。 （规则提示: 三段式信息收集（第一段，Which+What） + 可适当展示专业性）
- [ev-2026-07-15T090553187Z-ea906de9] 确认并保存客户提供的 VIN，主动说明中国发货和海运时效（45-60天），符合库存与地点及成交三要素中信心的构建，专业且诚实不虚假。 （规则提示: 库存与地点 + 成交三要素（信心））
- [ev-2026-07-14T185350434Z-ea9be911] 开头简洁，直接提出具体需求（请求发动机照片）来避免错误，符合第一段锁定信息收集的要求。 （规则提示: 三段式信息收集 - 锁定阶段应尽量明确确认关键信息）
- [ev-2026-07-14T185417117Z-ca03191a] 礼貌确认收货并说明接下来团队的动作，表现专业并累积客户信心。 （规则提示: 信心是累积的 - 诚实可信，体现团队会快速跟进）
- [ev-2026-07-14T185616497Z-f8377756] 主动说明后续报价流程和货源位置，体现诚实可信避免客户误解可能是加纳现货，且表达期待客户配合照片，有助成交。 （规则提示: 库存与地点 - 明确说明中国发货和交期，避免误解）
- [ev-2026-07-14T185415345Z-7d0902eb] 回复明确说明了后续动作安排（明天发高质量照片确认），且包含了物流时间（中国发货），体现专业和诚实可信的信心累积，符合 成交三要素 中信心和专业细节展示要求。 （规则提示: 整体销售思路 - 成交三要素 - 信心是累积的）
- [ev-2026-07-15T073133025Z-d29c5000] New customer, reply includes website link and asks customer what they are looking for, following the rule for new customer / unclear inquiry （规则提示: 新客户 / 模糊开场 — 必须带网站 + 问需求）
- [ev-2026-07-15T073246827Z-47018af4] Confirms details with specific model info and asks for additional needed info (model year or VIN) in a clear, professional way following the 3段式信息收集 first phase （规则提示: 三段式信息收集 — 第一段·锁定（Which + What））
- [ev-2026-07-15T073633004Z-dab85357] Correctly explains that Ghana office is in Accra, no inventory there, and website items ship from China by sea, clarifying location and inventory per rules （规则提示: 库存与地点 — 清楚说明没有本地库存，加纳办公室只服务当地客户）
- [ev-2026-07-14T100745782Z-d2a5fac9] 使用阿拉伯语自然回复客户，同时短句清晰，问了具体需求细节（产品类型、数量、目的港），符合声音规则中‘像真人 WhatsApp，短句，不用感叹号’和信息收集第一段锁定原则。 （规则提示: 声音 + 整体销售思路 - 三段式信息收集）
- [ev-2026-07-14T100728374Z-6cba9096] 简洁说明收到客户照片，告知团队将确认发动机，真实可信且自然，没有重复等待话术。 （规则提示: 声音 - 像真人 WhatsApp，不像客服机器人 + 信心累积）
- [ev-2026-07-15T085041487Z-4d77ccd7] Confirms the vehicle model and year, corrects customer's mistake with professionalism, and asks for VIN or engine code to confirm part needs. Provides shipping origin and expected lead time to build trust and set proper expectation. （规则提示: 整体销售思路 - 三段式信息收集 - 第一段锁定 - VIN/车型/发动机代码优先）
- [ev-2026-07-15T085406661Z-00d772ec] Acknowledges customer's correction and continues to ask for VIN or engine code while reminding about sea freight time, demonstrating professionalism and continuous information gathering. （规则提示: 整体销售思路 - 三段式信息收集 - 第一段锁定）
- [ev-2026-07-15T085713993Z-eb8515b1] Based on confirmed engine size, asks for specific VIN or full engine code to ensure precise matching of parts, showing high professionalism and reducing risk of mismatch. （规则提示: 整体销售思路 - 三段式信息收集 - 第一段锁定 - 关键细节确认）
- [ev-2026-07-15T220443858Z-7d34fa04] 准确识别了VIN（车台号）并且提问具体需求（engine, gearbox, half-cut），符合三段式第一段信息收集第1点，提升专业信心 （规则提示: 三段式信息收集（1）：先锁定VIN和具体需求）
- [ev-2026-07-15T220856596Z-8de51385] 主动披露了中国发货和预计45-60天海运时效，符合库存与地点相关规则，提升诚信和信心 （规则提示: 库存与地点）
- [ev-2026-07-15T221535611Z-82fe1195] 简短回应客户的“ok”，没有重复啰嗦，符合声音章节关于简短话术的要求 （规则提示: 声音）
- [ev-2026-07-14T215541236Z-d87f697c] Includes website link for new customer and asks what the customer is looking for, following rule for new/unclear inquiries. （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-14T215640662Z-24050b37] Provides website link with detailed information and asks for VIN or model, following first phase info collection. （规则提示: 三段式信息收集（5W2H）—优先询问VIN或具体车型年份发动机代码）
- [ev-2026-07-15T175606021Z-a7e2405a] Properly welcomes customer with name and website link and asks for needs, suitable for new customer or unclear intent. （规则提示: 客户自我介绍时要欢迎+自我介绍+带官网询问需求）
- [ev-2026-07-15T161036944Z-6fa8871f] 包含官网链接和询问客户提供准确的 VIN 或车型，符合新客户/模糊开场规则；短句且自然表达。 （规则提示: 新客户 / 模糊开场必须带官网 + 询问需求）
- [ev-2026-07-15T161330598Z-720e67fa] 清楚说明加纳办公室只有客服，没有库存，并且表明货物从中国海运且时效45-60天，符合库存与地点规则。 （规则提示: 客户问地理位置时，需澄清加纳办公室为服务处无库存，货品从中国海运）
- [ev-2026-07-15T161814398Z-02080986] 对客户简单客套回应且带祝福有温度，符合『客套话简短对应』和『对话结束时带祝福口吻』规则。 （规则提示: 客户说客套话，简短对应且适当带祝福）
- [ev-2026-07-15T215921217Z-59f1eb2a] Good new customer opening: included website www.asia-power.com plus asked natural question 'What are you looking for today?' in English, matching rule for new customer English default response and website inclusion. （规则提示: 声音 - 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T220050273Z-c59fd6e2] Professional and clear info about shipping origin and duration plus request specific part needed, advancing the sales process with clear logistics detail and parts inquiry after confirming model+year. （规则提示: 整体销售思路 - 锁定阶段和第二段摸底阶段 - 准确车型确认后询问具体需求 + 库存与地点 - 说明中国发货与海运时间）
- [ev-2026-07-15T220716169Z-ce6f5979] Polite and brief customer thank you reply with 'No problem.' matching the rule to keep short polite responses to thanks without unnecessary extra phrases. （规则提示: 声音 - 客户说谢谢/不客气/没事这类客套话，简短对应一句就行）
- [ev-2026-07-14T233606527Z-2ba84ddd] 无缝引导客户提供精准VIN或发动机代码，体现专业性和三段式信息收集中第一段“锁定”（Which+What），有助累积信心。 （规则提示: 三段式信息收集 / 信心累积）
- [ev-2026-07-15T071936903Z-1490ecfb] 自然地带入官网链接和询问完整车辆信息，同时避免直接停留在不能报价阶段，推进成交且避免直接问价格数字，符合“问价时先要 VIN 或model+year+engine code”规则。 （规则提示: 价格与单位 / 三段式信息收集）
- [ev-2026-07-15T105956896Z-3366fe36] 在说明海运时效的同时，继续引导客户提供VIN或车辆详细信息，体现诚实可信并充实专业性，符合成交推进中累积信心和展示专业细节原则。 （规则提示: 信心累积 / 库存与地点）
- [ev-2026-07-15T095922876Z-4841d619] Politely asks for a clearer photo or VIN/frame number, which aligns with the first stage of 'Which' to identify the vehicle, showing professional approach and immediate follow-up on customer input. （规则提示: 三段式信息收集（第一段·锁定） + 回复顺序（问配件））
- [ev-2026-07-15T140922326Z-1f1b85bd] Provides website link and asks for VIN or model, correctly pushing for vehicle identification (Which) and linking to official stock info on www.asia-power.com, matching the rule that new/unclear inquiries start with website + what are you looking for. （规则提示: 声音 - 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T154202890Z-40eda839] 符合新客户开场规范，回复中包含官网链接 www.asia-power.com 并附带询问需求“What part are you looking for today?”，正确引导客户提供具体需求。 （规则提示: 声音 / 新客户开场必须带官网 + 问需求）
- [ev-2026-07-15T154319609Z-3bcbd24b] 确认了客户提供的具体车型、年份和发动机代码（VW Golf 4 1.6 BSE engine），同时主动告知中国发货和海运时效45-60天，体现专业和诚实可信。 （规则提示: 整体销售思路 / 三段式信息收集锁定 / 成交三要素：信心）
- [ev-2026-07-15T191528608Z-239d2938] Proper new customer opening with website link and question about customer's needs, following the rule for new customer and website mention. （规则提示: 声音 - 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T191838727Z-8618ed56] Asks for VIN/frame to confirm exact matching unit after customer provided model/year/part, showing professional detail and following first stage info gathering. （规则提示: 整体销售思路 - 三段式信息收集 - 第一段·锁定 - 优先级顺序确认信息及What需求）
- [ev-2026-07-15T192001072Z-0e53194f] Confirms customer's gearbox type and proactively provides shipping origin and ETA, showing honesty and professional attitude to build confidence. （规则提示: 整体销售思路 - 信心是累积的 - 主动披露物流时效而不是等被问）
- [ev-2026-07-15T081721087Z-e02773aa] 第一条消息中包含了官网首页链接并询问客户需求，符合新客户开场规则，专业且顺畅。 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T142150557Z-fdd1cec2] 开头自然并且首次回复中带上了官网首页链接和询问具体需求，符合新客户开场要求 （规则提示: 声音 > 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T142244928Z-239dbf30] 主动说明库存货从中国发出和海运时效，提升客户信心透明度 （规则提示: 库存与地点 > 不要等客户问才说——顺带说清楚中国发货，海运时间）
- [ev-2026-07-15T142408271Z-d213b611] 客户表明‘Ok’结束对话，回一句‘No problem. Have a nice day!’，结尾带有人情味的祝福 （规则提示: 声音 > 对话明显要结束时，回一句简单祝福比干巴巴的 Ok 更得体）
- [ev-2026-07-15T145354541Z-a03f21a4] 新客户开场回复带上了官网链接并问需求，符合新客户/模糊开场必须带网站+问需求的规定。 （规则提示: 新客户 / 模糊开场 → 必须带网站 + 问需求）
- [ev-2026-07-15T145607155Z-e3920794] 对客户询问官网地址回复确认了网址，短句且信息准确，没有多余话语，符合声音短句原则。 （规则提示: 声音 - 短句；一条消息最多 3–4 行）
- [ev-2026-07-15T171431980Z-096a682c] Compliant new customer opening: includes website link and asks for vehicle parts, matching new customer requirement to provide www.asia-power.com plus a question about needs. （规则提示: 声音 / 新客户开场一律带网站+问需求）
- [ev-2026-07-15T173146346Z-df0b7c60] Directly asks for VIN or model after providing website and stock info, following the 3-step info collection and promoting VIN over vague description. （规则提示: 整体销售思路 / 三段式信息收集）

正例文件目录: `docs/zijing-training/good-examples/`

## 红线确认

- 未修改 `LIVE-RULES.md`
- 未自动改 bridge / prompt / Decision
- 未把发现自动合并成「新规则建议」条文（给人决定）
