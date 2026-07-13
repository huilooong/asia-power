# APSALES-NLU-001 — Production Validation

**Mode:** `WHATSAPP_AUTONOMY_MODE=sandbox`（未解除白名单）  
**Target number:** +86 166 3880 1930  
**CEO test wa_id:** `19402375223`

## Deploy

| 项 | 值 |
|----|-----|
| Commit | `c8aa7160c` |
| Release | `REL-20260713104418-api-c8aa7160c` |
| Python sync | rsync → `/root/.openclaw/workspace/AsiaPower/` sales_core + sandbox script + config |
| Autonomy | sandbox（确认） |

## 生产侧复测（同一脚本路径，非开陌生人）

| 轮次 | 输入 | next_action | 关键回复要点 |
|------|------|-------------|----------------|
| 1 | `2sz` | `ask_engine_plate` | 识别 2SZ；可问铭牌一次 |
| 2 | `Engine code is 2sz` | `ask_engine_photo` | act=`clarify_information`；承认 confirming 2SZ；**不再** ask_engine_plate |

生产机 `tests/test_apsales_nlu_001.py`：**12/12 PASS**  
JS 接线：`messageUnderstanding` / Evidence `message_understanding`：**OK**

## Checklist

| 项 | 结果 |
|----|------|
| `2sz` → 抽出 2SZ customer_reported | **PASS** |
| 第二轮澄清不同 NBA | **PASS**（photo） |
| 回复承认 2SZ | **PASS** |
| 白名单未开陌生人 | **PASS** sandbox |
| Evidence 新字段接线 | **PASS**（代码已部署） |

## Rollback

```bash
RESTORE_CONFIRM=REL-20260713104418-api-c8aa7160c node scripts/release-restore.mjs REL-20260713104418-api-c8aa7160c
# 并回滚 AsiaPower sales_core / scripts / config 到上一稳定版本
```
