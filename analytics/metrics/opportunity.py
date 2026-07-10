"""Sales pipeline opportunity metrics (APSALES-101)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from domain.opportunity import service as svc


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _is_today(iso_ts: str) -> bool:
    return bool(iso_ts) and iso_ts[:10] == _today_utc()


def _is_overdue(follow_up_at: str | None) -> bool:
    if not follow_up_at:
        return False
    try:
        due = datetime.fromisoformat(follow_up_at.replace("Z", "+00:00"))
    except ValueError:
        return False
    return due <= datetime.now(timezone.utc)


def compute_sales_pipeline_metrics() -> dict[str, Any]:
    open_opps = svc.list_open(limit=10_000)
    closed_opps = svc.list_closed(limit=10_000)

    new_leads = sum(
        1 for o in open_opps
        if o.get("sales_stage") == "Lead" and _is_today(o.get("created_at") or "")
    )
    qualified = sum(1 for o in open_opps if o.get("sales_stage") == "Qualified")
    quoted = sum(
        1 for o in open_opps
        if (o.get("quote") or {}).get("status") == "sent"
        or o.get("sales_stage") == "Quoted"
    )
    won = sum(1 for o in closed_opps if (o.get("outcome") or {}).get("result") == "won")
    lost = sum(1 for o in closed_opps if (o.get("outcome") or {}).get("result") == "lost")
    pending = sum(
        1 for o in open_opps
        if _is_overdue(o.get("follow_up_at")) or o.get("next_action")
    )
    urgent = sum(
        1 for o in open_opps
        if o.get("urgency") == "critical"
        or (_is_overdue(o.get("follow_up_at")) and o.get("urgency") in {"high", "critical"})
    )
    expected_revenue = sum(
        float(o.get("expected_revenue") or 0)
        for o in open_opps
        if (o.get("outcome") or {}).get("result") == "open"
    )

    return {
        "new_leads": new_leads,
        "qualified": qualified,
        "quoted": quoted,
        "won": won,
        "lost": lost,
        "pending": pending,
        "urgent": urgent,
        "expected_revenue": round(expected_revenue, 2),
        "open_count": len(open_opps),
        "closed_count": len(closed_opps),
    }
