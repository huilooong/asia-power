"""Bridge solo-trade campaign leads into the canonical APBD company repository."""

from __future__ import annotations

from typing import Any

from agents.apbd.leads.normalize import normalize_domain, normalize_name, normalize_phone
from agents.apbd.leads.repository import load_companies, new_company_shell, upsert_company
from agents.apbd.solo_trade.models import utc_now_iso


COUNTRY_CODES = {
    "canada": "CA",
    "ghana": "GH",
    "nigeria": "NG",
    "venezuela": "VE",
}


def _country_code(lead: dict[str, Any]) -> str:
    explicit = str(lead.get("country_code") or "").strip().upper()
    if len(explicit) == 2:
        return explicit
    return COUNTRY_CODES.get(str(lead.get("country") or "").strip().casefold(), "")


def _website_domain(lead: dict[str, Any]) -> str:
    raw = str(lead.get("website") or "").strip()
    if not raw or raw == "Not published":
        return ""
    return normalize_domain(raw)


def _company_domain(company: dict[str, Any]) -> str:
    stored = str((company.get("location") or {}).get("website_domain") or "").strip().casefold()
    if stored:
        return stored.removeprefix("www.")
    for channel in company.get("contact_channels") or []:
        if channel.get("type") == "website" and channel.get("value"):
            return normalize_domain(str(channel["value"]))
    return ""


def find_existing_company(companies: list[dict[str, Any]], lead: dict[str, Any]) -> dict[str, Any] | None:
    linked_id = str(lead.get("apbd_company_id") or "").strip()
    if linked_id:
        linked = next((row for row in companies if str(row.get("id") or "") == linked_id), None)
        if linked:
            return linked

    domain = _website_domain(lead)
    if domain:
        by_domain = next((row for row in companies if _company_domain(row) == domain), None)
        if by_domain:
            return by_domain

    phone = normalize_phone(str(lead.get("public_phone") or ""))
    name = normalize_name(str(lead.get("company") or lead.get("display_name") or ""))
    city = str(lead.get("city") or "").strip().casefold()
    country = _country_code(lead)
    for company in companies:
        if country and str(company.get("country_code") or "").upper() != country:
            continue
        if phone:
            for channel in company.get("contact_channels") or []:
                if channel.get("type") == "phone" and normalize_phone(str(channel.get("value") or "")) == phone:
                    return company
        company_name = normalize_name(str(company.get("display_name") or company.get("legal_name") or ""))
        company_city = str((company.get("location") or {}).get("city") or "").strip().casefold()
        if name and company_name == name and city and company_city == city:
            return company
    return None


def _contact_channels(lead: dict[str, Any], existing: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged = [dict(row) for row in existing if isinstance(row, dict)]
    index_by_key = {
        (str(row.get("type") or "").casefold(), str(row.get("value") or "").strip().casefold()): index
        for index, row in enumerate(merged)
        if str(row.get("value") or "").strip()
    }

    candidates: list[dict[str, Any]] = []
    website = str(lead.get("website") or "").strip()
    if website and website != "Not published":
        candidates.append({"type": "website", "value": website, "source": lead.get("data_source") or "solo_trade"})
    email = str(lead.get("public_email") or "").strip()
    if email and email != "Not published":
        candidates.append(
            {
                "type": "email",
                "value": email,
                "source": lead.get("public_email_source") or lead.get("data_source") or "solo_trade",
                "verified": str(lead.get("public_email_source") or "").startswith("hunter_verified"),
            }
        )
    phone = str(lead.get("public_phone") or "").strip()
    if phone and phone != "Not published":
        candidates.append({"type": "phone", "value": phone, "source": lead.get("data_source") or "solo_trade"})
    candidates.extend(dict(row) for row in (lead.get("contacts") or []) if isinstance(row, dict))

    for row in candidates:
        value = str(row.get("value") or "").strip()
        key = (str(row.get("type") or "").casefold(), value.casefold())
        if not value:
            continue
        if key in index_by_key:
            current = merged[index_by_key[key]]
            for field in (
                "verified",
                "verification_status",
                "verification_score",
                "verification_provider",
                "confidence",
                "name",
                "position",
                "evidence_url",
            ):
                if row.get(field) not in (None, ""):
                    current[field] = row[field]
            if row.get("provider"):
                current["enrichment_provider"] = row["provider"]
            continue
        index_by_key[key] = len(merged)
        merged.append(row)
    return merged


def lead_to_apbd_company(
    lead: dict[str, Any],
    *,
    campaign_id: str,
    existing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    company = dict(existing) if existing else new_company_shell(country_code=_country_code(lead))
    name = str(lead.get("company") or lead.get("display_name") or "").strip()
    if not name:
        raise ValueError("Cannot sync a lead without a company name")

    company["display_name"] = name
    company["legal_name"] = str(company.get("legal_name") or name)
    company["normalized_name"] = normalize_name(name)
    if _country_code(lead):
        company["country_code"] = _country_code(lead)
    location = dict(company.get("location") or {})
    for source_key, target_key in (("city", "city"), ("address", "address"), ("place_id", "google_place_id")):
        value = str(lead.get(source_key) or "").strip()
        if value:
            location[target_key] = value
    domain = _website_domain(lead)
    if domain:
        location["website_domain"] = domain
    company["location"] = location
    if lead.get("business_type"):
        company["business_type"] = lead["business_type"]
    if lead.get("description"):
        company["description"] = lead["description"]
    company["contact_channels"] = _contact_channels(lead, list(company.get("contact_channels") or []))

    source_urls = list(company.get("source_urls") or [])
    for value in [lead.get("source_url"), lead.get("company_page_url"), lead.get("website")]:
        url = str(value or "").strip()
        if url and url != "Not published" and url not in source_urls:
            source_urls.append(url)
    company["source_urls"] = source_urls

    refs = [dict(row) for row in (company.get("apbd_campaign_refs") or []) if isinstance(row, dict)]
    ref = next((row for row in refs if row.get("campaign_id") == campaign_id), None)
    if ref is None:
        ref = {"campaign_id": campaign_id, "lead_id": lead.get("lead_id"), "linked_at": utc_now_iso()}
        refs.append(ref)
    else:
        ref["lead_id"] = lead.get("lead_id")
        ref["updated_at"] = utc_now_iso()
    company["apbd_campaign_refs"] = refs

    if not existing:
        company["status"] = "enriched" if lead.get("status") != "new" else "discovered"
    company["last_verified_at"] = str(lead.get("discovered_at") or company.get("last_verified_at") or "")
    return company


def sync_campaign_to_apbd(campaign: dict[str, Any], *, lead_id: str = "") -> dict[str, Any]:
    campaign_id = str(campaign.get("campaign_id") or "").strip()
    if not campaign_id:
        raise ValueError("Campaign ID is required")
    companies = load_companies()
    targets = [
        row
        for row in (campaign.get("leads") or [])
        if isinstance(row, dict) and (not lead_id or str(row.get("lead_id") or "") == lead_id)
    ]
    if lead_id and not targets:
        raise ValueError(f"Lead not found: {lead_id}")

    created = 0
    updated = 0
    links: list[dict[str, str]] = []
    for lead in targets:
        existing = find_existing_company(companies, lead)
        company = lead_to_apbd_company(lead, campaign_id=campaign_id, existing=existing)
        saved = upsert_company(company, source="solo_trade_bridge")
        if existing:
            updated += 1
        else:
            created += 1
            companies.append(saved)
        lead["apbd_company_id"] = saved["id"]
        lead["apbd_linked_at"] = utc_now_iso()
        links.append({"lead_id": str(lead.get("lead_id") or ""), "apbd_company_id": str(saved["id"])})
    return {"linked": len(links), "created": created, "updated": updated, "links": links}
