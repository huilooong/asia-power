# APSALES-NLU-001 — Analysis

**Status:** P0 Hotfix audit complete  
**Date:** 2026-07-13

## 结论

真实 WhatsApp 三次重复 `Please send a clear engine plate photo.` 的根因不是 Commercial Decision V1 规则不够，而是：

1. **Message Understanding 缺失** — `2sz` / `Engine code is 2sz` 未结构化；
2. **Conversation State 未跨轮合并** — 每轮只看当前 raw text；
3. **Decision 入口绕过正式顺序** — sandbox 对未命中 fast path 的文本仍落到「无状态」CDR。

## 生产调用链（审计）

```
Meta webhook
→ server/lib/whatsapp-cloud-webhook.js
→ normalize
→ server/lib/whatsapp-cloud-sandbox.js (allowlist / autonomy)
→ spawn scripts/whatsapp_cloud_sandbox_reply.py
→ (旧) decide_commercial(raw text) 或 LLM
→ Truth Guard / Risk Policy
→ sendText
→ Evidence (只记录，不反馈下一轮 Decision)
```

## 问题答卷（审计时）

| # | 问题 | 审计结论 |
|---|------|----------|
| 1 | `2sz` 识别成什么？ | 旧 `engine_code_pattern` **不匹配** 2SZ；实体为空；意图落到 default / low-confidence |
| 2 | `Engine code is 2sz`？ | 同样未抽出 engine_code；被当成新一轮模糊询盘 |
| 3 | 为何未写入 known facts？ | 无 Conversation State；Evidence 不回灌 Decision |
| 4 | 为何仍 ask_engine_plate？ | CDR 对「声称代码但无铭牌证据」默认 `ask_engine_plate`；无 prior_asked |
| 5 | 理解 / 状态 / 传参 / 捷径？ | **理解层缺失 + 状态未持久化 + 未传 prior_state** |
| 6 | fast reply shortcut？ | 有 fast path（正则命中发动机代码/价格/冲突），但 `2sz` 常 miss → 仍进无状态 CDR |
| 7 | CDR 读 raw text？ | **是** — 旧路径几乎只 keyword / regex 当前句 |

## 真实失败对话复盘

| 轮次 | 客户 | 旧系统理解 | 旧 Decision |
|------|------|------------|-------------|
| 1 | `2sz` | 无实体 | ask_engine_plate |
| 2 | `2sz` | 无实体、无记忆 | ask_engine_plate（同句） |
| 3 | `Engine code is 2sz` | 无实体、无记忆 | ask_engine_plate（同句） |

## 修复方向（已实现）

正式顺序：

Customer Message → Message Understanding → Conversation State Update → Vehicle Intelligence → Commercial Decision → Truth Guard → Reply → Evidence

Commercial Decision V1 **保留**；只增加结构化输入与死循环保护。
