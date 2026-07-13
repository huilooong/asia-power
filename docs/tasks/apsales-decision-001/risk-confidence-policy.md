# APSALES-DECISION-001 — Risk & Confidence Policy

配置文件：`config/commercial-decision-v1.json`（**不得散落硬编码为唯一真相**）。

## 默认阈值

| 区间 | 行为 |
|------|------|
| `confidence >= advance_min`（默认 0.90） | 通常推进 scope / qty / port / quote prep |
| `caution_min`–`advance_min`（默认 0.60–0.89） | 权衡错误成本 vs 补证据成本 |
| `confidence < caution_min`（默认 0.60） | 优先高价值证据（铭牌/当前机照片） |

## 风险

| commercial_risk | 典型触发 |
|-----------------|----------|
| high | 无证据引擎代码 + 零售/未知；VIN↔铭牌冲突；疑似错配 |
| medium | provider_reported VIN；口述代码 + 部分上下文 |
| low | 已验证知识 / 批发历史一致 / 铭牌清晰且一致 |

## Trust First vs Business First

- Trust：高风险不推进错误报价  
- Business：≥90% 不无限索证  
