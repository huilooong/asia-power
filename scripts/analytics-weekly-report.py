#!/usr/bin/env python3
"""Generate AsiaPower weekly traffic markdown + CSV from site-analytics-daily.json."""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

INTERNAL_IPS = {
    "154.160.0.87",
    "154.160.16.2",
    "154.160.2.165",
    "154.160.22.51",
    "154.161.159.43",
    "154.161.36.176",
    "154.161.50.101",
}


def is_internal(ip: str) -> bool:
    return ip in INTERNAL_IPS


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def daily_rows(data: dict) -> list[dict]:
    rows = []
    for day in sorted(data.keys()):
        bucket = data[day]
        ips = bucket.get("uniqueIps") or {}
        paths = bucket.get("paths") or {}
        int_hits = sum(info.get("hits", 0) for ip, info in ips.items() if is_internal(ip))
        ext_ips = {ip for ip in ips if not is_internal(ip)}
        rows.append(
            {
                "date": day,
                "pageviews": bucket.get("pageviews", 0),
                "external_pageviews": max(0, bucket.get("pageviews", 0) - int_hits),
                "unique_ips": len(ips),
                "external_unique_ips": len(ext_ips),
                "whatsapp": bucket.get("whatsappClicks", 0),
                "halfcut_pv": sum(v for p, v in paths.items() if "/half-cuts/" in p),
                "internal_hits": int_hits,
            }
        )
    return rows


def write_csv(out_dir: Path, data: dict, rows: list[dict]) -> None:
    daily_path = out_dir / "analytics-daily-latest.csv"
    with daily_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "date",
                "pageviews",
                "external_pageviews",
                "unique_ips",
                "external_unique_ips",
                "whatsapp_clicks",
                "halfcut_pv",
                "internal_hits",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r["date"],
                    r["pageviews"],
                    r["external_pageviews"],
                    r["unique_ips"],
                    r["external_unique_ips"],
                    r["whatsapp"],
                    r["halfcut_pv"],
                    r["internal_hits"],
                ]
            )

    pages = Counter()
    for bucket in data.values():
        for p, c in (bucket.get("paths") or {}).items():
            pages[p] += c
    top_path = out_dir / "analytics-top-pages.csv"
    with top_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["path", "pageviews"])
        for p, c in pages.most_common(100):
            w.writerow([p, c])


def markdown_summary(rows: list[dict], search: dict, date_tag: str) -> str:
    if not rows:
        return f"# AsiaPower Traffic Report ({date_tag})\n\nNo data.\n"
    start, end = rows[0]["date"], rows[-1]["date"]
    total_pv = sum(r["pageviews"] for r in rows)
    ext_pv = sum(r["external_pageviews"] for r in rows)
    total_wa = sum(r["whatsapp"] for r in rows)
    lines = [
        f"# AsiaPower 访问周报（自动生成）",
        "",
        f"> 生成时间：{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} · 区间 {start} ~ {end}",
        "",
        "## 核心 KPI（外网口径，已剔除 7 个加纳内测 IP）",
        "",
        "| 指标 | 全部 | 外网（真实） |",
        "|------|------|--------------|",
        f"| 页面浏览 PV | {total_pv} | {ext_pv} |",
        f"| WhatsApp 点击 | {total_wa} | {total_wa}* |",
        "",
        "*WhatsApp 暂无法按 IP 拆分，仍显示总量。",
        "",
        "## 日趋势",
        "",
        "| 日期 | PV | 外网 PV | UV | 外网 UV | WA | 半切 PV |",
        "|------|-----|---------|-----|---------|-----|---------|",
    ]
    for r in rows:
        lines.append(
            f"| {r['date']} | {r['pageviews']} | {r['external_pageviews']} | "
            f"{r['unique_ips']} | {r['external_unique_ips']} | {r['whatsapp']} | {r['halfcut_pv']} |"
        )

    queries = sorted((search.get("queries") or {}).values(), key=lambda x: -(x.get("n") or 0))[:10]
    if queries:
        lines.extend(["", "## Top 搜索词", ""])
        for q in queries:
            lines.append(f"- **{q.get('q')}** — {q.get('n')} 次")

    lines.extend(
        [
            "",
            "## 下一步",
            "",
            "1. 打开 Admin → Analytics，切换 **External / 外网** 视图核对。",
            "2. 完整 17 章运营报告见 `reports/asia-power-traffic-report-YYYY-MM-DD.md`（人工版）。",
            "3. 原始 CSV：`reports/analytics-daily-latest.csv`、`reports/analytics-top-pages.csv`。",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--daily", required=True)
    parser.add_argument("--search", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--date-tag", required=True)
    args = parser.parse_args()

    data = load_json(Path(args.daily))
    search = load_json(Path(args.search))
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = daily_rows(data)
    write_csv(out_dir, data, rows)

    md = markdown_summary(rows, search, args.date_tag)
    (out_dir / f"asia-power-traffic-weekly-{args.date_tag}.md").write_text(md, encoding="utf-8")
    print(json.dumps({"days": len(rows), "external_pv": sum(r["external_pageviews"] for r in rows)}))


if __name__ == "__main__":
    main()
