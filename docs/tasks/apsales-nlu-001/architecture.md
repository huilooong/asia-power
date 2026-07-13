# APSALES-NLU-001 — Architecture

## 正式调用顺序（硬性）

```
Customer Message
  → Message Understanding          (sales_core/message_understanding.py)
  → Conversation State Update      (sales_core/conversation_state.py)
  → Vehicle Intelligence           (仅 VIN 等需要时)
  → Commercial Decision V1         (sales_core/commercial_decision.py + prior_state)
  → Dead-loop Guard                (conversation_state.apply_dead_loop_guard)
  → Truth Guard / Channel Policy
  → Reply
  → Evidence                       (+ message_understanding / state_before/after)
```

## 模块职责

| 模块 | 职责 | 禁止 |
|------|------|------|
| Message Understanding | 行为 + 实体结构化 | 不选 next_best_action |
| Conversation State | 合并客户陈述、asked、unavailable | 不猜测价格/库存 |
| Commercial Decision V1 | 基于结构化事实选一个 NBA | 不解析自然语言原意 |
| Dead-loop Guard | 拦截连续同 action / 同 reply | 不用同义词糊弄 |
| Evidence | 审计理解与决策 | 不驱动 Decision（状态文件驱动） |

## WhatsApp 接线

`scripts/whatsapp_cloud_sandbox_reply.py` → `_commercial_decide_reply`  
`server/lib/whatsapp-cloud-sandbox.js` → 传 Evidence 扩展字段  
状态持久化：`data/whatsapp_cloud/conversation_state/wa:<digits>.json`

## 确定性优先

- 短代码 / VIN / 数量 / 「Engine code is X」→ 正则
- 澄清 / 纠正 / 否定 / 指代 → 规则 + 上下文标志
- LLM 仅作复杂兜底（本 hotfix 不扩大 LLM 依赖）
