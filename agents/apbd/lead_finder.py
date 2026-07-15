"""APBD Lead Finder — public business lead discovery (Google Maps / public web)."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from agents.apbd.config import day_runtime_dir

ROOT = Path(__file__).resolve().parent.parent.parent
DEDUP_FILE = ROOT / "runtime" / "apbd" / "lead_dedup_keys.json"
MARKETS_CONFIG_FILE = ROOT / "config" / "apbd_lead_markets.yaml"

# Fallback only if config/apbd_lead_markets.yaml is missing (legacy hardcoded list).
PHASE1_MARKETS: list[dict[str, Any]] = [
    {
        "country": "Ghana",
        "city": "Accra",
        "queries": [
            "engine importer Accra Ghana",
            "auto parts wholesaler Accra",
            "used auto parts dealer Accra",
            "car dismantling yard Accra",
            "fleet maintenance company Accra",
            "commercial vehicle workshop Accra",
        ],
    },
    {
        "country": "Nigeria",
        "city": "Lagos",
        "queries": [
            "engine importer Lagos Nigeria",
            "auto parts importer Lagos",
            "tokunbo spare parts wholesaler Lagos",
            "auto dismantler Lagos",
            "fleet maintenance Lagos",
            "truck parts dealer Lagos",
        ],
    },
    {
        "country": "Nigeria",
        "city": "Abuja",
        "queries": [
            "auto parts importer Abuja",
            "used car parts dealer Abuja",
            "commercial vehicle workshop Abuja",
        ],
    },
    {
        "country": "Kenya",
        "city": "Nairobi",
        "queries": [
            "engine importer Nairobi Kenya",
            "auto parts wholesaler Nairobi",
            "car dismantling yard Kenya",
            "fleet maintenance Nairobi",
            "spare parts importer Nairobi",
        ],
    },
    {
        "country": "Tanzania",
        "city": "Dar es Salaam",
        "queries": [
            "auto parts importer Dar es Salaam",
            "used auto parts wholesaler Tanzania",
            "commercial vehicle workshop Dar es Salaam",
            "engine parts dealer Tanzania",
        ],
    },
    {
        "country": "UAE",
        "city": "Dubai",
        "queries": [
            "used auto parts wholesale Dubai",
            "engine importer Dubai UAE",
            "auto dismantler Dubai",
            "commercial vehicle spare parts Dubai",
            "fleet maintenance company Dubai",
        ],
    },
]

_CSV_FIELDS = [
    "Company",
    "Country",
    "City",
    "Website",
    "Public Email",
    "Public Phone",
    "Business Type",
    "Main Products",
    "Match Reason",
    "Company Page URL",
    "Data Source",
    "Source URL",
    "Priority",
]

_SUFFIX_RE = re.compile(r"\b(ltd|limited|llc|inc|plc|co\.|company|enterprises|group)\b\.?", re.I)


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _norm_query(query: str) -> str:
    return re.sub(r"\s+", " ", (query or "").strip().lower())


def _dedupe_queries(queries: list[Any]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in queries:
        q = str(raw or "").strip()
        if not q:
            continue
        key = _norm_query(q)
        if key in seen:
            continue
        seen.add(key)
        out.append(q)
    return out


def _load_yaml_dict(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def load_lead_markets_config() -> dict[str, Any]:
    """Load canonical markets YAML (merged + query-deduped). Falls back to PHASE1."""
    cfg = _load_yaml_dict(MARKETS_CONFIG_FILE)
    search = cfg.get("search") if isinstance(cfg.get("search"), dict) else {}
    markets_raw = cfg.get("markets") if isinstance(cfg.get("markets"), list) else []
    markets: list[dict[str, Any]] = []
    for item in markets_raw:
        if not isinstance(item, dict):
            continue
        country = str(item.get("country") or "").strip()
        city = str(item.get("city") or "").strip()
        queries = _dedupe_queries(list(item.get("queries") or []))
        if not country or not queries:
            continue
        markets.append({
            "id": str(item.get("id") or f"{country}_{city}").strip(),
            "country": country,
            "city": city,
            "queries": queries,
        })
    if not markets:
        markets = [
            {
                "id": f"{m.get('country','')}_{m.get('city','')}".strip("_"),
                "country": m.get("country") or "",
                "city": m.get("city") or "",
                "queries": _dedupe_queries(list(m.get("queries") or [])),
            }
            for m in PHASE1_MARKETS
        ]
        source = "phase1_fallback"
    else:
        source = str(MARKETS_CONFIG_FILE.relative_to(ROOT))
    return {
        "source": source,
        "search": {
            "max_results_per_query": int(search.get("max_results_per_query") or 5),
            "max_queries_per_run": int(search.get("max_queries_per_run") or 20),
            "max_total_leads": int(search.get("max_total_leads") or 40),
        },
        "markets": markets,
        "query_count": sum(len(m.get("queries") or []) for m in markets),
    }


def load_phase1_markets() -> list[dict[str, Any]]:
    """Public helper: markets list for discover_leads (from YAML)."""
    return list(load_lead_markets_config()["markets"])


def normalize_company_name(name: str) -> str:
    text = (name or "").strip().lower()
    text = re.sub(r"[^\w\s&'-]", " ", text)
    text = _SUFFIX_RE.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_website(url: str) -> str:
    raw = (url or "").strip().lower()
    if not raw:
        return ""
    if not raw.startswith("http"):
        raw = "https://" + raw
    parsed = urlparse(raw)
    host = (parsed.netloc or parsed.path).lower()
    if host.startswith("www."):
        host = host[4:]
    return host.rstrip("/")


def normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone or "")


def lead_dedup_key(lead: dict[str, Any]) -> str:
    company = normalize_company_name(lead.get("company") or "")
    country = (lead.get("country") or "").strip().lower()
    website = normalize_website(lead.get("website") or "")
    phone = normalize_phone(lead.get("public_phone") or "")
    if website:
        blob = f"{company}|{country}|web:{website}"
    elif phone:
        blob = f"{company}|{country}|tel:{phone}"
    else:
        city = (lead.get("city") or "").strip().lower()
        blob = f"{company}|{country}|{city}"
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:20]


def load_dedup_keys() -> set[str]:
    if not DEDUP_FILE.is_file():
        return set()
    try:
        data = json.loads(DEDUP_FILE.read_text(encoding="utf-8"))
        keys = data.get("keys") or []
        return set(str(k) for k in keys)
    except (json.JSONDecodeError, OSError):
        return set()


def save_dedup_keys(keys: set[str]) -> None:
    DEDUP_FILE.parent.mkdir(parents=True, exist_ok=True)
    trimmed = sorted(keys)[-10000:]
    DEDUP_FILE.write_text(
        json.dumps({"updated_at": _now_iso(), "keys": trimmed}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def infer_business_type(name: str, query: str, types: list[str] | None = None) -> str:
    text = f"{name} {query} {' '.join(types or [])}".lower()
    rules = [
        ("Engine importer", ("engine import", "engine importer", "motor import")),
        ("Auto parts importer", ("parts import", "spare parts import", "auto parts import")),
        ("Used auto parts wholesaler", ("wholesale", "wholesaler", "tokunbo", "used parts")),
        ("Auto dismantler", ("dismantl", "scrap yard", "salvage", "half cut")),
        ("Fleet maintenance company", ("fleet", "logistics fleet", "maintenance company")),
        ("Commercial vehicle workshop", ("truck", "commercial vehicle", "lorry", "workshop")),
        ("Repair chain / workshop", ("repair", "workshop", "service center", "garage")),
        ("Auto parts dealer", ("parts dealer", "spare parts", "auto parts")),
    ]
    for label, keywords in rules:
        if any(k in text for k in keywords):
            return label
    return "Auto parts / vehicle services"


def score_priority(business_type: str, name: str, *, has_contact: bool) -> str:
    text = f"{business_type} {name}".lower()
    s_signals = (
        "importer", "wholesaler", "dismantl", "fleet", "distributor", "wholesale",
    )
    a_signals = ("dealer", "parts", "repair", "workshop", "maintenance", "spare")
    if any(s in text for s in s_signals):
        return "S"
    if any(s in text for s in a_signals):
        return "A" if has_contact else "B"
    return "B"


def value_reason(lead: dict[str, Any]) -> str:
    bt = lead.get("business_type") or ""
    country = lead.get("country") or ""
    parts = [f"{bt} in {country}" if country else bt]
    if lead.get("website") and lead.get("website") != "Not published":
        parts.append("public website listed")
    if lead.get("public_phone") and lead.get("public_phone") != "Not published":
        parts.append("public phone/WhatsApp available")
    if lead.get("public_email") and lead.get("public_email") != "Not published":
        parts.append("public email published")
    parts.append("potential AsiaPower engine/parts buyer")
    return "; ".join(parts)


def _row_to_lead(row: dict[str, Any], *, query: str) -> dict[str, Any]:
    from agents.apbd.outreach_queue import infer_main_products

    if row.get("source") == "places_api_new" or row.get("data_source") == "google_maps":
        from customer_gateway.maps_prospect import enrich_lead_email
        enriched = enrich_lead_email(dict(row))
    else:
        enriched = dict(row)

    company = (enriched.get("name") or "").strip() or "Unknown"
    website = (enriched.get("website") or "").strip()
    phone = (enriched.get("phone") or "").strip()
    email = (enriched.get("email") or "").strip()
    source_url = (
        enriched.get("company_page_url")
        or enriched.get("maps_url")
        or enriched.get("website")
        or ""
    ).strip()
    types = enriched.get("types") or []
    business_type = infer_business_type(company, query, types if isinstance(types, list) else [])
    has_contact = bool(website or phone or email)
    data_source = enriched.get("data_source") or enriched.get("source") or "google_maps"
    main_products = infer_main_products(business_type, query)
    lead = {
        "company": company,
        "country": enriched.get("country") or "",
        "city": enriched.get("city") or "",
        "website": website or "Not published",
        "public_email": email or "Not published",
        "public_phone": phone or "Not published",
        "business_type": business_type,
        "main_products": main_products,
        "source_url": source_url or "Not published",
        "company_page_url": source_url or "Not published",
        "data_source": data_source,
        "value_reason": "",
        "match_reason": "",
        "priority": score_priority(business_type, company, has_contact=has_contact),
        "discovered_at": _now_iso(),
        "source": data_source,
        "place_id": enriched.get("place_id") or "",
        "query": query,
        "address": enriched.get("address") or "",
    }
    lead["value_reason"] = value_reason(lead)
    lead["match_reason"] = (
        f"{lead['business_type']} in {lead['country']} sourcing {main_products}; "
        f"AsiaPower verified supplier network matches their import profile"
    )
    lead["lead_id"] = lead_dedup_key(lead)
    return lead


def _maps_row_to_lead(row: dict[str, Any], *, query: str) -> dict[str, Any]:
    row = dict(row)
    row.setdefault("data_source", "google_maps")
    return _row_to_lead(row, query=query)


def discover_leads(
    *,
    markets: list[dict[str, Any]] | None = None,
    max_results_per_query: int | None = None,
    max_total: int | None = None,
    max_queries: int | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    from agents.apbd.public_sources import PUBLIC_SOURCE_SEARCHERS
    from customer_gateway.maps_prospect import _places_api_key, check_places_api_quota
    from agents.apbd.safety import APBD_DISCOVERY_MODE, assert_apbd_no_browser_ui

    assert_apbd_no_browser_ui("LeadFinder.discover_leads")

    cfg = load_lead_markets_config()
    search_cfg = cfg["search"]
    markets = markets or cfg["markets"]
    if max_results_per_query is None:
        max_results_per_query = int(search_cfg["max_results_per_query"])
    if max_total is None:
        max_total = int(search_cfg["max_total_leads"])
    if max_queries is None:
        max_queries = int(search_cfg["max_queries_per_run"])

    # Cross-market query dedupe: same normalized query text only hits Places once per run.
    run_query_seen: set[str] = set()

    seen = load_dedup_keys()
    leads: list[dict[str, Any]] = []
    quota = check_places_api_quota() if _places_api_key() else {"ok": False, "quota_exhausted": False}
    stats = {
        "ok": True,
        "sprint": "SPRINT-001",
        "queries_run": 0,
        "queries_skipped_dedupe": 0,
        "raw_results": 0,
        "duplicates_skipped": 0,
        "leads_found": 0,
        "markets": [],
        "errors": [],
        "sources_used": [],
        "by_source": {},
        "api_quota_exhausted": bool(quota.get("quota_exhausted")),
        "discovery_mode": APBD_DISCOVERY_MODE,
        "browser_fallback_disabled": True,
        "markets_config_source": cfg.get("source"),
        "markets_query_count": cfg.get("query_count"),
        "max_queries": max_queries,
        "max_total": max_total,
    }

    if not _places_api_key():
        stats["errors"].append("GOOGLE_PLACES_API_KEY not set — Google Maps source skipped")

    source_names = [name for name, _ in PUBLIC_SOURCE_SEARCHERS]
    stats["sources_connected"] = source_names

    for market in markets:
        country = market.get("country") or ""
        city = market.get("city") or ""
        market_count = 0
        for query in market.get("queries") or []:
            if len(leads) >= max_total or stats["queries_run"] >= max_queries:
                break
            q_key = _norm_query(str(query))
            if q_key in run_query_seen:
                stats["queries_skipped_dedupe"] += 1
                continue
            run_query_seen.add(q_key)
            stats["queries_run"] += 1
            for source_name, search_fn in PUBLIC_SOURCE_SEARCHERS:
                if len(leads) >= max_total:
                    break
                if source_name == "google_maps" and not _places_api_key():
                    continue
                try:
                    rows = search_fn(
                        query,
                        country=country,
                        city=city,
                        max_results=max(2, max_results_per_query // 2),
                    )
                except Exception as exc:
                    stats["errors"].append(f"{source_name}/{query}: {exc}")
                    continue
                if rows and source_name not in stats["sources_used"]:
                    stats["sources_used"].append(source_name)
                stats["raw_results"] += len(rows)
                for row in rows:
                    lead = _row_to_lead(row, query=query)
                    key = lead["lead_id"]
                    if key in seen:
                        stats["duplicates_skipped"] += 1
                        continue
                    seen.add(key)
                    leads.append(lead)
                    market_count += 1
                    src = lead.get("data_source") or source_name
                    stats["by_source"][src] = stats["by_source"].get(src, 0) + 1
                    if len(leads) >= max_total:
                        break
        stats["markets"].append({"country": country, "city": city, "leads": market_count})

    stats["leads_found"] = len(leads)
    save_dedup_keys(seen)
    return leads, stats


def save_lead_outputs(leads: list[dict[str, Any]], stats: dict[str, Any], *, day: str | None = None) -> dict[str, Any]:
    day_str = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    leads_dir = day_runtime_dir(day_str) / "leads"
    leads_dir.mkdir(parents=True, exist_ok=True)

    json_path = leads_dir / "daily-leads.json"
    csv_path = leads_dir / "daily-leads.csv"
    summary_path = leads_dir / "summary.json"

    market_countries = sorted({
        str(m.get("country") or "")
        for m in (load_lead_markets_config().get("markets") or [])
        if m.get("country")
    })

    payload = {
        "generated_at": _now_iso(),
        "day": day_str,
        "tool": "LeadFinderTool",
        "phase": "1",
        "markets": market_countries or ["Ghana", "Nigeria", "Kenya", "Tanzania", "UAE"],
        "lead_count": len(leads),
        "stats": stats,
        "leads": leads,
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=_CSV_FIELDS)
        writer.writeheader()
        for lead in leads:
            writer.writerow({
                "Company": lead.get("company", ""),
                "Country": lead.get("country", ""),
                "City": lead.get("city", ""),
                "Website": lead.get("website", ""),
                "Public Email": lead.get("public_email", ""),
                "Public Phone": lead.get("public_phone", ""),
                "Business Type": lead.get("business_type", ""),
                "Main Products": lead.get("main_products", ""),
                "Match Reason": lead.get("match_reason", ""),
                "Company Page URL": lead.get("company_page_url", ""),
                "Data Source": lead.get("data_source", ""),
                "Source URL": lead.get("source_url", ""),
                "Priority": lead.get("priority", ""),
            })

    by_priority = {"S": 0, "A": 0, "B": 0}
    for lead in leads:
        p = lead.get("priority") or "B"
        by_priority[p] = by_priority.get(p, 0) + 1

    summary = {
        "generated_at": _now_iso(),
        "day": day_str,
        "tool": "LeadFinderTool",
        "lead_count": len(leads),
        "by_priority": by_priority,
        "by_country": {},
        "files": {
            "json": str(json_path.name),
            "csv": str(csv_path.name),
        },
        "stats": stats,
    }
    for lead in leads:
        c = lead.get("country") or "Unknown"
        summary["by_country"][c] = summary["by_country"].get(c, 0) + 1

    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "leads_dir": str(leads_dir),
        "json_path": str(json_path),
        "csv_path": str(csv_path),
        "summary_path": str(summary_path),
        "lead_count": len(leads),
        "summary": summary,
    }


def run_lead_finder(
    *,
    max_results_per_query: int | None = None,
    max_total: int | None = None,
    max_queries: int | None = None,
) -> dict[str, Any]:
    """Discover real public companies — saves leads only, no outreach drafts (handled by APSales/子敬)."""
    leads, stats = discover_leads(
        max_results_per_query=max_results_per_query,
        max_total=max_total,
        max_queries=max_queries,
    )
    if not stats.get("ok"):
        return stats
    outputs = save_lead_outputs(leads, stats)
    return {
        "ok": True,
        "status": "completed",
        "lead_count": outputs["lead_count"],
        "outreach_queue_count": 0,
        "outputs": outputs,
        "outreach_queue": {},
        "stats": stats,
    }
