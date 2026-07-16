"""Extract brand / engine_code / year mentions from customer WhatsApp messages (V1).

Reuses engine-code patterns from whatsapp_sales_intelligence_full_report plus
popular codes from js/brand-catalog.js. Model/part NER is deferred (no lexicon yet).
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway import sales_intelligence_paths as sip

ROOT = Path(__file__).resolve().parent.parent
BRAND_DICT_PATH = ROOT / "data" / "knowledge-base" / "brand-dictionary.json"

# Extended from full_report + brand-catalog popular engines (alphanumeric cores).
_ENGINE_CODE_RE = re.compile(
    r"\b("
    r"G4K[ABCDEJH]|G4F[ACG]|G4N[ABC]|G6B[ADH]|G6EA|"
    r"HR\d{2}[A-Z]{0,2}|MR\d{2}[A-Z]{0,2}|QR\d{2}[A-Z]{0,2}|VQ\d{2}[A-Z]{0,2}|"
    r"QG\d{2}[A-Z]{0,2}|GA\d{2}[A-Z]{0,2}|"
    r"1NZ|2NZ|1ZZ|3ZZ|1AZ|2AZ|1ZR|2ZR|3ZR|2TR|1GR|2GR|1KD|2KD|3SZ|2SZ|"
    r"4B1[012]|4G1[358]|4G6[349]|4A9[12]|EA888|EA211|EA111|EA113|"
    r"K20A|K24A|L13A|L15[AB]|R18A|R20A|J30A|J35A|"
    r"EJ1[5]|EJ2[05]|FB2[05]|FA20|"
    r"M13A|M15A|M16A|J20A|G13B|G16B|"
    r"N42|N46|N52|N54|N55|B48|B58|"
    r"M111|M112|M113|M271|M272|M274|M276"
    r")\b",
    re.I,
)
_YEAR_RE = re.compile(r"\b((?:19|20)\d{2})\b")
_CATALOG_MARK_RE = re.compile(r"到货清单|独立卡片|index\.html|GHS\s*\d", re.I)
_BROADCAST_MIN_CODES = 3

# English brand tokens commonly used by African buyers (lowercase).
_EN_BRANDS = (
    "toyota",
    "honda",
    "nissan",
    "hyundai",
    "kia",
    "mazda",
    "mitsubishi",
    "suzuki",
    "subaru",
    "lexus",
    "bmw",
    "mercedes",
    "benz",
    "volkswagen",
    "vw",
    "ford",
    "chevrolet",
    "chery",
    "geely",
    "byd",
    "changan",
    "daihatsu",
    "isuzu",
    "hino",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_brand_dictionary() -> dict[str, str]:
    """Map alias (lower) → English brand."""
    out: dict[str, str] = {}
    for en in _EN_BRANDS:
        if en == "benz":
            out[en] = "Mercedes"
        elif en == "vw":
            out[en] = "Volkswagen"
        else:
            out[en] = en.title()
    out["volkswagen"] = "Volkswagen"
    if BRAND_DICT_PATH.is_file():
        try:
            raw = json.loads(BRAND_DICT_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            raw = {}
        if isinstance(raw, dict):
            for key, val in raw.items():
                eng = ""
                if isinstance(val, dict):
                    eng = str(val.get("english") or "").strip()
                elif isinstance(val, str):
                    eng = val.strip()
                if not eng:
                    continue
                out[str(key).strip().lower()] = eng
                out[eng.lower()] = eng
    return out


_BRAND_MAP = _load_brand_dictionary()
# Longest-first for Chinese multi-char brands
_BRAND_KEYS_SORTED = sorted(_BRAND_MAP.keys(), key=len, reverse=True)


def is_broadcast_catalog_message(text: str) -> bool:
    """Exclude own inventory blasts that list many engine codes."""
    body = text or ""
    if _CATALOG_MARK_RE.search(body):
        return True
    codes = {c.upper() for c in _ENGINE_CODE_RE.findall(body)}
    return len(codes) >= _BROADCAST_MIN_CODES


def extract_brands(text: str) -> list[str]:
    body = text or ""
    found: list[str] = []
    lower = body.lower()
    for key in _BRAND_KEYS_SORTED:
        if not key:
            continue
        if key.isascii():
            if re.search(rf"\b{re.escape(key)}\b", lower):
                brand = _BRAND_MAP[key]
                if brand not in found:
                    found.append(brand)
        else:
            if key in body:
                brand = _BRAND_MAP[key]
                if brand not in found:
                    found.append(brand)
    return found


def extract_engine_codes(text: str) -> list[str]:
    if is_broadcast_catalog_message(text):
        return []
    return sorted({c.upper() for c in _ENGINE_CODE_RE.findall(text or "")})


def extract_years(text: str) -> list[int]:
    years: list[int] = []
    for y in _YEAR_RE.findall(text or ""):
        try:
            yi = int(y)
        except ValueError:
            continue
        if 1985 <= yi <= 2030:
            years.append(yi)
    return sorted(set(years))


def extract_from_message(
    text: str,
    *,
    mentioned_at: str | None = None,
    source_conversation_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return zero or more entity rows for one customer message (V1: brand/engine/year)."""
    body = (text or "").strip()
    if not body or is_broadcast_catalog_message(body):
        return []
    brands = extract_brands(body)
    engines = extract_engine_codes(body)
    years = extract_years(body)
    if not brands and not engines and not years:
        return []
    # One row per (brand, engine) pairing when both present; else single sparse row.
    rows: list[dict[str, Any]] = []
    if brands and engines:
        for brand in brands:
            for eng in engines:
                rows.append(
                    {
                        "brand": brand,
                        "model": None,
                        "engine_code": eng,
                        "year": years[0] if years else None,
                        "part": None,
                        "mentioned_at": mentioned_at,
                        "source_conversation_id": source_conversation_id,
                    }
                )
    else:
        rows.append(
            {
                "brand": brands[0] if brands else None,
                "model": None,
                "engine_code": engines[0] if engines else None,
                "year": years[0] if years else None,
                "part": None,
                "mentioned_at": mentioned_at,
                "source_conversation_id": source_conversation_id,
            }
        )
    return rows


def extract_from_messages(
    messages: list[dict[str, Any]],
    *,
    source_conversation_id: str | None = None,
    customer_only: bool = True,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for msg in messages or []:
        if customer_only and msg.get("is_ceo"):
            continue
        out.extend(
            extract_from_message(
                msg.get("text") or "",
                mentioned_at=msg.get("timestamp"),
                source_conversation_id=source_conversation_id or msg.get("conversation_id"),
            )
        )
    return out


def persist_vehicle_inquiries_for_contact(
    contact_key: str,
    inquiries: list[dict[str, Any]],
) -> Path:
    """Write memory/sales_intelligence/vehicle_inquiries/<safe>.json"""
    sip.ensure_dirs()
    safe = re.sub(r"[^\w.\-+]+", "_", str(contact_key or "unknown"))[:120] or "unknown"
    path = sip.VEHICLE_INQUIRIES_DIR / f"{safe}.json"
    payload = {
        "contact": contact_key,
        "updated_at": _now(),
        "inquiry_count": len(inquiries),
        "distinct_engine_models": sorted(
            {r["engine_code"] for r in inquiries if r.get("engine_code")}
        ),
        "distinct_brands": sorted({r["brand"] for r in inquiries if r.get("brand")}),
        "inquiries": inquiries,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def build_vehicle_inquiries_from_conversations(
    conversations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Scan conversations and persist per-contact vehicle inquiry files."""
    from customer_gateway.conversation_database import load_all_conversations

    convs = conversations if conversations is not None else load_all_conversations()
    by_contact: dict[str, list[dict[str, Any]]] = {}
    for conv in convs:
        contact = conv.get("contact") or "unknown"
        cid = conv.get("id") or conv.get("conversation_id")
        rows = extract_from_messages(
            conv.get("messages") or [],
            source_conversation_id=str(cid) if cid else None,
            customer_only=True,
        )
        if not rows:
            continue
        by_contact.setdefault(contact, []).extend(rows)
    written = 0
    for contact, rows in by_contact.items():
        persist_vehicle_inquiries_for_contact(contact, rows)
        written += 1
    return {
        "ok": True,
        "contacts_with_inquiries": written,
        "total_conversations": len(convs),
        "output_dir": str(sip.VEHICLE_INQUIRIES_DIR),
    }


def run_vehicle_inquiry_extract(
    conversations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Public entry for batch/cron: extract + persist, never raise to caller."""
    try:
        return build_vehicle_inquiries_from_conversations(conversations)
    except Exception as exc:  # noqa: BLE001 — batch must not kill import/analyze
        return {
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
            "contacts_with_inquiries": 0,
            "total_conversations": 0,
            "output_dir": str(sip.VEHICLE_INQUIRIES_DIR),
        }
