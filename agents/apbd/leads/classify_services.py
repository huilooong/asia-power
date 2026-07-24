"""Rule-based service / brand / business-type classification with evidence."""

from __future__ import annotations

import re
from typing import Any

from agents.apbd.leads.market_config import brand_list

_SERVICE_PATTERNS: list[tuple[str, str]] = [
    (r"engine\s+replacement|replace(?:ment)?\s+engine|engine\s+swap", "engine_replacement"),
    (r"used\s+engine\s+install", "used_engine_installation"),
    (r"engine\s+rebuild|rebuilt\s+engine", "engine_rebuilding"),
    (r"engine\s+repair|engine\s+service", "engine_repair"),
    (r"engine\s+diagnos", "engine_diagnostics"),
    (r"transmission\s+replacement|replace(?:ment)?\s+transmission", "transmission_replacement"),
    (r"transmission\s+repair|gearbox\s+repair", "transmission_repair"),
    (r"used\s+transmission\s+install", "used_transmission_installation"),
    (r"hybrid", "hybrid_repair"),
    (r"\bev\b|electric\s+vehicle", "ev_repair"),
    (r"diesel", "diesel_repair"),
    (r"fleet", "fleet_service"),
    (r"commercial\s+vehicle|truck\s+repair", "commercial_vehicle"),
    (r"used\s+(auto\s+)?parts|salvage|dismantl|recycler", "used_parts_sales"),
    (r"auto\s+parts", "auto_parts_sales"),
    (r"oil\s+change|lube", "oil_change"),
    (r"tire|tyre", "tire_service"),
    (r"brake", "brake_service"),
    (r"suspension|alignment", "suspension"),
    (r"general\s+repair|full[\s-]?service|auto\s+repair", "general_repair"),
]

_NEGATIVE_ONLY = [
    (r"detailing|car\s+wash|detail\s+shop", "detailing_only"),
    (r"body\s+shop|collision|paint\s+booth", "body_shop_only"),
    (r"\boil\s+change\b", "oil_change_only_hint"),
]


def classify_from_text(
    text: str,
    *,
    source_url: str = "",
    source_type: str = "website",
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    """Return (services, brands, flags)."""
    blob = text or ""
    services: list[dict[str, Any]] = []
    seen_svc: set[str] = set()
    for pat, code in _SERVICE_PATTERNS:
        m = re.search(pat, blob, re.I)
        if not m or code in seen_svc:
            continue
        seen_svc.add(code)
        start = max(0, m.start() - 30)
        end = min(len(blob), m.end() + 30)
        services.append(
            {
                "service_code": code,
                "evidence_text": re.sub(r"\s+", " ", blob[start:end]).strip()[:200],
                "evidence_url": source_url,
                "source_type": source_type,
                "confidence": 0.75,
            }
        )

    brands_out: list[dict[str, Any]] = []
    seen_b: set[str] = set()
    for brand in brand_list():
        if re.search(rf"\b{re.escape(brand)}\b", blob, re.I) and brand.lower() not in seen_b:
            seen_b.add(brand.lower())
            brands_out.append(
                {
                    "brand_code": brand,
                    "evidence_text": brand,
                    "evidence_url": source_url,
                    "confidence": 0.7,
                }
            )

    flags: list[str] = []
    for pat, flag in _NEGATIVE_ONLY:
        if re.search(pat, blob, re.I):
            flags.append(flag)
    return services, brands_out, flags


def infer_business_type(company: dict[str, Any], flags: list[str] | None = None) -> str:
    name = f"{company.get('display_name') or ''} {company.get('description') or ''}".lower()
    svc = {s.get("service_code") for s in (company.get("services") or [])}
    brands = company.get("brands") or []
    chains = company.get("chain_status") or ""

    if "dealership" in name or "toyota store" in name:
        return "dealership_service"
    if any(x in name for x in ("dismantl", "recycler", "salvage", "wreck")):
        return "auto_recycler"
    if "used_parts_sales" in svc or "used parts" in name:
        return "used_parts_dealer"
    if "transmission_repair" in svc or "transmission_replacement" in svc or "transmission" in name:
        return "transmission_shop"
    if "engine_rebuilding" in svc or "engine rebuild" in name:
        return "engine_rebuilder"
    if len(brands) >= 2 or "asian" in name or "japanese" in name or "import" in name:
        return "asian_vehicle_specialist"
    if len(brands) == 1:
        return "brand_specialist"
    if "tire_service" in svc and not (svc & {"engine_repair", "engine_replacement", "transmission_repair", "general_repair"}):
        return "tire_and_service"
    if flags and "body_shop_only" in flags and "general_repair" not in svc:
        return "body_shop"
    if flags and "detailing_only" in flags:
        return "detailing"
    if chains == "national":
        return "independent_repair_shop"  # still typed; scoring penalizes national
    return "independent_repair_shop"


def merge_services(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by = {str(s.get("service_code")): s for s in existing if s.get("service_code")}
    for s in incoming:
        code = str(s.get("service_code") or "")
        if not code:
            continue
        if code not in by or float(s.get("confidence") or 0) > float(by[code].get("confidence") or 0):
            by[code] = s
    return list(by.values())


def merge_brands(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by = {str(b.get("brand_code")).lower(): b for b in existing if b.get("brand_code")}
    for b in incoming:
        code = str(b.get("brand_code") or "")
        if not code:
            continue
        key = code.lower()
        if key not in by:
            by[key] = b
    return list(by.values())
