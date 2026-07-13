# APSALES-DECISION-001 — Architecture

## 落点

Commercial Decision Rules V1 **落入现有 Sales Decision**，不新建 Engine。

```
Customer Message
→ Context (message facts + optional customer flags + VehicleSnapshot)
→ Vehicle Intelligence（若有 VIN）
→ Commercial Decision Rules V1   ← 本任务
→ Truth Guard
→ Channel Policy（WhatsApp）
→ Reply
→ Evidence（含 commercial_decision 记录）
```

## 模块

| 模块 | 路径 | 职责 |
|------|------|------|
| Rules + NBA | `sales_core/commercial_decision.py` | 决策记录、评分、选一个 next_best_action |
| 阈值配置 | `config/commercial-decision-v1.json` | confidence 阈值等（可配置，不散落硬编码） |
| VI 接入 | `vehicle_intelligence.build_sales_decision` | 委托 CDR |
| Sandbox 接入 | `scripts/whatsapp_cloud_sandbox_reply.py` | VIN + 引擎代码/询价走 CDR |
| Channel | `commercial_decision.apply_channel_policy` | ≤60 词、≤2 问、禁邮件口吻 |
| Evidence | sandbox / evidence 透传 `commercial_decision` | 可审计 |

## 原则映射

| 原则 | 实现要点 |
|------|----------|
| Trust First | high risk → manual_review / decline_wrong_supply |
| Business First | confidence≥threshold → 推进成交字段 |
| Evidence Guided | claimed engine_code ≠ verified |
| Current Installed Engine First | VIN vs plate/photo conflict → conflicting |
| Next Best Action | 只选一个 primary |
| One Reply, One Objective | Channel Policy 限问 |

## 非目标

自动报价数字、供应商承诺、OCR 新能力、corgi Phase 2、Coach 写规则。
