#!/usr/bin/env python3
"""Send CEO-approved email follow-ups to open website leads (real addresses only)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from customer_gateway.distribution_progress import migrate_social_posts_to_blocked  # noqa: E402
from customer_gateway.email_outbound import send_enabled  # noqa: E402
from customer_gateway.email_test_filter import is_test_or_bot_email  # noqa: E402
from customer_gateway.outreach_sent_registry import is_already_sent  # noqa: E402
from customer_gateway.outreach_engine import (  # noqa: E402
    approve_outreach,
    create_lead_email_outreach,
    scan_outreach_candidates,
    send_outreach,
)


def _dedupe_email_candidates(candidates: list[dict]) -> list[dict]:
    """One send per email address; skip test/internal addresses."""
    seen: set[str] = set()
    unique: list[dict] = []
    for cand in candidates:
        email = (cand.get("email") or "").strip().lower()
        if not email or email in seen or is_test_or_bot_email(email) or is_already_sent(email):
            continue
        if "gooddlong" in email:
            continue
        seen.add(email)
        unique.append(cand)
    return unique


def main() -> int:
    parser = argparse.ArgumentParser(description="AsiaPower email outreach batch")
    parser.add_argument("--limit", type=int, default=3, help="Max emails to send")
    parser.add_argument("--dry-run", action="store_true", help="Create drafts only")
    parser.add_argument("--migrate-social", action="store_true", default=True)
    args = parser.parse_args()

    migrated = migrate_social_posts_to_blocked()
    if migrated:
        print(f"Migrated {migrated} social post(s) → blocked_no_account")

    if not send_enabled():
        print("ERROR: Email send not enabled (EMAIL_SEND_ENABLED=1 + RESEND_API_KEY required)")
        return 1

    candidates = _dedupe_email_candidates([
        c for c in scan_outreach_candidates(limit=50)
        if c.get("channel") == "email" and (c.get("email") or "").strip()
    ])
    if not candidates:
        print("No open website leads with email addresses.")
        return 0

    results: list[dict] = []
    for cand in candidates[: max(1, args.limit)]:
        record = create_lead_email_outreach(cand)
        entry = {
            "outreach_id": record["outreach_id"],
            "name": cand.get("name"),
            "email": cand.get("email"),
            "country": cand.get("country"),
            "status": "draft",
        }
        if args.dry_run:
            entry["status"] = "dry_run"
            results.append(entry)
            continue
        approve_outreach(record["outreach_id"])
        sent = send_outreach(record["outreach_id"])
        entry["status"] = "sent"
        entry["resend_id"] = sent.get("resend_id")
        entry["subject"] = sent.get("subject")
        results.append(entry)

    print(json.dumps({"ok": True, "sent": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
