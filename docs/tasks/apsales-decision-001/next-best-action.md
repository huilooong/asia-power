# APSALES-DECISION-001 — Next Best Action

## V1 评分（可审计，非 ML）

```
action_score =
  sales_progress
  + risk_reduction
  + evidence_gain
  - customer_effort
  - delay_cost
```

只选 **一个** primary `next_best_action`。  
`alternative_actions` 记录未选候选（审计用）。

## WhatsApp Channel Policy

- ≤ 60 英文词  
- ≤ 3 短段  
- ≤ 2 紧密相关问题（默认 1）  
- 禁止 Dear Customer / Best regards / 内部标签  
- 不默认塞官网（CDR 回复默认不加，除非配置）  
- 超限 → 重写压缩，**禁止截断致残**  

## Reply

Reply = NBA 的渠道化表达，不是决策本身。
