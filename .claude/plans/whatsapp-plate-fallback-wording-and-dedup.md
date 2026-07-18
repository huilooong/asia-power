# VIN/铭牌识别失败:文案改准确 + 防止连续刷屏

## 给 Cursor 的交付说明

两件独立的事,分开做完分开写报告:

- **A**:`plateFailureReply` 的回复文案有误导性,改成准确说明"需要车架铭牌/VIN 贴纸照片",不是暗示"拍糊了"。
- **B**:同一个客户短时间内连续发多张照片都识别失败时,现在会收到好几条一模一样的回复,改成不重复刷屏。

开始动手前,先在本文件最下面的「Cursor 实施报告」章节追加一行「已开始 <日期时间>」,注明做的是 A 还是 B。做完把结果写进同一章节(带日期,追加,不覆盖)。

## Context

2026-07-18,龙哥用测试号 `+19402375223` 连续发了 3 张照片给 +233 线,3 张都识别失败(`decodeError: "no_plate_facts"`),3 条回复一字不差,间隔几十秒(04:47:54 / 04:48:33 / 04:48:37,`bridge.mjs` 日志里的真实记录)。

龙哥指出两个问题:

1. **文案误导**:现在发的是 "Got your photo — I couldn't read the plate clearly. Could you send a clearer photo of the VIN/frame number, or type it here?"——这句话暗示"拍糊了、重拍清楚点就行"。但之前排查过一个真实案例(Zambia 客户,2026-07-17),客户发的照片其实是发动机整机照,根本没有车架铭牌/VIN 出现在画面里,不是清晰度问题,是**压根拍的不是要的东西**。龙哥怀疑这次这 3 张也是同样情况(具体内容因为服务器照片自动清理已经查不到,龙哥凭经验判断)。用"看不清"这种话术会误导客户以为要拍得更清楚,而不是拍对地方,容易导致客户反复拍同一个错误的东西。
2. **连续刷屏**:排查确认,这个失败回复走的是 `bridge.mjs` 里 `plateFailureReply()`,是独立于模型对话的确定性快速通道,**完全没有接入**现有的 `detectPossibleRepeat`/`recentAgentReplies` 防重复机制(那套只作用于模型生成的销售话术那条链路)。所以客户发几张都失败,就发几条一模一样的话,没有任何限制。龙哥原话:"非洲这些客户喜欢一次堆10几张照片,他岂不是要回十几条同样的信息"。

## A. 文案改准确

### 改动

在 `apsales-human-visibility.mjs` 里找到 `plateFailureReply` 相关的文案(`bridge.mjs` 里两处 `sheetNote`/回复文案,注意找全,不要漏了某个分支),把误导性的"看不清"措辞改成准确说明,大意(具体英文措辞可以打磨,语气参照 LIVE-RULES.md"像真人不像客服机器人"这条基调):

> 收到你的照片了,但这张里没看到车架铭牌/VIN 号——需要的是贴在车身上那个印着一串字母数字的金属铭牌或者贴纸(不是车辆本身的照片)。方便的话直接拍那个,或者你知道的话直接打字告诉我也行。

不要用"clearly"这类暗示"糊了"的词,明确说清楚"需要的是铭牌/VIN 这个特定东西,不是随便一张车的照片"。

### 验证

- 构造 mock 场景,确认新文案不包含"clearly"/"clearer"这类暗示模糊度的词,而是明确提到"VIN"/"frame plate"/"nameplate"这类具体指向。
- 人工读一遍新文案,确认符合"像真人不像客服机器人"的语气,不要写成生硬的技术说明。

## B. 防止连续刷屏

### 改动

在 `dealState` 里加一个字段记录"最近一次发过失败回复的时间"(比如 `last_plate_failure_reply_at`),`plateFailureReply` 触发前先检查:

- 如果距离上一次发送**同一条失败提示**超过一定时间窗口(建议 5-10 分钟,具体数值 Cursor 可以判断合理值,不用死板照抄),正常发送,并更新这个时间戳。
- 如果在窗口内(说明客户正在连续发多张都失败的照片),**不要重复发同一句话**——静默处理这张照片(后台还是正常跑 OCR,万一识别成功了正常走成功那条路径,不受影响),不发送第二条失败提示。
- 可以选择性地加一个"失败次数计数"(比如连续 3 次以上还没成功),达到阈值后换一句不一样的话(比如"这几张都没找到铭牌,方便直接打字告诉我底盘号/VIN 吗"),不要用同一句话在原地打转——这条呼应 `LIVE-RULES.md` 第 112 行已经有的"不要用同一个问题原地打转"这个原则,是同一类问题的另一种表现,不用重新发明逻辑,精神上保持一致就行。

**不要**把这条防重复逻辑跟模型对话那条 `detectPossibleRepeat` 机制合并或者复用同一套代码——那套是给模型生成文本用的,这里是确定性快速通道,数据结构和触发条件不一样,分开实现,保持这条通道原本"不过模型、走得快"的特性不变。

### 验证

- 复现今天这个真实案例:同一个 `senderId` 短时间内连续发 3 张都识别失败的照片,断言只发了 1 条失败提示(或者按设计如果做了"3次后换话术",断言是 1 条 + 1 条不同措辞的提示,不是 3 条一样的)。
- 间隔超过设定的时间窗口后再发一张失败的照片,断言这次正常发送提示(不会永久性哑掉,只是短时间内防刷屏)。
- 确认这张"被静默"的照片本身还是正常跑了 OCR(如果客户碰巧后面发的某一张成功识别了,成功那条路径要正常触发,不会因为前面被防刷屏逻辑拦过就跟着受影响)。

## Cursor 实施报告

<!-- 追加,不要覆盖之前记录 -->

- 已开始 2026-07-18 ~05:24 Asia/Shanghai（Cursor；A+B）

### 完成 2026-07-18 ~05:25 Asia/Shanghai（Cursor）

| 项 | 结果 |
|---|---|
| A 文案 | 成功 — `plateFailureAskCopy` 明确要铭牌/VIN 贴纸，去掉 clearly/clearer；`bridge` sheetNote 同步 |
| B 去重 | 成功 — 8 分钟窗口：第1条 primary、窗口内静默、第3次 escalate；成功路径 `plateFailureResetPatch` |
| LIVE-RULES | 成功 — 「身份与 VIN」增加铭牌照片 + 短窗口不刷屏一条 |
| 测试 | 成功 — `node --test tests/test_plate_failure_reply.js` 15/15 |
| 部署 | 成功 — `REL-20260718052600-apsales-openclaw-7645643a8` |

**改动文件**
- `deploy/apsales-live-draft/apsales-human-visibility.mjs`
- `deploy/apsales-live-draft/bridge.mjs`
- `docs/zijing-training/LIVE-RULES.md`
- `tests/test_plate_failure_reply.js`

**行为摘要**
1. 失败文案改为：需要 metal plate/sticker 上的字母数字，不是 general car/engine shot；可打字 VIN。
2. `decidePlateFailureReply`：窗口内第 2 张静默（仍跑 OCR）；第 3 张换 escalate 话术；超时后重新 primary。
3. 未并入 `detectPossibleRepeat`。

**Release:** `REL-20260718052600-apsales-openclaw-7645643a8`（commit `7645643a8`）
