# APSALES-NLU-002 — Production Validation

**Mode:** `WHATSAPP_AUTONOMY_MODE=live`（现网；白名单仍保留 CEO US）  
**Business number:** +86 166 3880 1930  
**US / CEO wa_id suffix:** `5223`

## Deploy

| 项 | 值 |
|----|-----|
| Commit | `f4468db45` |
| Branch | `feature/apsales-evidence-001` |
| Release (api) | `REL-20260713120527-api-f4468db45` |
| Python sync | rsync → `/root/.openclaw/workspace/AsiaPower/` `sales_core/*` + `scripts/whatsapp_cloud_sandbox_reply.py` + `tests/test_apsales_nlu_002.py` |
| Prod unit | 6/6 PASS on server |

## Live Graph 出站（白名单 US 号码）

| 轮次 | 入站 | decision | 出站要点 | wamid_out |
|------|------|----------|----------|-----------|
| 1 | `2sz` | commercial_decision | ask_scope（Noted 2SZ… long block or complete） | 已发送 |
| 2 | `Complete engine` | commercial_decision | **What quantity do you need?**（非 LLM / 非铭牌） | 已发送 |
| 2 replay | 同 wamid | skipped | `outbound_idempotent_skip` | 未重发 |
| 3 | 强制 `ask_engine_plate` 后 `[image]` | commercial_decision | **Thanks — we received your photo** + 推进 quantity | 已发送 |
| 3 replay | 同 image wamid | skipped | `outbound_idempotent_skip` | 未重发 |

## conversation_state（`wa:19402375223`）

| 字段 | 值 |
|------|-----|
| `known.product_scope` | `complete_engine` |
| `requested_evidence_received` | `true` |
| `pending_image_review` | `true` |
| `customer_reported.customer_result` | `sent_image` |
| `last_customer_message_type` | `image` |
| `last_requested_evidence` | `engine_plate` |

## Checklist

| 项 | 结果 |
|----|------|
| Complete engine → answer / commercial / 不问铭牌 | **PASS** |
| Long block（prod unit + local） | **PASS** |
| 图片确认收到、不重复要铭牌 | **PASS** |
| 同 wamid 出站幂等 | **PASS** |
| 代码含 claimInboundOnce / claimOutboundOnce | **PASS** |

## Rollback

```bash
RESTORE_CONFIRM=REL-20260713120527-api-f4468db45 node scripts/release-restore.mjs REL-20260713120527-api-f4468db45
# 并回滚 AsiaPower sales_core / scripts/whatsapp_cloud_sandbox_reply.py 到上一稳定 commit
```
