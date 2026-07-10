#!/usr/bin/env python3
"""Cron entry: 子敬自动找客户 + 流量动作（不自动外发）."""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")


def main() -> int:
    from customer_gateway.growth_autopilot import (
        autopilot_enabled,
        format_autopilot_report,
        notify_ceo_report,
        run_growth_autopilot,
        should_notify,
    )

    if not autopilot_enabled():
        print("APSALES_GROWTH_AUTOPILOT=0 — skipped")
        return 0

    result = run_growth_autopilot()
    report = format_autopilot_report(result)
    print(report)

    if should_notify(result):
        sent = notify_ceo_report(result)
        print(f"\nTelegram notified: {sent} chat(s)")
    else:
        print("\nNo new work — Telegram skipped (set APSALES_GROWTH_ALWAYS_NOTIFY=1 for daily ping)")

    return 1 if result.get("errors") else 0


if __name__ == "__main__":
    raise SystemExit(main())
