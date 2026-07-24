"""Place-ID-first entity resolution / merge helpers."""

from __future__ import annotations

from typing import Any

from agents.apbd.leads.normalize import normalize_domain, normalize_name, normalize_phone
from agents.apbd.leads.repository import find_by_place_id, find_fuzzy_duplicate


def place_id_of(company: dict[str, Any]) -> str:
    loc = company.get("location") or {}
    pid = str(loc.get("google_place_id") or "").strip()
    if pid:
        return pid
    for ext in company.get("external_profiles") or []:
        if ext.get("source") == "google_places":
            return str(ext.get("external_id") or "").strip()
    return ""


def resolve_existing(companies: list[dict[str, Any]], candidate: dict[str, Any]) -> dict[str, Any] | None:
    pid = place_id_of(candidate)
    if pid:
        hit = find_by_place_id(companies, pid)
        if hit:
            return hit
    return find_fuzzy_duplicate(companies, candidate)


def merge_contact_channels(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = list(existing or [])
    seen = {(str(c.get("type")), normalize_phone(str(c.get("value") or "")) or str(c.get("value") or "").lower()) for c in out}
    for ch in incoming or []:
        key = (str(ch.get("type")), normalize_phone(str(ch.get("value") or "")) or str(ch.get("value") or "").lower())
        if key in seen or not ch.get("value"):
            continue
        seen.add(key)
        out.append(ch)
    return out


def merge_company_records(base: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Non-destructive merge; never overwrite human_locked_fields."""
    locked = set(base.get("human_locked_fields") or [])
    merged = dict(base)
    for key, val in incoming.items():
        if key in locked or key in ("id", "created_at", "human_locked_fields", "outreach_activities"):
            continue
        if key in ("contact_channels",):
            merged[key] = merge_contact_channels(base.get(key) or [], val or [])
            continue
        if key in ("services", "brands", "external_profiles", "source_urls", "contact_persons"):
            # Prefer classify merge helpers when available; else append unique
            cur = list(base.get(key) or [])
            for item in val or []:
                if item not in cur:
                    cur.append(item)
            merged[key] = cur
            continue
        if key == "chinese_relevance":
            # Keep stronger evidence (handled upstream usually)
            if not merged.get(key) or (merged.get(key) or {}).get("status") == "unknown":
                merged[key] = val
            continue
        if val in (None, "", [], {}):
            continue
        if not merged.get(key):
            merged[key] = val
    # Prefer richer location
    bloc = dict(base.get("location") or {})
    iloc = dict(incoming.get("location") or {})
    for k, v in iloc.items():
        if v and (k not in locked) and (not bloc.get(k)):
            bloc[k] = v
    merged["location"] = bloc
    merged["normalized_name"] = normalize_name(str(merged.get("display_name") or ""))
    # domain hint
    for ch in merged.get("contact_channels") or []:
        if ch.get("type") == "website":
            dom = normalize_domain(str(ch.get("value") or ""))
            if dom:
                merged.setdefault("location", {})["website_domain"] = dom
    return merged
