#!/usr/bin/env python3
"""CLI for 子敬 to log verified distribution actions + notify CEO."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from customer_gateway.distribution_progress import (  # noqa: E402
    format_progress_text,
    get_progress,
    record_event,
)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Log APSales distribution action")
    p.add_argument(
        "--action",
        required=True,
        choices=["group_join", "post_published", "post_pending", "scan_done", "reply_found", "followup_drafted", "email_received"],
    )
    p.add_argument("--wave", "--wave-id", dest="wave_id", default="", help="wave_id e.g. wave1-en-gh-ng")
    p.add_argument("--no-notify", action="store_true", help="Skip Telegram notify")
    p.add_argument("--json", action="store_true", help="Output JSON result")

    # group_join
    p.add_argument("--group-name", default="")
    p.add_argument("--group-url", default="")
    p.add_argument("--platform", default="facebook")
    p.add_argument("--market", default="")
    p.add_argument("--screenshot-note", "--proof", dest="screenshot_note", default="")

    # post_published
    p.add_argument("--scheme", "--scheme-id", dest="scheme_id", default="")
    p.add_argument("--post-url", default="")
    p.add_argument("--listing-url", default="https://asia-power.com/half-cuts/")
    p.add_argument("--ceo-approved-at", default="")
    p.add_argument("--content", default="", help="Full post text (max 2000 chars)")
    p.add_argument("--caption-short", default="", help="Short image-first caption (FB ≤500, X ≤280)")
    p.add_argument("--content-file", default="", help="Read post text from file")

    # scan / reply
    p.add_argument("--posts-scanned", type=int, default=0)
    p.add_argument("--pending-replies", type=int, default=0)
    p.add_argument("--customer-handle", default="")
    p.add_argument("--snippet", default="")
    p.add_argument("--draft-id", default="")
    p.add_argument("--thread-id", default="")
    p.add_argument("--subject", default="")

    p.add_argument("--test-batch", action="store_true", help="Mark as CEO test batch")
    p.add_argument("--manual-note", default="", help="Manual publish instructions")
    p.add_argument("--image-url", action="append", default=[], dest="image_urls", help="Image URL(s) for manual post")
    p.add_argument("--progress", action="store_true", help="Show progress only")
    return p


def main() -> int:
    args = build_parser().parse_args()

    if args.progress:
        if args.json:
            print(json.dumps(get_progress(), ensure_ascii=False, indent=2))
        else:
            print(format_progress_text())
        return 0

    content = args.content
    if args.content_file:
        content = Path(args.content_file).read_text(encoding="utf-8")

    fields = {
        "group_name": args.group_name,
        "group_url": args.group_url,
        "name": args.group_name,
        "url": args.group_url,
        "platform": args.platform,
        "market": args.market,
        "screenshot_note": args.screenshot_note,
        "scheme_id": args.scheme_id,
        "post_url": args.post_url,
        "listing_url": args.listing_url,
        "ceo_approved_at": args.ceo_approved_at,
        "post_content": content,
        "content": content,
        "caption_short": args.caption_short,
        "posts_scanned": args.posts_scanned,
        "count": args.posts_scanned,
        "pending_replies": args.pending_replies,
        "customer_handle": args.customer_handle,
        "snippet": args.snippet,
        "draft_id": args.draft_id,
        "thread_id": args.thread_id,
        "subject": args.subject,
        "test_batch": args.test_batch,
        "manual_note": args.manual_note,
        "image_urls": args.image_urls,
    }

    try:
        result = record_event(
            args.action,
            wave_id=args.wave_id,
            notify=not args.no_notify,
            **{k: v for k, v in fields.items() if v not in ("", 0, None)},
        )
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        event = result.get("event") or {}
        print(f"✅ 已记录: {event.get('summary', args.action)}")
        print(f"Telegram 已通知 CEO: {result.get('notified', 0)} 条")
        print(format_progress_text())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
