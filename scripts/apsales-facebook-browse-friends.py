#!/usr/bin/env python3
"""Mac local: browse Facebook friends feed for dismantling / half-cut market intel."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

REPORT_DEFAULT = ROOT / "reports" / "africa-me-halfcut-intelligence-2026-07-04.md"


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="子敬 · Facebook 好友动态浏览（拆车/半切/Tokunbo）")
    p.add_argument("--minutes", type=int, default=0, help="Session length (default 5–10 random)")
    p.add_argument("--scrolls", type=int, default=0, help="Max scroll count (default env or 12)")
    p.add_argument("--max-posts", type=int, default=50, help="Max posts to scan (default 50)")
    p.add_argument("--max-friends", type=int, default=0, help="Max friend profiles to visit in --deep mode")
    p.add_argument("--deep", action="store_true", help="Also visit top friend profiles from network")
    p.add_argument("--comment", action="store_true", help="Allow 1 helpful comment if highly relevant")
    p.add_argument("--status", action="store_true", help="Show last browse session summary only")
    p.add_argument("--report", nargs="?", const=str(REPORT_DEFAULT), help="Generate intel markdown report after browse")
    p.add_argument("--json", action="store_true", help="JSON output")
    return p


def main() -> int:
    args = build_parser().parse_args()

    from integrations.social_browser.facebook_feed_research import (
        browse_friends_feed,
        generate_intel_report,
        get_browse_summary,
    )

    if args.status:
        payload = get_browse_summary()
        if args.json:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            print("=== Facebook 好友动态浏览 ===")
            print(f"上次浏览: {payload.get('last_session_at') or '尚无'}")
            print(f"时长: {payload.get('last_duration_minutes') or '—'} 分钟")
            print(f"上次情报: {payload.get('last_intel_saved', 0)} 条 · 发动机线索 {payload.get('last_engine_leads', 0)} 条")
            print(f"累计情报: {payload.get('total_intel', 0)} 条 · 发动机线索 {payload.get('total_engine_leads', 0)} 条")
            print(f"情报文件: {payload.get('intel_file')}")
        return 0

    os.environ.setdefault("APSALES_SOCIAL_BROWSER_HEADLESS", "0")

    from customer_gateway.zijing_activity_stream import track_step

    with track_step(
        "browse_feed",
        f"浏览好友动态 max_posts={args.max_posts} deep={args.deep}",
        platform="facebook",
    ):
        result = browse_friends_feed(
            session_minutes=args.minutes or None,
            max_scrolls=args.scrolls or None,
            max_posts=args.max_posts,
            max_friends=args.max_friends or (30 if args.deep else 0),
            deep=args.deep,
            allow_comment=args.comment,
        )

    report_path = None
    if result.get("ok") and args.report is not None:
        report_out = generate_intel_report(
            args.report,
            session_id=result.get("session_id"),
        )
        result["report"] = report_out
        report_path = report_out.get("path")

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"=== Facebook 好友动态浏览 · {result.get('session_id', '—')} ===")
        if result.get("ok"):
            print(
                f"✅ {result.get('duration_minutes')} 分钟 · "
                f"扫描 {result.get('posts_scanned')} 帖 · "
                f"情报 {result.get('intel_saved', 0)} 条 · "
                f"发动机线索 {result.get('engine_leads', 0)} 条"
            )
            if result.get("deep"):
                print(f"  深度模式 · 访问好友主页 {result.get('friends_visited', 0)} 个")
            if result.get("commented"):
                print("  💬 已发 1 条相关评论")
            print(f"  情报 → {result.get('intel_file')}")
            if report_path:
                print(f"  报告 → {report_path}")
        else:
            print(f"❌ {result.get('error') or result.get('message', 'failed')}")

    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
