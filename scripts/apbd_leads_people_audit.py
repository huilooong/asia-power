#!/usr/bin/env python3
"""Audit visible-text APBD decision makers against the current conservative rules."""

from __future__ import annotations

import argparse
import fcntl
import json
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


def _stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def audit(
    companies: list[dict[str, Any]], *, reset_visible: bool = False
) -> dict[str, Any]:
    from agents.apbd.leads.adapters.website import valid_visible_person_record

    removed: list[dict[str, str]] = []
    visible_kept = 0
    total_kept = 0
    companies_with_people: set[str] = set()
    for company in companies:
        contacts: list[dict[str, Any]] = []
        for original in company.get("contact_persons") or []:
            person = dict(original)
            if person.get("source") == "official_website_visible_text":
                if reset_visible:
                    removed.append(
                        {
                            "company_id": str(company.get("id") or ""),
                            "company": str(company.get("display_name") or ""),
                            "name": str(person.get("name") or ""),
                            "title": str(person.get("title") or ""),
                            "evidence_url": str(person.get("evidence_url") or ""),
                            "reason": "visible_people_version_reset",
                        }
                    )
                    continue
                if not valid_visible_person_record(person):
                    removed.append(
                        {
                            "company_id": str(company.get("id") or ""),
                            "company": str(company.get("display_name") or ""),
                            "name": str(person.get("name") or ""),
                            "title": str(person.get("title") or ""),
                            "evidence_url": str(person.get("evidence_url") or ""),
                            "reason": "visible_person_failed_current_rules",
                        }
                    )
                    continue
                visible_kept += 1
            if reset_visible:
                person.pop("visible_role_evidence", None)
            contacts.append(person)
            total_kept += 1
            companies_with_people.add(str(company.get("id") or ""))
        company["contact_persons"] = contacts
    return {
        "ok": True,
        "decision_makers_kept": total_kept,
        "visible_text_people_kept": visible_kept,
        "companies_with_decision_makers": len(companies_with_people),
        "removed_count": len(removed),
        "removed": removed,
        "reset_visible": reset_visible,
        "outreach_sent": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit APBD visible-text decision makers")
    parser.add_argument("--apply", action="store_true", help="Persist the audited result")
    parser.add_argument(
        "--reset-visible",
        action="store_true",
        help="Remove visible-text people before a versioned full re-extraction",
    )
    args = parser.parse_args()

    if not args.apply:
        from agents.apbd.leads.repository import load_companies

        result = audit(load_companies(), reset_visible=bool(args.reset_visible))
        result["dry_run"] = True
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    WRITER_LOCK.parent.mkdir(parents=True, exist_ok=True)
    with WRITER_LOCK.open("a+") as lock_handle:
        try:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({"ok": False, "error": "discovery_writer_active"}))
            return 2
        from agents.apbd.leads.repository import load_companies, save_companies

        companies = load_companies()
        result = audit(companies, reset_visible=bool(args.reset_visible))
        result["dry_run"] = False
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        backup = BACKUP_DIR / f"companies-before-people-audit-{_stamp()}.json"
        shutil.copy2(DB_FILE, backup)
        backup.chmod(0o600)
        save_companies(companies)
        result["backup"] = str(backup)

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report = REPORT_DIR / f"ca-people-audit-{_stamp()}.json"
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    result["report"] = str(report)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
