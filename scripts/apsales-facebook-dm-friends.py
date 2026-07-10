#!/usr/bin/env python3
"""子敬 · Facebook 好友一对一私信（CEO 批准 · 限速 5/次 15/日）."""

from __future__ import annotations

import argparse
import json
import os
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
    p = argparse.ArgumentParser(description="子敬 · Facebook 好友一对一私信")
    p.add_argument("--dry-run", action="store_true", help="列出待发送好友，不实际发送")
    p.add_argument("--send", action="store_true", help="发送给下一批未发过的好友")
    p.add_argument("--max", type=int, default=0, help="本次最多发送人数（默认 policy 5）")
    p.add_argument("--status", action="store_true", help="显示今日 DM 统计")
    p.add_argument("--json", action="store_true", help="JSON 输出")
    return p


def main() -> int:
    args = build_parser().parse_args()

    from integrations.social_browser.facebook_messenger import (
        get_dm_stats,
        get_eligible_friends,
        load_dm_policy,
        send_friend_dms,
    )

    if args.status:
        stats = get_dm_stats()
        policy = load_dm_policy()
        stats["policy"] = policy
        if args.json:
            print(json.dumps(stats, ensure_ascii=False, indent=2))
        else:
            print("=== Facebook 好友私信 ===")
            print(f"今日已发: {stats['sent_today']} / {stats['max_per_day']}")
            print(f"今日剩余: {stats['remaining_today']}")
            print(f"累计已发: {stats['total_sent']}")
            print(f"日志: {stats['log_file']}")
        return 0

    os.environ.setdefault("APSALES_SOCIAL_BROWSER_HEADLESS", "0")

    if args.dry_run or (not args.send):
        from customer_gateway.zijing_activity_stream import log_step_end, log_step_start

        log_step_start("friend_dm", "Dry run 预览待发送好友", platform="facebook")
        result = send_friend_dms(max_send=args.max or None, dry_run=True)
        if not result.get("ok") and result.get("error") == "daily_cap_reached":
            if args.json:
                print(json.dumps(result, ensure_ascii=False, indent=2))
            else:
                print(f"❌ {result.get('message') or result.get('error')}")
            return 1

        eligible = get_eligible_friends(limit=300)
        if args.json:
            print(json.dumps({**result, "eligible_detail": eligible}, ensure_ascii=False, indent=2))
        else:
            print("=== Facebook 好友私信 · Dry Run ===")
            print(f"好友总数（页面抓取）: {eligible.get('total_friends', '—')}")
            print(f"已发过: {eligible.get('already_messaged', 0)}")
            print(f"待发送: {eligible.get('eligible_count', 0)}")
            print(f"今日已发: {eligible.get('sent_today', 0)} / {eligible.get('max_per_day', 15)}")
            print(f"今日还可发: {eligible.get('remaining_today', 0)}")
            print(f"本批计划（max {result.get('max_per_run', 5)}）: {result.get('would_send', 0)} 人")
            preview = result.get("friends_preview") or []
            if preview:
                print("\n下一批好友:")
                for f in preview:
                    print(f"  · {f.get('name')} ({f.get('friend_id')})")
            if result.get("message_preview"):
                print("\n消息预览:\n---")
                print(result["message_preview"])
                print("---")
        log_step_end("friend_dm", f"预览 would_send={result.get('would_send', 0)}", platform="facebook", status="completed")
        return 0

    if args.send:
        from customer_gateway.zijing_activity_stream import track_step

        max_n = args.max or None
        with track_step("friend_dm", f"发送私信 max={max_n or 'policy'}", platform="facebook"):
            result = send_friend_dms(max_send=max_n, dry_run=False)
        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print("=== Facebook 好友私信 · 发送结果 ===")
            if result.get("blocked"):
                print(f"🛑 Messenger 拦截/CAPTCHA — 已停止")
            if result.get("sent", 0):
                print(f"✅ 成功 {result['sent']} 人")
            if result.get("failed", 0):
                print(f"❌ 失败 {result['failed']} 人")
            print(f"今日累计: {result.get('sent_today', 0)} · 剩余额度 {result.get('remaining_today', 0)}")
            for row in result.get("results") or []:
                mark = "✅" if row.get("status") == "sent" else "❌"
                print(f"  {mark} {row.get('name')} — {row.get('status')}")
            if result.get("message_used"):
                print("\n最后一条消息:\n---")
                print(result["message_used"])
                print("---")
            if result.get("error") and not result.get("sent"):
                print(f"错误: {result['error']}")
        return 0 if result.get("ok") or result.get("sent", 0) > 0 else 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
