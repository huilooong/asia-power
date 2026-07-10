#!/usr/bin/env python3
"""Aggregate verified Africa/ME half-cut market intelligence from on-disk sources.

Scans WhatsApp conversation DB, parsed chats, and customer profiles.
Excludes known browser-import stub duplicates (439x "Is matiz 2 automatic engine").
Outputs JSON summary to stdout; optional --out path.

Usage:
  .venv/bin/python3 scripts/aggregate-market-intelligence.py
  .venv/bin/python3 scripts/aggregate-market-intelligence.py --out reports/market-intel-aggregate.json
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CONV_DIR = ROOT / "memory" / "sales_intelligence" / "conversations"
PROF_DIR = ROOT / "memory" / "customer_gateway" / "customer_profiles"
WP_DIR = ROOT / "memory" / "customer_gateway" / "whatsapp_parsed"
IMPORT_STATE = ROOT / "memory" / "sales_intelligence" / "import_state.json"
LATEST_ANALYSIS = ROOT / "memory" / "sales_intelligence" / "latest_analysis.json"

STUB_FIRST = "Is matiz  2 automatic  engine"

ENGINE_RE = re.compile(
    r"\b(G4K[ABCDEJ]|G4FA|G4FC|G4GC|G4NA|G4ND|HR\d{2}[A-Z]{2}|1NZ|2NZ|1ZZ|"
    r"2ZR|1ZR|2AZ|1KD|2KD|3SZ|2SZ|4B1[12]|EA888|2NZ-FE|1NZ-FE|1KD-FTV|2KD-FTV|QR25|HR16)\b",
    re.I,
)
CATALOG_RE = re.compile(r"到货清单|独立卡片|index\.html|GHS\s*\d", re.I)
PRICE_PATTERNS = [
    re.compile(r"fob\s*(?:price\s*)?(\d{3,6})", re.I),
    re.compile(r"china fob price\s*(\d{3,6})", re.I),
    re.compile(r"USD\s*(\d{3,6})", re.I),
    re.compile(r"price is\s*([\d,]+)", re.I),
    re.compile(r"(\d{4,5})\s*usd", re.I),
]

MODEL_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Vitz/Yaris", re.compile(r"vitz|yaris|echo", re.I)),
    ("Corolla", re.compile(r"corolla", re.I)),
    ("RAV4", re.compile(r"rav4", re.I)),
    ("Hilux", re.compile(r"hilux", re.I)),
    ("Elantra", re.compile(r"elantra", re.I)),
    ("Sonata", re.compile(r"sonata", re.I)),
    ("Tucson", re.compile(r"tucson", re.I)),
    ("Sorento", re.compile(r"sorento", re.I)),
    ("Highlander", re.compile(r"highlander", re.I)),
    ("Vios", re.compile(r"vios", re.I)),
    ("Kia Forte/Seltos", re.compile(r"forte|seltos", re.I)),
    ("Matiz", re.compile(r"matiz", re.I)),
]


def detect_country(contact: str) -> str:
    c = contact or ""
    if re.search(r"ghana", c, re.I) or "+233" in c:
        return "Ghana"
    if re.search(r"nigeria", c, re.I) or "+234" in c:
        return "Nigeria"
    if re.search(r"kenya", c, re.I) or "+254" in c:
        return "Kenya"
    if re.search(r"togo", c, re.I) or "+228" in c:
        return "Togo"
    if "+231" in c:
        return "Liberia"
    if "+971" in c:
        return "UAE"
    return "unknown"


def is_stub(conv: dict[str, Any]) -> bool:
    msgs = conv.get("messages", [])
    if not msgs:
        return True
    return (msgs[0].get("text") or "").strip() == STUB_FIRST


def load_json(path: Path) -> Any | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def scan_conversations() -> dict[str, Any]:
    engine_hits: Counter[str] = Counter()
    engine_by_country: dict[str, Counter[str]] = defaultdict(Counter)
    engine_contacts: dict[str, set[str]] = defaultdict(set)
    model_hits: Counter[str] = Counter()
    model_by_country: dict[str, Counter[str]] = defaultdict(Counter)
    model_contacts: dict[str, set[str]] = defaultdict(set)
    country_conv: Counter[str] = Counter()
    prices: list[dict[str, str]] = []
    customers: list[dict[str, Any]] = []

    total = stub = real = 0

    for path in sorted(CONV_DIR.glob("*.json")):
        conv = json.loads(path.read_text(encoding="utf-8"))
        total += 1
        if is_stub(conv):
            stub += 1
            continue
        real += 1

        contact = conv.get("contact", "")
        country = detect_country(contact)
        country_conv[country] += 1

        cust_codes: set[str] = set()
        cust_models: set[str] = set()
        enquiries: list[str] = []

        for msg in conv.get("messages", []):
            if msg.get("is_ceo"):
                continue
            text = msg.get("text", "") or ""
            cat = msg.get("category", "")
            if cat in ("enquiry", "price_request", "availability_check"):
                enquiries.append(text[:160])

            codes = {m.upper().replace("-FE", "").replace("-FTV", "").replace("DE", "")
                     for m in ENGINE_RE.findall(text)}
            if len(codes) >= 3 or CATALOG_RE.search(text):
                continue
            for code in codes:
                engine_hits[code] += 1
                engine_by_country[country][code] += 1
                engine_contacts[code].add(contact)
                cust_codes.add(code)

            tl = text.lower()
            if any(x in tl for x in ("engine", "半切", "half cut", "halfcut", "机")):
                for name, pat in MODEL_PATTERNS:
                    if pat.search(text):
                        model_hits[name] += 1
                        model_by_country[country][name] += 1
                        model_contacts[name].add(contact)
                        cust_models.add(name)

            for pat in PRICE_PATTERNS:
                m = pat.search(text)
                if m:
                    prices.append({
                        "contact": contact,
                        "country": country,
                        "price_usd": m.group(1).replace(",", ""),
                        "context": text[:140],
                        "source": str(path.relative_to(ROOT)),
                    })

        if cust_codes or cust_models or enquiries:
            customers.append({
                "contact": contact,
                "country": country,
                "engine_codes": sorted(cust_codes),
                "models": sorted(cust_models),
                "message_count": conv.get("message_count", 0),
                "enquiry_samples": enquiries[:3],
                "source": str(path.relative_to(ROOT)),
            })

    return {
        "total_conversations": total,
        "stub_excluded": stub,
        "real_conversations": real,
        "conversations_by_country": dict(country_conv),
        "engine_codes": {
            "mentions": dict(engine_hits),
            "by_country": {k: dict(v) for k, v in engine_by_country.items()},
            "distinct_contacts": {k: len(v) for k, v in engine_contacts.items()},
        },
        "model_enquiries": {
            "mentions": dict(model_hits),
            "by_country": {k: dict(v) for k, v in model_by_country.items()},
            "distinct_contacts": {k: len(v) for k, v in model_contacts.items()},
        },
        "verified_prices": prices,
        "customers_with_demand": sorted(customers, key=lambda x: -x.get("message_count", 0)),
    }


def scan_profiles() -> dict[str, Any]:
    total = 0
    with_country = 0
    with_products = 0
    countries: Counter[str] = Counter()
    products: Counter[str] = Counter()

    if not PROF_DIR.is_dir():
        return {"total": 0, "with_country": 0, "with_products": 0}

    for path in PROF_DIR.glob("*.json"):
        total += 1
        prof = load_json(path) or {}
        c = (prof.get("country") or "").strip()
        if c and c.lower() != "unknown":
            with_country += 1
            countries[c] += 1
        prods = prof.get("interested_products") or []
        if prods:
            with_products += 1
            for p in prods:
                products[str(p).upper()] += 1

    return {
        "total": total,
        "with_country": with_country,
        "with_products": with_products,
        "countries": dict(countries),
        "products": dict(products),
        "note": "Profiles largely empty — country/product fields not populated by importer.",
    }


def scan_whatsapp_parsed() -> dict[str, Any]:
    if not WP_DIR.is_dir():
        return {"files": 0, "unique_contacts": 0, "engine_mentions": {}}

    contacts: set[str] = set()
    hits: Counter[str] = Counter()
    for path in WP_DIR.glob("*.json"):
        data = load_json(path) or {}
        contact = data.get("contact", "")
        contacts.add(contact)
        for msg in data.get("messages", []):
            if msg.get("is_ceo"):
                continue
            text = msg.get("text", "") or ""
            for m in ENGINE_RE.findall(text):
                hits[m.upper()] += 1
            for kw in msg.get("product_keywords", []):
                hits[str(kw).upper()] += 1

    return {
        "files": len(list(WP_DIR.glob("*.json"))),
        "unique_contacts": len(contacts),
        "engine_mentions": dict(hits),
        "note": "High duplicate count from sample/test re-imports; use conversation DB as primary.",
    }


def load_meta() -> dict[str, Any]:
    import_state = load_json(IMPORT_STATE) or {}
    analysis = load_json(LATEST_ANALYSIS) or {}
    funnel = (analysis.get("performance") or {}).get("funnel") or {}
    return {
        "import_state": {
            "conversation_count": import_state.get("conversation_count"),
            "message_count": import_state.get("message_count"),
            "effective_customers": (import_state.get("role_summary") or {}).get("effective_customers"),
            "browser_import": import_state.get("browser_import"),
        },
        "funnel_keyword_inferred": funnel,
        "funnel_caveat": "Funnel counts include 439 stub conversations; not financial-grade.",
    }


def aggregate() -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "conversations": scan_conversations(),
        "customer_profiles": scan_profiles(),
        "whatsapp_parsed": scan_whatsapp_parsed(),
        "meta": load_meta(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Aggregate verified market intelligence")
    parser.add_argument("--out", help="Write JSON to this path")
    args = parser.parse_args()

    result = aggregate()
    text = json.dumps(result, ensure_ascii=False, indent=2)

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(f"Wrote {out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
