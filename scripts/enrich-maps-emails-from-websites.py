#!/usr/bin/env python3
"""Scrape contact emails from lead websites (africa_maps_leads.jsonl)."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from customer_gateway.maps_prospect import _scrape_email_from_website  # noqa: E402
from customer_gateway.outreach_sent_registry import is_already_sent, normalize_email  # noqa: E402

SOCIAL_RE = re.compile(r"facebook|instagram|tiktok|twitter|linkedin|google\.com/maps", re.I)

LEADS_FILE = ROOT / "memory" / "customer_gateway" / "africa_maps_leads.jsonl"
REPORT_FILE = ROOT / "reports" / "maps-email-scrape-report.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape emails from lead websites")
    parser.add_argument("--limit", type=int, default=120, help="Max websites to scrape this run")
    parser.add_argument("--delay", type=float, default=0.8, help="Seconds between requests")
    parser.add_argument("--dry-run", action="store_true", help="Preview targets only")
    parser.add_argument("--rescrape", action="store_true", help="Retry previously attempted sites")
    args = parser.parse_args()

    if not LEADS_FILE.is_file():
        print(json.dumps({"ok": False, "error": "africa_maps_leads.jsonl not found"}, ensure_ascii=False))
        return 1

    lines = LEADS_FILE.read_text(encoding="utf-8").splitlines()
    records: list[dict] = []
    targets: list[int] = []

    for idx, line in enumerate(lines):
        if not line.strip():
            continue
        row = json.loads(line)
        records.append(row)
        email = normalize_email(row.get("email") or "")
        website = (row.get("website") or "").strip()
        if email or not website:
            continue
        if SOCIAL_RE.search(website):
            continue
        if row.get("email_scrape_attempted_at") and not args.rescrape:
            continue
        targets.append(idx)

    batch_targets = targets[: max(1, args.limit)]
    result = {
        "ok": True,
        "generated_at": _now_iso(),
        "total_leads": len(records),
        "needs_scrape": len(targets),
        "attempted": len(batch_targets),
        "found": 0,
        "already_sent_skipped": 0,
        "new_emails": [],
        "failed_sites": [],
    }

    if args.dry_run:
        preview = []
        for idx in batch_targets[:20]:
            row = records[idx]
            preview.append(
                {
                    "business": row.get("business_name") or row.get("name"),
                    "country": row.get("country"),
                    "website": row.get("website"),
                }
            )
        result["preview"] = preview
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    updated_lines = list(lines)
    for n, idx in enumerate(batch_targets, 1):
        row = records[idx]
        website = (row.get("website") or "").strip()
        name = row.get("business_name") or row.get("name") or "?"
        print(f"[{n}/{len(batch_targets)}] {name[:40]} | {website[:60]}")
        email = normalize_email(_scrape_email_from_website(website))
        if email:
            if is_already_sent(email):
                result["already_sent_skipped"] += 1
            else:
                result["found"] += 1
                result["new_emails"].append(
                    {
                        "business": name,
                        "country": row.get("country"),
                        "email": email,
                        "website": website,
                    }
                )
            row = {
                **row,
                "email": email,
                "email_source": "website_scrape",
                "email_scraped_at": _now_iso(),
            }
            records[idx] = row
            updated_lines[idx] = json.dumps(row, ensure_ascii=False)
        else:
            row = {**row, "email_scrape_attempted_at": _now_iso()}
            records[idx] = row
            updated_lines[idx] = json.dumps(row, ensure_ascii=False)
            result["failed_sites"].append({"business": name, "website": website})
        if n < len(batch_targets):
            time.sleep(max(0.2, args.delay))

    LEADS_FILE.write_text("\n".join(updated_lines) + ("\n" if updated_lines else ""), encoding="utf-8")
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
