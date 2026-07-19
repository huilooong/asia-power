"""Public inventory catalog match — shared semantics with bridge findInventoryMatches.

Fetches https://asia-power.com/api/half-cuts/public (cached) and returns real
price_usd + detail/category URLs for the Python commercial_decision path.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any

SITE_ORIGIN = "https://asia-power.com"
INVENTORY_PUBLIC_API = f"{SITE_ORIGIN}/api/half-cuts/public"
CACHE_TTL_SEC = 10 * 60
MAX_SELF_DISCOUNT_PCT = 5.0

_cache: list[dict[str, Any]] | None = None
_cache_at: float = 0.0


def category_page_url(part_intent: str | None = None, vehicle_category: str | None = None) -> str:
    cat = str(vehicle_category or "").lower()
    if "truck" in cat:
        return f"{SITE_ORIGIN}/trucks/"
    if "machin" in cat:
        return f"{SITE_ORIGIN}/machinery/"
    part = str(part_intent or "").lower()
    if part == "engine":
        return f"{SITE_ORIGIN}/engines/"
    if part == "gearbox":
        return f"{SITE_ORIGIN}/half-cuts/?part=transmission"
    if part in {"half_cut", "half-cut", "halfcut"}:
        return f"{SITE_ORIGIN}/half-cuts/"
    return f"{SITE_ORIGIN}/half-cuts/"


def detail_page_url(item: dict[str, Any]) -> str | None:
    slug = str(item.get("slug") or "").strip()
    if not slug:
        return None
    cat = str(item.get("vehicleCategory") or "").lower()
    from urllib.parse import quote

    q = quote(slug, safe="")
    if "truck" in cat:
        return f"{SITE_ORIGIN}/trucks/detail.html?slug={q}"
    if "machin" in cat:
        return f"{SITE_ORIGIN}/machinery/detail.html?slug={q}"
    return f"{SITE_ORIGIN}/half-cuts/detail.html?slug={q}"


def _part_matches(item: dict[str, Any], part_intent: str | None) -> bool:
    if not part_intent:
        return True
    cond = str(item.get("vehicleCondition") or "").lower()
    if part_intent == "engine":
        return "engine" in cond
    if part_intent == "gearbox":
        return "transmission" in cond
    if part_intent in {"half_cut", "half-cut", "halfcut"}:
        return "half cut" in cond or "front cut" in cond
    return True


def fetch_catalog(*, force: bool = False, timeout: float = 8.0) -> list[dict[str, Any]]:
    global _cache, _cache_at
    now = time.time()
    if not force and _cache is not None and now - _cache_at < CACHE_TTL_SEC:
        return _cache
    try:
        req = urllib.request.Request(
            INVENTORY_PUBLIC_API,
            headers={"User-Agent": "AsiaPower-inventory-public/1.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        items = data.get("approved") if isinstance(data, dict) else None
        _cache = items if isinstance(items, list) else []
        _cache_at = now
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        if _cache is None:
            _cache = []
    return _cache or []


def set_catalog_for_tests(items: list[dict[str, Any]] | None) -> None:
    """Inject catalog in unit tests (None clears cache)."""
    global _cache, _cache_at
    _cache = items
    _cache_at = time.time() if items is not None else 0.0


def infer_part_intent(text: str, product_type: str | None = None) -> str | None:
    t = f"{text or ''} {product_type or ''}".lower()
    if "gearbox" in t or "transmission" in t or "gear box" in t:
        return "gearbox"
    if "half cut" in t or "half-cut" in t or "halfcut" in t or "front cut" in t:
        return "half_cut"
    if "engine" in t or "long block" in t or "complete engine" in t:
        return "engine"
    return None


def find_inventory_matches(
    *,
    brand: str | None = None,
    model: str | None = None,
    part_intent: str | None = None,
    engine_code: str | None = None,
    text: str = "",
    limit: int = 5,
    catalog: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Mirror bridge.mjs findInventoryMatches (+ slug/detail_url + engine_code)."""
    b = str(brand or "").strip().lower()
    m = str(model or "").strip().lower()
    ec = str(engine_code or "").strip().lower()
    if not b and not m and not ec:
        return []
    items = catalog if catalog is not None else fetch_catalog()
    if not items:
        return []
    t = str(text or "").lower()
    out: list[dict[str, Any]] = []
    for item in items:
        if str(item.get("status") or "") != "Available":
            continue
        ib = str(item.get("brand") or "").lower()
        im = str(item.get("model") or "").lower()
        iec = str(item.get("engineCode") or "").lower()
        if ec:
            if not iec or (ec not in iec and iec not in ec):
                continue
        else:
            if b and ib and b not in ib and ib not in b:
                continue
            if m and im and m not in im and im not in m and im not in t:
                continue
        if not _part_matches(item, part_intent):
            continue
        detail = detail_page_url(item)
        out.append(
            {
                "stock_id": item.get("stockId"),
                "slug": item.get("slug"),
                "title": item.get("title"),
                "price_usd": item.get("priceUsd"),
                "condition": item.get("vehicleCondition"),
                "vehicle_category": item.get("vehicleCategory"),
                "engine_code": item.get("engineCode") or None,
                "transmission_code": item.get("transmissionCode") or None,
                "detail_url": detail,
                "category_url": category_page_url(part_intent, item.get("vehicleCategory")),
            }
        )
        if len(out) >= limit:
            break
    return out


def parse_price_usd(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n <= 0:
        return None
    return n


def min_allowed_exw(listed: float, max_discount_pct: float = MAX_SELF_DISCOUNT_PCT) -> float:
    return listed * (1.0 - max_discount_pct / 100.0)


def quote_within_self_authority(listed: float, quoted: float) -> bool:
    """True if quoted EXW is not more than 5% below listed."""
    return quoted + 1e-9 >= min_allowed_exw(listed)


def format_prepare_quote_reply(matches: list[dict[str, Any]], *, part_intent: str | None = None) -> tuple[str, bool]:
    """Return (reply_text, needs_price_confirmation).

    On match: quote exact listed EXW (0% self-discount) + detail link.
    On no match: keep pending wording; needs_price_confirmation=True.
    """
    if not matches:
        cat = category_page_url(part_intent)
        return (
            "Thanks — enough to check supply and prepare quotation "
            f"(no price number until confirmed). Browse: {cat}",
            True,
        )
    best = matches[0]
    price = parse_price_usd(best.get("price_usd"))
    if price is None:
        return (
            "Thanks — enough to check supply and prepare quotation "
            "(no price number until confirmed).",
            True,
        )
    # Quote listed EXW only — never auto-discount below list on this path.
    stock = best.get("stock_id") or ""
    title = str(best.get("title") or "unit").strip()
    link = best.get("detail_url") or category_page_url(part_intent)
    price_i = int(round(price))
    reply = (
        f"EXW {price_i} USD for {title}"
        + (f" ({stock})" if stock else "")
        + f". Details: {link}"
    )
    return reply, False
