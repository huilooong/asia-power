#!/usr/bin/env python3
"""Send deduplicated bilingual outreach batch (outreach_batch_v2.json) via Resend.

Usage:
  python3 scripts/send-outreach-batch-v2.py --dry-run          # preview only
  python3 scripts/send-outreach-batch-v2.py --limit 5          # send first 5
  python3 scripts/send-outreach-batch-v2.py --limit 20         # send first 20
  python3 scripts/send-outreach-batch-v2.py --all              # send all pending
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from customer_gateway.outreach_sent_registry import is_already_sent, normalize_email, record_sent  # noqa: E402

BATCH_FILE = ROOT / "runtime/apbd/2026-07-05/outreach_batch_v2.json"
FROM_ADDR = os.getenv("EMAIL_FROM_SALES", "AsiaPower Sales <sales@asia-power.com>")
REPLY_TO = "sales@asia-power.com"
API_KEY = os.getenv("RESEND_API_KEY", "").strip()
SEND_ENABLED = os.getenv("EMAIL_SEND_ENABLED", "0").strip() == "1"
DELAY_SECONDS = 2.5  # between sends — avoid rate-limit / spam triggers
DAILY_LIMIT = 90
EMAIL_COUNTER = ROOT / "reports/email-daily-count.json"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_counter() -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if EMAIL_COUNTER.exists():
        try:
            d = json.loads(EMAIL_COUNTER.read_text())
            if d.get("date") == today:
                return d
        except Exception:
            pass
    return {"date": today, "sent": 0, "limit": DAILY_LIMIT}


def _save_counter(counter: dict) -> None:
    EMAIL_COUNTER.parent.mkdir(parents=True, exist_ok=True)
    EMAIL_COUNTER.write_text(json.dumps(counter, indent=2))


def resend_send(*, to: str, subject: str, text: str) -> dict:
    payload = {
        "from": FROM_ADDR,
        "to": [to],
        "subject": subject,
        "text": text,
        "reply_to": REPLY_TO,
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "AsiaPower-Outreach/2.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(body)
            msg = detail.get("message") or detail.get("error") or body
        except json.JSONDecodeError:
            msg = body or str(exc)
        raise ValueError(f"Resend error: {msg}") from exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Preview without sending")
    parser.add_argument("--limit", type=int, default=0, help="Max emails to send (0 = use --all)")
    parser.add_argument("--all", action="store_true", help="Send all pending drafts")
    args = parser.parse_args()

    if not args.dry_run and not SEND_ENABLED:
        print("ERROR: EMAIL_SEND_ENABLED not set to 1 in .env")
        return 1
    if not args.dry_run and not API_KEY:
        print("ERROR: RESEND_API_KEY not set in .env")
        return 1

    data = json.loads(BATCH_FILE.read_text(encoding="utf-8"))
    drafts = data["drafts"]
    pending = [
        d for d in drafts
        if d.get("status") == "pending_approval" and not is_already_sent(d.get("email") or "")
    ]
    skipped = len([d for d in drafts if d.get("status") == "pending_approval"]) - len(pending)

    limit = args.limit if args.limit > 0 else (len(pending) if args.all else 10)
    batch = pending[:limit]

    counter = _load_counter()
    remaining_today = counter["limit"] - counter["sent"]

    if not args.dry_run and remaining_today <= 0:
        print(f"⛔ 今日已达发信上限 {counter['limit']} 封，明日继续。")
        return 0

    if not args.dry_run:
        limit = min(limit, remaining_today)
        batch = pending[:limit]

    mode = "DRY-RUN" if args.dry_run else "LIVE"
    print(f"\n{'='*55}")
    print(f"  AsiaPower Outreach Batch v2 — {mode}")
    print(f"  Total pending: {len(pending)} | Sending: {len(batch)} | Skipped (already sent): {skipped}")
    print(f"  Today: {counter['sent']}/{counter['limit']} sent | Remaining: {remaining_today}")
    print(f"  From: {FROM_ADDR}")
    print(f"{'='*55}\n")

    sent_count = 0
    failed = []

    for i, draft in enumerate(batch, 1):
        email = draft["email"]
        subject = draft["subject"]
        body = draft["body"]
        company = draft["company"]
        country = draft["country"]
        lang = draft.get("lang", "en").upper()

        print(f"[{i}/{len(batch)}] {company[:45]} | {country} | {lang} | {email}")

        if args.dry_run:
            print(f"         Subject: {subject}")
            print(f"         Body preview: {body[:80].replace(chr(10),' ')}...")
            draft["status"] = "dry_run_ok"
            sent_count += 1
            continue

        try:
            email = normalize_email(draft["email"])
            if is_already_sent(email):
                print("         ⏭ skipped — already sent")
                draft["status"] = "skipped_already_sent"
                continue
            result = resend_send(to=email, subject=subject, text=body)
            resend_id = result.get("id", "?")
            draft["status"] = "sent"
            draft["sent_at"] = _now()
            draft["resend_id"] = resend_id
            record_sent(
                email=email,
                company=company,
                country=country,
                source="outreach_batch_v2",
                resend_id=resend_id,
                sent_at=draft["sent_at"],
                draft_id=draft.get("draft_id") or "",
            )
            print(f"         ✅ sent — resend_id={resend_id}")
            sent_count += 1
            counter["sent"] += 1
            _save_counter(counter)
            if i < len(batch):
                time.sleep(DELAY_SECONDS)
        except ValueError as exc:
            print(f"         ❌ failed: {exc}")
            draft["status"] = "failed"
            draft["error"] = str(exc)
            failed.append(email)

    # Write results back
    BATCH_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'='*55}")
    print(f"  Done — {mode}")
    print(f"  Sent: {sent_count} | Failed: {len(failed)}")
    if failed:
        print(f"  Failed: {failed}")
    still_pending = len([d for d in drafts if d.get("status") == "pending_approval"])
    print(f"  Still pending: {still_pending}")
    print(f"{'='*55}\n")
    return 0 if not failed else 2


if __name__ == "__main__":
    raise SystemExit(main())
