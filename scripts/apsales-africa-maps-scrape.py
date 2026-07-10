#!/usr/bin/env python3
"""Africa-wide Google Maps scrape — 54 countries, resume-capable.

Saves → memory/customer_gateway/africa_maps_leads.jsonl
Progress → memory/customer_gateway/africa_maps_progress.json
Email drafts → outreach_queue (CEO approval only, NO auto-send)

Usage:
  python3 scripts/apsales-africa-maps-scrape.py --force
  python3 scripts/apsales-africa-maps-scrape.py --force --aggressive --no-cap
  python3 scripts/apsales-africa-maps-scrape.py --force --max-countries 5
  python3 scripts/apsales-africa-maps-scrape.py --status
  python3 scripts/apsales-africa-maps-scrape.py --report
  python3 scripts/apsales-africa-maps-scrape.py --report --live
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    pass


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="子敬 · 非洲全量 Google Maps 获客")
    p.add_argument("--force", action="store_true", help="Run regardless of FB block trigger")
    p.add_argument("--aggressive", action="store_true", default=True, help="CEO sprint: 40/query, 6 scroll, per-country 500 (default on)")
    p.add_argument("--no-cap", action="store_true", default=True, help="No country/draft caps — all 54 countries (default on)")
    p.add_argument("--slow", action="store_true", help="Disable aggressive defaults (legacy pacing)")
    p.add_argument("--max-countries", type=int, default=0, help="Process N countries this run (0=all remaining)")
    p.add_argument("--max-drafts", type=int, default=0, help="Draft cap override (0=config default 50)")
    p.add_argument("--start-index", type=int, default=-1, help="Override resume index")
    p.add_argument("--purge-invalid", action="store_true", help="Remove leads with neither phone nor email")
    p.add_argument("--status", action="store_true", help="Show progress only")
    p.add_argument("--report", action="store_true", help="Print CEO report table")
    p.add_argument("--live", action="store_true", help="Report: show last entry + hourly rate")
    p.add_argument("--json", action="store_true", help="JSON output")
    return p


def main() -> int:
    args = build_parser().parse_args()

    from customer_gateway.africa_maps_prospect import (
        _load_progress,
        format_progress_report,
        load_africa_config,
        purge_invalid_africa_leads,
        rebuild_progress_from_leads,
        run_africa_maps_batch,
        should_run_africa_maps,
        write_africa_maps_report,
    )

    if args.purge_invalid:
        purged = purge_invalid_africa_leads()
        progress = rebuild_progress_from_leads(_load_progress())
        purge_out = {"purge": purged, "totals": progress.get("totals")}
        if args.status or args.report or args.json:
            if args.report:
                print(format_progress_report(progress, live=args.live))
            elif args.json:
                purge_out["report"] = format_progress_report(progress, live=args.live)
                print(json.dumps(purge_out, ensure_ascii=False, indent=2))
            else:
                print(json.dumps(purge_out, ensure_ascii=False, indent=2))
            if not args.force:
                return 0
        else:
            print(json.dumps(purge_out, ensure_ascii=False, indent=2))
            if not args.force:
                return 0

    if args.status or args.report:
        progress = _load_progress()
        cfg = load_africa_config()
        countries = cfg.get("countries") or []
        live = args.live or args.report
        out = {
            "should_run": should_run_africa_maps(force=args.force)[0],
            "country_index": progress.get("country_index"),
            "countries_total": len(countries),
            "countries_done": progress.get("countries_done"),
            "totals": progress.get("totals"),
            "drafts_created": progress.get("drafts_created"),
            "updated_at": progress.get("updated_at"),
        }
        if args.json:
            out["report"] = format_progress_report(progress, live=live)
            print(json.dumps(out, ensure_ascii=False, indent=2))
        elif args.report:
            print(format_progress_report(progress, live=live))
            write_africa_maps_report(progress, live=live)
        else:
            print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    aggressive = args.aggressive and not args.slow
    no_cap = args.no_cap and not args.slow
    max_countries = args.max_countries if args.max_countries > 0 else None
    max_drafts = args.max_drafts if args.max_drafts > 0 else None
    start_index = args.start_index if args.start_index >= 0 else None
    if no_cap:
        max_countries = None
        max_drafts = None

    result = run_africa_maps_batch(
        force=args.force or aggressive or no_cap,
        max_countries=max_countries,
        max_drafts=max_drafts,
        start_index=start_index,
        aggressive=aggressive,
        no_cap=no_cap,
    )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if result.get("skipped"):
            print(f"— 非洲 Maps 跳过: {result.get('reason', '?')}")
        else:
            print(f"=== 非洲 Maps 全量获客 · 触发 {result.get('trigger', '?')} ===")
            print(f"  方法: {result.get('method', '?')}")
            print(f"  本轮查询: {result.get('queries_run', 0)}")
            print(f"  新线索: {result.get('new_leads', 0)} · 邮件草稿: {result.get('new_drafts', 0)}")
            print(f"  进度: {result.get('countries_done', 0)}/{result.get('countries_total', 54)} 国")
            if result.get("draft_ids"):
                print(f"  草稿 ID: {', '.join(result['draft_ids'][:5])}")
            if result.get("errors"):
                print(f"  ⚠️  {len(result['errors'])} 条错误（见日志）")
            print("\n" + (result.get("report") or ""))
            print("\n  📌 草稿仅入队，须 CEO 批准后才可发送")

    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
