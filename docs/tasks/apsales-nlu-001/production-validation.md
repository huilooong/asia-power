# APSALES-NLU-001 — Production Validation

**Mode:** `WHATSAPP_AUTONOMY_MODE=sandbox`（未解除白名单）  
**Target number:** +86 166 3880 1930  
**CEO test wa_id:** `19402375223`

## Deploy steps (executed)

1. Commit + push GitHub  
2. Release Manager `api`（`server/lib/whatsapp-cloud-sandbox.js` + `asiapower-evidence.js`）  
3. rsync Python 到 `/root/.openclaw/workspace/AsiaPower/`：
   - `sales_core/message_understanding.py`
   - `sales_core/conversation_state.py`
   - `sales_core/commercial_decision.py`
   - `scripts/whatsapp_cloud_sandbox_reply.py`
   - `config/commercial-decision-v1.json`
4. 确认 autonomy 仍为 sandbox  
5. 生产侧本地复测同一对话（或 CEO WhatsApp 手测）  
6. 核对 Evidence turn 含 `message_understanding` / `state_before` / `state_after` / `repeated_action_blocked`

## Checklist

| 项 | 期望 | 结果 |
|----|------|------|
| `2sz` → 抽出 2SZ | customer_reported | _pending deploy fill_ |
| 第二轮澄清不同 NBA | ≠ ask_engine_plate | _pending deploy fill_ |
| 回复承认 2SZ | 含 confirming | _pending deploy fill_ |
| 白名单未开陌生人 | sandbox | OK（部署前已确认） |
| Evidence 新字段 | 有 | _pending deploy fill_ |

## Rollback

```bash
# inventory-site API：Release Manager 回滚上一 Release
# AsiaPower Python：从上一 commit checkout 对应 sales_core / scripts / config
```
