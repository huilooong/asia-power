#!/usr/bin/env python3
"""子敬 WhatsApp 自动接单 — poll → listen → 低风险自动发送 + 熔断保护.

Usage:
  python3 scripts/zijing-whatsapp-autopilot.py --once
  python3 scripts/zijing-whatsapp-autopilot.py --loop --interval 120
  python3 scripts/zijing-whatsapp-autopilot.py --status
  python3 scripts/zijing-whatsapp-autopilot.py --resume
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

LOG_PATH = ROOT / "reports" / "zijing-whatsapp-autopilot.log"


def log(msg: str) -> None:
    line = time.strftime("[%Y-%m-%d %H:%M:%S] ") + msg
    print(line, flush=True)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def run_once() -> dict:
    from customer_gateway.whatsapp_auto_sender import set_run_budget
    from customer_gateway.whatsapp_business_polling import poll_readonly
    from customer_gateway.whatsapp_live_readonly import listen_readonly
    from customer_gateway.whatsapp_send_guard import (
        guard_status,
        is_paused,
        max_per_run,
    )

    paused, reason = is_paused()
    if paused:
        log(f"SKIP paused: {reason}")
        return {"ok": False, "paused": True, "reason": reason}

    set_run_budget(max_per_run())
    poll = poll_readonly(force_connect=True)
    listen = listen_readonly()
    set_run_budget(None)

    sent = 0
    skipped = 0
    for draft in listen.get("drafts") or []:
        if draft.get("auto_sent") or draft.get("status") == "sent":
            sent += 1
        elif draft.get("status") == "pending":
            skipped += 1

    status = guard_status()
    summary = {
        "ok": True,
        "paused": False,
        "polled": poll.get("new_messages", 0),
        "drafts": listen.get("state", {}).get("drafts_created", 0),
        "sent_hint": sent,
        "pending_ceo": skipped,
        "guard": status,
    }
    log(
        f"cycle OK poll_new={summary['polled']} drafts={summary['drafts']} "
        f"guard_hour={status.get('sends_last_hour')} "
        f"circuit={status.get('circuit_rule', 'duplicate')}"
    )
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="子敬 WhatsApp 自动接单")
    parser.add_argument("--once", action="store_true", help="Run one cycle and exit")
    parser.add_argument("--loop", action="store_true", help="Run continuously")
    parser.add_argument("--interval", type=int, default=120, help="Loop interval seconds (default 120)")
    parser.add_argument("--status", action="store_true", help="Show guard status JSON")
    parser.add_argument("--resume", action="store_true", help="Clear circuit-breaker pause")
    args = parser.parse_args()

    if args.resume:
        from customer_gateway.whatsapp_send_guard import resume_autosend

        resume_autosend()
        log("RESUMED — autopilot unpaused")
        return 0

    if args.status:
        from customer_gateway.whatsapp_send_guard import guard_status
        from customer_gateway.whatsapp_safety import low_risk_auto_send_enabled

        out = {
            "auto_send_enabled": low_risk_auto_send_enabled(),
            **guard_status(),
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    if args.loop:
        log(f"LOOP start interval={max(60, args.interval)}s")
        while True:
            try:
                run_once()
            except Exception as exc:
                log(f"cycle ERROR: {exc}")
            time.sleep(max(60, args.interval))

    result = run_once()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
