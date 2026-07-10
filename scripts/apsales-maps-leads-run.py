#!/usr/bin/env python3
"""Google Maps prospecting — fallback when FB/social blocked or idle.

Saves leads → memory/customer_gateway/maps_leads.jsonl
Email drafts → memory/customer_gateway/outreach_queue/ (CEO approval only, NO auto-send)

Usage:
  python3 scripts/apsales-maps-leads-run.py
  python3 scripts/apsales-maps-leads-run.py --force
  python3 scripts/apsales-maps-leads-run.py --json --max-leads 3 --max-drafts 2
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
    p = argparse.ArgumentParser(description="子敬 · Google Maps 客户开发（草稿须 CEO 批准）")
    p.add_argument("--force", action="store_true", help="Run even without FB block")
    p.add_argument("--social-idle", action="store_true", help="Treat as social-idle trigger")
    p.add_argument("--max-leads", type=int, default=0, help="Override daily lead cap (0=config)")
    p.add_argument("--max-drafts", type=int, default=0, help="Override daily draft cap (0=config)")
    p.add_argument("--json", action="store_true", help="JSON output")
    p.add_argument("--status", action="store_true", help="Show caps + trigger status only")
    return p


def main() -> int:
    args = build_parser().parse_args()

    from customer_gateway.maps_prospect import (
        _load_state,
        load_maps_config,
        run_maps_prospect_batch,
        should_run_maps_fallback,
    )

    if args.status:
        cfg = load_maps_config()
        caps = cfg.get("daily_caps") or {}
        state = _load_state()
        should, reason = should_run_maps_fallback(force=args.force, social_idle=args.social_idle)
        out = {
            "should_run": should,
            "trigger_reason": reason,
            "daily_caps": caps,
            "today": {
                "leads": state.get("leads_today", 0),
                "drafts": state.get("drafts_today", 0),
            },
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    max_leads = args.max_leads if args.max_leads > 0 else None
    max_drafts = args.max_drafts if args.max_drafts > 0 else None

    result = run_maps_prospect_batch(
        force=args.force,
        social_idle=args.social_idle,
        max_leads=max_leads,
        max_drafts=max_drafts,
    )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if result.get("skipped"):
            print(f"— Maps 获客跳过: {result.get('reason', '?')}")
        else:
            print(f"=== Google Maps 获客 · 触发 {result.get('trigger', '?')} ===")
            print(f"  方法: {result.get('method', '?')}")
            print(f"  搜索: {len(result.get('queries_run') or [])} 条查询")
            print(f"  新线索: {result.get('new_leads', 0)} · 邮件草稿: {result.get('new_drafts', 0)}")
            if result.get("draft_ids"):
                print(f"  草稿 ID: {', '.join(result['draft_ids'])}")
            if result.get("errors"):
                print(f"  ⚠️  {', '.join(result['errors'][:3])}")
            print(f"  今日累计: 线索 {result.get('leads_today', 0)} · 草稿 {result.get('drafts_today', 0)}")
            print("  📌 草稿仅入队，须 CEO 批准后才可发送")

    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
