"""QXB half-cut FOB price estimation from live catalog comparables."""

from __future__ import annotations

import json
import re
import statistics
import urllib.request
from typing import Any

_CATALOG_CACHE: dict[str, list[dict[str, Any]]] = {}


def _round_fob(usd: float) -> int:
    return int(max(50, round(usd / 50) * 50))


def fetch_public_listings(api_base: str, *, force: bool = False) -> list[dict[str, Any]]:
    key = api_base.rstrip("/")
    if not force and key in _CATALOG_CACHE:
        return _CATALOG_CACHE[key]
    url = f"{key}/api/half-cuts/public"
    req = urllib.request.Request(url, headers={"User-Agent": "AsiaPower-QXB-Price/1.0"})
    with urllib.request.urlopen(req, timeout=30) as res:
        payload = json.loads(res.read().decode())
    items = payload.get("approved") if isinstance(payload, dict) else payload
    if not isinstance(items, list):
        items = []
    _CATALOG_CACHE[key] = items
    return items


def _parse_price(item: dict[str, Any]) -> float | None:
    for key in ("priceUsd", "priceUSD", "fobPriceUsd", "fobPrice", "price"):
        val = item.get(key)
        if val is None or val == "":
            continue
        try:
            amount = float(val)
        except (TypeError, ValueError):
            continue
        if amount > 0:
            return amount
    return None


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


def _model_match(a: str, b: str) -> bool:
    na, nb = _norm(a), _norm(b)
    if not na or not nb:
        return False
    return na == nb or na in nb or nb in na


def _score_listing(
    item: dict[str, Any],
    *,
    brand: str,
    brand_slug: str,
    model: str,
    year: int | None,
    engine_code: str,
) -> int:
    score = 0
    item_brand = str(item.get("brand") or "")
    item_slug = str(item.get("brandSlug") or "")
    if brand_slug and item_slug == brand_slug:
        score += 40
    elif _norm(item_brand) == _norm(brand):
        score += 35
    elif _norm(brand) and _norm(brand) in _norm(item_brand):
        score += 20

    if engine_code and str(item.get("engineCode") or "").upper() == engine_code.upper():
        score += 30

    if _model_match(str(item.get("model") or ""), model):
        score += 25

    item_year = item.get("year")
    if year and item_year:
        try:
            delta = abs(int(year) - int(item_year))
            score += max(0, 15 - delta * 3)
        except (TypeError, ValueError):
            pass

    if str(item.get("vehicleCategory") or "passenger") != "passenger":
        score -= 20
    return score


def estimate_half_cut_price_usd(
    *,
    brand: str,
    brand_slug: str,
    model: str,
    year: int | None,
    engine_code: str,
    api_base: str,
    listings: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Estimate FOB USD from similar live half-cut listings.
    CEO should adjust at approve time — record is tagged priceEstimated.
    """
    catalog = listings if listings is not None else fetch_public_listings(api_base)
    scored: list[tuple[int, float, dict[str, Any]]] = []
    for item in catalog:
        price = _parse_price(item)
        if price is None:
            continue
        score = _score_listing(
            item,
            brand=brand,
            brand_slug=brand_slug,
            model=model,
            year=year,
            engine_code=engine_code,
        )
        if score >= 35:
            scored.append((score, price, item))

    if scored:
        scored.sort(key=lambda x: (-x[0], -x[1]))
        strong = [x for x in scored if x[0] >= 60]
        pool = strong if strong else scored
        top = pool[:8]
        prices = [p for _, p, _ in top]
        est = _round_fob(statistics.median(prices))
        refs = [
            {
                "stockId": it.get("stockId"),
                "year": it.get("year"),
                "model": it.get("model"),
                "engineCode": it.get("engineCode"),
                "priceUsd": p,
                "score": s,
            }
            for s, p, it in top[:3]
        ]
        return {
            "priceUsd": est,
            "priceEstimated": True,
            "method": "catalog_median",
            "sampleCount": len(prices),
            "references": refs,
            "note": f"子龙预估 FOB ${est}（基于 {len(prices)} 条相似目录价中位数，CEO 批准前请复核）",
        }

    # Compact / older passenger fallback from catalog-wide old-car band.
    old_prices = [
        _parse_price(i)
        for i in catalog
        if _parse_price(i) is not None
        and str(i.get("vehicleCategory") or "passenger") == "passenger"
        and (i.get("year") or 0) <= 2010
    ]
    old_prices = [p for p in old_prices if p is not None]
    if old_prices:
        est = _round_fob(statistics.median(old_prices))
        return {
            "priceUsd": est,
            "priceEstimated": True,
            "method": "old_passenger_median",
            "sampleCount": len(old_prices),
            "references": [],
            "note": f"子龙预估 FOB ${est}（无直接可比，用 ≤2010 乘用车目录中位数，CEO 批准前请复核）",
        }

    return {
        "priceUsd": 1000,
        "priceEstimated": True,
        "method": "default_floor",
        "sampleCount": 0,
        "references": [],
        "note": "子龙预估 FOB $1000（无目录可比，默认底价，CEO 批准前请复核）",
    }
