"""Shared query API for growth (APBD) and sales (apsales / outreach)."""

from __future__ import annotations

from typing import Any

from agents.apbd.leads.repository import list_companies


def query_leads(
    *,
    country: str = "CA",
    city: str = "",
    status: str = "",
    priority: str = "",
    chinese: str = "",
    min_score: float | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    return list_companies(
        country=country,
        city=city,
        status=status,
        priority=priority,
        chinese=chinese,
        min_score=min_score,
        limit=limit,
    )


def approved_for_outreach(
    *,
    country: str = "CA",
    city: str = "",
    priority: str = "",
    limit: int = 30,
) -> list[dict[str, Any]]:
    """Sales-facing: only human-approved leads."""
    return query_leads(
        country=country,
        city=city,
        status="approved_for_outreach",
        priority=priority,
        limit=limit,
    )


def to_outreach_candidate(company: dict[str, Any]) -> dict[str, Any]:
    channels = company.get("contact_channels") or []
    email = next((c.get("value") for c in channels if c.get("type") == "email"), "")
    phone = next((c.get("value") for c in channels if c.get("type") == "phone"), "")
    website = next((c.get("value") for c in channels if c.get("type") == "website"), "")
    loc = company.get("location") or {}
    brands = ", ".join(str(b.get("brand_code") or "") for b in (company.get("brands") or [])[:4])
    services = ", ".join(str(s.get("service_code") or "") for s in (company.get("services") or [])[:4])
    product = brands or services or "used engines / transmissions"
    pri = str(company.get("priority") or "C")
    return {
        "candidate_id": f"apbd-{company.get('id')}",
        "source": "apbd_leads",
        "name": company.get("display_name") or "",
        "company": company.get("display_name") or "",
        "country": company.get("country_code") or "CA",
        "city": loc.get("city") or "",
        "email": email or "",
        "phone": phone or "",
        "website": website or "",
        "product": product,
        "channel": "email" if email else ("phone" if phone else "research"),
        "reason": (
            f"APBD approved lead · priority {pri} · score {company.get('score')} · "
            f"{loc.get('city') or ''} · chinese={(company.get('chinese_relevance') or {}).get('status')}"
        ),
        "priority": "high" if pri == "A" else ("medium" if pri == "B" else "low"),
        "ref_id": company.get("id"),
        "google_place_id": loc.get("google_place_id") or "",
        "score": company.get("score"),
        "apbd_status": company.get("status"),
    }
