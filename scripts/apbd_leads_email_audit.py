#!/usr/bin/env python3
"""Audit APBD website emails, remove deterministic artifacts, and label review quality."""

from __future__ import annotations

import argparse
import fcntl
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

DB_FILE = ROOT / "runtime" / "apbd" / "leads" / "db" / "companies.json"
WRITER_LOCK = ROOT / "runtime" / "apbd" / "leads" / "trickle.lock"
BACKUP_DIR = ROOT / "runtime" / "apbd" / "leads" / "backups"
REPORT_DIR = ROOT / "runtime" / "apbd" / "leads" / "reports"
FREE_MAIL_DOMAINS = {
    "gmail.com",
    "hotmail.ca",
    "hotmail.com",
    "live.ca",
    "live.com",
    "outlook.com",
    "yahoo.ca",
    "yahoo.com",
}


def _stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _domain(value: str) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    if "@" in raw:
        return raw.rsplit("@", 1)[1]
    if "://" not in raw:
        raw = "https://" + raw
    return urlparse(raw).netloc.lower().removeprefix("www.")


def _website_domain(company: dict[str, Any]) -> str:
    for channel in company.get("contact_channels") or []:
        if channel.get("type") == "website" and channel.get("value"):
            return _domain(str(channel["value"]))
    return ""


def _quality(email: str, website_domain: str) -> tuple[str, str]:
    domain = _domain(email)
    if website_domain and domain == website_domain:
        return "official_domain_public", "unverified_public"
    if domain in FREE_MAIL_DOMAINS:
        return "public_free_mailbox", "manual_review_required"
    return "other_domain_public", "manual_review_required"


def audit(companies: list[dict[str, Any]]) -> dict[str, Any]:
    from agents.apbd.leads.normalize import clean_public_email

    removed: list[dict[str, str]] = []
    normalized = 0
    deduplicated = 0
    tiers: dict[str, int] = {}
    companies_with_email: set[str] = set()

    for company in companies:
        website_domain = _website_domain(company)
        channels: list[dict[str, Any]] = []
        seen_emails: set[str] = set()
        for original in company.get("contact_channels") or []:
            channel = dict(original)
            if channel.get("type") != "email":
                channels.append(channel)
                continue
            raw = str(channel.get("value") or "")
            cleaned = clean_public_email(raw)
            if not cleaned:
                removed.append(
                    {
                        "company_id": str(company.get("id") or ""),
                        "company": str(company.get("display_name") or ""),
                        "value": raw,
                        "reason": "deterministic_placeholder_or_artifact",
                    }
                )
                continue
            if cleaned in seen_emails:
                deduplicated += 1
                continue
            seen_emails.add(cleaned)
            if cleaned != raw.lower():
                normalized += 1
            tier, status = _quality(cleaned, website_domain)
            channel["value"] = cleaned
            channel["quality_tier"] = tier
            channel["verification_status"] = status
            channels.append(channel)
            tiers[tier] = tiers.get(tier, 0) + 1
            companies_with_email.add(str(company.get("id") or ""))
        company["contact_channels"] = channels

    return {
        "ok": True,
        "email_records_kept": sum(tiers.values()),
        "companies_with_email": len(companies_with_email),
        "removed_count": len(removed),
        "normalized_count": normalized,
        "deduplicated_count": deduplicated,
        "quality_tiers": tiers,
        "removed": removed,
        "outreach_sent": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit APBD public website email quality")
    parser.add_argument("--apply", action="store_true", help="Persist the audited result")
    args = parser.parse_args()

    if not args.apply:
        from agents.apbd.leads.repository import load_companies

        result = audit(load_companies())
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
        result = audit(companies)
        result["dry_run"] = False
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        backup = BACKUP_DIR / f"companies-before-email-audit-{_stamp()}.json"
        shutil.copy2(DB_FILE, backup)
        backup.chmod(0o600)
        save_companies(companies)
        result["backup"] = str(backup)

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report = REPORT_DIR / f"ca-email-audit-{_stamp()}.json"
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    result["report"] = str(report)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
