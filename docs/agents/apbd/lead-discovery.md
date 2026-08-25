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

### 生产细水长流（持续 · 负载门控）

意思是：**负载不高就一直小步采**；网站/WhatsApp 忙时自动停手，不退出服务。

- systemd：`apbd-ca-leads-trickle.service`（`--loop`）— **不等 4 小时轮作**
- 每批：1 城 / 约 8 家；空闲间隔约 **20s**；负载 >1.8 则等 60s
- **一直采到免费 Places 额度用完**（429 后休眠约 1 小时再试）
- 到 500：慢巡检（约 6 小时看一次）
- 资源帽：CPUQuota 35%、MemoryMax 256M、Nice 15
- Telegram：有进展 / 配额 / 里程碑才报（启动时会报一次）

```bash
systemctl status apbd-ca-leads-trickle.service
journalctl -u apbd-ca-leads-trickle.service -n 50 --no-pager

# 手动单批（调试）
cd /root/.openclaw/workspace/AsiaPower
.venv/bin/python3 scripts/apbd_leads_ca_trickle.py --limit 5 --max-cities 1
```

## Places Key

- 环境变量：`GOOGLE_PLACES_API_KEY` 或 `GOOGLE_MAPS_API_KEY`
- **缺 Key → 明确失败**（`missing_places_api_key`），禁止改抓 Google Maps 网页
- CEO 定稿：继续免费 Demo Key；撞 429 只汇报，不自动升级付费

## 加拿大官网补充（邮箱 / LinkedIn证据 / 决策人）

发现服务和补充任务都会写同一份 `companies.json`，禁止同时运行。生产批次必须：

1. 暂停 `apbd-ca-leads-trickle.service`；
2. 运行小批官网补充；脚本自动备份数据库并生成机器报告；
3. 核对 `complete`、`failed`、`new_email_records` 和证据链接；
4. 恢复发现服务。

补充器只读取公开官网：邮箱必须保留来源页；LinkedIn资料只接受官网直接链接的公开URL；
决策人接受官网结构化数据，也接受官网可见文字中明确的“姓名＋职位”关系。无法确认时写入人工LinkedIn核验提示，
不猜测姓名或邮箱。Google Places只用于复核官网、电话和营业状态，不提供邮箱。

```bash
.venv/bin/python3 scripts/apbd_leads_ca_enrich.py --dry-run --limit 10
.venv/bin/python3 scripts/apbd_leads_ca_enrich.py --limit 50 --max-pages 4 --timeout 6 --workers 6
.venv/bin/python3 scripts/apbd_leads_ca_enrich.py --limit 10 --places-fallback-limit 5
.venv/bin/python3 scripts/apbd_leads_ca_enrich.py --limit 250 --workers 6 --people-backfill
.venv/bin/python3 scripts/apbd_leads_people_audit.py
.venv/bin/python3 scripts/apbd_leads_people_audit.py --apply
.venv/bin/python3 scripts/apbd_leads_people_audit.py --apply --reset-visible
```

独立补充脚本默认使用 6 个受控并发 worker，不会并发写数据库：官网读取并行，完成后一次性落盘。
同一批仍先做数据库备份，并通过 `trickle.lock` 阻止发现服务同时写入。通用 APBD CLI 和慢巡检
默认保持单 worker，避免后台服务突然增加负载。

`--people-backfill` 只重新检查已成功读取且尚未运行当前人物提取版本的官网。人物必须在官网
可见文字中形成明确的“姓名＋Owner/Founder/President/Manager等职位”关系，并保留证据原文；
只有姓名、只有职位、客户评论或推测关系都不入库。同一姓名在JSON-LD和可见文字中只保留一人。
`--reset-visible` 用于规则版本升级时先清除旧版可见文字结果，之后再用 `--people-backfill`
全量重建；不删除独立的JSON-LD人物。门店专属URL不得直接吸收母公司团队页人物，除非证据页
属于该门店路径，或页面可见文字明确提到该潜客公司全名。

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
