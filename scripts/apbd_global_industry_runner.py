#!/usr/bin/env python3
"""Low-load systemd entrypoint for global APBD industry research."""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agents.apbd.global_industry import (  # noqa: E402
    DEFAULT_CONFIG_PATH,
    load_config,
    run_once,
)

LOCK_PATH = ROOT / "runtime" / "apbd" / "leads" / "trickle.lock"


def _load_env_keys() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        value = line.strip()
        if not value or value.startswith("#") or "=" not in value:
            continue
        key, raw = value.split("=", 1)
        key = key.strip()
        if os.environ.get(key):
            continue
        if key.startswith("GOOGLE_") or key.endswith("_API_KEY") or "TELEGRAM" in key or key.startswith("COO_"):
            os.environ[key] = raw.strip().strip('"').strip("'")


def _acquire_lock():
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    handle = LOCK_PATH.open("a+", encoding="utf-8")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        return None
    return handle


def _release_lock(handle: Any) -> None:
    if handle is None:
        return
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
    except OSError:
        pass
    handle.close()


def _result_sleep(result: dict[str, Any], runtime: dict[str, Any]) -> int:
    if result.get("skipped") and result.get("reason") == "load_high":
        return int(runtime.get("busy_sleep_seconds") or 120)
    if result.get("api_quota_exhausted"):
        return int(runtime.get("quota_sleep_seconds") or 3600)
    if not result.get("ok"):
        return int(runtime.get("error_sleep_seconds") or 600)
    return int(runtime.get("idle_sleep_seconds") or 900)


def _execute(args: argparse.Namespace) -> dict[str, Any]:
    return run_once(
        config_path=Path(args.config),
        dry_run=bool(args.dry_run),
        force=bool(args.force),
        limit=args.limit,
    )


def run_loop(args: argparse.Namespace) -> int:
    config = load_config(Path(args.config))
    runtime = config.get("runtime") or {}
    lock = _acquire_lock()
    if lock is None:
        print("[apbd-global] another APBD discovery worker holds the shared lock; exiting")
        return 0
    print(
        json.dumps(
            {
                "event": "apbd_global_industry_loop_started",
                "external_send_enabled": False,
                "ghana_excluded": True,
                "market_count": len(config.get("markets") or []),
                "industry_count": len(config.get("industry_scopes") or []),
            },
            ensure_ascii=False,
        )
    )
    try:
        while True:
            try:
                result = _execute(args)
            except Exception as exc:
                result = {
                    "ok": False,
                    "event": "unhandled_iteration_error",
                    "error": f"{type(exc).__name__}: {str(exc)[:300]}",
                    "external_send_enabled": False,
                }
            print(json.dumps(result, ensure_ascii=False))
            time.sleep(max(5, _result_sleep(result, runtime)))
    except KeyboardInterrupt:
        print("[apbd-global] interrupted")
        return 0
    finally:
        _release_lock(lock)


def main() -> int:
    parser = argparse.ArgumentParser(description="APBD global industry research worker")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH))
    parser.add_argument("--loop", action="store_true", help="Run continuously for systemd")
    parser.add_argument("--once", action="store_true", help="Run one iteration (default)")
    parser.add_argument("--dry-run", action="store_true", help="Validate and show the next work item without writes")
    parser.add_argument("--force", action="store_true", help="Ignore the load gate for one controlled run")
    parser.add_argument("--limit", type=int, default=None, help="Override per-iteration discovery result cap")
    args = parser.parse_args()
    _load_env_keys()

    if args.dry_run:
        print(json.dumps(_execute(args), ensure_ascii=False, indent=2))
        return 0
    if args.loop:
        return run_loop(args)

    lock = _acquire_lock()
    if lock is None:
        print("[apbd-global] another APBD discovery worker holds the shared lock; exiting")
        return 0
    try:
        result = _execute(args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("ok") or result.get("skipped") else 2
    finally:
        _release_lock(lock)


if __name__ == "__main__":
    raise SystemExit(main())
