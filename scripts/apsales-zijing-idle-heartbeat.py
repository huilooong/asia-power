#!/usr/bin/env python3
"""子敬 idle heartbeat — writes to activity stream every 30s when no work running."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ModuleNotFoundError:
    pass


def _idle_detail() -> str:
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    pending = 0
    next_cron = ""
    next_action_line = ""
    try:
        import json

        qf = ROOT / "memory" / "customer_gateway" / "apsales_social_engagement_queue.json"
        if qf.is_file():
            queue = json.loads(qf.read_text(encoding="utf-8"))
            if isinstance(queue, list):
                pending = sum(1 for x in queue if isinstance(x, dict) and x.get("status") == "pending")
    except Exception:
        pass

    try:
        from customer_gateway.social_engagement_engine import get_next_pending_action_summary

        nxt = get_next_pending_action_summary()
        if nxt:
            next_action_line = f"，{nxt.get('label', '')}"
    except Exception:
        pass

    minute = now.minute
    if minute < 30:
        next_cron = now.replace(minute=30, second=0, microsecond=0).strftime("%H:%M UTC")
    else:
        nh = now.replace(minute=0, second=0, microsecond=0)
        next_cron = (nh + timedelta(hours=1)).strftime("%H:%M UTC")

    try:
        from customer_gateway.social_engagement_engine import any_market_awake, in_night_slow_mode

        any_awake = any_market_awake()
        night_slow = in_night_slow_mode()
        if any_awake:
            period = "有市场营业"
        elif night_slow:
            period = "夜间慢速"
        else:
            period = "全球休眠"
    except Exception:
        from customer_gateway.social_engagement_engine import in_active_hours

        period = "工作时段" if in_active_hours() else "非工作时段"
    return (
        f"UTC {now.strftime('%H:%M')} {period}，队列 {pending} 待执行，"
        f"下次 cron {next_cron}{next_action_line}"
    )


def emit_once() -> None:
    from customer_gateway.zijing_activity_stream import get_current_action, write_idle

    if get_current_action(within_sec=10):
        return
    write_idle(_idle_detail())


def main() -> int:
    parser = argparse.ArgumentParser(description="子敬 idle heartbeat")
    parser.add_argument("--once", action="store_true", help="Write one idle line and exit")
    parser.add_argument("--interval", type=int, default=30, help="Seconds between heartbeats (default 30)")
    args = parser.parse_args()

    if args.once:
        emit_once()
        return 0

    interval = max(15, args.interval)
    while True:
        emit_once()
        time.sleep(interval)


if __name__ == "__main__":
    raise SystemExit(main())
