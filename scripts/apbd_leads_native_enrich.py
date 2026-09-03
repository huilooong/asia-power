#!/usr/bin/env python3
"""Run bounded APBD first-party contact validation; never sends outreach."""

from __future__ import annotations

import argparse
import fcntl
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

DB_FILE = ROOT / "runtime" / "apbd" / "leads" / "db" / "companies.json"
LOCK_FILE = ROOT / "runtime" / "apbd" / "leads" / "native-enrichment.lock"
BACKUP_DIR = ROOT / "runtime" / "apbd" / "leads" / "backups"
REPORT_DIR = ROOT / "runtime" / "apbd" / "leads" / "reports"


def _stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="APBD first-party contact validation")
    parser.add_argument("--country", default="VE")
    parser.add_argument("--city", default="")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    country = str(args.country or "").strip().upper()
    if not re.fullmatch(r"[A-Z]{2}", country):
        print(json.dumps({"ok": False, "error": "country_must_be_iso2"}))
        return 2
    limit = max(1, min(int(args.limit), 100))
    workers = max(1, min(int(args.workers), 8))
    from agents.apbd.leads.pipeline import run_native_enrich

    if args.dry_run:
        result = run_native_enrich(
            country=country,
            city=str(args.city or "")[:100],
            limit=limit,
            workers=workers,
            persist=False,
        )
        result["dry_run"] = True
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOCK_FILE.open("a+", encoding="utf-8") as lock_handle:
        try:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({"ok": False, "error": "native_enrichment_already_running"}))
            return 3
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        backup = BACKUP_DIR / f"companies-before-native-enrichment-{_stamp()}.json"
        if DB_FILE.exists():
            shutil.copy2(DB_FILE, backup)
            backup.chmod(0o600)
        result = run_native_enrich(
            country=country,
            city=str(args.city or "")[:100],
            limit=limit,
            workers=workers,
            persist=True,
        )
        result["dry_run"] = False
        result["backup"] = str(backup) if backup.exists() else ""

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report = REPORT_DIR / f"native-enrichment-{country.lower()}-{_stamp()}.json"
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    result["report"] = str(report)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
