# 加纳同事:白名单免自动回复 + 转发消息改英文

## 给 Cursor 的交付说明

**开始动手前**,先在本文件最下面的「Cursor 实施报告」章节追加一行「已开始 <日期时间>」,再开始改代码。

做完后把结果写进本文件最下面的「Cursor 实施报告」章节(带日期,追加,不覆盖)。

## Context

龙哥反馈(2026-07-16):"把我们的同事加入白名单,对他不要用自动回复,还有转发给他的消息用英文,他是加纳人,我们现在的agent发给他的是中文,他看不懂。"

**假设澄清(如果错了请龙哥指正,先按这个做)**:系统里目前唯一有"加纳同事"身份的号码,是 [[project_deploy_notes]] 之前实现的 Ghana customer support line —— 本地格式 `054 913 5916` / E.164 `+233 54 913 5916`(记录在 `data/knowledge-base/company-contacts.md`)。这个号码已经在跑一个"交接通知"功能(`deploy/apsales-live-draft/ghana-staff-handoff.mjs`,2026-07-15 上线):当 +233 线子敬 agent 的回复里包含这个号码(说明把联系方式给了客户),系统会主动给这个号码发一条 WhatsApp,告知客户号码 + 聊天概况。**这条通知现在是中文写死的**("📞 客户可能会联系你" / "客户号码:" / "最近聊天概况:" / "客户: ... 子敬: ..."),这正是龙哥说"看不懂"的那条消息。

两个问题要分开修:

### 问题 1:转发给他的消息是中文

`ghana-staff-handoff.mjs` 里 `notifyGhanaStaffIfHandingOff()` 组装的 `lines` 数组是中文硬编码。改成英文。`buildHandoffSummary()` 里摘要的 `客户:` / `子敬:` 标签同理改成 `Customer:` / `Zijing:` (或 `Agent:`,内部工具消息,叫法不影响客户侧品牌)。

### 问题 2:如果这位同事自己发消息进来,不要触发自动回复

调查确认(`deploy/apsales-live-draft/bridge.mjs`):inbound 消息处理目前只区分两种情况——(a) `classifyFromMeMessage(message) === "bot_echo"`,即消息本身是从 AsiaPower 业务号发出去的(团队在同一个号上手动回复客户),这种会走 `appendTeamReply` 记录、不自动回复(约 line 985-1018);(b) 其它所有 `message.fromPhoneE164` 开头是 `+` 的号码,一律当普通客户走 `runOpenClawReply()` 全套 LLM 自动回复流程(约 line 1021 起)。

**这位同事的号码 `+233549135916` 是一个独立手机号,不是业务号本身**——如果他直接给 AsiaPower 的 WhatsApp 业务号发消息(比如回复刚才收到的交接通知,或者主动找子敬确认什么),他的消息会落进 (b) 分支,被当成陌生客户走 LLM 自动回复,生成的回复大概率答非所问甚至奇怪。这就是龙哥说的"对他不要用自动回复"。

## 设计

### 1. 内部号码名单,做成可扩展列表(不要只塞一个数字进 if 判断)

在 `bridge.mjs` 顶部(挨着现有的 `GHANA_SUPPORT_CONTACT_LOCAL`/`GHANA_SUPPORT_CONTACT_E164` 常量)加:

```js
const INTERNAL_STAFF_NUMBERS_E164 = (
  process.env.APSALES_INTERNAL_STAFF_NUMBERS_E164 || GHANA_SUPPORT_CONTACT_E164
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isInternalStaffNumber(senderId) {
  const digits = String(senderId || "").replace(/\D/g, "");
  if (!digits) return false;
  return INTERNAL_STAFF_NUMBERS_E164.some(
    (n) => String(n).replace(/\D/g, "") === digits,
  );
}
```

用逗号分隔的环境变量而不是单个变量,是为了以后再加第二个内部号码时不用改代码——只加环境变量。默认值就是现有的加纳 support 号,保证零配置也生效。

### 2. 在客户处理分支最前面拦截

在 `bridge.mjs` 约 line 1029 `const senderId = message.fromPhoneE164;` 之后、开始跑 `buildVoiceContext`/LLM 之前,加:

```js
const senderId = message.fromPhoneE164;
if (isInternalStaffNumber(senderId)) {
  log("ignored inbound from internal staff number", { senderId, messageId: message.messageId });
  await appendActivity(
    "apsales_internal_staff_message_skipped",
    `内部同事消息不自动回复 ${senderId}`,
    "skipped",
  );
  return;
}
```

**不要静默丢弃**——用 `appendActivity` 留一条记录,万一以后同事说"我发消息你们没理我",能查到是被这条规则拦下的,不是系统故障。

如果他确实需要人工/agent 回应(比如他也想问库存问题),这条规则只是关掉*自动*回复,不影响团队成员在 WhatsApp 里手动回他——这跟"不转人工,agent 是主线"的既有原则(见 `ghana-staff-handoff-notify.md` 的 Context)不矛盾,因为这里针对的是员工本人,不是客户。

### 3. `ghana-staff-handoff.mjs` 消息模板改英文

```js
const lines = [
  "New contact shared with a customer",
  `Customer number: ${senderId}`,
  summary ? `\nRecent chat summary:\n${summary}` : "(no chat summary available yet)",
];
```

`buildHandoffSummary()` 里:

```js
return recent
  .map((t) => {
    const msg = String(t.customer?.message || "").slice(0, 200);
    const reply = String(t.reply?.text || "").slice(0, 200);
    return `Customer: ${msg}\nAgent: ${reply}`;
  })
  .join("\n---\n");
```

## 验证

- `tests/test_ghana_staff_handoff.js` 现有 8 个测试里断言消息文案的部分(如果有硬编码中文字符串的断言)要同步改成英文期望值,不要留下断言仍然要求中文、跟代码实际输出不一致的假通过。
- 新增测试覆盖 `isInternalStaffNumber()`:命中 `+233549135916`(以及本地格式数字如果混进来也要能命中,用 digits-only 比较);不命中普通客户号码。
- 新增测试覆盖 inbound 主流程:mock 一条 `fromPhoneE164 = "+233549135916"` 的消息,断言没有调用 `runOpenClawReply`/LLM 路径,也没有调用 `session.sendText` 给他自动回复;`appendActivity` 记录了跳过事件。
- 部署后人工验证:让这位同事的号码给 AsiaPower WhatsApp 业务号发一条消息,确认没有收到子敬的自动回复(生产日志里能看到 `ignored inbound from internal staff number`);再触发一次正常的"分享联系方式给客户"场景,确认他这次收到的交接通知是英文。

## Cursor 实施报告

<!-- 追加,不要覆盖之前记录 -->

- 已开始 2026-07-17 ~01:49 Asia/Shanghai（Cursor）

### 完成报告 — 2026-07-17 ~01:52（Cursor）

**状态**: 已落地并准备部署 `apsales-openclaw`

**做了什么**:
1. 交接通知全文改英文（`New contact shared…` / `Customer:` / `Agent:`）；去掉中文硬编码
2. 内部同事白名单：`apsales-internal-staff.mjs` + bridge 入口跳过自动回复（默认 `+233549135916`，可用 `APSALES_INTERNAL_STAFF_NUMBERS_E164` 扩展）
3. 测试：`tests/test_ghana_staff_handoff.js` 英文断言；新增 `tests/test_apsales_internal_staff.mjs`

**验证**: `node --test tests/test_ghana_staff_handoff.js tests/test_apsales_internal_staff.mjs` → 全部通过

**未做 / 人工后续**:
- 生产上让加纳同事给业务号发一条消息，确认无自动回复 + 日志有 `ignored inbound from internal staff number`
- 正常客户触发一次分享联系方式，确认同事收到英文交接通知

**生产 Release**: `REL-20260717015327-apsales-openclaw-61c87ee6b`（服务 active；boot 日志 internalStaffCount=1, hotDealStallMs=7200000）
