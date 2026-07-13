# APSALES-DECISION-001 — Decision Rules V1

## 场景 → Next Best Action（摘要）

| 场景 | 条件 | Primary NBA |
|------|------|-------------|
| A 只说发动机代码 | 无历史验证、错配风险高 | `ask_engine_plate`（次选 `ask_engine_photo`） |
| B 明确批发 | wholesaler/repeat + 批量 + 代码一致 | `ask_scope` 或已有 scope → qty/port |
| C 已发 VIN | VI 成功；需确认当前机 | 一般 scope；若需当前机 → plate/photo |
| D VIN 失败/低可信 | snapshot 不 ok / low conf | 单项最高价值证据（plate 优先） |
| E VIN vs 照片/铭牌冲突 | conflicting | `request_manual_review` 或补冲突证据 |
| F 询价 | price intent | 规格够 → 商业字段；不够 → 身份证据 |
| G 规格可信未 scope | identity ok, no scope | `ask_scope` |
| H scope 已知 | missing qty/port | 动态缺一问一 |
| I 高概率错误采购 | high risk, 难降险 | `request_manual_review` / `decline_wrong_supply` |

## 禁止

- 固定三件套同时抛出  
- 重复问 known  
- 未验证承诺库存/价格/guarantee fit / 确认发动机代码  
- 绕过 Truth Guard  
