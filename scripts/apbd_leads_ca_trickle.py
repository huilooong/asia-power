#!/usr/bin/env python3
"""Low-impact Canada leads trickle runner for production.

CEO meaning of 细水长流 (2026-07-24):
  Keep running as long as server load is not high — small batches, pause when busy.

Design:
  - 1 city / batch, small Places budget
  - Load gate: pause (do not exit) when load is high
  - Single-flight via flock
  - Telegram on progress / quota / milestones / target done
  - --loop for systemd continuous service

Usage:
  python scripts/apbd_leads_ca_trickle.py              # one batch
  python scripts/apbd_leads_ca_trickle.py --loop       # continuous
  python scripts/apbd_leads_ca_trickle.py --force      # ignore load gate (one batch)
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
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

LOCK_PATH = ROOT / "runtime" / "apbd" / "leads" / "trickle.lock"
STATE_PATH = ROOT / "runtime" / "apbd" / "leads" / "trickle_state.json"
REPORT_DIR = ROOT / "runtime" / "apbd" / "leads" / "reports"

# Conservative defaults for 2-vCPU droplet
DEFAULT_LIMIT = 5
DEFAULT_MAX_CITIES = 1
DEFAULT_LOAD_MAX = 1.8
DEFAULT_NICE_SLEEP = 2.0
DEFAULT_IDLE_SLEEP = 120          # seconds between batches when healthy
DEFAULT_BUSY_SLEEP = 90           # wait when load too high
DEFAULT_QUOTA_SLEEP = 3600        # wait after Places 429
DEFAULT_TARGET_SLEEP = 21600      # 6h after hitting 500


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


def _acquire_lock(*, blocking: bool = False):
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    fh = open(LOCK_PATH, "a+", encoding="utf-8")
    flags = fcntl.LOCK_EX
    if not blocking:
        flags |= fcntl.LOCK_NB
    try:
        fcntl.flock(fh.fileno(), flags)
    except BlockingIOError:
        fh.close()
        return None
    return fh


def _release_lock(fh) -> None:
    if not fh:
        return
    try:
        fcntl.flock(fh.fileno(), fcntl.LOCK_UN)
    except Exception:
        pass
    try:
        fh.close()
    except Exception:
        pass


def run_once(
    *,
    limit: int = DEFAULT_LIMIT,
    max_cities: int = DEFAULT_MAX_CITIES,
    load_max: float = DEFAULT_LOAD_MAX,
    force: bool = False,
    no_telegram: bool = False,
    enrich: bool = False,
) -> dict[str, Any]:
    """Run one small batch. Returns status dict (never raises for load skip)."""
    load1 = _load_avg_1m()
    if not force and load1 > float(load_max):
        return {
            "ok": True,
            "skipped": True,
            "reason": "load_high",
            "load_1m": load1,
            "load_max": load_max,
            "added": 0,
        }

    started = time.time()
    state = _read_state()
    cities = _city_rotation()
    idx = int(state.get("city_index") or 0) % len(cities)
    pick = cities[idx : idx + max(1, int(max_cities))]
    if not pick:
        pick = [cities[0]]

    from agents.apbd.leads.pipeline import run_discover, run_enrich, run_score
    from agents.apbd.leads.refresh import coverage_report

    city_results: list[dict[str, Any]] = []
    errors: list[str] = []
    added_total = 0
    quota_hit = False
    missing_key = False

    for city in pick:
        if city_results:
            time.sleep(DEFAULT_NICE_SLEEP)
        result = run_discover(
            country="CA",
            city=city,
            limit=max(1, int(limit)),
            dry_run=False,
        )
        city_results.append({"city": city, **result})
        added_total += int(result.get("added") or 0)
        if result.get("error_code") == "missing_places_api_key":
            missing_key = True
            errors.append(str(result.get("error")))
            break
        if result.get("quota_exhausted"):
            quota_hit = True
            errors.append(f"quota_exhausted_after:{city}")
            break
        if result.get("errors"):
            errors.extend([str(e) for e in (result.get("errors") or [])[:3]])

    if enrich and added_total > 0 and not quota_hit and not missing_key:
        run_enrich(country="CA", city=pick[0], limit=min(8, int(limit)))
        run_score(country="CA")
    elif added_total > 0:
        run_score(country="CA")

    coverage = coverage_report(country="CA")
    state["city_index"] = (idx + len(pick)) % len(cities)
    state["runs"] = int(state.get("runs") or 0) + 1
    state["last_run_at"] = _now()
    state["last_added"] = added_total
    state["last_valid_total"] = coverage.get("valid_total")
    state["mode"] = "continuous"
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
        "missing_key": missing_key,
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

    last_mile = int(state.get("last_telegram_milestone") or 0)
    hit_target = valid >= target
    hit_mile = valid // 50 > last_mile // 50
    lines = [
        "🇨🇦 APBD 加拿大汽修潜客 · 细水长流（持续）",
        f"城市: {', '.join(pick)}",
        f"本轮新增: {added_total}",
        f"有效合计: {valid} / {target}（缺口 {gap}）",
        f"电话 {cov.get('phone_pct')}% · 网站 {cov.get('website_pct')}% · 邮箱 {cov.get('email_pct')}%",
        f"负载: {load1:.2f} · 耗时: {elapsed}s",
    ]
    if quota_hit:
        lines.append("⚠️ Places 配额耗尽 — 休眠后自动再试")
    if missing_key:
        lines.append("❌ 缺少 Places Key — 已暂停")
    if errors and not quota_hit and not missing_key:
        lines.append("错误: " + "; ".join(errors[:2]))
    if hit_target:
        lines.append("✅ 已达 500 有效目标 — 进入慢巡检")

    if not no_telegram and (added_total > 0 or quota_hit or hit_target or hit_mile or missing_key or errors):
        sent = _notify("\n".join(lines))
        if hit_mile or hit_target:
            state["last_telegram_milestone"] = valid
            _write_state(state)
        print(f"[trickle] telegram_sent={sent}")
    else:
        print("[trickle] no progress — telegram skipped")

    print(json.dumps({"ok": True, "report": str(out), **report["coverage"], "added": added_total}, ensure_ascii=False))
    return {
        "ok": not missing_key,
        "skipped": False,
        "added": added_total,
        "quota_exhausted": quota_hit,
        "missing_key": missing_key,
        "hit_target": hit_target,
        "valid_total": valid,
        "gap_to_target": gap,
        "load_1m": load1,
        "errors": errors,
        "report_path": str(out),
    }


def run_loop(args: argparse.Namespace) -> int:
    """Continuous trickle: work when load is OK, sleep when busy/quota/done."""
    _load_env_keys()
    lock_fh = _acquire_lock(blocking=False)
    if lock_fh is None:
        print("[trickle] another instance holds the lock — exit")
        return 0

    idle = int(args.idle_sleep)
    busy = int(args.busy_sleep)
    quota_sleep = int(args.quota_sleep)
    target_sleep = int(args.target_sleep)
    started_msg = (
        "🇨🇦 APBD 加拿大汽修潜客 · 持续细水长流已启动\n"
        f"负载门限 {args.load_max} · 每批 {args.limit} 家 / 1 城\n"
        f"空闲间隔 {idle}s · 忙时等待 {busy}s · 配额休眠 {quota_sleep}s\n"
        "负载不高就继续采；忙时自动停手，不拖累网站/WhatsApp。"
    )
    if not args.no_telegram:
        _notify(started_msg)
    print("[trickle] loop started", started_msg.replace("\n", " | "))

    try:
        while True:
            result = run_once(
                limit=int(args.limit),
                max_cities=int(args.max_cities),
                load_max=float(args.load_max),
                force=bool(args.force),
                no_telegram=bool(args.no_telegram),
                enrich=bool(args.enrich),
            )
            if result.get("skipped") and result.get("reason") == "load_high":
                print(
                    f"[trickle] load {result.get('load_1m'):.2f} > {args.load_max} — sleep {busy}s"
                )
                time.sleep(busy)
                continue
            if result.get("missing_key"):
                print("[trickle] missing Places key — sleep 30m")
                time.sleep(1800)
                continue
            if result.get("quota_exhausted"):
                print(f"[trickle] quota exhausted — sleep {quota_sleep}s")
                time.sleep(quota_sleep)
                continue
            if result.get("hit_target"):
                print(f"[trickle] target reached — slow patrol sleep {target_sleep}s")
                time.sleep(target_sleep)
                continue
            time.sleep(idle)
    except KeyboardInterrupt:
        print("[trickle] interrupted")
        return 0
    finally:
        _release_lock(lock_fh)


def main() -> int:
    parser = argparse.ArgumentParser(description="APBD Canada leads trickle (server-safe)")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument("--max-cities", type=int, default=DEFAULT_MAX_CITIES)
    parser.add_argument("--load-max", type=float, default=DEFAULT_LOAD_MAX)
    parser.add_argument("--force", action="store_true", help="Ignore load gate")
    parser.add_argument("--no-telegram", action="store_true")
    parser.add_argument("--enrich", action="store_true", default=False, help="Also enrich (heavier)")
    parser.add_argument("--loop", action="store_true", help="Continuous mode (systemd)")
    parser.add_argument("--idle-sleep", type=int, default=DEFAULT_IDLE_SLEEP)
    parser.add_argument("--busy-sleep", type=int, default=DEFAULT_BUSY_SLEEP)
    parser.add_argument("--quota-sleep", type=int, default=DEFAULT_QUOTA_SLEEP)
    parser.add_argument("--target-sleep", type=int, default=DEFAULT_TARGET_SLEEP)
    args = parser.parse_args()

    _load_env_keys()
    if args.loop:
        return run_loop(args)

    load1 = _load_avg_1m()
    if not args.force and load1 > float(args.load_max):
        msg = (
            f"APBD CA leads trickle skipped — load {load1:.2f} > {args.load_max} "
            f"(protecting server)"
        )
        print(msg)
        return 0

    lock_fh = _acquire_lock(blocking=False)
    if lock_fh is None:
        print("[trickle] another run holds the lock — exit")
        return 0
    try:
        result = run_once(
            limit=int(args.limit),
            max_cities=int(args.max_cities),
            load_max=float(args.load_max),
            force=True,  # already checked load above
            no_telegram=bool(args.no_telegram),
            enrich=bool(args.enrich),
        )
        if result.get("missing_key"):
            return 2
        if result.get("quota_exhausted") and int(result.get("added") or 0) == 0:
            return 2
        return 0
    finally:
        _release_lock(lock_fh)


if __name__ == "__main__":
    raise SystemExit(main())
