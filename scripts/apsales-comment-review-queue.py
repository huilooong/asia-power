#!/usr/bin/env python3
"""Build an APSales manual review queue for public video/comment candidates.

This script is intentionally read-only toward external platforms. It reads local
intel JSONL records, finds `comment_review_candidate` items, and writes a
markdown queue for a human or approved browser runner to inspect public comments.
It does not open browsers, log in, comment, DM, email, WhatsApp, or publish.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INTEL_FILES = [
    ROOT / "memory" / "customer_gateway" / "global_social_demand_intel.jsonl",
    ROOT / "memory" / "customer_gateway" / "social_research_notes.jsonl",
    ROOT / "memory" / "customer_gateway" / "fb_friends_market_intel.jsonl",
]
REPORT_FILE = ROOT / "docs" / "agent-reports" / "apsales-comment-review-queue.md"

BUYER_TERMS = [
    "where can i buy",
    "where to buy",
    "looking for",
    "i need",
    "need engine",
    "need gearbox",
    "who has",
    "how much",
    "price",
    "quote",
    "ship to",
]
PRODUCT_TERMS = [
    "engine",
    "gearbox",
    "transmission",
    "half cut",
    "half-cut",
    "tokunbo",
    "spare parts",
    "G4KD",
    "G4NA",
    "2TR-FE",
    "1KD-FTV",
    "2KD-FTV",
]


def now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def iter_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict):
            row["_intel_file"] = str(path.relative_to(ROOT))
            rows.append(row)
    return rows


def load_rows(paths: list[Path]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in paths:
        rows.extend(iter_jsonl(path))
    return rows


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def source_platform(row: dict[str, Any]) -> str:
    return str(row.get("source_platform") or row.get("platform") or row.get("source") or "unknown").strip().lower()


def score_row(row: dict[str, Any]) -> int:
    try:
        base = int(row.get("buyer_intent_score") or 0)
    except (TypeError, ValueError):
        base = 0
    text = clean(str(row.get("text") or "")).lower()
    score = base
    if source_platform(row) == "youtube":
        score += 10
    if any(term.lower() in text for term in PRODUCT_TERMS):
        score += 10
    if any(term in text for term in ("g4kd", "g4na", "2tr-fe", "toyota", "hyundai", "kia")):
        score += 5
    return max(0, min(100, score))


def select_candidates(rows: list[dict[str, Any]], *, limit: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        if row.get("intent_type") != "comment_review_candidate":
            continue
        url = str(row.get("post_url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        out.append({**row, "_review_score": score_row(row)})
    out.sort(key=lambda r: (r.get("_review_score", 0), str(r.get("created_at") or "")), reverse=True)
    return out[:limit]


def write_report(candidates: list[dict[str, Any]], *, rows_reviewed: int) -> None:
    lines = [
        "# APSales Comment Review Queue",
        "",
        f"Generated: {now_utc()}",
        "",
        "## Safety Boundary",
        "",
        "- This queue is for public comment review only.",
        "- Do not comment, DM, email, WhatsApp, or publish automatically.",
        "- If a real buyer comment is found, copy the public comment text into local intel first, then run APSales demand draft generation.",
        "- External replies require human approval.",
        "",
        "## Run Summary",
        "",
        f"- Local intel rows reviewed: {rows_reviewed}",
        f"- Comment review candidates: {len(candidates)}",
        "",
        "## What To Look For In Comments",
        "",
        "- Buyer wording: " + ", ".join(f"`{x}`" for x in BUYER_TERMS),
        "- Product wording: " + ", ".join(f"`{x}`" for x in PRODUCT_TERMS),
        "- Useful buyer details: country, vehicle model, engine code, gearbox type, destination port, budget, urgency.",
        "",
        "## Review Queue",
        "",
    ]
    if not candidates:
        lines.append("No comment review candidates found in current intel files.")
    else:
        lines.append("| Priority | Platform | Country | Signal | URL | Recommended Action |")
        lines.append("| ---: | --- | --- | --- | --- | --- |")
        for row in candidates:
            signal = clean(str(row.get("text") or "")).replace("|", "/")[:160]
            action = "Open video, sort comments by newest/relevant, search buyer/product wording, capture public buyer comments only."
            lines.append(
                f"| {row.get('_review_score')} | {source_platform(row)} | {row.get('detected_country') or 'Global'} | "
                f"{signal} | {row.get('post_url')} | {action} |"
            )

    lines.extend([
        "",
        "## Next Step After A Real Buyer Comment Is Found",
        "",
        "1. Save the public comment text and URL into `memory/customer_gateway/global_social_demand_intel.jsonl` with `intent_type: buyer_demand` only if it clearly asks for engine/gearbox/half-cut help.",
        "2. Run `python3 scripts/apsales-social-autopilot.py --demand-drafts --json`.",
        "3. Review the generated APSales draft.",
        "4. Reply only after human approval.",
    ])

    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build APSales public comment review queue")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--json", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    rows = load_rows(DEFAULT_INTEL_FILES)
    candidates = select_candidates(rows, limit=args.limit)
    write_report(candidates, rows_reviewed=len(rows))
    result = {
        "ok": True,
        "reviewed": len(rows),
        "candidates": len(candidates),
        "report": str(REPORT_FILE),
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Reviewed: {len(rows)}")
        print(f"Candidates: {len(candidates)}")
        print(f"Report: {REPORT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
