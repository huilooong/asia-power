"""Build Places search tasks from market + keyword YAML (quota-aware batching)."""

from __future__ import annotations

from typing import Any

from agents.apbd.leads.market_config import get_country, keyword_lists, load_markets
from agents.apbd.leads.repository import count_by_region


def _region_for_city(country: dict[str, Any], city: str) -> dict[str, Any] | None:
    want = (city or "").strip().lower()
    for region in country.get("regions") or []:
        for c in region.get("cities") or []:
            if str(c).lower() == want:
                return region
        for d in region.get("districts") or []:
            if str(d).lower() == want:
                return region
    return None


def plan_queries(
    *,
    country_code: str = "CA",
    city: str = "",
    region_id: str = "",
    keyword_groups: list[str] | None = None,
    limit_queries: int = 0,
) -> list[dict[str, Any]]:
    markets = load_markets()
    country = get_country(markets, country_code)
    pack = keyword_lists(markets.get("keyword_pack"))
    defaults = markets.get("search_defaults") or {}

    groups = keyword_groups or list(markets.get("query_groups_priority") or []) or [
        "chinese_service",
        "powertrain",
        "asian_vehicle",
        "parts",
        "general",
    ]
    keywords: list[str] = []
    for g in groups:
        keywords.extend(pack.get(g) or [])

    cities: list[str] = []
    if city:
        cities = [city]
    elif region_id:
        for region in country.get("regions") or []:
            if str(region.get("id")) == region_id:
                cities = [str(c) for c in (region.get("cities") or [])]
                # districts as extra location hints
                for d in region.get("districts") or []:
                    cities.append(str(d))
                break
    else:
        # Prefer under-filled regions first
        counts = count_by_region(country_code)
        ranked = []
        for region in country.get("regions") or []:
            rid = str(region.get("id") or "")
            target = int(region.get("target") or 0)
            have = int(counts.get(rid) or 0)
            gap = max(0, target - have)
            ranked.append((gap, region))
        ranked.sort(key=lambda x: -x[0])
        for gap, region in ranked:
            if gap <= 0:
                continue
            for c in region.get("cities") or []:
                cities.append(str(c))
            for d in region.get("districts") or []:
                cities.append(str(d))

    # Deduplicate cities while preserving order
    seen_c: set[str] = set()
    ordered_cities: list[str] = []
    for c in cities:
        key = c.lower()
        if key in seen_c:
            continue
        seen_c.add(key)
        ordered_cities.append(c)

    max_per_q = int(defaults.get("max_results_per_query") or 8)
    max_queries = int(limit_queries or defaults.get("max_queries_per_run") or 15)
    sleep_s = float(defaults.get("sleep_seconds_between_queries") or 1.5)

    tasks: list[dict[str, Any]] = []
    for loc in ordered_cities:
        for kw in keywords:
            q = f"{kw} {loc} Canada".strip()
            region = _region_for_city(country, loc) or {}
            # District hints keep primary city when resolvable; else use the hint itself
            city_name = loc
            if region and loc not in [str(c) for c in (region.get("cities") or [])]:
                cities_in_region = [str(c) for c in (region.get("cities") or [])]
                city_name = cities_in_region[0] if cities_in_region else loc
            tasks.append(
                {
                    "query": q,
                    "keyword": kw,
                    "city": city_name,
                    "location_hint": loc,
                    "country": country_code,
                    "region_id": str(region.get("id") or ""),
                    "max_results": max_per_q,
                    "sleep_s": sleep_s,
                }
            )
            if len(tasks) >= max_queries:
                return tasks
    return tasks[:max_queries] if max_queries else tasks
