"""APBD Competitor Finder — public competitor gap analysis (no browser automation)."""

from __future__ import annotations

import csv
import hashlib
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agents.apbd.config import day_runtime_dir
from agents.apbd.keyword_finder import PRIORITY_ENGINE_CODES, load_catalog_engine_codes
from agents.apbd.safety import assert_apbd_no_browser_ui

ROOT = Path(__file__).resolve().parent.parent.parent
DEDUP_FILE = ROOT / "runtime" / "apbd" / "competitor_dedup_keys.json"

PHASE1_MARKETS = ["Ghana", "Nigeria", "Kenya", "Tanzania", "UAE"]

# Public competitor profiles — marketplace, exporters, regional suppliers (no login sources)
PUBLIC_COMPETITORS: list[dict[str, Any]] = [
    {
        "company": "Alibaba Used Engine Suppliers",
        "website": "https://www.alibaba.com",
        "country": "China / Global",
        "business_focus": "Marketplace — engine suppliers",
        "target_markets": ["Global", "Africa", "Middle East"],
        "main_product_categories": ["Used engines", "Engine assemblies", "Auto parts"],
        "engine_brands_covered": ["Toyota", "Hyundai", "Nissan", "Honda", "Mixed"],
        "competitor_type": "marketplace",
        "fetch_path": "",
    },
    {
        "company": "Engine World USA",
        "website": "https://www.engineworldusa.com",
        "country": "USA",
        "business_focus": "Used engine exporter",
        "target_markets": ["USA", "Caribbean", "Africa"],
        "main_product_categories": ["Used engines", "Transmissions"],
        "engine_brands_covered": ["Toyota", "Honda", "Nissan", "Ford"],
        "competitor_type": "used_engine_exporter",
        "fetch_path": "/",
    },
    {
        "company": "SW Engines",
        "website": "https://www.swengines.com",
        "country": "USA",
        "business_focus": "Used engine retailer / exporter",
        "target_markets": ["USA", "International"],
        "main_product_categories": ["Used engines", "Crate engines"],
        "engine_brands_covered": ["Toyota", "Honda", "Ford", "Chevrolet"],
        "competitor_type": "used_engine_exporter",
        "fetch_path": "/",
    },
    {
        "company": "Japan Partner",
        "website": "https://www.japan-partner.com",
        "country": "Japan",
        "business_focus": "Used vehicles / parts exporter",
        "target_markets": ["Global", "Africa", "Russia"],
        "main_product_categories": ["Half cuts", "Used cars", "Engines"],
        "engine_brands_covered": ["Toyota", "Nissan", "Honda", "Mazda"],
        "competitor_type": "half_cut_supplier",
        "fetch_path": "/",
    },
    {
        "company": "BE FORWARD Auto Parts",
        "website": "https://www.beforward.jp",
        "country": "Japan",
        "business_focus": "Auto parts / half-cut marketplace",
        "target_markets": ["Africa", "Asia", "Caribbean"],
        "main_product_categories": ["Auto parts", "Half cuts", "Used vehicles"],
        "engine_brands_covered": ["Toyota", "Nissan", "Honda", "Multi-brand"],
        "competitor_type": "marketplace",
        "fetch_path": "/",
    },
    {
        "company": "Tokyo Motor Corporation",
        "website": "https://www.tokyo-motors.com",
        "country": "Japan",
        "business_focus": "Used engine / auto parts export",
        "target_markets": ["Africa", "Middle East", "Asia"],
        "main_product_categories": ["Used engines", "Half cuts", "Gearboxes"],
        "engine_brands_covered": ["Toyota", "Nissan", "Mazda"],
        "competitor_type": "auto_parts_exporter",
        "fetch_path": "/",
    },
    {
        "company": "Jumia Auto Parts Ghana",
        "website": "https://www.jumia.com.gh",
        "country": "Ghana",
        "business_focus": "Regional marketplace",
        "target_markets": ["Ghana", "West Africa"],
        "main_product_categories": ["Auto parts", "Accessories"],
        "engine_brands_covered": ["Mixed aftermarket"],
        "competitor_type": "marketplace",
        "fetch_path": "/",
    },
    {
        "company": "Jiji Nigeria Auto Parts",
        "website": "https://jiji.ng",
        "country": "Nigeria",
        "business_focus": "Regional classified marketplace",
        "target_markets": ["Nigeria"],
        "main_product_categories": ["Auto parts", "Engines", "Vehicles"],
        "engine_brands_covered": ["Mixed"],
        "competitor_type": "marketplace",
        "fetch_path": "/",
    },
]

_CSV_FIELDS = [
    "Company",
    "Website",
    "Country",
    "Business Focus",
    "Target Markets",
    "Main Product Categories",
    "Engine Brands Covered",
    "Missing Opportunities",
    "Weak Content",
    "Keywords We Can Target",
    "Pages We Should Build",
    "Business Opportunity",
    "Priority",
    "Opportunity Category",
    "Source URL",
]

_GAP_CHECKS = [
    ("missing_engine_page", "Competitor missing {code} engine page", "engine_detail", "S"),
    ("no_half_cut_section", "No dedicated half-cut section", "half_cut_hub", "A"),
    ("no_faq", "No buyer FAQ / export process guide", "faq_hub", "A"),
    ("no_country_landing", "No {country} country landing page", "country_landing", "A"),
    ("weak_buyer_guide", "Weak engine buyer guide / fitment content", "engine_buying_guide", "A"),
    ("weak_eeat", "Weak trust signals (VIN, stock confirmation, photos)", "trust_content", "B"),
    ("missing_compatibility", "Missing engine compatibility / interchange content", "compatibility_guide", "A"),
    ("missing_gearbox_matching", "Missing gearbox matching guidance", "gearbox_matching", "S"),
    ("poor_internal_linking", "Thin internal linking between engines and half-cuts", "site_structure", "B"),
]

_USER_AGENT = "AsiaPower-APBD-CompetitorIntel/1.0 (+https://asia-power.com)"


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def opportunity_id(company: str, category: str, detail: str) -> str:
    blob = f"{company}|{category}|{detail}".lower()
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:20]


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
    trimmed = sorted(keys)[-15000:]
    DEDUP_FILE.write_text(
        json.dumps({"updated_at": _now_iso(), "keys": trimmed}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _fetch_public_html(url: str, *, max_bytes: int = 350_000) -> tuple[bool, str]:
    """Fetch public page text via HTTP only — no Playwright."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
        with urllib.request.urlopen(req, timeout=12) as resp:
            return True, resp.read(max_bytes).decode("utf-8", errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, OSError):
        return False, ""


def analyze_public_signals(html: str, *, catalog_codes: list[str]) -> dict[str, Any]:
    text = html.lower()
    codes_found = [c for c in catalog_codes if c.lower() in text]
    return {
        "has_half_cut": any(x in text for x in ("half cut", "half-cut", "halfcut", "half cut")),
        "has_faq": "faq" in text or "frequently asked" in text,
        "has_gearbox": "gearbox" in text or "transmission" in text,
        "has_vin": "vin" in text,
        "has_export_process": any(x in text for x in ("export process", "shipping", "cif", "fob")),
        "has_country_pages": any(m.lower() in text for m in PHASE1_MARKETS),
        "engine_codes_found": codes_found[:30],
        "word_count_estimate": len(re.findall(r"\w+", text)),
    }


def _keywords_for_engine(code: str, country: str = "") -> str:
    parts = [f"{code} engine for sale", f"{code} half cut", f"{code} engine export"]
    if country:
        parts.append(f"{code} engine {country}")
    return "; ".join(parts[:4])


def _pages_to_build(category: str, code: str = "", country: str = "") -> str:
    mapping = {
        "missing_engine_page": f"/engines/{code.lower().replace('-', '-')}.html engine intelligence page",
        "no_half_cut_section": "/half-cuts/ hub with engine-linked half-cut listings",
        "no_faq": "/contact.html + engine FAQ block on high-intent pages",
        "no_country_landing": f"/engines/ with {country} buyer guide section",
        "weak_buyer_guide": f"{code} buying guide with fitment + export checklist" if code else "Engine buying guide template",
        "weak_eeat": "VIN decode block + stock confirmation workflow on engine pages",
        "missing_compatibility": f"{code} compatibility / interchange section" if code else "Engine compatibility hub",
        "missing_gearbox_matching": f"{code} engine + gearbox bundle page" if code else "Gearbox matching guide",
        "poor_internal_linking": "Cross-link engines ↔ half-cuts ↔ gearboxes in site nav",
    }
    return mapping.get(category, "engine_detail")


def _score_priority(base: str, *, competitor_type: str, code: str = "") -> str:
    high_codes = {c.upper() for c in PRIORITY_ENGINE_CODES[:15]}
    if base == "S":
        return "S"
    boosted_types = {
        "used_engine_exporter", "marketplace", "half_cut_supplier", "auto_parts_exporter",
    }
    if (
        base == "A"
        and code.upper() in high_codes
        and competitor_type in boosted_types
    ):
        return "S"
    return base


def _build_opportunity(
    competitor: dict[str, Any],
    *,
    category: str,
    missing: str,
    weak: str,
    keywords: str,
    pages: str,
    business: str,
    priority: str,
    source_url: str,
    engine_code: str = "",
) -> dict[str, Any]:
    pri = _score_priority(priority, competitor_type=competitor.get("competitor_type", ""), code=engine_code)
    return {
        "company": competitor["company"],
        "website": competitor["website"],
        "country": competitor["country"],
        "business_focus": competitor["business_focus"],
        "target_markets": ", ".join(competitor.get("target_markets") or []),
        "main_product_categories": ", ".join(competitor.get("main_product_categories") or []),
        "engine_brands_covered": ", ".join(competitor.get("engine_brands_covered") or []),
        "missing_opportunities": missing,
        "weak_content": weak,
        "keywords_we_can_target": keywords,
        "pages_we_should_build": pages,
        "business_opportunity": business,
        "priority": pri,
        "opportunity_category": category,
        "source_url": source_url,
        "engine_code": engine_code,
        "competitor_type": competitor.get("competitor_type", ""),
        "opportunity_id": opportunity_id(competitor["company"], category, missing),
        "discovered_at": _now_iso(),
        "analysis_mode": "public_http_and_catalog_gap",
    }


def analyze_competitor(
    competitor: dict[str, Any],
    *,
    catalog_codes: list[str],
    priority_codes: list[str],
    fetch_ok: bool | None = None,
    html: str = "",
) -> tuple[list[dict[str, Any]], bool]:
    base_url = (competitor.get("website") or "").rstrip("/")
    fetch_path = competitor.get("fetch_path") or "/"
    fetch_url = f"{base_url}{fetch_path}" if base_url else ""
    if fetch_ok is None:
        fetch_ok, html = _fetch_public_html(fetch_url) if fetch_url else (False, "")
    signals = analyze_public_signals(html, catalog_codes=catalog_codes) if fetch_ok else {}

    opportunities: list[dict[str, Any]] = []
    source = fetch_url if fetch_ok else competitor.get("website", "")

    # Engine page gaps (top priority engines)
    found_codes = {c.upper() for c in signals.get("engine_codes_found") or []}
    for code in priority_codes[:12]:
        if code.upper() in found_codes:
            continue
        cat = "missing_engine_page"
        missing = f"Competitor missing {code} engine page"
        opportunities.append(_build_opportunity(
            competitor,
            category=cat,
            missing=missing,
            weak=f"Thin or absent {code} content on public site",
            keywords=_keywords_for_engine(code, PHASE1_MARKETS[0]),
            pages=_pages_to_build(cat, code=code),
            business=f"AsiaPower can capture {code} search traffic with verified inventory pages",
            priority="S",
            source_url=source,
            engine_code=code,
        ))

    if fetch_ok:
        if not signals.get("has_half_cut") and competitor.get("competitor_type") != "marketplace":
            opportunities.append(_build_opportunity(
                competitor,
                category="no_half_cut_section",
                missing="No Half Cut section",
                weak="No half-cut buyer path on public site",
                keywords="half cut engine export; half cut Toyota; half cut Hyundai",
                pages=_pages_to_build("no_half_cut_section"),
                business="AsiaPower half-cut catalog is a differentiation wedge",
                priority="A",
                source_url=source,
            ))
        if not signals.get("has_faq"):
            opportunities.append(_build_opportunity(
                competitor,
                category="no_faq",
                missing="No FAQ / export buyer guide",
                weak="Poor buyer education content",
                keywords="how to import engine from China; engine export FAQ",
                pages=_pages_to_build("no_faq"),
                business="FAQ content increases inquiry conversion on engine pages",
                priority="A",
                source_url=source,
            ))
        if not signals.get("has_gearbox"):
            code = priority_codes[0] if priority_codes else "G4KD"
            opportunities.append(_build_opportunity(
                competitor,
                category="missing_gearbox_matching",
                missing="Missing gearbox matching guidance",
                weak="No engine + gearbox bundle explanation",
                keywords=f"{code} engine and gearbox; gearbox matching guide",
                pages=_pages_to_build("missing_gearbox_matching", code=code),
                business="Bundle pages raise average quote value",
                priority="S",
                source_url=source,
                engine_code=code,
            ))
        if not signals.get("has_country_pages"):
            for country in PHASE1_MARKETS[:3]:
                opportunities.append(_build_opportunity(
                    competitor,
                    category="no_country_landing",
                    missing=f"No {country} country landing page",
                    weak=f"No localized content for {country} buyers",
                    keywords=f"engine export to {country}; auto parts {country}",
                    pages=_pages_to_build("no_country_landing", country=country),
                    business=f"Country-specific trust content wins {country} importer searches",
                    priority="A",
                    source_url=source,
                ))
        if signals.get("word_count_estimate", 0) < 800:
            opportunities.append(_build_opportunity(
                competitor,
                category="weak_buyer_guide",
                missing="Weak buyer guide content",
                weak="Homepage/catalog appears thin on buying workflow",
                keywords="used engine buying guide; engine import checklist",
                pages=_pages_to_build("weak_buyer_guide"),
                business="Deep buyer guides outperform thin catalog competitors",
                priority="A",
                source_url=source,
            ))
        if not signals.get("has_vin") or not signals.get("has_export_process"):
            opportunities.append(_build_opportunity(
                competitor,
                category="weak_eeat",
                missing="Weak EEAT — VIN/stock/export proof",
                weak="Missing VIN decode or export process transparency",
                keywords="VIN verified engine; stock confirmed engine export",
                pages=_pages_to_build("weak_eeat"),
                business="Trust signals differentiate AsiaPower from anonymous listings",
                priority="B",
                source_url=source,
            ))
        opportunities.append(_build_opportunity(
            competitor,
            category="poor_internal_linking",
            missing="Limited cross-linking between product categories",
            weak="Engines, half-cuts and gearboxes not interlinked",
            keywords="engine half cut gearbox bundle",
            pages=_pages_to_build("poor_internal_linking"),
            business="Internal linking improves SEO and inquiry paths across catalog",
            priority="B",
            source_url=source,
        ))
    else:
        # Static gap analysis when fetch unavailable (still actionable from profile)
        code = priority_codes[0] if priority_codes else "2TR-FE"
        opportunities.append(_build_opportunity(
            competitor,
            category="missing_engine_page",
            missing=f"Likely missing deep {code} guide (fetch unavailable — profile-based)",
            weak="Exporter profile suggests thin engine-code SEO",
            keywords=_keywords_for_engine(code),
            pages=_pages_to_build("missing_engine_page", code=code),
            business="AsiaPower engine intelligence pages can outrank generic exporter listings",
            priority="A",
            source_url=source,
            engine_code=code,
        ))

    return opportunities, fetch_ok


def discover_competitor_opportunities(
    *,
    max_opportunities: int = 120,
    fetch_competitors: bool = True,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    assert_apbd_no_browser_ui("CompetitorFinder.discover_competitor_opportunities")

    catalog = load_catalog_engine_codes()
    priority = [c for c in PRIORITY_ENGINE_CODES if c in catalog] or PRIORITY_ENGINE_CODES[:20]
    seen = load_dedup_keys()
    all_opps: list[dict[str, Any]] = []
    stats = {
        "ok": True,
        "discovery_mode": "public_http_and_catalog_gap",
        "browser_automation": False,
        "competitors_analyzed": 0,
        "fetch_success": 0,
        "fetch_failed": 0,
        "opportunities_found": 0,
        "duplicates_skipped": 0,
    }

    competitors = PUBLIC_COMPETITORS if fetch_competitors else PUBLIC_COMPETITORS
    for comp in competitors:
        stats["competitors_analyzed"] += 1
        base_url = (comp.get("website") or "").rstrip("/")
        fetch_path = comp.get("fetch_path") or "/"
        fetch_url = f"{base_url}{fetch_path}" if base_url else ""
        if fetch_url:
            fetch_ok, html = _fetch_public_html(fetch_url)
            if fetch_ok:
                stats["fetch_success"] += 1
            else:
                stats["fetch_failed"] += 1
        else:
            fetch_ok, html = False, ""
        opps, _ = analyze_competitor(
            comp,
            catalog_codes=catalog,
            priority_codes=priority,
            fetch_ok=fetch_ok,
            html=html,
        )
        for opp in opps:
            if len(all_opps) >= max_opportunities:
                break
            oid = opp["opportunity_id"]
            if oid in seen:
                stats["duplicates_skipped"] += 1
                continue
            seen.add(oid)
            all_opps.append(opp)
        if len(all_opps) >= max_opportunities:
            break

    all_opps.sort(key=lambda o: ({"S": 0, "A": 1, "B": 2}.get(o["priority"], 3), o["company"]))
    stats["opportunities_found"] = len(all_opps)
    save_dedup_keys(seen)
    return all_opps, stats


def save_competitor_outputs(
    opportunities: list[dict[str, Any]],
    stats: dict[str, Any],
    *,
    day: str | None = None,
) -> dict[str, Any]:
    day_str = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = day_runtime_dir(day_str) / "competitors"
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "daily-competitors.json"
    csv_path = out_dir / "daily-competitors.csv"
    summary_path = out_dir / "summary.json"

    payload = {
        "generated_at": _now_iso(),
        "day": day_str,
        "tool": "CompetitorTool",
        "opportunity_count": len(opportunities),
        "stats": stats,
        "opportunities": opportunities,
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=_CSV_FIELDS)
        writer.writeheader()
        for row in opportunities:
            writer.writerow({
                "Company": row.get("company", ""),
                "Website": row.get("website", ""),
                "Country": row.get("country", ""),
                "Business Focus": row.get("business_focus", ""),
                "Target Markets": row.get("target_markets", ""),
                "Main Product Categories": row.get("main_product_categories", ""),
                "Engine Brands Covered": row.get("engine_brands_covered", ""),
                "Missing Opportunities": row.get("missing_opportunities", ""),
                "Weak Content": row.get("weak_content", ""),
                "Keywords We Can Target": row.get("keywords_we_can_target", ""),
                "Pages We Should Build": row.get("pages_we_should_build", ""),
                "Business Opportunity": row.get("business_opportunity", ""),
                "Priority": row.get("priority", ""),
                "Opportunity Category": row.get("opportunity_category", ""),
                "Source URL": row.get("source_url", ""),
            })

    by_priority: dict[str, int] = {"S": 0, "A": 0, "B": 0}
    by_category: dict[str, int] = {}
    for opp in opportunities:
        by_priority[opp.get("priority", "B")] = by_priority.get(opp.get("priority", "B"), 0) + 1
        cat = opp.get("opportunity_category") or "other"
        by_category[cat] = by_category.get(cat, 0) + 1

    summary = {
        "generated_at": _now_iso(),
        "day": day_str,
        "tool": "CompetitorTool",
        "opportunity_count": len(opportunities),
        "by_priority": by_priority,
        "by_category": by_category,
        "files": {"json": json_path.name, "csv": csv_path.name},
        "stats": stats,
    }
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "competitors_dir": str(out_dir),
        "json_path": str(json_path),
        "csv_path": str(csv_path),
        "summary_path": str(summary_path),
        "opportunity_count": len(opportunities),
        "summary": summary,
    }


def run_competitor_finder(*, max_opportunities: int = 120) -> dict[str, Any]:
    opportunities, stats = discover_competitor_opportunities(max_opportunities=max_opportunities)
    outputs = save_competitor_outputs(opportunities, stats)
    return {
        "ok": True,
        "status": "completed",
        "opportunity_count": outputs["opportunity_count"],
        "outputs": outputs,
        "stats": stats,
    }
