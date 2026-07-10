"""Traffic source metrics for SEO analytics (APSALES-101)."""

from __future__ import annotations

from collections import Counter
from typing import Any

from domain.opportunity import service as svc


def _group_counter(opps: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for opp in opps:
        traffic = opp.get("traffic") or {}
        value = (traffic.get(key) or "").strip() or "(none)"
        counts[value] += 1
    return dict(counts)


def compute_traffic_metrics() -> dict[str, Any]:
    opps = svc.load_all()
    by_landing = _group_counter(opps, "landing_page")
    by_engine = _group_counter(opps, "engine_slug")
    by_campaign = _group_counter(opps, "utm_campaign")
    by_channel = _group_counter(opps, "entry_channel")
    total = sum(by_channel.values()) or 1
    organic = by_channel.get("organic", 0)
    paid = by_channel.get("paid", 0)
    return {
        "inquiries_by_landing_page": by_landing,
        "inquiries_by_engine_slug": by_engine,
        "inquiries_by_utm_campaign": by_campaign,
        "inquiries_by_entry_channel": by_channel,
        "organic_vs_paid_ratio": {
            "organic": round(organic / total, 4),
            "paid": round(paid / total, 4),
            "other": round((total - organic - paid) / total, 4),
        },
    }
