#!/usr/bin/env python3
"""Accept pending Facebook friend requests (human-paced, max 20/run)."""

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
    p = argparse.ArgumentParser(description="子敬 · Facebook 自动通过好友请求（限速，不群发私信）")
    p.add_argument("--max", type=int, default=0, help="Max accepts this run (default 20, cap 20)")
    p.add_argument("--json", action="store_true", help="JSON output")
    p.add_argument("--dry-run", action="store_true", help="Verify login only, do not click")
    return p


def main() -> int:
    args = build_parser().parse_args()

    from customer_gateway.social_session import session_status
    from integrations.social_browser.facebook_friends import accept_friend_requests
    from integrations.social_browser.platform_adapter import verify_login

    st = session_status("facebook")
    if args.dry_run:
        ok = verify_login("facebook")
        payload = {"logged_in": ok, "session": st}
        print(json.dumps(payload, ensure_ascii=False, indent=2) if args.json else (
            f"Facebook: {'✅ 已登录' if ok else '❌ 未登录'} · 账号 {st.get('account_label') or '—'}"
        ))
        return 0 if ok else 1

    max_accept = args.max if args.max > 0 else None
    from customer_gateway.zijing_activity_stream import track_step

    with track_step("accept_friends", f"通过好友请求 max={max_accept or 'default'}", platform="facebook"):
        result = accept_friend_requests(max_accept=max_accept)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if result.get("ok"):
            print(f"✅ 已通过 {result.get('accepted', 0)} 个好友请求（本轮上限 {result.get('max_per_run', 20)}）")
            if result.get("remaining_hint"):
                print(f"   {result['remaining_hint']}")
        else:
            print(f"❌ 失败: {result.get('error') or result.get('message') or 'unknown'}")
            if result.get("accepted"):
                print(f"   已通过 {result['accepted']} 个后停止")

    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
