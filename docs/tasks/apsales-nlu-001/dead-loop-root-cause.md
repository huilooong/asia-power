# Dead-loop Root Cause

## 现象

同一句 outbound：`Please send a clear engine plate photo.` 连续三轮。

## 根因链

1. `2SZ` 不在旧引擎代码正则 → 抽取失败  
2. 无会话状态 → 第二轮 / 第三轮仍「零已知」  
3. CDR 对低置信声称默认 `ask_engine_plate`  
4. 无「同一 next_best_action 不得连续」硬拦  
5. Evidence 只记账，不阻止重复

## 修复后的硬保护

| 保护 | 实现 |
|------|------|
| 同一 NBA 不得连续两轮 | `would_repeat_action` + Decision 内过滤 `last_action` |
| 同一 outbound 不得连续 | `outbound_hash` 规范化后比对 |
| 铭牌已不可用 | `unavailable_evidence` 剔除 `ask_engine_plate` |
| 已问过铭牌 + 客户澄清 | 改走 `ask_engine_photo` / `ask_vin` 等 |
| 仍撞车 | `apply_dead_loop_guard` → alternate / manual review 文案 |

检测对象是 **Decision Objective / Next Best Action**，不是同义词改写。

## 替代证据顺序

`ask_engine_photo` → `ask_vin` → `ask_vin_plate` → `ask_registration` → `ask_oe_label` → `request_manual_review`
