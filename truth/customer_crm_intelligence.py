"""Customer CRM intelligence — tiers + behavior + vehicle inquiry aggregates.

Follows truth/verified_sales_intelligence.py conventions (_load_json, _with_source,
available flag, limitations). Do not invent stats; only report on-disk facts.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from customer_gateway import sales_intelligence_paths as sip
from customer_gateway.whatsapp_contact_resolver import is_phone_like, normalize_phone_digits

ROOT = Path(__file__).resolve().parent.parent


def _load_json(path: Path) -> Any | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _fmt_source(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def _with_source(value: Any, source: str) -> dict[str, Any]:
    return {"value": value, "source": source}


def _safe_slug(contact: str) -> str:
    return re.sub(r"[^\w.\-+]+", "_", str(contact or "unknown"))[:120] or "unknown"


def _contact_keys_for_lookup(contact: str) -> list[str]:
    """Possible keys used across tiers / customers / inquiries."""
    raw = (contact or "").strip()
    keys = [raw]
    if raw.startswith("wa:"):
        keys.append(raw[3:])
        keys.append("+" + raw[3:])
    digits = normalize_phone_digits(raw)
    if digits:
        keys.extend([digits, f"+{digits}", f"wa:{digits}"])
    # unique preserve order
    seen: set[str] = set()
    out: list[str] = []
    for k in keys:
        if k and k not in seen:
            seen.add(k)
            out.append(k)
    return out


def _load_tiers() -> dict[str, Any]:
    return _load_json(sip.CUSTOMER_TIERS_PATH) or {}


def _load_customer_behavior(contact: str) -> dict[str, Any] | None:
    """Best-effort match against customers/*.json (filename or contact field)."""
    if not sip.CUSTOMERS_DIR.is_dir():
        return None
    candidates = {_safe_slug(k) for k in _contact_keys_for_lookup(contact)}
    for path in sip.CUSTOMERS_DIR.glob("*.json"):
        if path.stem in candidates:
            data = _load_json(path)
            if isinstance(data, dict):
                return data
    # Scan contact field
    for path in sip.CUSTOMERS_DIR.glob("*.json"):
        data = _load_json(path)
        if not isinstance(data, dict):
            continue
        c = str(data.get("contact") or data.get("name") or "")
        if c in _contact_keys_for_lookup(contact):
            return data
    return None


def _load_vehicle_inquiry(contact: str) -> dict[str, Any] | None:
    if not sip.VEHICLE_INQUIRIES_DIR.is_dir():
        return None
    for key in _contact_keys_for_lookup(contact):
        path = sip.VEHICLE_INQUIRIES_DIR / f"{_safe_slug(key)}.json"
        data = _load_json(path)
        if isinstance(data, dict):
            return data
    return None


def _tier_for_contact(tiers: dict[str, Any], contact: str) -> str | None:
    by = tiers.get("by_contact") or {}
    if not isinstance(by, dict):
        return None
    for key in _contact_keys_for_lookup(contact):
        if key in by:
            return str(by[key])
    return None


def _aggregate_vehicle_rankings() -> dict[str, Any]:
    brand_counts: dict[str, int] = {}
    engine_counts: dict[str, int] = {}
    year_counts: dict[str, int] = {}
    files_read = 0
    name_only_contacts = 0
    phone_linked = 0
    if sip.VEHICLE_INQUIRIES_DIR.is_dir():
        for path in sip.VEHICLE_INQUIRIES_DIR.glob("*.json"):
            data = _load_json(path)
            if not isinstance(data, dict):
                continue
            files_read += 1
            contact = str(data.get("contact") or path.stem)
            if is_phone_like(contact) or normalize_phone_digits(contact):
                phone_linked += 1
            else:
                name_only_contacts += 1
            for row in data.get("inquiries") or []:
                if not isinstance(row, dict):
                    continue
                b = row.get("brand")
                e = row.get("engine_code")
                y = row.get("year")
                if b:
                    brand_counts[str(b)] = brand_counts.get(str(b), 0) + 1
                if e:
                    engine_counts[str(e)] = engine_counts.get(str(e), 0) + 1
                if y is not None:
                    year_counts[str(y)] = year_counts.get(str(y), 0) + 1

    def top(d: dict[str, int], n: int = 20) -> list[dict[str, Any]]:
        return [
            {"name": k, "count": v}
            for k, v in sorted(d.items(), key=lambda kv: (-kv[1], kv[0]))[:n]
        ]

    return {
        "files_read": files_read,
        "phone_linked_contacts": phone_linked,
        "name_only_contacts": name_only_contacts,
        "top_brands": top(brand_counts),
        "top_engine_codes": top(engine_counts),
        "top_years": top(year_counts),
    }


def load_customer_crm_data(contact: str | None = None) -> dict[str, Any]:
    """
    contact set → single-customer profile.
    contact None → aggregate assortment view for sourcing decisions.
    """
    source_files: list[str] = []
    limitations: list[str] = [
        "Name-only sales_intelligence contacts cannot be joined to Evidence wa:<digits> ids.",
        "V1 vehicle extractor covers brand + engine_code + year only (model/part deferred).",
        "Wholesale distinct-engine signal is NOT yet wired into commercial_decision live path.",
    ]

    tiers = _load_tiers()
    if tiers:
        source_files.append(_fmt_source(sip.CUSTOMER_TIERS_PATH))

    if contact:
        tier = _tier_for_contact(tiers, contact)
        behavior = _load_customer_behavior(contact)
        inquiry = _load_vehicle_inquiry(contact)
        if behavior is not None:
            # best-effort source path
            source_files.append(_fmt_source(sip.CUSTOMERS_DIR / f"{_safe_slug(contact)}.json"))
        if inquiry is not None:
            source_files.append(
                _fmt_source(sip.VEHICLE_INQUIRIES_DIR / f"{_safe_slug(contact)}.json")
            )
        phone_joinable = bool(normalize_phone_digits(contact)) or contact.startswith("wa:")
        if not phone_joinable:
            limitations.append(
                f"Contact '{contact}' looks name-based — cannot cross-reference Evidence wa: ids."
            )
        available = bool(tier or behavior or inquiry)
        return {
            "available": available,
            "scope": "single_customer",
            "contact": contact,
            "tier": _with_source(tier, _fmt_source(sip.CUSTOMER_TIERS_PATH)) if tier else None,
            "behavior": _with_source(behavior, "memory/sales_intelligence/customers/") if behavior else None,
            "vehicle_inquiries": _with_source(inquiry, "memory/sales_intelligence/vehicle_inquiries/")
            if inquiry
            else None,
            "distinct_engine_models_count": len((inquiry or {}).get("distinct_engine_models") or []),
            "source_files": source_files,
            "limitations": limitations,
        }

    rankings = _aggregate_vehicle_rankings()
    if rankings["files_read"]:
        source_files.append(_fmt_source(sip.VEHICLE_INQUIRIES_DIR))
    tier_counts = (tiers or {}).get("customer_tiers") or {}
    available = bool(tiers or rankings["files_read"])
    if rankings["name_only_contacts"]:
        limitations.append(
            f"{rankings['name_only_contacts']} vehicle-inquiry contacts are name-only "
            "(no phone join to Evidence)."
        )
    return {
        "available": available,
        "scope": "aggregate",
        "tier_counts": _with_source(tier_counts, _fmt_source(sip.CUSTOMER_TIERS_PATH))
        if tier_counts
        else None,
        "assortment": _with_source(rankings, _fmt_source(sip.VEHICLE_INQUIRIES_DIR)),
        "source_files": source_files,
        "limitations": limitations,
    }
