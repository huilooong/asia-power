# APSALES-NLU-001 — Review

## 是否达成核心目标

是：客户消息先 Message Understanding → Conversation State → Commercial Decision；死循环保护生效；V1 Decision 保留。

## 风险与残留

| 风险 | 说明 | 缓解 |
|------|------|------|
| 短噪声码误抽 | 过宽 whitelist | 置信度 + Decision 仍要证据 |
| LLM 路径 | 非 CDR 路径仍可能绕过 | sandbox 优先 CDR；后续收紧 |
| 状态文件本地盘 | 多进程争用 | 单机 WhatsApp worker 可接受 |
| 首次回复仍问铭牌 | 允许一次 | 第二轮必须换路径 |

## CEO 验收点

1. 白名单内发 `2sz` → 可问铭牌一次  
2. 再发 `Engine code is 2sz` → 必须承认 2SZ，且不再孤立重复铭牌句  
3. Evidence 能回答：理解成什么 / 新学到什么 / 为何此动作 / 是否拦重复
