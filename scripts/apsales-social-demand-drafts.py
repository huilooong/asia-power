#!/usr/bin/env python3
"""Create APSales reply drafts from existing social demand intel.

Read-only toward social platforms: this script does not log in, post, DM, email,
or send WhatsApp. It only reads local intel JSONL and writes internal draft_queue
records for CEO/APSales approval.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

DEFAULT_INTEL_FILES = [
    ROOT / "memory" / "customer_gateway" / "fb_friends_market_intel.jsonl",
    ROOT / "memory" / "customer_gateway" / "social_research_notes.jsonl",
    ROOT / "memory" / "customer_gateway" / "global_social_demand_intel.jsonl",
]
REPORT_FILE = ROOT / "docs" / "agent-reports" / "apsales-social-demand-drafts.md"
STATE_FILE = ROOT / "memory" / "customer_gateway" / "social_demand_draft_state.json"

BUYER_PRODUCT_RE = re.compile(
    r"(where can i|where to|looking for|i need|need|want to buy|who has|recommend|quote|price)"
    r".{0,160}"
    r"(engine|gearbox|transmission|half[- ]?cut|spare parts?|tokunbo|used parts?)"
    r"|"
    r"(engine|gearbox|transmission|half[- ]?cut|spare parts?|tokunbo|used parts?)"
    r".{0,160}"
    r"(where can i|where to|looking for|i need|need|want to buy|who has|recommend|quote|price)",
    re.I,
)
FALSE_BUYER_RE = re.compile(
    r"\b(review|is it still worth buying|things to know before you buy|palm kernel|agriculture|house clearance|for sale|hot deal|foreign used|store for)\b",
    re.I,
)

COUNTRY_URLS = {
    "Ghana": "https://asia-power.com/engines/ghana-half-cut-engines.html",
    "Nigeria": "https://asia-power.com/engines/nigeria-half-cut-engines.html",
    "Kenya": "https://asia-power.com/engines/kenya-half-cut-engines.html",
    "Tanzania": "https://asia-power.com/engines/tanzania-half-cut-engines.html",
    "Uganda": "https://asia-power.com/engines/uganda-half-cut-engines.html",
    "South Africa": "https://asia-power.com/engines/south-africa-half-cut-engines.html",
    "UAE": "https://asia-power.com/engines/dubai-half-cut-engines.html",
    "Benin": "https://asia-power.com/engines/benin-half-cut-engines.html",
    "Togo": "https://asia-power.com/engines/togo-half-cut-engines.html",
    "Cameroon": "https://asia-power.com/engines/cameroon-half-cut-engines.html",
    "Senegal": "https://asia-power.com/engines/senegal-half-cut-engines.html",
    "Ivory Coast": "https://asia-power.com/engines/cote-d-ivoire-half-cut-engines.html",
}

DEFAULT_URL = "https://asia-power.com/contact.html"
CATALOG_URL = "https://asia-power.com/half-cuts/"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _load_json(path: Path, default: object) -> object:
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _iter_jsonl(path: Path) -> list[dict[str, Any]]:
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
            row.setdefault("_intel_file", str(path.relative_to(ROOT)))
            rows.append(row)
    return rows


def load_intel_rows(paths: list[Path]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in paths:
        rows.extend(_iter_jsonl(path))
    return rows


def _stable_key(row: dict[str, Any]) -> str:
    blob = "\n".join([
        str(row.get("author") or ""),
        str(row.get("text") or ""),
        str(row.get("post_url") or ""),
    ])
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()[:16]


def _is_self_or_noise(row: dict[str, Any]) -> bool:
    text = f"{row.get('author', '')}\n{row.get('text', '')}".lower()
    if row.get("intent_type") == "self_promotion":
        return True
    return any(
        marker in text
        for marker in (
        "asia-power.com",
        "asiapower",
        "sales@asia-power.com",
            "i'm a supplier from china",
            "we supply verified",
            "we list verified",
        )
    )


def _fallback_score(row: dict[str, Any]) -> int:
    try:
        return int(row.get("buyer_intent_score") or 0)
    except (TypeError, ValueError):
        pass

    text = str(row.get("text") or "").lower()
    score = 0
    if any(k in text for k in ("looking for", "need", "needed", "want to buy", "who has", "anyone selling", "quote", "how much", "where can i get", "where to buy", "recommend supplier", "looking to import")):
        score += 45
    if any(k in text for k in ("engine", "gearbox", "transmission", "half cut", "half-cut", "spare part")):
        score += 20
    if row.get("detected_engine_codes"):
        score += 20
    if row.get("detected_country"):
        score += 10
    if any(k in text for k in ("for sale", "available", "call or whatsapp", "clean sharp", "distress sale")) and score < 60:
        score -= 25
    return max(0, min(100, score))


def _intent_type(row: dict[str, Any], score: int) -> str:
    if row.get("intent_type"):
        return str(row["intent_type"])
    return "buyer_demand" if score >= 70 else "market_signal"


def _passes_buyer_quality(row: dict[str, Any]) -> bool:
    text = str(row.get("text") or "")
    platform = _source_platform(row)
    host = urlparse(str(row.get("post_url") or "")).netloc.lower()
    if platform == "nairaland" and not host.endswith("nairaland.com"):
        return False
    if platform == "youtube" and not host.endswith("youtube.com"):
        return False
    if not BUYER_PRODUCT_RE.search(text):
        return False
    if FALSE_BUYER_RE.search(text):
        return False
    if row.get("source_type") == "classifieds":
        return False
    return True


def _source_platform(row: dict[str, Any]) -> str:
    for key in ("source_platform", "platform", "source"):
        value = str(row.get(key) or "").strip().lower()
        if value:
            return value
    file_hint = str(row.get("_intel_file") or "").lower()
    if "fb_" in file_hint or "facebook" in file_hint:
        return "facebook"
    if "nairaland" in file_hint:
        return "nairaland"
    if "jiji" in file_hint:
        return "jiji"
    return "social"


def _target_url(row: dict[str, Any]) -> str:
    country = str(row.get("detected_country") or "").strip()
    if country in COUNTRY_URLS:
        return COUNTRY_URLS[country]
    text = str(row.get("text") or "").lower()
    if "gearbox" in text or "transmission" in text:
        return "https://asia-power.com/gearboxes/"
    if "half" in text or "cut" in text:
        return CATALOG_URL
    if row.get("detected_engine_codes") or "engine" in text:
        return "https://asia-power.com/engines/"
    return DEFAULT_URL


def _products(row: dict[str, Any]) -> list[str]:
    text = str(row.get("text") or "").lower()
    out: list[str] = []
    for code in row.get("detected_engine_codes") or []:
        if code and code not in out:
            out.append(str(code))
    for word in ("engine", "gearbox", "transmission", "half-cut", "half cut", "spare parts"):
        if word in text and word not in out:
            out.append(word)
    return out[:8]


def _draft_text(row: dict[str, Any], url: str) -> str:
    engines = ", ".join(row.get("detected_engine_codes") or [])
    country = str(row.get("detected_country") or "").strip()
    product_hint = engines or "the engine / gearbox / half-cut"
    destination = f" for {country}" if country else ""
    return (
        f"Hi — I saw your post about {product_hint}{destination}.\n\n"
        "AsiaPower helps buyers check used engines, gearboxes and half-cuts from China before quotation. "
        "We confirm photos, engine/gearbox matching, package scope, condition and export availability before price.\n\n"
        f"You can send model, year, engine code, gearbox type and destination port here: {url}\n\n"
        "No pressure — exact availability and price must be confirmed before quotation."
    )


def select_candidates(rows: list[dict[str, Any]], *, limit: int, min_score: int) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()
    state = _load_json(STATE_FILE, {})
    already = set((state if isinstance(state, dict) else {}).get("created_keys") or [])

    for row in reversed(rows):
        key = _stable_key(row)
        if key in seen or key in already:
            continue
        seen.add(key)
        if _is_self_or_noise(row):
            continue
        score = _fallback_score(row)
        intent = _intent_type(row, score)
        if score < min_score or intent != "buyer_demand" or not _passes_buyer_quality(row):
            continue
        enriched = {
            **row,
            "_demand_key": key,
            "_score": score,
            "_target_url": _target_url(row),
        }
        selected.append(enriched)
        if len(selected) >= limit:
            break

    selected.sort(key=lambda r: r.get("_score", 0), reverse=True)
    return selected


def create_drafts(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    from customer_gateway.draft_queue import save_draft

    created: list[dict[str, Any]] = []
    for row in candidates:
        url = row["_target_url"]
        draft = save_draft({
            "customer_hash": hashlib.sha1(str(row.get("author", "social")).encode("utf-8")).hexdigest()[:16],
            "customer_name": f"social:{row.get('author') or 'unknown'}",
            "detected_language": "en",
            "original_message": str(row.get("text") or "")[:1000],
            "internal_analysis_zh": (
                "社媒公开需求线索。"
                f"国家={row.get('detected_country') or 'unknown'}；"
                f"产品={', '.join(_products(row)) or 'unknown'}；"
                f"buyer_intent_score={row.get('_score')}；"
                f"来源={row.get('source') or 'social'}；"
                "仅生成回复草稿，不自动评论、不自动私信。"
            ),
            "customer_reply_draft": _draft_text(row, url),
            "risk_level": "medium",
            "approval_required": True,
            "next_action": "ceo_review_social_reply",
            "category": "social_demand_reply",
            "classification": "public_social_buyer_demand",
            "confidence": float(row.get("_score", 0)) / 100,
            "action": "generate_draft",
            "reasoning_summary": "公开社媒求购/询价信号，建议人工确认后互动导流。",
            "authority": "sales",
            "constitution_allowed": True,
            "constitution_reason": "Draft only. No external send/post/DM.",
            "authority_check": "draft:allow; external_send:deny_without_ceo_approval",
            "risk_score": 0.45,
            "risk_reason": "Public social interaction can affect brand/account safety; requires CEO approval.",
            "decision_path": "Social Intel -> Demand Filter -> Draft Queue",
            "products": _products(row),
            "source_post_url": row.get("post_url") or "",
            "source_platform": _source_platform(row),
            "source_type": "public_social_intel",
            "demand_key": row["_demand_key"],
        })
        created.append({
            "draft_id": draft["draft_id"],
            "author": row.get("author") or "unknown",
            "score": row.get("_score"),
            "country": row.get("detected_country") or "",
            "url": url,
            "products": _products(row),
        })

    state = _load_json(STATE_FILE, {})
    if not isinstance(state, dict):
        state = {}
    keys = set(state.get("created_keys") or [])
    keys.update(row["_demand_key"] for row in candidates)
    state["updated_at"] = _now()
    state["created_keys"] = sorted(keys)
    _save_json(STATE_FILE, state)
    return created


def write_report(*, rows: list[dict[str, Any]], candidates: list[dict[str, Any]], created: list[dict[str, Any]]) -> None:
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    intent_counts: dict[str, int] = {}
    for row in rows:
        score = _fallback_score(row)
        intent = _intent_type(row, score)
        if _is_self_or_noise(row):
            intent = "self_promotion"
        intent_counts[intent] = intent_counts.get(intent, 0) + 1

    lines = [
        "# APSales Social Demand Drafts",
        "",
        f"Generated: {_now()}",
        "",
        "## Scope",
        "",
        "- Reads existing local social/forum/marketplace intel only.",
        "- Default sources: Facebook feed intel, social research notes, and global social demand intel JSONL.",
        "- Does not log in to any platform.",
        "- Does not post, comment, DM, email or WhatsApp anyone.",
        "- Creates internal APSales draft_queue records only when explicitly run with `--create-drafts`.",
        "",
        "## Current Social Intel Quality",
        "",
        f"- Total intel rows reviewed: {len(rows)}",
    ]
    for key in sorted(intent_counts):
        lines.append(f"- {key}: {intent_counts[key]}")

    source_counts: dict[str, int] = {}
    for row in rows:
        platform = _source_platform(row)
        source_counts[platform] = source_counts.get(platform, 0) + 1
    lines.extend(["", "## Source Mix", ""])
    if source_counts:
        for key in sorted(source_counts):
            lines.append(f"- {key}: {source_counts[key]}")
    else:
        lines.append("- No local intel rows found.")

    lines.extend([
        "",
        "## Selected Buyer Demand Candidates",
        "",
    ])
    if not candidates:
        lines.append("No high-confidence buyer demand candidates found in the existing intel file.")
    else:
        lines.append("| Score | Country | Author | Products | Target URL |")
        lines.append("| ---: | --- | --- | --- | --- |")
        for row in candidates:
            lines.append(
                f"| {row.get('_score')} | {row.get('detected_country') or ''} | "
                f"{str(row.get('author') or '')[:60]} | {', '.join(_products(row)) or ''} | {row.get('_target_url')} |"
            )

    review_rows = [
        row for row in rows
        if _intent_type(row, _fallback_score(row)) == "comment_review_candidate"
    ][:20]
    lines.extend([
        "",
        "## Comment Review Candidates",
        "",
    ])
    if not review_rows:
        lines.append("No video/comment review candidates found in the current intel files.")
    else:
        lines.append("| Platform | Country | Signal | URL |")
        lines.append("| --- | --- | --- | --- |")
        for row in review_rows:
            signal = str(row.get("text") or "").replace("|", "/")[:140]
            lines.append(
                f"| {_source_platform(row)} | {row.get('detected_country') or ''} | "
                f"{signal} | {row.get('post_url') or ''} |"
            )

    lines.extend([
        "",
        "## Drafts Created",
        "",
    ])
    if not created:
        lines.append("No drafts created in this run.")
    else:
        lines.append("| Draft ID | Score | Country | Author | Target URL |")
        lines.append("| --- | ---: | --- | --- | --- |")
        for row in created:
            lines.append(
                f"| {row['draft_id']} | {row['score']} | {row['country']} | "
                f"{str(row['author'])[:60]} | {row['url']} |"
            )

    lines.extend([
        "",
        "## Practical Conclusion",
        "",
        "The useful path is not broad automated posting. The useful path is:",
        "",
        "1. Browse public social, forum, marketplace and video-comment sources manually or with approved local runners.",
        "2. Save structured intel.",
        "3. Filter only real buyer demand.",
        "4. Create reply drafts.",
        "5. Human approves the exact reply.",
        "6. APSales posts/replies manually or through an approved controlled action.",
        "",
        "This keeps AsiaPower active in the market without burning accounts or spamming irrelevant groups.",
    ])

    REPORT_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Create APSales reply drafts from social demand intel")
    p.add_argument("--limit", type=int, default=10)
    p.add_argument("--min-score", type=int, default=70)
    p.add_argument("--intel-file", action="append", default=[], help="Extra JSONL intel file to read")
    p.add_argument("--create-drafts", action="store_true")
    p.add_argument("--json", action="store_true")
    return p


def main() -> int:
    args = build_parser().parse_args()
    paths = DEFAULT_INTEL_FILES + [Path(p) for p in args.intel_file]
    rows = load_intel_rows(paths)
    candidates = select_candidates(rows, limit=args.limit, min_score=args.min_score)
    created = create_drafts(candidates) if args.create_drafts else []
    write_report(rows=rows, candidates=candidates, created=created)

    result = {
        "ok": True,
        "reviewed": len(rows),
        "sources": [str(p) for p in paths],
        "candidates": len(candidates),
        "drafts_created": len(created),
        "report": str(REPORT_FILE),
        "created": created,
    }
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"Reviewed: {len(rows)}")
        print(f"Candidates: {len(candidates)}")
        print(f"Drafts created: {len(created)}")
        print(f"Report: {REPORT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
