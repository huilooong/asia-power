#!/usr/bin/env python3
"""Record a public buyer comment into AsiaPower social demand intel.

This script is local-only. It does not fetch the URL, open a browser, reply,
comment, DM, email, WhatsApp, or publish. It only saves a public comment that a
human or approved browser runner has already reviewed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
INTEL_FILE = ROOT / "memory" / "customer_gateway" / "global_social_demand_intel.jsonl"
REPORT_FILE = ROOT / "docs" / "agent-reports" / "apsales-record-public-comment-demand.md"

BUYER_PRODUCT_RE = re.compile(
    r"(where can i|where to|looking for|i need|need|want to buy|who has|recommend|quote|price|ship to)"
    r".{0,180}"
    r"(engine|gearbox|transmission|half[- ]?cut|spare parts?|tokunbo|used parts?)"
    r"|"
    r"(engine|gearbox|transmission|half[- ]?cut|spare parts?|tokunbo|used parts?)"
    r".{0,180}"
    r"(where can i|where to|looking for|i need|need|want to buy|who has|recommend|quote|price|ship to)",
    re.I,
)

COUNTRY_ALIASES = {
    "Ghana": ["ghana", "accra", "kumasi", "tema"],
    "Nigeria": ["nigeria", "lagos", "abuja", "ladipo", "nnewi"],
    "Kenya": ["kenya", "nairobi", "mombasa"],
    "Tanzania": ["tanzania", "dar es salaam", "arusha"],
    "UAE": ["uae", "dubai", "abu dhabi", "sharjah"],
}


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def stable_key(url: str, comment: str, author: str) -> str:
    return hashlib.sha1(f"{url}\n{author}\n{comment}".encode("utf-8")).hexdigest()[:20]


def detect_platform(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if "youtube.com" in host or "youtu.be" in host:
        return "youtube"
    if "facebook.com" in host:
        return "facebook"
    if "nairaland.com" in host:
        return "nairaland"
    return "public_web"


def detect_country(text: str, fallback: str) -> str:
    lowered = text.lower()
    for country, aliases in COUNTRY_ALIASES.items():
        if any(alias in lowered for alias in aliases):
            return country
    return fallback


def detect_products(text: str) -> list[str]:
    lowered = text.lower()
    products: list[str] = []
    for word in ("engine", "gearbox", "transmission", "half cut", "half-cut", "spare parts", "tokunbo"):
        if word in lowered:
            products.append(word)
    for code in re.findall(r"\b(?:G4KD|G4NA|G4KE|G4KJ|2TR-FE|1KD-FTV|2KD-FTV|1NZ-FE|2AZ-FE|MR20DE|QR25DE)\b", text, flags=re.I):
        products.append(code.upper())
    return sorted(set(products))


def validate_comment(comment: str) -> tuple[bool, str]:
    if len(comment) < 12:
        return False, "comment_too_short"
    if not BUYER_PRODUCT_RE.search(comment):
        return False, "missing_buyer_product_intent"
    return True, "ok"


def append_record(record: dict) -> None:
    INTEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    with INTEL_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")


def write_report(record: dict | None, *, ok: bool, reason: str) -> None:
    lines = [
        "# APSales Record Public Comment Demand",
        "",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## Safety",
        "",
        "- Local record only.",
        "- No browser, login, comment, DM, email, WhatsApp or publish action.",
        "- Public comment must be reviewed before recording.",
        "",
        "## Result",
        "",
        f"- OK: {str(ok).lower()}",
        f"- Reason: `{reason}`",
    ]
    if record:
        lines.extend([
            f"- Platform: {record.get('source_platform')}",
            f"- Country: {record.get('detected_country')}",
            f"- Products: {', '.join(record.get('detected_engine_codes') or record.get('products') or [])}",
            f"- URL: {record.get('post_url')}",
            "",
            "## Recorded Text",
            "",
            str(record.get("text") or ""),
        ])
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Record reviewed public comment as buyer demand intel")
    parser.add_argument("--url", required=True)
    parser.add_argument("--comment", required=True)
    parser.add_argument("--author", default="public-comment")
    parser.add_argument("--country", default="")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    comment = clean(args.comment)
    ok, reason = validate_comment(comment)
    record = None
    if ok:
        platform = detect_platform(args.url)
        country = detect_country(comment, args.country)
        products = detect_products(comment)
        record = {
            "created_at": now_utc(),
            "source": "public_comment_review",
            "source_platform": platform,
            "source_type": "video_comments" if platform == "youtube" else "public_comments",
            "detected_country": country,
            "author": args.author,
            "text": comment,
            "post_url": args.url,
            "buyer_intent_score": 85,
            "intent_type": "buyer_demand",
            "intent_reasons": ["reviewed_public_comment", "buyer_product_proximity"],
            "products": products,
            "detected_engine_codes": [p for p in products if re.search(r"\d|G4|MR|QR", p)],
            "potential_lead": True,
            "recommended_action": "create_apsales_reply_draft",
            "demand_key": stable_key(args.url, comment, args.author),
        }
        if not args.dry_run:
            append_record(record)
    write_report(record, ok=ok, reason=reason)
    result = {
        "ok": ok,
        "reason": reason,
        "dry_run": args.dry_run,
        "recorded": bool(ok and not args.dry_run),
        "report": str(REPORT_FILE),
        "intel_file": str(INTEL_FILE),
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
