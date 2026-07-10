#!/usr/bin/env python3
"""Send Google Maps / APBD africa_maps leads with email (deduped, daily cap)."""

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
from customer_gateway.maps_prospect import build_maps_outreach_email  # noqa: E402
from customer_gateway.outreach_sent_registry import is_already_sent, normalize_email, record_sent  # noqa: E402

LEADS_FILE = ROOT / "memory" / "customer_gateway" / "africa_maps_leads.jsonl"
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


def _load_candidates() -> list[dict]:
    if not LEADS_FILE.is_file():
        return []
    seen: set[str] = set()
    out: list[dict] = []
    for line in LEADS_FILE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        lead = json.loads(line)
        email = normalize_email(lead.get("email") or "")
        if not email or email in seen or is_test_or_bot_email(email) or is_already_sent(email):
            continue
        seen.add(email)
        out.append(
            {
                **lead,
                "email": email,
                "name": lead.get("business_name") or lead.get("name") or "there",
            }
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Send Maps africa leads outreach batch")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Max sends (0 = fill daily quota)")
    args = parser.parse_args()

    if not args.dry_run and not send_enabled():
        print("ERROR: EMAIL_SEND_ENABLED=1 and RESEND_API_KEY required")
        return 1

    counter = _load_counter()
    remaining = counter["limit"] - counter["sent"]
    if remaining <= 0 and not args.dry_run:
        print(f"Daily limit reached: {counter['sent']}/{counter['limit']}")
        return 0

    candidates = _load_candidates()
    limit = args.limit if args.limit > 0 else remaining
    if not args.dry_run:
        limit = min(limit, remaining)
    batch = candidates[:limit]

    mode = "DRY-RUN" if args.dry_run else "LIVE"
    print(f"Maps outreach batch — {mode}")
    print(f"Candidates: {len(candidates)} | Sending: {len(batch)}")
    print(f"Today: {counter['sent']}/{counter['limit']} | Remaining: {remaining}")

    results: list[dict] = []
    for idx, lead in enumerate(batch, 1):
        email = lead["email"]
        name = lead.get("name") or email
        subject, body = build_maps_outreach_email(lead)
        print(f"[{idx}/{len(batch)}] {name[:45]} | {lead.get('country')} | {email}")
        if args.dry_run:
            results.append({"name": name, "email": email, "status": "dry_run"})
            continue
        try:
            result = send_proactive_email(to=email, subject=subject, text=body)
            sent_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
            counter["sent"] += 1
            _save_counter(counter)
            record_sent(
                email=email,
                company=name,
                country=lead.get("country") or "",
                source="africa_maps_leads",
                resend_id=result.get("resend_id") or "",
                sent_at=sent_at,
                lead_key=lead.get("lead_key") or "",
            )
            results.append({"name": name, "email": email, "status": "sent", "resend_id": result.get("resend_id")})
            if idx < len(batch):
                time.sleep(DELAY_SECONDS)
        except ValueError as exc:
            results.append({"name": name, "email": email, "status": "failed", "error": str(exc)})

    print(json.dumps({"ok": True, "results": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
