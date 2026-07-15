#!/usr/bin/env python3
"""Send APBD outreach queue drafts that have a public email (CEO-approved batch)."""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from customer_gateway.email_outbound import send_enabled, send_proactive_email  # noqa: E402
from customer_gateway.email_test_filter import is_test_or_bot_email  # noqa: E402
from customer_gateway.outreach_sent_registry import is_already_sent, normalize_email, record_sent  # noqa: E402

APBD_ROOT = ROOT / "runtime" / "apbd"
EMAIL_COUNTER = ROOT / "reports" / "email-daily-count.json"
DAILY_LIMIT = 90
DELAY_SECONDS = 2.5


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _load_counter() -> dict:
    if EMAIL_COUNTER.is_file():
        try:
            data = json.loads(EMAIL_COUNTER.read_text(encoding="utf-8"))
            if data.get("date") == _today():
                return data
        except (json.JSONDecodeError, OSError):
            pass
    return {"date": _today(), "sent": 0, "limit": DAILY_LIMIT}


def _save_counter(counter: dict) -> None:
    EMAIL_COUNTER.parent.mkdir(parents=True, exist_ok=True)
    EMAIL_COUNTER.write_text(json.dumps(counter, indent=2), encoding="utf-8")


def _parse_email_draft(draft_text: str) -> tuple[str, str]:
    text = (draft_text or "").strip()
    if not text:
        return "AsiaPower — verified engine & parts supply", ""
    subject = "AsiaPower — verified engine & parts supply"
    body = text
    if text.lower().startswith("subject:"):
        first, _, rest = text.partition("\n")
        subject = first.split(":", 1)[1].strip() or subject
        body = rest.lstrip("\n")
    return subject, body


def _iter_queue_records() -> list[tuple[Path, dict]]:
    records: list[tuple[Path, dict]] = []
    for queue_dir in sorted(APBD_ROOT.glob("*/outreach_queue")):
        for path in sorted(queue_dir.glob("*.json")):
            if path.name in {"outreach-queue.json", "summary.json"}:
                continue
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            records.append((path, record))
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description="Send APBD outreach queue emails")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Max sends (0 = up to daily limit)")
    args = parser.parse_args()

    if not args.dry_run and not send_enabled():
        print("ERROR: EMAIL_SEND_ENABLED=1 and RESEND_API_KEY required")
        return 1

    counter = _load_counter()
    remaining = counter["limit"] - counter["sent"]
    if remaining <= 0 and not args.dry_run:
        print(f"Daily limit reached: {counter['sent']}/{counter['limit']}")
        return 0

    pending: list[tuple[Path, dict, str]] = []
    seen: set[str] = set()

    for path, record in _iter_queue_records():
        if record.get("approval_status") == "sent":
            continue
        # Hard gate: never send unless explicitly approved (Track B / three-tracks).
        # Legacy runs treated any non-sent row as sendable — that bypassed CEO approval.
        if str(record.get("approval_status") or "").strip().lower() != "approved":
            continue
        email = normalize_email(record.get("public_email") or "")
        if not email or "@" not in email or "not published" in email:
            continue
        if is_test_or_bot_email(email) or email in seen or is_already_sent(email):
            continue
        seen.add(email)
        pending.append((path, record, email))

    limit = args.limit if args.limit > 0 else remaining
    if not args.dry_run:
        limit = min(limit, remaining)
    batch = pending[:limit]

    mode = "DRY-RUN" if args.dry_run else "LIVE"
    print(f"APBD outreach queue — {mode}")
    print(f"Pending with email: {len(pending)} | Sending: {len(batch)}")
    print(f"Today: {counter['sent']}/{counter['limit']} | Remaining: {remaining}")

    results: list[dict] = []
    for idx, (path, record, email) in enumerate(batch, 1):
        company = record.get("company") or email
        subject, body = _parse_email_draft(record.get("email_draft") or "")
        print(f"[{idx}/{len(batch)}] {company[:50]} | {email}")
        if args.dry_run:
            results.append({"company": company, "email": email, "status": "dry_run", "subject": subject})
            continue
        try:
            result = send_proactive_email(to=email, subject=subject, text=body)
            sent_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
            record["approval_status"] = "sent"
            record["sent_at"] = sent_at
            record["resend_id"] = result.get("resend_id")
            path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
            counter["sent"] += 1
            _save_counter(counter)
            record_sent(
                email=email,
                company=company,
                country=record.get("country") or "",
                source="apbd_outreach_queue",
                resend_id=result.get("resend_id") or "",
                sent_at=sent_at,
                outreach_id=record.get("outreach_id") or "",
            )
            results.append(
                {
                    "company": company,
                    "email": email,
                    "status": "sent",
                    "resend_id": result.get("resend_id"),
                }
            )
            if idx < len(batch):
                time.sleep(DELAY_SECONDS)
        except ValueError as exc:
            results.append({"company": company, "email": email, "status": "failed", "error": str(exc)})

    print(json.dumps({"ok": True, "results": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
