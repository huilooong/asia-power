#!/usr/bin/env python3
"""Hourly Sales Coach structured pass (detectors / self-improve) — no LLM.

Cron-safe: no interactive prompts; logs to stdout (redirected by cron).
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except Exception:
    pass


def main() -> int:
    from sales_coach.self_improve import run_self_improve

    day = date.today()
    started = datetime.now(timezone.utc).isoformat()
    print(f"[coach-structured] start {started} day={day.isoformat()}")
    result = run_self_improve(day=day, write=True) or {}
    slim = {
        "day": result.get("day"),
        "turns": result.get("turns"),
        "issue_count": len(result.get("issues") or []),
        "recurring": result.get("recurring"),
        "report_path": result.get("report_path"),
        "proposals_path": result.get("proposals_path"),
    }
    print(json.dumps({"ok": True, "started": started, "result": slim}, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001 — cron must not hang silent
        print(f"[coach-structured] FAILED: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
