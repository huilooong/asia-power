"""Re-verification cycle + coverage / cost reporting."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agents.apbd.leads.adapters.website import enrich_company_from_website
from agents.apbd.leads.market_config import get_country, load_markets, load_scoring
from agents.apbd.leads.repository import (
    count_by_region,
    iter_needing_refresh,
    list_companies,
    upsert_company,
)
from agents.apbd.leads.scoring import apply_score

ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = ROOT / "runtime" / "apbd" / "leads" / "reports"


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def refresh_stale(*, country: str = "CA", limit: int = 40) -> dict[str, Any]:
    scoring = load_scoring()
    refresh_days = scoring.get("refresh_days") or {}
    # Use B-band default (60) as floor; priority-specific handled by older_than
    refreshed = 0
    skipped = 0
    for company in list(iter_needing_refresh(older_than_days=30)):
        if str(company.get("country_code") or "").upper() != country.upper():
            continue
        pri = str(company.get("priority") or "C")
        days = int(refresh_days.get(pri) or refresh_days.get("C") or 120)
        # Re-check age against band
        from agents.apbd.leads.repository import iter_needing_refresh as _ign  # noqa: F401

        # Simple: if priority A use 30 already; we already pulled older_than 30
        if pri in ("C", "D") and refreshed > limit // 2:
            # Prefer A/B first — skip some C/D when budget tight
            skipped += 1
            continue
        if refreshed >= limit:
            break
        updated = enrich_company_from_website(company)
        apply_score(updated)
        updated["last_verified_at"] = _now()
        if updated.get("status") == "stale":
            updated["status"] = "enriched"
        upsert_company(updated, source="refresh")
        refreshed += 1
    return {"ok": True, "refreshed": refreshed, "skipped": skipped, "country": country}


def coverage_report(*, country: str = "CA") -> dict[str, Any]:
    markets = load_markets()
    cfg = get_country(markets, country)
    companies = [c for c in list_companies(country=country) if c.get("status") != "rejected"]
    counts = count_by_region(country)
    with_phone = sum(
        1
        for c in companies
        if any(ch.get("type") == "phone" for ch in (c.get("contact_channels") or []))
    )
    with_web = sum(
        1
        for c in companies
        if any(ch.get("type") == "website" for ch in (c.get("contact_channels") or []))
    )
    with_email = sum(
        1
        for c in companies
        if any(ch.get("type") == "email" for ch in (c.get("contact_channels") or []))
    )
    scored = sum(1 for c in companies if c.get("score") is not None)
    approved = sum(1 for c in companies if c.get("status") == "approved_for_outreach")
    chinese_confirmed = sum(
        1
        for c in companies
        if (c.get("chinese_relevance") or {}).get("status")
        in ("confirmed_chinese_service", "confirmed_chinese_business")
    )
    by_priority: dict[str, int] = {}
    for c in companies:
        p = str(c.get("priority") or "?")
        by_priority[p] = by_priority.get(p, 0) + 1

    target = int(cfg.get("target_total") or 500)
    report = {
        "generated_at": _now(),
        "country": country,
        "target_total": target,
        "valid_total": len(companies),
        "gap_to_target": max(0, target - len(companies)),
        "region_counts": counts,
        "region_targets": {
            str(r.get("id")): int(r.get("target") or 0) for r in (cfg.get("regions") or [])
        },
        "coverage": {
            "phone_pct": round(100 * with_phone / len(companies), 1) if companies else 0,
            "website_pct": round(100 * with_web / len(companies), 1) if companies else 0,
            "email_pct": round(100 * with_email / len(companies), 1) if companies else 0,
            "scored_pct": round(100 * scored / len(companies), 1) if companies else 0,
        },
        "counts": {
            "with_phone": with_phone,
            "with_website": with_web,
            "with_email": with_email,
            "scored": scored,
            "approved_for_outreach": approved,
            "chinese_confirmed": chinese_confirmed,
            "by_priority": by_priority,
        },
        "cost_notes": {
            "places_key_policy": "free_demo_key_only",
            "no_maps_html_scrape": True,
            "quota_behavior": "stop_and_report_when_429",
        },
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORT_DIR / f"coverage-{country.lower()}-{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report["path"] = str(path)
    return report
