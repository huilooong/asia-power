# APBD Durable Lead Discovery（加拿大汽修首发）

挂在现有增长 Agent **APBD（郭嘉）** 内，不新建 Agent / 不新建 CRM / 不用 SQL。

## 配置

| 文件 | 作用 |
|------|------|
| `config/apbd_leads_markets.yaml` | 加拿大城市配额与目标 500 |
| `config/apbd_lead_keywords.yaml` | 汽修 / 动力总成 / 中文服务关键词包 |
| `config/apbd_lead_scoring.yaml` | 评分权重版本（`ca-auto-repair-v1`） |

## 数据落盘

`runtime/apbd/leads/db/`

- `companies.json` — 公司主库
- `search_tasks.json` — 搜索任务日志
- `change_history.jsonl` — 字段变更
- `raw_places/` — Places 原始行
- `review_queue.json` — 人工审核队列

导出：`runtime/apbd/leads/exports/`
报告：`runtime/apbd/leads/reports/`

## CLI

```bash
python main.py "/apbd leads discover --country CA --city Richmond --limit 20"
python main.py "/apbd leads discover --country CA --city Richmond --dry-run"
python main.py "/apbd leads enrich --country CA --limit 50"
python main.py "/apbd leads score --country CA"
python main.py "/apbd leads review --country CA"
python main.py "/apbd leads approve --id lead-xxx"
python main.py "/apbd leads export --country CA --format csv"
python main.py "/apbd leads query --status approved_for_outreach --limit 20"
python main.py "/apbd leads coverage --country CA"
python main.py "/apbd leads refresh --country CA --limit 40"
python main.py "/apbd leads batch --country CA --limit 40"
python main.py "/apbd leads fixture-load"
```

分批冲 500（配额友好）：

```bash
python scripts/apbd_leads_ca_batch.py --limit-per-city 15 --max-cities 8
```

### 生产细水长流（推荐）

服务器 cron（`deploy/cron/apbd-ca-leads-trickle.cron`）：**每 4 小时**跑 1 个城市、最多约 6 家新增；负载 >1.8 自动跳过；`flock` 防重叠；`nice`/`ionice` 降优先级。有进展/撞配额/到里程碑时 Telegram 汇报。

```bash
# 手动试跑（生产）
cd /root/.openclaw/workspace/AsiaPower
nice -n 15 .venv/bin/python3 scripts/apbd_leads_ca_trickle.py --limit 6 --max-cities 1
```

## Places Key

- 环境变量：`GOOGLE_PLACES_API_KEY` 或 `GOOGLE_MAPS_API_KEY`
- **缺 Key → 明确失败**（`missing_places_api_key`），禁止改抓 Google Maps 网页
- CEO 定稿：继续免费 Demo Key；撞 429 只汇报，不自动升级付费

## 中文服务规则

只能根据公开证据标注（官网写「中文服务 / Mandarin / Cantonese」等）。
**禁止**仅凭华人姓名、长相、华人区地址推断。

## 销售侧（子敬）

`/outreach scan` 会读取 `status=approved_for_outreach` 的潜客，`source=apbd_leads`。
外发仍须 CEO / 审批门禁，禁止自动群发。

## 状态机

`discovered → enriched → needs_review → verified → approved_for_outreach`
旁路：`rejected` / `stale`

## 重验节奏（建议）

| 优先级 | 天数 |
|--------|------|
| A | 30 |
| B | 60 |
| C | 120 |
| D | 180 |

命令：`/apbd leads refresh` + `/apbd leads coverage`
