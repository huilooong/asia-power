# APBD Batch-2 Lead Discovery Report

**Date:** 2026-07-05  
**Task:** Codex batch-2 lead search (Nairobi, Dar es Salaam, Dubai)  
**Status:** ✅ 完成（原脚本已修正并成功运行）

---

## 结论

| 项目 | 结果 |
|------|------|
| 搜索目标 | 5 组 query × 城市 |
| 新增线索 | **10 条** |
| 坦桑尼亚 Dar es Salaam | 5 条 |
| 阿联酋 Dubai | 5 条 |
| 肯尼亚 Nairobi | 0 条 |
| Dubai used engines | 0 条 |
| 数据文件 | `runtime/apbd/batch2-leads.json` |

---

## 代码修正说明

原命令使用了不存在的 `LeadFinder` 类和 `async find()` 方法。

`agents/apbd/lead_finder.py` 实际提供的是**函数式 API**：

- `discover_leads()` — 批量市场搜索
- `run_lead_finder()` — 完整流水线（含 outreach 队列）
- `LeadFinderTool` — 工具类（在 `agents/apbd/tools.py`）

修正后改用 `PUBLIC_SOURCE_SEARCHERS` + `_row_to_lead()` 逐条搜索，逻辑等价于原意图。

修正脚本路径：`runtime/apbd/run_batch2_leads.py`

---

## 完整控制台输出

```
Kenya/Nairobi [auto parts]: 0 found
Kenya/Nairobi [car spare parts]: 0 found
Tanzania/Dar es Salaam [auto parts]: 5 found
UAE/Dubai [spare parts]: 5 found
UAE/Dubai [used engines]: 0 found
Total: 10 leads
```

运行耗时：约 14 秒  
退出码：0

---

## 搜索目标

| Query | City | Country |
|-------|------|---------|
| auto parts | Nairobi | Kenya |
| car spare parts | Nairobi | Kenya |
| auto parts | Dar es Salaam | Tanzania |
| spare parts | Dubai | UAE |
| used engines | Dubai | UAE |

---

## 线索明细（10 条）

### Tanzania — Dar es Salaam（5 条，query: auto parts）

| Company | Priority | Data Source | Address |
|---------|----------|-------------|---------|
| Empire Auto Spare Parts | B | openstreetmap | Twiga Street, Jangwani, Ilala Municipal |
| CHAMA AUTO SPARE PARTS | B | openstreetmap | Kajenge Road, Makumbusho, Kinondoni Municipal |
| Jjs Auto Parts | B | openstreetmap | Msimbazi Street, Jangwani, Ilala Municipal |
| Khadija Auto Parts | B | openstreetmap | Kariakoo Street, Jangwani, Ilala Municipal |
| Carmix Auto Parts | B | openstreetmap | Msimbazi Street, Jangwani, Ilala Municipal |

### UAE — Dubai（5 条，query: spare parts）

| Company | Priority | Data Source | Address |
|---------|----------|-------------|---------|
| Home Runner Auto Spare Parts Trading | B | openstreetmap | Naif area, Dubai |
| New York Auto Spare Parts | B | openstreetmap | Um Ramool, Dubai |
| Mitsubishi spare parts | B | openstreetmap | Bur Saeed, Dubai |
| First Option Auto Spare Parts Trading | B | openstreetmap | Ras Al Khor Industrial Area, Dubai |
| Blue Berry Auto Spare Parts | B | openstreetmap | Naif area, Dubai |

> 以上线索均无公开网站/邮箱/电话（均为 "Not published"），来源均为 OpenStreetMap Nominatim。

---

## 0 条结果说明

| 目标 | 可能原因 |
|------|----------|
| Kenya/Nairobi × 2 | Google Maps 需 `GOOGLE_PLACES_API_KEY`；Yellow Pages 有 Kenya 域名但本次未命中；OSM 无匹配 POI |
| UAE/Dubai used engines | OSM 无 "used engines" 匹配；Google Maps 未配置 key |

---

## 文件路径

| 文件 | 路径 |
|------|------|
| 报告 | `docs/agent-reports/codex-batch2-leads.md` |
| JSON 数据 | `runtime/apbd/batch2-leads.json` |
| 运行脚本 | `runtime/apbd/run_batch2_leads.py` |

---

## 下一步建议

1. 配置 `GOOGLE_PLACES_API_KEY` 后重跑 Nairobi / Dubai used engines，可显著提升命中率
2. 对 10 条 OSM 线索做 enrichment（补电话/网站）
3. 如需 outreach 队列，可调用 `run_lead_finder()` 或 `generate_outreach_queue(leads)`
