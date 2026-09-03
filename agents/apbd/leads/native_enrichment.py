"""First-party APBD contact intelligence with explicit evidence boundaries.

This module validates contacts already observed on public pages.  It never
guesses an address, probes an SMTP recipient, or marks a contact send-ready.
"""

from __future__ import annotations

import re
import socket
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Callable
from urllib.parse import urlparse

from agents.apbd.leads.normalize import clean_public_email, normalize_domain

NATIVE_ENRICHMENT_VERSION = "apbd-native-enrichment-v1"

FREE_MAIL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "hotmail.com",
    "hotmail.ca",
    "hotmail.es",
    "live.com",
    "live.ca",
    "outlook.com",
    "yahoo.com",
    "yahoo.ca",
    "yahoo.es",
    "icloud.com",
    "proton.me",
    "protonmail.com",
}

ROLE_LOCAL_PARTS = {
    "admin",
    "administracion",
    "atencion",
    "compras",
    "contact",
    "contacto",
    "hello",
    "hola",
    "info",
    "operaciones",
    "operations",
    "parts",
    "procurement",
    "purchasing",
    "repuestos",
    "sales",
    "service",
    "ventas",
}

DECISION_ROLE_RE = re.compile(
    r"\b(owner|co[- ]?owner|founder|president|ceo|chief executive|director|"
    r"general manager|operations manager|parts manager|purchasing manager|"
    r"procurement manager|service manager|propietari[oa]|fundador|director|"
    r"gerente(?: general| de compras| de repuestos)?)\b",
    re.I,
)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _email_domain(email: str) -> str:
    return email.rsplit("@", 1)[1].lower() if "@" in email else ""


def _official_domain(company: dict[str, Any]) -> str:
    location_domain = normalize_domain(str((company.get("location") or {}).get("website_domain") or ""))
    if location_domain:
        return location_domain
    for channel in company.get("contact_channels") or []:
        if channel.get("type") == "website" and channel.get("value"):
            domain = normalize_domain(str(channel["value"]))
            if domain:
                return domain
    return ""


@lru_cache(maxsize=2048)
def resolve_public_domain(domain: str) -> str:
    """Return web-DNS reachability only; this is not mailbox verification."""
    clean = str(domain or "").strip().lower().rstrip(".")
    if not clean:
        return "not_checked"
    try:
        socket.getaddrinfo(clean, 443, type=socket.SOCK_STREAM)
        return "resolves"
    except (socket.gaierror, TimeoutError, OSError):
        return "unresolved"


def _mailbox_kind(local_part: str) -> str:
    local = re.sub(r"[._+-].*$", "", local_part.lower())
    return "role_mailbox" if local in ROLE_LOCAL_PARTS else "named_or_other_mailbox"


def _email_validation(
    email: str,
    official_domain: str,
    resolver: Callable[[str], str],
) -> dict[str, Any]:
    domain = _email_domain(email)
    exact_official = bool(official_domain and domain == official_domain)
    if exact_official:
        relationship = "official_domain"
    elif domain in FREE_MAIL_DOMAINS:
        relationship = "public_free_mailbox"
    else:
        relationship = "other_domain"
    return {
        "version": NATIVE_ENRICHMENT_VERSION,
        "format_valid": True,
        "domain_status": resolver(domain),
        "official_domain_match": exact_official,
        "domain_relationship": relationship,
        "mailbox_kind": _mailbox_kind(email.split("@", 1)[0]),
        "deliverability_status": "unknown_not_smtp_verified",
        "send_eligible": False,
    }


def _person_has_public_evidence(person: dict[str, Any]) -> bool:
    name = str(person.get("name") or "").strip()
    title = str(person.get("title") or person.get("role") or "").strip()
    evidence_url = str(person.get("evidence_url") or "").strip()
    evidence_text = str(person.get("evidence_text") or "").strip()
    source = str(person.get("source") or "")
    return bool(
        len(name.split()) >= 2
        and DECISION_ROLE_RE.search(title)
        and evidence_url.startswith(("http://", "https://"))
        and (evidence_text or source == "official_website_jsonld")
    )


def _safe_pattern_hypotheses(company: dict[str, Any], official_domain: str) -> list[dict[str, Any]]:
    """Describe possible patterns, never materialize guessed email addresses."""
    if not official_domain:
        return []
    rows: list[dict[str, Any]] = []
    for person in company.get("contact_persons") or []:
        if not isinstance(person, dict) or not _person_has_public_evidence(person):
            continue
        rows.append(
            {
                "person_name": str(person.get("name") or "").strip(),
                "role": str(person.get("title") or person.get("role") or "").strip(),
                "domain": official_domain,
                "candidate_patterns": ["first.last", "first", "first_initial.last"],
                "actual_email_generated": False,
                "requires_public_email_evidence": True,
                "send_eligible": False,
            }
        )
    return rows


def enrich_company_native(
    company: dict[str, Any],
    *,
    resolver: Callable[[str], str] = resolve_public_domain,
) -> tuple[dict[str, Any], dict[str, int]]:
    """Attach first-party validation to public contacts without changing vendor truth."""
    official_domain = _official_domain(company)
    channels: list[dict[str, Any]] = []
    counters = {
        "public_emails_checked": 0,
        "official_domain_emails": 0,
        "free_mailboxes": 0,
        "other_domain_emails": 0,
        "unresolved_domains": 0,
        "role_mailboxes": 0,
        "named_people_with_evidence": 0,
        "email_pattern_hypotheses": 0,
        "send_eligible": 0,
    }
    seen_emails: set[str] = set()

    for original in company.get("contact_channels") or []:
        channel = dict(original)
        if channel.get("type") != "email":
            channels.append(channel)
            continue
        raw = str(channel.get("value") or "")
        email = clean_public_email(raw)
        if not email or email in seen_emails:
            channel["native_validation"] = {
                "version": NATIVE_ENRICHMENT_VERSION,
                "format_valid": False,
                "domain_status": "not_checked",
                "deliverability_status": "unknown_not_smtp_verified",
                "send_eligible": False,
            }
            channels.append(channel)
            continue
        seen_emails.add(email)
        channel["value"] = email
        validation = _email_validation(email, official_domain, resolver)
        channel["native_validation"] = validation
        channels.append(channel)
        counters["public_emails_checked"] += 1
        relationship = validation["domain_relationship"]
        if relationship == "official_domain":
            counters["official_domain_emails"] += 1
        elif relationship == "public_free_mailbox":
            counters["free_mailboxes"] += 1
        else:
            counters["other_domain_emails"] += 1
        counters["unresolved_domains"] += int(validation["domain_status"] == "unresolved")
        counters["role_mailboxes"] += int(validation["mailbox_kind"] == "role_mailbox")

    company["contact_channels"] = channels
    hypotheses = _safe_pattern_hypotheses(company, official_domain)
    counters["named_people_with_evidence"] = len(hypotheses)
    counters["email_pattern_hypotheses"] = len(hypotheses)
    company["native_enrichment"] = {
        "version": NATIVE_ENRICHMENT_VERSION,
        "status": "complete",
        "checked_at": _now(),
        "official_domain": official_domain,
        "summary": dict(counters),
        "pattern_hypotheses": hypotheses,
        "smtp_recipient_probe_used": False,
        "guessed_emails_generated": False,
        "outreach_sent": False,
    }
    return company, counters
