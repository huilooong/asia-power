#!/usr/bin/env python3
"""Low-impact Canada leads trickle runner for production.

Design goals (CEO 2026-07-24):
  - Fine trickle, never burst: 1 city / run, small Places budget
  - Skip when server load is high (protect inventory-site / WhatsApp)
  - Single-flight via flock
  - Telegram report after each run and when target reached

Usage:
  python scripts/apbd_leads_ca_trickle.py
  python scripts/apbd_leads_ca_trickle.py --force   # ignore load gate
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

LOCK_PATH = ROOT / "runtime" / "apbd" / "leads" / "trickle.lock"
STATE_PATH = ROOT / "runtime" / "apbd" / "leads" / "trickle_state.json"
REPORT_DIR = ROOT / "runtime" / "apbd" / "leads" / "reports"

# Conservative defaults for 2-vCPU droplet
DEFAULT_LIMIT = 6
DEFAULT_MAX_CITIES = 1
DEFAULT_LOAD_MAX = 1.8
DEFAULT_NICE_SLEEP = 2.0


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _load_env_keys() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        key, val = s.split("=", 1)
        key = key.strip()
        if key in os.environ and os.environ.get(key):
            continue
        if key.startswith("GOOGLE_") or key.endswith("_API_KEY") or "TELEGRAM" in key or key.startswith("COO_"):
            os.environ[key] = val.strip().strip('"').strip("'")


def _load_avg_1m() -> float:
    try:
        return float(os.getloadavg()[0])
    except (OSError, AttributeError):
        return 0.0


def _read_state() -> dict:
    if not STATE_PATH.is_file():
        return {"city_index": 0, "runs": 0, "last_telegram_milestone": 0}
    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {"city_index": 0, "runs": 0, "last_telegram_milestone": 0}


def _write_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _city_rotation() -> list[str]:
    from agents.apbd.leads.market_config import get_country, load_markets

    ca = get_country(load_markets(), "CA")
    cities: list[str] = []
    for region in ca.get("regions") or []:
        for city in region.get("cities") or []:
            cities.append(str(city))
    return cities or ["Richmond"]


def _notify(text: str) -> int:
    try:
        from coo_core.approval_gate import notify_ceo, parse_allowed_chat_ids
        from tools import message_tool

        chat_ids = parse_allowed_chat_ids(os.getenv("COO_TELEGRAM_ALLOWED_CHAT_IDS"))
        if chat_ids and message_tool.coo_telegram_token():
            return notify_ceo(text)
        fallback_chat = (
            os.getenv("ASIAPOWER_TELEGRAM_CHAT_ID") or os.getenv("TELEGRAM_CHAT_ID") or ""
        ).strip()
        fallback_token = (
            os.getenv("ASIAPOWER_TELEGRAM_BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN") or ""
        ).strip()
        if fallback_chat and fallback_token:
            message_tool.send_telegram_message(fallback_chat, text, token=fallback_token)
            return 1
    except Exception as exc:
        print(f"[trickle] telegram_failed: {exc}", file=sys.stderr)
    return 0


def _acquire_lock():
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOCK_PATH, "a+", encoding="utf-8")
    try:
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        fh.close()
        return None
    return fh


def main() -> int:
    parser = argparse.ArgumentParser(description="APBD Canada leads trickle (server-safe)")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument("--max-cities", type=int, default=DEFAULT_MAX_CITIES)
    parser.add_argument("--load-max", type=float, default=DEFAULT_LOAD_MAX)
    parser.add_argument("--force", action="store_true", help="Ignore load gate")
    parser.add_argument("--no-telegram", action="store_true")
    parser.add_argument("--enrich", action="store_true", default=False, help="Also enrich (heavier)")
    args = parser.parse_args()

    _load_env_keys()
    load1 = _load_avg_1m()
    if not args.force and load1 > float(args.load_max):
        msg = (
            f"APBD CA leads trickle skipped — load {load1:.2f} > {args.load_max} "
            f"(protecting server)"
        )
        print(msg)
        if not args.no_telegram:
            # Avoid spam: only notify skip when load is very high
            if load1 >= float(args.load_max) + 0.7:
                _notify(msg)
        return 0

    lock_fh = _acquire_lock()
    if lock_fh is None:
        print("[trickle] another run holds the lock — exit")
        return 0

    started = time.time()
    state = _read_state()
    cities = _city_rotation()
    idx = int(state.get("city_index") or 0) % len(cities)
    pick = cities[idx : idx + max(1, int(args.max_cities))]
    if not pick:
        pick = [cities[0]]

    from agents.apbd.leads.pipeline import run_discover, run_enrich, run_score
    from agents.apbd.leads.refresh import coverage_report

    city_results = []
    errors: list[str] = []
    added_total = 0
    quota_hit = False

    try:
        for city in pick:
            # Extra pacing between cities (usually only one)
            if city_results:
                time.sleep(DEFAULT_NICE_SLEEP)
            result = run_discover(
                country="CA",
                city=city,
                limit=max(1, int(args.limit)),
                dry_run=False,
            )
            city_results.append({"city": city, **result})
            added_total += int(result.get("added") or 0)
            if result.get("error_code") == "missing_places_api_key":
                errors.append(str(result.get("error")))
                break
            if result.get("quota_exhausted") or result.get("ok") is False and result.get("quota_exhausted"):
                quota_hit = True
                errors.append(f"quota_exhausted_after:{city}")
                break
            if result.get("errors"):
                errors.extend([str(e) for e in (result.get("errors") or [])[:3]])

        if args.enrich and added_total > 0 and not quota_hit:
            # Cap enrich work tightly
            run_enrich(country="CA", city=pick[0], limit=min(8, int(args.limit)))
            run_score(country="CA")
        elif added_total > 0:
            # Score only (cheap) so coverage numbers stay useful
            run_score(country="CA")

        coverage = coverage_report(country="CA")
        state["city_index"] = (idx + len(pick)) % len(cities)
        state["runs"] = int(state.get("runs") or 0) + 1
        state["last_run_at"] = _now()
        state["last_added"] = added_total
        state["last_valid_total"] = coverage.get("valid_total")
        _write_state(state)

        elapsed = int(time.time() - started)
        valid = int(coverage.get("valid_total") or 0)
        target = int(coverage.get("target_total") or 500)
        gap = int(coverage.get("gap_to_target") or max(0, target - valid))
        cov = coverage.get("coverage") or {}

        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        report = {
            "started_at": _now(),
            "elapsed_s": elapsed,
            "load_1m": load1,
            "cities": pick,
            "added": added_total,
            "city_results": city_results,
            "errors": errors,
            "quota_exhausted": quota_hit,
            "coverage": {
                "valid_total": valid,
                "target_total": target,
                "gap_to_target": gap,
                "phone_pct": cov.get("phone_pct"),
                "website_pct": cov.get("website_pct"),
                "email_pct": cov.get("email_pct"),
            },
        }
        out = REPORT_DIR / f"ca-trickle-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        # Telegram: always after a real run; milestone every +50 or target done
        last_mile = int(state.get("last_telegram_milestone") or 0)
        hit_target = valid >= target
        hit_mile = valid // 50 > last_mile // 50
        lines = [
            "🇨🇦 APBD 加拿大汽修潜客 · 细水长流",
            f"城市: {', '.join(pick)}",
            f"本轮新增: {added_total}",
            f"有效合计: {valid} / {target}（缺口 {gap}）",
            f"电话 {cov.get('phone_pct')}% · 网站 {cov.get('website_pct')}% · 邮箱 {cov.get('email_pct')}%",
            f"负载: {load1:.2f} · 耗时: {elapsed}s",
        ]
        if quota_hit:
            lines.append("⚠️ Places 配额耗尽，本轮已停，明日再续")
        if errors and not quota_hit:
            lines.append("错误: " + "; ".join(errors[:2]))
        if hit_target:
            lines.append("✅ 已达 500 有效目标")
        text = "\n".join(lines)

        # Notify on progress / quota / milestone / errors (skip silent empty runs)
        if not args.no_telegram and (added_total > 0 or quota_hit or hit_target or hit_mile or errors):
            sent = _notify(text)
            if hit_mile or hit_target:
                state["last_telegram_milestone"] = valid
                _write_state(state)
            print(f"[trickle] telegram_sent={sent}")
        else:
            print("[trickle] no progress — telegram skipped")

        print(json.dumps({"ok": True, "report": str(out), **report["coverage"], "added": added_total}, ensure_ascii=False))
        return 0 if not (quota_hit and added_total == 0 and errors) else 2
    finally:
        try:
            fcntl.flock(lock_fh.fileno(), fcntl.LOCK_UN)
        except Exception:
            pass
        lock_fh.close()


if __name__ == "__main__":
    raise SystemExit(main())
