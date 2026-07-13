# Customer-reported working assumption (CEO 2026-07-13)

## Principle

> Use customer information as a working assumption.  
> Verify only when the commercial risk justifies it.

中文：把客户信息当作可工作的初步依据；只有当商业风险值得时，才进一步验证。

## Field status

| 状态 | 含义 |
|------|------|
| `customer_reported` | 客户已明确陈述；**可用**于推进销售对话 |
| `verified` | 已用证据确认（铭牌/照片/可靠交叉） |
| **规则** | `customer_reported ≠ verified`，但 **≠ 无效 / 不可忽略** |

## When to verify（主动补证据）

1. 错配成本高（如修理厂装车）  
2. 即将正式报价 / 采购 / 发货  
3. 信息冲突  
4. 客户不确定（maybe / I think / mechanic said）  
5. 该型号高频混淆或版本风险  

## When NOT to default-distrust

- 客户表达明确（如 `2sz` / `Engine code is 2SZ` / `Need G4KD`）  
- 上下文一致  
- 尚未进入报价/发货闸口  

→ 先记入 `customer_reported`，推进 scope / quantity 等，**不要每次默认要铭牌照片**。

## Config

`config/commercial-decision-v1.json` → `customer_reported_policy`  
`sales_core/commercial_decision.py` 消费该策略。
