# Coach 修复任务: no_fake_verified_claim

## 给 Cursor 的交付说明

**龙哥已通过审批网关批准本任务（编号 `MIGRATE-no_fake_verified_claim-20260722`）。**

开始动手前,先在本文件最下面的「Cursor 实施报告」章节追加一行「已开始 <日期时间>」。做完把结果写进同一章节(追加,不覆盖)。

**重要**: Sales Coach 只发现了症状,多数情况下**还没确定根因**。先排查根因,不要假设;查清楚再改代码。不要把批准当成「直接套一个 diff」。

## Context

- 批准编号: `MIGRATE-no_fake_verified_claim-20260722`
- 稳定 rule_id: `no_fake_verified_claim`
- 复发次数: 2
- 历史 evidence_ids: ev-2026-07-16T183455365Z-3a212b7b, ev-2026-07-17T121446396Z-2b78fcd9, ev-2026-07-20T081626536Z-1a2fac3a, ev-2026-07-21T080949238Z-b3797ed0
- 来源 agent: `sales_coach`
- 动作: `agent_prompt_fix`
- 原因摘要: Coach 积压清理自动派工 no_fake_verified_claim（合并 4 张 pending，第 2 次）
- Coach 证据包: rule_id=no_fake_verified_claim | confidence=high | repeat=4 distinct=4 | evidence_id=ev-2026-07-16T183455365Z-3a212b7b | reason=pending backlog migration (4 tickets) | rule_hint=no_fake_verified_claim | customer_excerpt=rule_id=永久不要_编造_已核实___已检查__p0 | confidence=high | repeat=1 distinct=1 | evidence_id=ev-2026-07-16T183455365Z-3a212b7b | reason=回复中说 'We're checking for pictures | agent_excerpt= | recurrence=2 | historical_evidence_ids=ev-2026-07-16T183455365Z-3a212b7b, ev-2026-07-17T121446396Z-2b78fcd9, ev-2026-07-20T081626536Z-1a2fac3a, ev-2026-07-21T080949238Z-b3797ed0
- 日期: 2026-07-22

这是「发现了症状,还没确定根因」类任务(除非证据里已经写明已知模式,例如再次号码泄漏)。排查优先看:
- `deploy/apsales-live-draft/bridge.mjs` 内嵌 prompt
- `docs/zijing-training/LIVE-RULES.md`
- 相关 Evidence / 客户对话原文

## 验证(固定检查项)

- 修完后用真实或构造对话验证违规不再出现。
- **如果这次改动涉及 `bridge.mjs`(或其它包含 agent 对话 prompt 的文件)里的规则,必须同步检查 `docs/zijing-training/LIVE-RULES.md` 有没有对应条目,没有就补上;Cursor 的实施报告里要明确写清楚这次有没有改 `LIVE-RULES.md`、改了哪一条,没改的话要说明为什么不需要改(比如这次只是纯代码层面的确定性检查,不涉及对话措辞规则)。**
- 需要上生产时走 Release Manager,不要 `--allow-dirty` 常态直推。

## Cursor 实施报告

<!-- 追加,不要覆盖之前记录 -->
