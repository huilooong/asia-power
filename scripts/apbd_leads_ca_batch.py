#!/usr/bin/env python3
"""Batch Canada auto-repair lead discovery under APBD (quota-aware).

Usage:
  python scripts/apbd_leads_ca_batch.py --limit-per-city 15 --max-cities 8
  python scripts/apbd_leads_ca_batch.py --dry-run
  python scripts/apbd_leads_ca_batch.py --fixtures-only
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_env_keys() -> None:
    """Load GOOGLE_* keys from .env without executing arbitrary shell fragments."""
    import os

    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        key, val = s.split("=", 1)
        key = key.strip()
        if not key.startswith("GOOGLE_") and not key.endswith("_API_KEY"):
            continue
        if key in os.environ and os.environ.get(key):
            continue
        os.environ[key] = val.strip().strip('"').strip("'")


def main() -> int:
    parser = argparse.ArgumentParser(description="APBD Canada leads batch discover")
    parser.add_argument("--limit-per-city", type=int, default=15)
    parser.add_argument("--max-cities", type=int, default=8)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--fixtures-only", action="store_true")
    parser.add_argument("--enrich", action="store_true", default=True)
    args = parser.parse_args()

    _load_env_keys()

    from agents.apbd.leads.market_config import get_country, load_markets
    from agents.apbd.leads.pipeline import ingest_fixture_companies, run_discover, run_enrich, run_score
    from agents.apbd.leads.refresh import coverage_report

    report: dict = {
        "started_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "mode": "fixtures_only" if args.fixtures_only else ("dry_run" if args.dry_run else "live"),
        "city_results": [],
        "errors": [],
    }

    if args.fixtures_only or args.dry_run:
        fixture = ROOT / "tests" / "fixtures" / "apbd_leads" / "canada_sample.json"
        data = json.loads(fixture.read_text(encoding="utf-8"))
        if not args.dry_run:
            report["fixtures"] = ingest_fixture_companies(data["companies"])
        else:
            report["fixtures"] = {"ok": True, "dry_run": True, "count": len(data["companies"])}

    if not args.fixtures_only:
        ca = get_country(load_markets(), "CA")
        cities: list[str] = []
        for region in ca.get("regions") or []:
            for city in region.get("cities") or []:
                cities.append(str(city))
        cities = cities[: max(1, args.max_cities)]

        for city in cities:
            result = run_discover(
                country="CA",
                city=city,
                limit=args.limit_per_city,
                dry_run=args.dry_run,
            )
            report["city_results"].append({"city": city, **result})
            if result.get("error_code") == "missing_places_api_key":
                report["errors"].append(result.get("error"))
                break
            if result.get("quota_exhausted"):
                report["errors"].append(f"quota_exhausted_after:{city}")
                break

        if not args.dry_run and args.enrich and not report["errors"]:
            report["enrich"] = run_enrich(country="CA", limit=args.limit_per_city * len(cities))
            report["score"] = run_score(country="CA")

    coverage = coverage_report(country="CA")
    report["coverage"] = coverage
    report["finished_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    out_dir = ROOT / "runtime" / "apbd" / "leads" / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"ca-batch-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Also write a human summary markdown for CEO
    md_path = ROOT / "docs" / "ops" / "apbd-ca-leads-quality-report.md"
    md_path.parent.mkdir(parents=True, exist_ok=True)
    cov = coverage.get("coverage") or {}
    md = f"""# 加拿大汽修潜客 · 质量报告

生成时间：{report['finished_at']}

| 项 | 值 |
|----|----|
| 模式 | {report['mode']} |
| 有效店数 | {coverage.get('valid_total')} |
| 目标 | {coverage.get('target_total')} |
| 缺口 | {coverage.get('gap_to_target')} |
| 电话覆盖 | {cov.get('phone_pct')}% |
| 网站覆盖 | {cov.get('website_pct')}% |
| 邮箱覆盖 | {cov.get('email_pct')}% |
| 已评分 | {cov.get('scored_pct')}% |
| 已批准 outreach | {(coverage.get('counts') or {}).get('approved_for_outreach')} |
| 中文证据确认 | {(coverage.get('counts') or {}).get('chinese_confirmed')} |

机器报告：`{out_path.relative_to(ROOT)}`
覆盖率 JSON：`{coverage.get('path')}`

## 说明

- Places 使用免费 Demo Key；缺 Key 或 429 会停止并写入 errors，不抓 Maps 网页。
- 冲满 500 需多日分批：`python scripts/apbd_leads_ca_batch.py --limit-per-city 15 --max-cities 8`
- 销售侧只读 `approved_for_outreach`（`/outreach scan` → source=`apbd_leads`）。
"""
    md_path.write_text(md, encoding="utf-8")
    print(json.dumps({"ok": True, "report": str(out_path), "markdown": str(md_path), "valid_total": coverage.get("valid_total"), "gap": coverage.get("gap_to_target"), "errors": report["errors"]}, ensure_ascii=False, indent=2))
    return 0 if not (report["errors"] and report["mode"] == "live" and coverage.get("valid_total", 0) == 0) else 2


if __name__ == "__main__":
    raise SystemExit(main())
