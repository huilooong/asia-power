# APSALES-NLU-002 — Production Validation

**Mode:** live（CEO US allowlist suffix `5223`）  
**Business number:** +86 166 3880 1930

## Deploy (qty binding)

| 项 | 值 |
|----|-----|
| Commit | `d519e7940` |
| Release (api) | `REL-20260713122504-api-d519e7940` |
| Python sync | `sales_core/*` + `whatsapp_cloud_sandbox_reply.py` → AsiaPower |

## Live Graph — quantity regression (2026-07-13)

| 轮次 | 入站 | decision | 出站 | 结果 |
|------|------|----------|------|------|
| 1 | `2sz` | commercial_decision | Noted 2SZ… long block or complete engine? | PASS |
| 2 | `Complete engine` | commercial_decision | What quantity do you need? | PASS |
| 3 | `1` | commercial_decision | **Which destination port?** | PASS（无欢迎语） |
| 3 replay | 同 wamid `1` | skipped | `outbound_idempotent_skip` | PASS |

### conversation_state `wa:19402375223`

| 字段 | 值 |
|------|-----|
| `known.product_scope` | `complete_engine` |
| `known.quantity` | `1` |
| `last_system_action` | `ask_destination` |
| outbound | Which destination port? |

## Double “1” welcome (pre-fix)

| 观察 | 结论 |
|------|------|
| 12:15:20Z + 12:15:45Z 两次 `1` | **两个不同 inbound wamid** |
| 两次不同 wamid_out | 两次真实 Graph 发送 |
| 原因 | 数量未绑定 → Python 未走 Commercial → `core` import 失败 → **fallback 欢迎语** |
| 非幂等漏发 | P2 按 wamid 正确；重复是客户/测试重发了第二条 `1` |

## Rollback

```bash
RESTORE_CONFIRM=REL-20260713122504-api-d519e7940 node scripts/release-restore.mjs REL-20260713122504-api-d519e7940
# 并回滚 AsiaPower sales_core / sandbox_reply 到上一 commit
```
