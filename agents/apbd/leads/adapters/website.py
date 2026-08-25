"""Public website enrichment with evidence, bounded timeouts, and no invented contacts."""

from __future__ import annotations

import html as html_lib
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from functools import lru_cache
from html.parser import HTMLParser
from typing import Any, Iterable
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

from agents.apbd.leads.chinese_evidence import apply_chinese_relevance, scan_text_for_chinese_evidence
from agents.apbd.leads.classify_services import (
    classify_from_text,
    infer_business_type,
    merge_brands,
    merge_services,
)
from agents.apbd.leads.normalize import clean_public_email, extract_emails, normalize_domain

_UA = "AsiaPower-APBD-LeadEnrich/1.1 (+https://asia-power.com; public-business-research)"
_CONTACT_PATHS = (
    "/",
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/team",
    "/our-team",
    "/staff",
    "/management",
)
_LINKEDIN_RE = re.compile(
    r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/(?:company|in)/[^\s\"'<>?#]+",
    re.I,
)
_JSONLD_RE = re.compile(
    r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.I | re.S,
)
_DECISION_ROLE_RE = re.compile(
    r"\b(owner|co[- ]?owner|founder|president|chief executive|ceo|director|general manager|"
    r"operations manager|parts manager|purchasing manager|procurement manager|service manager)\b",
    re.I,
)


class _RedirectHandler(urllib.request.HTTPRedirectHandler):
    """Add explicit HTTP 308 support for older urllib behavior."""

    def http_error_308(self, req: Any, fp: Any, code: int, msg: str, headers: Any) -> Any:
        return self.http_error_302(req, fp, code, msg, headers)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style", "noscript"):
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript") and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if not self._skip_depth and data and data.strip():
            self._chunks.append(data.strip())

    def text(self) -> str:
        return " ".join(self._chunks)


@lru_cache(maxsize=1024)
def _robots_parser(origin: str) -> RobotFileParser | None:
    """Fetch robots.txt once per origin with a short timeout."""
    robots_url = origin.rstrip("/") + "/robots.txt"
    try:
        req = urllib.request.Request(robots_url, headers={"User-Agent": _UA})
        with urllib.request.urlopen(req, timeout=4) as resp:
            raw = resp.read(300_000).decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return None
    parser = RobotFileParser()
    parser.set_url(robots_url)
    parser.parse(raw.splitlines())
    return parser


def _allowed_by_robots(url: str) -> bool:
    try:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        parser = _robots_parser(origin)
        return True if parser is None else parser.can_fetch(_UA, url)
    except Exception:
        return True


def fetch_url(url: str, *, timeout: int = 8) -> dict[str, Any]:
    if not url.startswith("http"):
        url = "https://" + url
    if not _allowed_by_robots(url):
        return {"ok": False, "error": "robots_disallow", "url": url, "text": "", "html": ""}
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": _UA,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.7",
            "Accept-Language": "en-CA,en;q=0.8",
        },
    )
    try:
        opener = urllib.request.build_opener(_RedirectHandler())
        with opener.open(req, timeout=max(2, int(timeout))) as resp:
            raw = resp.read(750_000)
            final = resp.geturl()
            ctype = resp.headers.get("Content-Type", "")
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        return {"ok": False, "error": str(exc)[:200], "url": url, "text": "", "html": ""}
    if "html" not in ctype.lower() and "text" not in ctype.lower():
        return {"ok": False, "error": "non_html", "url": final, "text": "", "html": ""}
    html = raw.decode("utf-8", errors="replace")
    parser = _TextExtractor()
    try:
        parser.feed(html)
        text = parser.text()
    except Exception:
        text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return {"ok": True, "url": final, "text": text[:100_000], "html": html, "error": ""}


def website_of(company: dict[str, Any]) -> str:
    for channel in company.get("contact_channels") or []:
        if channel.get("type") == "website" and channel.get("value"):
            return str(channel["value"]).strip()
    return ""


def _clean_email(value: str) -> str:
    return clean_public_email(value)


def _emails_from_page(raw_html: str, text: str) -> list[str]:
    values = extract_emails(raw_html + " " + text)
    mailtos = re.findall(r"mailto:([^\"'<>?\s]+@[^\"'<>?\s]+)", raw_html, flags=re.I)
    values = mailtos + values
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        email = _clean_email(value)
        if email and email not in seen:
            seen.add(email)
            out.append(email)
    return out


def _linkedin_urls(raw_html: str) -> list[str]:
    decoded = html_lib.unescape(raw_html or "")
    out: list[str] = []
    seen: set[str] = set()
    for match in _LINKEDIN_RE.findall(decoded):
        url = match.rstrip("/.,;:)")
        key = url.lower()
        if key not in seen:
            seen.add(key)
            out.append(url)
    return out


def _walk_json(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _walk_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_json(child)


def _jsonld_people(raw_html: str, evidence_url: str) -> list[dict[str, Any]]:
    people: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for block in _JSONLD_RE.findall(raw_html or ""):
        try:
            payload = json.loads(html_lib.unescape(block).strip())
        except (json.JSONDecodeError, TypeError):
            continue
        for node in _walk_json(payload):
            kind = node.get("@type")
            kinds = {str(x).lower() for x in kind} if isinstance(kind, list) else {str(kind).lower()}
            if "person" not in kinds:
                continue
            name = str(node.get("name") or "").strip()
            role = str(node.get("jobTitle") or node.get("roleName") or "").strip()
            if not name or not role or not _DECISION_ROLE_RE.search(role):
                continue
            same_as = node.get("sameAs") or []
            if isinstance(same_as, str):
                same_as = [same_as]
            linkedin = next((str(url) for url in same_as if "linkedin.com/in/" in str(url).lower()), "")
            email = _clean_email(str(node.get("email") or ""))
            key = (name.lower(), role.lower())
            if key in seen:
                continue
            seen.add(key)
            people.append(
                {
                    "name": name,
                    "title": role,
                    "email": email,
                    "linkedin_url": linkedin,
                    "source": "official_website_jsonld",
                    "evidence_url": evidence_url,
                    "verification_status": "official_site_linked" if linkedin else "official_site_named",
                    "observed_at": _now(),
                }
            )
    return people


def _merge_external_profiles(company: dict[str, Any], urls: list[str], evidence_url: str) -> None:
    profiles = list(company.get("external_profiles") or [])
    existing = {str(item.get("url") or "").rstrip("/").lower() for item in profiles}
    for url in urls:
        key = url.rstrip("/").lower()
        if key in existing:
            continue
        profile_type = "person" if "/in/" in key else "company"
        profiles.append(
            {
                "source": "linkedin_public_link",
                "external_id": "",
                "url": url,
                "evidence_url": evidence_url,
                "meta": {"profile_type": profile_type, "verification": "linked_from_official_website"},
            }
        )
        existing.add(key)
    company["external_profiles"] = profiles


def _merge_contact_people(company: dict[str, Any], people: list[dict[str, Any]]) -> None:
    contacts = list(company.get("contact_persons") or [])
    existing = {
        (str(item.get("name") or "").lower(), str(item.get("title") or item.get("role") or "").lower())
        for item in contacts
    }
    for person in people:
        key = (str(person.get("name") or "").lower(), str(person.get("title") or "").lower())
        if key not in existing:
            contacts.append(person)
            existing.add(key)
    company["contact_persons"] = contacts


def enrich_company_from_website(
    company: dict[str, Any], *, max_pages: int = 5, timeout: int = 8
) -> dict[str, Any]:
    """Enrich one company from public official pages; never infer or guess a person/email."""
    attempted_at = _now()
    base = website_of(company)
    if not base:
        company["website_enrichment"] = {
            "status": "no_website",
            "attempted_at": attempted_at,
            "pages_attempted": 0,
            "pages_fetched": 0,
            "errors": [],
        }
        return company

    base_url = base if "://" in base else "https://" + base
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    domain = normalize_domain(base)
    if not domain:
        company["website_enrichment"] = {
            "status": "unsupported_website",
            "attempted_at": attempted_at,
            "pages_attempted": 0,
            "pages_fetched": 0,
            "errors": [{"url": base, "error": "social_or_aggregator_not_official_website"}],
            "retryable": False,
        }
        return company
    pages_attempted = 0
    pages_fetched = 0
    consecutive_failures = 0
    errors: list[dict[str, str]] = []
    evidence_urls: list[str] = []
    found_linkedin: list[str] = []
    found_people: list[dict[str, Any]] = []
    emails_before = {
        str(channel.get("value") or "").lower()
        for channel in (company.get("contact_channels") or [])
        if channel.get("type") == "email"
    }

    page_urls = [base_url]
    page_urls.extend(
        urljoin(origin.rstrip("/") + "/", path.lstrip("/"))
        for path in _CONTACT_PATHS
        if path != "/"
    )
    for url in dict.fromkeys(page_urls):
        if pages_attempted >= max(1, int(max_pages)):
            break
        pages_attempted += 1
        result = fetch_url(url, timeout=timeout)
        if not result.get("ok"):
            consecutive_failures += 1
            errors.append({"url": url, "error": str(result.get("error") or "fetch_failed")[:200]})
            if consecutive_failures >= 2 and pages_fetched == 0:
                break
            continue

        consecutive_failures = 0
        pages_fetched += 1
        evidence_url = str(result.get("url") or url)
        evidence_urls.append(evidence_url)
        raw_html = str(result.get("html") or "")
        text = str(result.get("text") or "")

        channels = list(company.get("contact_channels") or [])
        existing = {str(channel.get("value") or "").lower() for channel in channels}
        for email in _emails_from_page(raw_html, text)[:5]:
            if email not in existing:
                channels.append(
                    {
                        "type": "email",
                        "value": email,
                        "source": "official_website",
                        "evidence_url": evidence_url,
                        "verification_status": "unverified_public",
                        "observed_at": attempted_at,
                    }
                )
                existing.add(email)
        if re.search(r"<form[^>]+>|type=[\"']email[\"']|contact.?form", raw_html, re.I):
            if evidence_url not in {
                str(channel.get("value") or "")
                for channel in channels
                if channel.get("type") == "contact_form"
            }:
                channels.append(
                    {
                        "type": "contact_form",
                        "value": evidence_url,
                        "source": "official_website",
                        "evidence_url": evidence_url,
                    }
                )
        company["contact_channels"] = channels

        page_linkedin = _linkedin_urls(raw_html)
        found_linkedin.extend(page_linkedin)
        _merge_external_profiles(company, page_linkedin, evidence_url)
        people = _jsonld_people(raw_html, evidence_url)
        found_people.extend(people)
        _merge_contact_people(company, people)

        services, brands, flags = classify_from_text(
            text, source_url=evidence_url, source_type="website"
        )
        company["services"] = merge_services(company.get("services") or [], services)
        company["brands"] = merge_brands(company.get("brands") or [], brands)
        company["classification_flags"] = sorted(
            set((company.get("classification_flags") or []) + list(flags))
        )
        chinese_evidence = scan_text_for_chinese_evidence(text, source_url=evidence_url)
        if chinese_evidence:
            company = apply_chinese_relevance(company, chinese_evidence)

    if domain:
        company.setdefault("location", {})["website_domain"] = domain
    company["business_type"] = infer_business_type(company, company.get("classification_flags") or [])
    if pages_fetched and company.get("status") == "discovered":
        company["status"] = "enriched"
    company = apply_chinese_relevance(company, None)

    emails_after = {
        str(channel.get("value") or "").lower()
        for channel in (company.get("contact_channels") or [])
        if channel.get("type") == "email" and channel.get("value")
    }
    unique_linkedin = list(dict.fromkeys(found_linkedin))
    unique_people = {
        (
            str(person.get("name") or "").strip().lower(),
            str(person.get("title") or "").strip().lower(),
        )
        for person in found_people
        if person.get("name") and person.get("title")
    }
    state = "complete" if pages_fetched else "failed"
    company["website_enrichment"] = {
        "status": state,
        "attempted_at": attempted_at,
        "pages_attempted": pages_attempted,
        "pages_fetched": pages_fetched,
        "evidence_urls": list(dict.fromkeys(evidence_urls)),
        "new_email_count": len(emails_after - emails_before),
        "linkedin_links_found": len(unique_linkedin),
        "decision_makers_found": len(unique_people),
        "errors": errors[:10],
        "retryable": not pages_fetched,
    }
    company["linkedin_review"] = {
        "status": "public_links_found" if unique_linkedin else "manual_review_needed",
        "public_links": unique_linkedin,
        "search_hint": (
            f'site:linkedin.com/in "{company.get("display_name") or ""}" '
            f'"{(company.get("location") or {}).get("city") or "Canada"}" '
            '(owner OR president OR "general manager" OR "parts manager")'
        ),
        "updated_at": attempted_at,
    }
    return company
