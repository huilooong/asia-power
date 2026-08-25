#!/usr/bin/env python3
"""Bounded Canada lead enrichment runner.

Website-first only. It extracts public emails, official LinkedIn links, and
structured decision-maker evidence. It never sends outreach or guesses data.
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

DB_FILE = ROOT / "runtime" / "apbd" / "leads" / "db" / "companies.json"
WRITER_LOCK = ROOT / "runtime" / "apbd" / "leads" / "trickle.lock"
BACKUP_DIR = ROOT / "runtime" / "apbd" / "leads" / "backups"
REPORT_DIR = ROOT / "runtime" / "apbd" / "leads" / "reports"


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        key = key.strip()
        if key and not os.environ.get(key):
            os.environ[key] = value.strip().strip('"').strip("'")


def _acquire_writer_lock() -> Any:
    WRITER_LOCK.parent.mkdir(parents=True, exist_ok=True)
    handle = WRITER_LOCK.open("a+")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        handle.close()
        return None
    return handle


def _backup_db() -> str:
    if not DB_FILE.is_file():
        raise FileNotFoundError(f"lead database not found: {DB_FILE}")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    target = BACKUP_DIR / f"companies-before-website-enrich-{_stamp()}.json"
    shutil.copy2(DB_FILE, target)
    target.chmod(0o600)
    return str(target)


def _preview(limit: int, retry_failed: bool) -> dict[str, Any]:
    from agents.apbd.leads.repository import list_companies

    rows = []
    for company in list_companies(country="CA"):
        has_website = any(
            channel.get("type") == "website" and channel.get("value")
            for channel in (company.get("contact_channels") or [])
        )
        prior = company.get("website_enrichment") or {}
        status = str(prior.get("status") or "")
        eligible = (
            has_website
            and status not in ("complete", "unsupported_website")
            and (status != "failed" or retry_failed)
        )
        if eligible:
            rows.append(
                {
                    "company_id": company.get("id"),
                    "name": company.get("display_name"),
                    "city": (company.get("location") or {}).get("city"),
                }
            )
        if len(rows) >= limit:
            break
    return {"ok": True, "dry_run": True, "selected": len(rows), "targets": rows}


def main() -> int:
    parser = argparse.ArgumentParser(description="APBD Canada public website enrichment")
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--max-pages", type=int, default=5)
    parser.add_argument("--timeout", type=int, default=8)
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Concurrent websites to inspect (1-12; discovery service still remains single-writer)",
    )
    parser.add_argument(
        "--places-fallback-limit",
        type=int,
        default=0,
        help="Recheck exact Places details for businesses that still have no website",
    )
    parser.add_argument("--retry-failed", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    limit = max(1, min(int(args.limit), 100))
    max_pages = max(1, min(int(args.max_pages), 9))
    timeout = max(2, min(int(args.timeout), 20))
    workers = max(1, min(int(args.workers), 12))
    _load_env()

    if args.dry_run:
        print(json.dumps(_preview(limit, bool(args.retry_failed)), ensure_ascii=False, indent=2))
        return 0

    lock_handle = _acquire_writer_lock()
    if lock_handle is None:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "discovery_writer_active",
                    "action": "stop apbd-ca-leads-trickle.service before enrichment",
                },
                ensure_ascii=False,
            )
        )
        return 2

    try:
        from agents.apbd.leads.pipeline import run_enrich, run_places_contact_refresh

        backup = _backup_db()
        result = run_enrich(
            country="CA",
            limit=limit,
            max_pages=max_pages,
            timeout=timeout,
            retry_failed=bool(args.retry_failed),
            workers=workers,
        )
        if int(args.places_fallback_limit) > 0:
            result["places_fallback"] = run_places_contact_refresh(
                country="CA",
                limit=min(int(args.places_fallback_limit), 50),
                retry_failed=bool(args.retry_failed),
            )
        result.update(
            {
                "started_by": "scripts/apbd_leads_ca_enrich.py",
                "completed_at": _now(),
                "backup": backup,
                "outreach_sent": False,
            }
        )
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        report_path = REPORT_DIR / f"ca-website-enrich-{_stamp()}.json"
        report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result["report"] = str(report_path)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("ok") else 1
    finally:
        fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)
        lock_handle.close()


if __name__ == "__main__":
    raise SystemExit(main())
