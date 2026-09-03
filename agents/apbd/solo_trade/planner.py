"""Build bounded, inspectable search plans from campaign briefs."""

from __future__ import annotations

import re
from typing import Any

from agents.apbd.solo_trade.models import CampaignBrief

DEPTH_LIMITS = {
    1: {"max_queries": 4, "results_per_query": 4, "website_pages": 1},
    2: {"max_queries": 10, "results_per_query": 6, "website_pages": 3},
    3: {"max_queries": 20, "results_per_query": 10, "website_pages": 5},
}


def _market_parts(value: str) -> tuple[str, str]:
    parts = [p.strip() for p in re.split(r"[,/]", value) if p.strip()]
    if len(parts) >= 2:
        return parts[-1], parts[0]
    return value.strip(), ""


def build_search_plan(brief: CampaignBrief) -> dict[str, Any]:
    limits = DEPTH_LIMITS[brief.search_depth]
    planned: list[dict[str, str]] = []
    seen: set[str] = set()

    def add(query: str, market: str, customer_type: str, strategy: str) -> None:
        normalized = " ".join(query.casefold().split())
        if not normalized or normalized in seen or len(planned) >= limits["max_queries"]:
            return
        seen.add(normalized)
        planned.append(
            {
                "query": " ".join(query.split()),
                "market": market,
                "customer_type": customer_type,
                "strategy": strategy,
            }
        )

    for market in brief.target_markets:
        for product in brief.product_keywords:
            for customer_type in brief.customer_types:
                add(f"{product} {customer_type} {market}", market, customer_type, "direct_fit")
                if brief.search_depth >= 2:
                    add(
                        f"{product} importer distributor wholesaler {market}",
                        market,
                        customer_type,
                        "channel_fit",
                    )
                if brief.search_depth >= 3:
                    add(
                        f"{product} purchasing procurement buyer {market}",
                        market,
                        customer_type,
                        "procurement_signal",
                    )
                    add(
                        f"{product} trade importer company registry {market}",
                        market,
                        customer_type,
                        "registry_signal",
                    )

    legacy_markets: list[dict[str, Any]] = []
    for market in brief.target_markets:
        country, city = _market_parts(market)
        queries = [row["query"] for row in planned if row["market"] == market]
        if queries:
            legacy_markets.append({"country": country, "city": city, "queries": queries})

    return {
        "search_depth": brief.search_depth,
        "limits": limits,
        "max_customers": brief.max_customers,
        "queries": planned,
        "legacy_markets": legacy_markets,
        "paid_enrichment_default": False,
        "provider_policy": {
            "public_web": "allowed_read_only",
            "hunter": "explicit_opt_in_and_api_key",
            "apollo": "explicit_opt_in_and_api_key",
        },
    }
