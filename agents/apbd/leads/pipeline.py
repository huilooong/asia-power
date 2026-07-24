"""Discover → enrich → score → review pipeline for APBD leads."""

from __future__ import annotations

from typing import Any

from agents.apbd.leads.adapters.places import (
    PlacesConfigError,
    PlacesQuotaError,
    discover_query,
    require_places_key,
)
from agents.apbd.leads.adapters.website import enrich_company_from_website
from agents.apbd.leads.market_config import load_markets
from agents.apbd.leads.repository import list_companies, load_companies, upsert_company
from agents.apbd.leads.review_queue import enqueue_needs_review, maybe_auto_status
from agents.apbd.leads.scoring import apply_score
from agents.apbd.leads.search_planner import plan_queries


def run_discover(
    *,
    country: str = "CA",
    city: str = "",
    region_id: str = "",
    limit: int = 20,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Run Places discovery for a city/region. Hard-fails without API key (except dry-run)."""
    markets = load_markets()
    defaults = markets.get("search_defaults") or {}
    max_new = int(defaults.get("max_new_leads_per_run") or 40)
    # Limit queries so we don't burn quota chasing one city
    q_limit = max(1, min(15, (limit // 4) + 1 if limit else 8))
    plans = plan_queries(country_code=country, city=city, region_id=region_id, limit_queries=q_limit)

    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "planned_queries": len(plans),
            "queries": [p["query"] for p in plans[:20]],
            "added": 0,
        }

    try:
        require_places_key()
    except PlacesConfigError as exc:
        return {"ok": False, "error": str(exc), "error_code": "missing_places_api_key", "added": 0}

    added = 0
    duplicates = 0
    queries_run = 0
    errors: list[str] = []
    quota_hit = False

    for plan in plans:
        if added >= limit or added >= max_new:
            break
        try:
            task = discover_query(
                plan["query"],
                country=country,
                city=str(plan.get("city") or city or ""),
                max_results=min(int(plan.get("max_results") or 8), limit - added),
                sleep_s=float(plan.get("sleep_s") or 0),
            )
            queries_run += 1
            added += int(task.get("added") or 0)
            duplicates += int(task.get("duplicates") or 0)
        except PlacesQuotaError as exc:
            quota_hit = True
            errors.append(str(exc))
            break
        except PlacesConfigError as exc:
            return {"ok": False, "error": str(exc), "error_code": "missing_places_api_key", "added": added}
        except Exception as exc:
            errors.append(str(exc)[:200])
            continue

    return {
        "ok": not quota_hit,
        "added": added,
        "duplicates": duplicates,
        "queries_run": queries_run,
        "planned_queries": len(plans),
        "quota_exhausted": quota_hit,
        "errors": errors[:10],
        "country": country,
        "city": city,
    }


def run_enrich(*, country: str = "CA", city: str = "", limit: int = 50) -> dict[str, Any]:
    rows = list_companies(country=country, city=city, status="discovered", limit=limit)
    # Also re-enrich recently discovered without website pass
    if len(rows) < limit:
        more = [
            c
            for c in list_companies(country=country, city=city, limit=limit * 2)
            if c.get("status") in ("discovered", "enriched") and not any(
                ch.get("type") == "email" for ch in (c.get("contact_channels") or [])
            )
        ]
        seen = {c["id"] for c in rows}
        for c in more:
            if c["id"] not in seen:
                rows.append(c)
            if len(rows) >= limit:
                break

    enriched = 0
    for company in rows[:limit]:
        updated = enrich_company_from_website(company)
        apply_score(updated)
        maybe_auto_status(updated)
        upsert_company(updated, source="website_enrich")
        enriched += 1
    return {"ok": True, "enriched": enriched, "country": country, "city": city}


def run_score(*, country: str = "CA", limit: int = 0) -> dict[str, Any]:
    companies = list_companies(country=country, limit=limit or 0)
    n = 0
    for company in companies:
        apply_score(company)
        maybe_auto_status(company)
        upsert_company(company, source="rescore")
        n += 1
    return {"ok": True, "scored": n}


def run_review_enqueue(*, country: str = "CA", min_score: float = 55.0, limit: int = 50) -> dict[str, Any]:
    companies = list_companies(country=country, min_score=min_score, limit=limit)
    queued = 0
    for company in companies:
        if company.get("status") in ("approved_for_outreach", "rejected", "verified"):
            continue
        if company.get("priority") in ("A", "B") or float(company.get("score") or 0) >= min_score:
            company["status"] = "needs_review"
            upsert_company(company, source="review_enqueue")
            enqueue_needs_review(company)
            queued += 1
    return {"ok": True, "queued": queued}


def ingest_fixture_companies(companies: list[dict[str, Any]]) -> dict[str, Any]:
    """Load fixture companies through enrich/score path without Places."""
    from agents.apbd.leads.chinese_evidence import apply_chinese_relevance, scan_text_for_chinese_evidence
    from agents.apbd.leads.classify_services import classify_from_text, infer_business_type, merge_brands, merge_services

    added = 0
    for raw in companies:
        company = dict(raw)
        blob = " ".join(
            [
                str(company.get("display_name") or ""),
                str(company.get("description") or ""),
                str(company.get("fixture_website_text") or ""),
            ]
        )
        services, brands, flags = classify_from_text(blob, source_url=str(company.get("fixture_url") or ""))
        company["services"] = merge_services(company.get("services") or [], services)
        company["brands"] = merge_brands(company.get("brands") or [], brands)
        company["classification_flags"] = sorted(set(flags))
        company["business_type"] = infer_business_type(company, company.get("classification_flags"))
        ev = scan_text_for_chinese_evidence(blob, source_url=str(company.get("fixture_url") or ""))
        # Explicit: Chinese-looking name alone must stay unknown
        if company.get("fixture_force_chinese_unknown"):
            company["chinese_relevance"] = {
                "status": "unknown",
                "evidence_type": "",
                "evidence_text": "",
                "evidence_url": "",
                "confidence": 0.0,
                "reviewed_by": "",
                "reviewed_at": "",
            }
        else:
            company = apply_chinese_relevance(company, ev)
            company = apply_chinese_relevance(company, None)
        apply_score(company)
        maybe_auto_status(company)
        upsert_company(company, source="fixture")
        added += 1
    return {"ok": True, "added": added, "total": len(load_companies())}
