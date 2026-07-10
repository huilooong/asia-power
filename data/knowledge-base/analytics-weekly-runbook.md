# Analytics 周报 Runbook

> 一键拉生产访问数据、剔除加纳内测 IP、输出 Markdown + CSV。  
> 完整 17 章运营报告需人工/Agent 补充洞察，见 `reports/asia-power-traffic-report-YYYY-MM-DD.md`。

## 一键命令

```bash
bash scripts/analytics-weekly-report.sh
```

输出：

| 文件 | 说明 |
|------|------|
| `reports/asia-power-traffic-weekly-YYYY-MM-DD.md` | 自动摘要（KPI + 日表 + Top 搜索） |
| `reports/analytics-daily-latest.csv` | 日趋势原始表 |
| `reports/analytics-top-pages.csv` | Top 100 页面 |

## 内测 IP（展示层过滤，不删原始 JSON）

以下 7 个 IP 为加纳办公室高流量内测，Admin Analytics 默认 **External / 外网** 视图已排除：

- 154.160.0.87, 154.160.16.2, 154.160.2.165, 154.160.22.51  
- 154.161.159.43, 154.161.36.176, 154.161.50.101  

配置代码：`server/lib/analytics-internal-ips.js`

## Admin 核对

1. 打开 https://asia-power.com/admin/analytics.html  
2. 登录后点 **External / 外网**（默认）或 **All / 全部** 对比  
3. 原始数据文件（生产）：`/root/.openclaw/workspace/inventory-site/data/site-analytics-daily.json`

## 与运营 KPI 对照

| 来源 | 目标 |
|------|------|
| `data/knowledge-base/apsales-distribution-playbook.md` | 子敬 KPI = 客户访问 asia-power.com + 邮件/WhatsApp 线索 |
| Playbook P0 | 每日加入 2–3 个 FB 小组（西非 tokunbo / half cut 关键词） |
| 当前 15 天基准 | 外网 ~6,548 PV · 150 WA · 29 表单线索 |

## 故障

| 现象 | 处理 |
|------|------|
| scp 失败 | 检查 SSH `root@159.65.86.24` |
| 数据只有 15 天 | 正常 — 统计系统 2026-06-20 上线 |
| PV 突然飙高 | 先看 Admin IP 表是否内测 IP，切换外网视图 |
