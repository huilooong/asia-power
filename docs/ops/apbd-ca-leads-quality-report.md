# 加拿大汽修潜客 · 质量报告

生成时间：2026-07-24T12:34:08.197501Z

| 项 | 值 |
|----|----|
| 模式 | live |
| 有效店数 | 80 |
| 目标 | 500 |
| 缺口 | 420 |
| 电话覆盖 | 100.0% |
| 网站覆盖 | 78.8% |
| 邮箱覆盖 | 38.8% |
| 已评分 | 100.0% |
| 已批准 outreach | 1 |
| 中文证据确认 | 1 |

机器报告：`runtime/apbd/leads/reports/ca-batch-20260724-123408.json`
覆盖率 JSON：`/Users/longhui/Desktop/AsiaPower/runtime/apbd/leads/reports/coverage-ca-20260724.json`

## 说明

- Places 使用免费 Demo Key；缺 Key 或 429 会停止并写入 errors，不抓 Maps 网页。
- 冲满 500 需多日分批：`python scripts/apbd_leads_ca_batch.py --limit-per-city 15 --max-cities 8`
- 销售侧只读 `approved_for_outreach`（`/outreach scan` → source=`apbd_leads`）。
