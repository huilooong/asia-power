"""APBD Keyword Finder — local catalog + market matrix (no browser, no paid APIs)."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agents.apbd.config import day_runtime_dir
from agents.apbd.safety import APBD_DISCOVERY_MODE, assert_apbd_no_browser_ui

ROOT = Path(__file__).resolve().parent.parent.parent
ENGINES_DIR = ROOT / "engines"
DEDUP_FILE = ROOT / "runtime" / "apbd" / "keyword_dedup_keys.json"

PHASE1_COUNTRIES = ["Ghana", "Nigeria", "Kenya", "Tanzania", "UAE"]

# High-value engines for Africa / Middle East export (curated + catalog scan)
PRIORITY_ENGINE_CODES = [
    "G4KD", "G4KE", "G4NA", "G4FC", "G4FG", "G4GC", "G4KA", "G4KC", "G4KJ", "G4ED",
    "2TR-FE", "1KD-FTV", "2KD-FTV", "1NZ-FE", "2NZ-FE", "1ZZ-FE", "1GR-FE", "2GR-FE",
    "QR25DE", "HR16DE", "HR15DE", "MR20DE", "K24A", "K24Z4", "K20A",
    "2AZ-FE", "1AZ-FE", "3ZR-FE", "1ZR-FE", "2ZR-FE", "3ZZ-FE",
    "R18A", "R20A3", "L15A", "L15A1", "L15A7", "K10B",
]

VEHICLE_ENGINE_PAIRS = [
    {"vehicle": "Toyota Hilux", "engine": "2TR-FE"},
    {"vehicle": "Toyota Hilux", "engine": "1KD-FTV"},
    {"vehicle": "Toyota Hilux", "engine": "2KD-FTV"},
    {"vehicle": "Toyota Corolla", "engine": "1NZ-FE"},
    {"vehicle": "Toyota Corolla", "engine": "2NZ-FE"},
    {"vehicle": "Hyundai Tucson", "engine": "G4KD"},
    {"vehicle": "Hyundai Tucson", "engine": "G4KE"},
    {"vehicle": "Hyundai Elantra", "engine": "G4FC"},
    {"vehicle": "Kia Sportage", "engine": "G4KD"},
    {"vehicle": "Nissan X-Trail", "engine": "QR25DE"},
    {"vehicle": "Nissan Qashqai", "engine": "MR20DE"},
    {"vehicle": "Nissan Tiida", "engine": "HR16DE"},
    {"vehicle": "Honda CR-V", "engine": "K24A"},
    {"vehicle": "Honda Accord", "engine": "K24A"},
]

_CSV_FIELDS = [
    "Keyword",
    "Category",
    "Search Intent",
    "Buyer Intent",
    "Suggested Page Type",
    "Business Value",
    "Inquiry Value",
    "Priority",
    "Reason",
]

_BRAND_PREFIXES = ("toyota", "hyundai", "nissan", "honda", "kia", "mazda", "mitsubishi", "ford")


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_keyword(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def keyword_id(keyword: str) -> str:
    return hashlib.sha256(_normalize_keyword(keyword).encode("utf-8")).hexdigest()[:20]


def load_dedup_keys() -> set[str]:
    if not DEDUP_FILE.is_file():
        return set()
    try:
        data = json.loads(DEDUP_FILE.read_text(encoding="utf-8"))
        return set(str(k) for k in (data.get("keys") or []))
    except (json.JSONDecodeError, OSError):
        return set()


def save_dedup_keys(keys: set[str]) -> None:
    DEDUP_FILE.parent.mkdir(parents=True, exist_ok=True)
    trimmed = sorted(keys)[-20000:]
    DEDUP_FILE.write_text(
        json.dumps({"updated_at": _now_iso(), "keys": trimmed}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def slug_to_engine_code(slug: str) -> str:
    slug = slug.replace("-v2", "").strip().lower()
    for brand in _BRAND_PREFIXES:
        prefix = brand + "-"
        if slug.startswith(prefix):
            slug = slug[len(prefix):]
            break
    return slug.replace("-", "-").upper() if "-" in slug else slug.upper()


def load_catalog_engine_codes() -> list[str]:
    codes: set[str] = set(PRIORITY_ENGINE_CODES)
    if ENGINES_DIR.is_dir():
        for path in ENGINES_DIR.glob("*.html"):
            if path.name == "index.html":
                continue
            code = slug_to_engine_code(path.stem)
            if 2 <= len(code) <= 24 and re.match(r"^[A-Z0-9-]+$", code):
                codes.add(code)
    return sorted(codes)


def _score_priority(
    *,
    category: str,
    keyword: str,
    engine_code: str,
    country: str = "",
) -> str:
    kw = keyword.lower()
    high_engines = {c.lower() for c in PRIORITY_ENGINE_CODES[:20]}
    if engine_code.lower() in high_engines and country and category in {
        "engine_country", "engine_export", "engine_import", "used_engine",
    }:
        return "S"
    if any(x in kw for x in ("for sale", "export", "half cut", "replacement", "importer")):
        return "S" if engine_code.lower() in high_engines else "A"
    if category in {"engine_replacement", "vehicle_engine", "gearbox", "half_cut"}:
        return "A"
    if category in {"compatibility", "auto_parts_export"}:
        return "A"
    return "B"


def _inquiry_value(priority: str) -> str:
    return {"S": "high", "A": "medium", "B": "low"}.get(priority, "low")


def _suggested_page_type(category: str) -> str:
    mapping = {
        "half_cut": "half_cut_listing",
        "gearbox": "gearbox_hub",
        "engine_country": "engine_detail",
        "engine_code": "engine_detail",
        "engine_export": "engine_detail",
        "engine_import": "engine_detail",
        "used_engine": "engine_detail",
        "engine_replacement": "engine_detail",
        "vehicle_engine": "engine_detail",
        "compatibility": "engine_detail",
        "auto_parts_export": "contact_enquiry",
    }
    return mapping.get(category, "engine_detail")


def _build_record(
    *,
    keyword: str,
    category: str,
    search_intent: str,
    buyer_intent: str,
    business_value: str,
    reason: str,
    engine_code: str = "",
    country: str = "",
) -> dict[str, Any]:
    priority = _score_priority(category=category, keyword=keyword, engine_code=engine_code, country=country)
    return {
        "keyword": keyword,
        "category": category,
        "search_intent": search_intent,
        "buyer_intent": buyer_intent,
        "suggested_page_type": _suggested_page_type(category),
        "business_value": business_value,
        "inquiry_value": _inquiry_value(priority),
        "priority": priority,
        "reason": reason,
        "engine_code": engine_code,
        "country": country,
        "keyword_id": keyword_id(keyword),
        "discovered_at": _now_iso(),
        "source": "local_catalog_matrix",
    }


def generate_keyword_opportunities(
    *,
    engine_codes: list[str] | None = None,
    countries: list[str] | None = None,
    max_keywords: int = 400,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    assert_apbd_no_browser_ui("KeywordFinder.generate_keyword_opportunities")

    engine_codes = engine_codes or load_catalog_engine_codes()
    countries = countries or PHASE1_COUNTRIES
    seen = load_dedup_keys()
    keywords: list[dict[str, Any]] = []
    stats = {
        "ok": True,
        "discovery_mode": "local_catalog_matrix",
        "engine_codes_used": len(engine_codes),
        "countries_used": len(countries),
        "templates_applied": 0,
        "duplicates_skipped": 0,
        "keywords_found": 0,
        "browser_automation": False,
    }

    def add(record: dict[str, Any]) -> None:
        if len(keywords) >= max_keywords:
            return
        kid = record["keyword_id"]
        if kid in seen:
            stats["duplicates_skipped"] += 1
            return
        seen.add(kid)
        keywords.append(record)
        stats["templates_applied"] += 1

    for code in engine_codes:
        if len(keywords) >= max_keywords:
            break
        # Engine code core
        add(_build_record(
            keyword=f"{code} engine",
            category="engine_code",
            search_intent="commercial",
            buyer_intent="medium",
            business_value="Targets buyers searching by exact engine code — matches AsiaPower engine pages",
            reason=f"Catalog engine {code} has dedicated SEO asset potential",
            engine_code=code,
        ))
        add(_build_record(
            keyword=f"{code} engine for sale",
            category="used_engine",
            search_intent="transactional",
            buyer_intent="high",
            business_value="High purchase intent — direct quote enquiry path",
            reason="Transactional query aligns with AsiaPower export sales workflow",
            engine_code=code,
        ))
        add(_build_record(
            keyword=f"{code} half cut",
            category="half_cut",
            search_intent="commercial",
            buyer_intent="high",
            business_value="Half-cut buyers often convert to multi-part orders",
            reason="Half-cut category is core AsiaPower inventory strength",
            engine_code=code,
        ))
        add(_build_record(
            keyword=f"{code} engine and gearbox",
            category="gearbox",
            search_intent="commercial",
            buyer_intent="high",
            business_value="Powertrain bundle increases average order value",
            reason="Gearbox pairing keywords drive bundled quotations",
            engine_code=code,
        ))
        add(_build_record(
            keyword=f"{code} engine compatibility",
            category="compatibility",
            search_intent="informational",
            buyer_intent="medium",
            business_value="Fitment content builds trust before enquiry",
            reason="Compatibility searches precede purchase decisions in Africa markets",
            engine_code=code,
        ))
        add(_build_record(
            keyword=f"{code} engine export",
            category="engine_export",
            search_intent="transactional",
            buyer_intent="high",
            business_value="Export-intent keyword — ideal for CIF/FOB quote funnel",
            reason="Matches AsiaPower China-to-Africa export positioning",
            engine_code=code,
        ))
        add(_build_record(
            keyword=f"used {code} engine",
            category="used_engine",
            search_intent="commercial",
            buyer_intent="high",
            business_value="Used engine demand in West and East Africa",
            reason="Used engine queries are primary WhatsApp/email enquiry drivers",
            engine_code=code,
        ))

        for country in countries:
            if len(keywords) >= max_keywords:
                break
            add(_build_record(
                keyword=f"{code} engine {country}",
                category="engine_country",
                search_intent="commercial",
                buyer_intent="high",
                business_value=f"Geo-targeted engine demand in {country}",
                reason=f"Country + engine combo for localized landing and ads",
                engine_code=code,
                country=country,
            ))
            add(_build_record(
                keyword=f"{code} engine importer {country}",
                category="engine_import",
                search_intent="transactional",
                buyer_intent="high",
                business_value=f"Importer-intent buyers in {country} — B2B pipeline",
                reason="Importer keywords indicate wholesale buyer persona",
                engine_code=code,
                country=country,
            ))
            add(_build_record(
                keyword=f"auto parts export to {country}",
                category="auto_parts_export",
                search_intent="commercial",
                buyer_intent="medium",
                business_value=f"Export corridor keyword China → {country}",
                reason="Supports country hub pages and outreach copy",
                engine_code=code,
                country=country,
            ))

    for pair in VEHICLE_ENGINE_PAIRS:
        if len(keywords) >= max_keywords:
            break
        vehicle = pair["vehicle"]
        code = pair["engine"]
        add(_build_record(
            keyword=f"{vehicle} engine replacement",
            category="engine_replacement",
            search_intent="commercial",
            buyer_intent="high",
            business_value=f"Vehicle-specific replacement demand → {code} supply",
            reason=f"{vehicle} is common in target markets; ties model pain to engine SKU",
            engine_code=code,
        ))
        add(_build_record(
            keyword=f"{vehicle} {code} engine",
            category="vehicle_engine",
            search_intent="commercial",
            buyer_intent="high",
            business_value="Model + code long-tail captures precise buyers",
            reason="Long-tail fitment query with clear product mapping",
            engine_code=code,
        ))

    keywords.sort(key=lambda k: ({"S": 0, "A": 1, "B": 2}.get(k["priority"], 3), k["keyword"]))
    stats["keywords_found"] = len(keywords)
    save_dedup_keys(seen)
    return keywords, stats


def save_keyword_outputs(
    keywords: list[dict[str, Any]],
    stats: dict[str, Any],
    *,
    day: str | None = None,
) -> dict[str, Any]:
    day_str = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = day_runtime_dir(day_str) / "keywords"
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "daily-keywords.json"
    csv_path = out_dir / "daily-keywords.csv"
    summary_path = out_dir / "summary.json"

    payload = {
        "generated_at": _now_iso(),
        "day": day_str,
        "tool": "KeywordFinderTool",
        "keyword_count": len(keywords),
        "stats": stats,
        "keywords": keywords,
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=_CSV_FIELDS)
        writer.writeheader()
        for row in keywords:
            writer.writerow({
                "Keyword": row.get("keyword", ""),
                "Category": row.get("category", ""),
                "Search Intent": row.get("search_intent", ""),
                "Buyer Intent": row.get("buyer_intent", ""),
                "Suggested Page Type": row.get("suggested_page_type", ""),
                "Business Value": row.get("business_value", ""),
                "Inquiry Value": row.get("inquiry_value", ""),
                "Priority": row.get("priority", ""),
                "Reason": row.get("reason", ""),
            })

    by_priority = {"S": 0, "A": 0, "B": 0}
    by_category: dict[str, int] = {}
    for kw in keywords:
        by_priority[kw.get("priority", "B")] = by_priority.get(kw.get("priority", "B"), 0) + 1
        cat = kw.get("category") or "other"
        by_category[cat] = by_category.get(cat, 0) + 1

    summary = {
        "generated_at": _now_iso(),
        "day": day_str,
        "tool": "KeywordFinderTool",
        "keyword_count": len(keywords),
        "by_priority": by_priority,
        "by_category": by_category,
        "files": {"json": json_path.name, "csv": csv_path.name},
        "stats": stats,
    }
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "keywords_dir": str(out_dir),
        "json_path": str(json_path),
        "csv_path": str(csv_path),
        "summary_path": str(summary_path),
        "keyword_count": len(keywords),
        "summary": summary,
    }


def run_keyword_finder(*, max_keywords: int = 400) -> dict[str, Any]:
    """Generate keyword opportunities and write daily outputs."""
    keywords, stats = generate_keyword_opportunities(max_keywords=max_keywords)
    outputs = save_keyword_outputs(keywords, stats)
    return {
        "ok": True,
        "status": "completed",
        "keyword_count": outputs["keyword_count"],
        "outputs": outputs,
        "stats": stats,
    }
