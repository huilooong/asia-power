"""APBD public business discovery — real sources only (HTTP/API, no browser UI)."""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

_USER_AGENT = "AsiaPower-APBD-LeadFinder/1.0 (contact: https://asia-power.com)"


def search_google_maps_places(
    query: str,
    *,
    country: str = "",
    city: str = "",
    max_results: int = 5,
) -> list[dict[str, Any]]:
    from customer_gateway.maps_prospect import _places_api_key, search_places_api

    if not _places_api_key():
        return []
    try:
        rows = search_places_api(query, country=country, city=city, max_results=max_results)
    except Exception:
        return []
    for row in rows:
        row["data_source"] = "google_maps"
        row["company_page_url"] = (row.get("maps_url") or row.get("website") or "").strip()
    return rows


def search_openstreetmap_nominatim(
    query: str,
    *,
    country: str = "",
    city: str = "",
    max_results: int = 5,
) -> list[dict[str, Any]]:
    """OpenStreetMap Nominatim — public geocoding/POI API (real listings)."""
    q = " ".join(p for p in (query, city, country) if p).strip()
    params = urllib.parse.urlencode({
        "q": q,
        "format": "json",
        "addressdetails": "1",
        "limit": max(1, min(max_results, 10)),
        "extratags": "1",
    })
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read(200_000).decode("utf-8", errors="replace"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError):
        return []

    results: list[dict[str, Any]] = []
    for item in data if isinstance(data, list) else []:
        if not isinstance(item, dict):
            continue
        name = (item.get("name") or item.get("display_name") or "").split(",")[0].strip()
        if not name or len(name) < 3:
            continue
        addr = item.get("address") or {}
        phone = (item.get("extratags") or {}).get("phone") or (item.get("extratags") or {}).get("contact:phone") or ""
        website = (item.get("extratags") or {}).get("website") or (item.get("extratags") or {}).get("contact:website") or ""
        osm_url = f"https://www.openstreetmap.org/{item.get('osm_type', 'node')}/{item.get('osm_id', '')}"
        results.append({
            "name": name,
            "address": item.get("display_name") or "",
            "phone": phone,
            "website": website,
            "email": (item.get("extratags") or {}).get("email") or (item.get("extratags") or {}).get("contact:email") or "",
            "maps_url": osm_url,
            "place_id": f"osm-{item.get('osm_type', '')}-{item.get('osm_id', '')}",
            "query": query,
            "country": country or addr.get("country") or "",
            "city": city or addr.get("city") or addr.get("town") or addr.get("state") or "",
            "source": "openstreetmap_nominatim",
            "data_source": "openstreetmap",
            "company_page_url": website or osm_url,
            "types": [(item.get("type") or ""), (item.get("class") or "")],
        })
        if len(results) >= max_results:
            break
    time.sleep(1.1)  # Nominatim usage policy
    return results


def _extract_text_fields(html: str) -> dict[str, str]:
    email_m = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", html)
    phone_m = re.search(r"\+?\d[\d\s\-()]{8,}\d", html)
    return {
        "email": email_m.group(0) if email_m else "",
        "phone": phone_m.group(0).strip() if phone_m else "",
    }


def search_yellowpages_public(
    query: str,
    *,
    country: str = "",
    city: str = "",
    max_results: int = 3,
) -> list[dict[str, Any]]:
    """Public Yellow Pages web listings (Ghana directory when available)."""
    domain_map = {
        "Ghana": "https://www.yellowpages.com.gh",
        "Nigeria": "https://www.yellowpages.com.ng",
        "Kenya": "https://www.yellowpages.co.ke",
    }
    base = domain_map.get(country, "")
    if not base:
        return []
    search_q = urllib.parse.quote(f"{query} {city}".strip())
    url = f"{base}/search?q={search_q}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read(150_000).decode("utf-8", errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return []

    results: list[dict[str, Any]] = []
    for match in re.finditer(
        r'<a[^>]+href="(/[^"]+)"[^>]*>([^<]{3,80})</a>',
        html,
        re.I,
    ):
        href, title = match.group(1), re.sub(r"\s+", " ", match.group(2)).strip()
        if any(x in title.lower() for x in ("home", "login", "advert", "yellow pages")):
            continue
        if not any(k in title.lower() for k in ("parts", "auto", "motor", "engine", "vehicle", "spare", "garage", "workshop")):
            continue
        page_url = base + href if href.startswith("/") else href
        contact = _extract_text_fields(html[match.start():match.start() + 2000])
        results.append({
            "name": title,
            "address": city,
            "phone": contact.get("phone", ""),
            "website": "",
            "email": contact.get("email", ""),
            "maps_url": page_url,
            "place_id": "",
            "query": query,
            "country": country,
            "city": city,
            "source": "yellow_pages",
            "data_source": "yellow_pages",
            "company_page_url": page_url,
            "types": ["business_directory"],
        })
        if len(results) >= max_results:
            break
    return results


def search_europages_public(
    query: str,
    *,
    country: str = "",
    city: str = "",
    max_results: int = 3,
) -> list[dict[str, Any]]:
    """Europages public search page — importer/distributor listings."""
    country_slug = {
        "Ghana": "ghana",
        "Nigeria": "nigeria",
        "Kenya": "kenya",
        "Tanzania": "tanzania",
        "UAE": "united-arab-emirates",
    }.get(country, "")
    q = urllib.parse.quote(f"{query} auto parts")
    url = f"https://www.europages.co.uk/companies/{country_slug}/auto%20parts.html" if country_slug else f"https://www.europages.co.uk/companies/auto%20parts.html?q={q}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read(200_000).decode("utf-8", errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return []

    results: list[dict[str, Any]] = []
    for match in re.finditer(r'data-company-name="([^"]+)"[^>]*data-company-url="([^"]+)"', html):
        name, rel = match.group(1).strip(), match.group(2).strip()
        if len(name) < 3:
            continue
        page_url = rel if rel.startswith("http") else f"https://www.europages.co.uk{rel}"
        results.append({
            "name": name,
            "address": country,
            "phone": "",
            "website": "",
            "email": "",
            "maps_url": page_url,
            "place_id": "",
            "query": query,
            "country": country,
            "city": "",
            "source": "europages",
            "data_source": "europages",
            "company_page_url": page_url,
            "types": ["importer", "distributor"],
        })
        if len(results) >= max_results:
            break
    return results


PUBLIC_SOURCE_SEARCHERS = [
    ("google_maps", search_google_maps_places),
    ("openstreetmap", search_openstreetmap_nominatim),
    ("yellow_pages", search_yellowpages_public),
    ("europages", search_europages_public),
]
