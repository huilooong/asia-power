"""Thin Places adapter over customer_gateway.maps_prospect — no Maps HTML scrape."""

from __future__ import annotations

import time
import uuid
from typing import Any

from agents.apbd.leads.normalize import normalize_name
from agents.apbd.leads.repository import (
    find_by_place_id,
    load_companies,
    new_company_shell,
    save_raw_place,
    save_search_task,
    upsert_company,
)


class PlacesConfigError(RuntimeError):
    """Raised when Places API key is missing — explicit failure, no scrape fallback."""


class PlacesQuotaError(RuntimeError):
    """Raised when Places daily quota is exhausted."""


def require_places_key() -> str:
    from customer_gateway.maps_prospect import _places_api_key

    key = _places_api_key()
    if not key:
        raise PlacesConfigError(
            "missing_places_api_key: set GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY. "
            "Will not scrape Google Maps HTML."
        )
    return key


def check_quota() -> dict[str, Any]:
    require_places_key()
    from customer_gateway.maps_prospect import check_places_api_quota

    status = check_places_api_quota()
    if status.get("quota_exhausted"):
        raise PlacesQuotaError(str(status.get("error") or "quota_exhausted"))
    return status


def search_text(
    query: str,
    *,
    country: str = "CA",
    city: str = "",
    max_results: int = 8,
) -> list[dict[str, Any]]:
    require_places_key()
    from customer_gateway.maps_prospect import search_places_api

    try:
        return search_places_api(query, country=country, city=city, max_results=max_results)
    except Exception as exc:
        msg = str(exc)
        if "429" in msg or "Quota exceeded" in msg:
            raise PlacesQuotaError(msg) from exc
        raise


def place_row_to_company(row: dict[str, Any], *, country_code: str = "CA") -> dict[str, Any]:
    company = new_company_shell(country_code=country_code)
    name = str(row.get("name") or "").strip()
    company["display_name"] = name
    company["legal_name"] = name
    company["normalized_name"] = normalize_name(name)
    place_id = str(row.get("place_id") or "").strip()
    address = str(row.get("address") or "").strip()
    city = str(row.get("city") or "").strip()
    company["location"] = {
        "country_code": country_code,
        "city": city,
        "address": address,
        "google_place_id": place_id,
        "google_maps_url": str(row.get("maps_url") or ""),
    }
    channels: list[dict[str, Any]] = []
    if row.get("phone"):
        channels.append({"type": "phone", "value": str(row["phone"]), "source": "google_places"})
    if row.get("website"):
        channels.append({"type": "website", "value": str(row["website"]), "source": "google_places"})
    if row.get("email"):
        channels.append({"type": "email", "value": str(row["email"]), "source": "google_places"})
    company["contact_channels"] = channels
    company["external_profiles"] = [
        {
            "source": "google_places",
            "external_id": place_id,
            "url": str(row.get("maps_url") or ""),
            "meta": {
                "rating": row.get("rating"),
                "types": row.get("types") or [],
                "query": row.get("query") or "",
            },
        }
    ]
    if row.get("maps_url"):
        company["source_urls"] = [str(row["maps_url"])]
    company["status"] = "discovered"
    return company


def ingest_place_rows(
    rows: list[dict[str, Any]],
    *,
    country_code: str = "CA",
    task_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Upsert by Place ID; skip duplicates. Persist raw payloads when place_id present."""
    companies = load_companies()
    added = 0
    duplicates = 0
    for row in rows:
        pid = str(row.get("place_id") or "").strip()
        if pid:
            save_raw_place(pid, row)
            if find_by_place_id(companies, pid):
                duplicates += 1
                continue
        company = place_row_to_company(row, country_code=country_code)
        upsert_company(company, source="places_discover")
        companies.append(company)
        added += 1

    task = {
        "task_id": f"task-{uuid.uuid4().hex[:10]}",
        "kind": "places_discover",
        "country": country_code,
        "added": added,
        "duplicates": duplicates,
        "queried": len(rows),
        **(task_meta or {}),
    }
    save_search_task(task)
    return task


def discover_query(
    query: str,
    *,
    country: str = "CA",
    city: str = "",
    max_results: int = 8,
    sleep_s: float = 0.0,
) -> dict[str, Any]:
    rows = search_text(query, country=country, city=city, max_results=max_results)
    if sleep_s > 0:
        time.sleep(sleep_s)
    return ingest_place_rows(
        rows,
        country_code=country,
        task_meta={"query": query, "city": city},
    )
