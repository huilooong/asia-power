# APSALES-NLU-001 — Implementation

## 代码变更

| 文件 | 变更 |
|------|------|
| `sales_core/message_understanding.py` | **新增** 确定性 NLU |
| `sales_core/conversation_state.py` | **新增** 状态持久化 + 死循环保护 |
| `sales_core/commercial_decision.py` | `prior_state` / `understanding`；澄清后改替代证据；承认客户声称 |
| `config/commercial-decision-v1.json` | `engine_code_pattern` 含 `[123][A-Z]{2}`（2SZ） |
| `scripts/whatsapp_cloud_sandbox_reply.py` | NLU → State → CDR → Guard |
| `server/lib/whatsapp-cloud-sandbox.js` | Evidence 传 NLU/state 字段 |
| `server/lib/asiapower-evidence.js` | Evidence turn 扩展字段 |
| `tests/test_apsales_nlu_001.py` | **新增** 回归用例 |

## 未改（按禁止项）

- 未新建微服务 / Engine  
- 未推翻 Commercial Decision V1  
- 未改 VIN Provider / 报价 / 支付  
- 未解除 WhatsApp 白名单（保持 sandbox）

## 部署注意

- `api` target：同步 `server/lib/*` 到 inventory-site  
- Python：须同步到 `/root/.openclaw/workspace/AsiaPower/` 的 `sales_core/`、`scripts/whatsapp_cloud_sandbox_reply.py`、`config/commercial-decision-v1.json`
