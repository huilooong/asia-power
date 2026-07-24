"""Public website enrichment — robots-aware, evidence-linked, no invented contacts."""

from __future__ import annotations

import re
import urllib.error
import urllib.request
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

from agents.apbd.leads.chinese_evidence import apply_chinese_relevance, scan_text_for_chinese_evidence
from agents.apbd.leads.classify_services import (
    classify_from_text,
    infer_business_type,
    merge_brands,
    merge_services,
)
from agents.apbd.leads.normalize import extract_emails, normalize_domain

_UA = "AsiaPower-APBD-LeadEnrich/1.0 (+https://asia-power.com; research)"
_CONTACT_PATHS = ("/", "/contact", "/contact-us", "/about", "/about-us", "/services")


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style", "noscript"):
            self._skip = True

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript"):
            self._skip = False

    def handle_data(self, data: str) -> None:
        if not self._skip and data and data.strip():
            self._chunks.append(data.strip())

    def text(self) -> str:
        return " ".join(self._chunks)


def _allowed_by_robots(url: str) -> bool:
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        rp = RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(_UA, url)
    except Exception:
        # Fail open for missing robots; fail closed only on explicit disallow we can parse
        return True


def fetch_url(url: str, *, timeout: int = 20) -> dict[str, Any]:
    if not url.startswith("http"):
        url = "https://" + url
    if not _allowed_by_robots(url):
        return {"ok": False, "error": "robots_disallow", "url": url, "text": "", "html": ""}
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            final = resp.geturl()
            ctype = resp.headers.get("Content-Type", "")
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        return {"ok": False, "error": str(exc)[:200], "url": url, "text": "", "html": ""}
    if "html" not in ctype.lower() and "text" not in ctype.lower():
        return {"ok": False, "error": "non_html", "url": final, "text": "", "html": ""}
    try:
        html = raw.decode("utf-8", errors="replace")
    except Exception:
        html = raw.decode("latin-1", errors="replace")
    parser = _TextExtractor()
    try:
        parser.feed(html)
        text = parser.text()
    except Exception:
        text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return {"ok": True, "url": final, "text": text[:80000], "html": html[:200000], "error": ""}


def website_of(company: dict[str, Any]) -> str:
    for ch in company.get("contact_channels") or []:
        if ch.get("type") == "website" and ch.get("value"):
            return str(ch["value"]).strip()
    return ""


def enrich_company_from_website(company: dict[str, Any], *, max_pages: int = 3) -> dict[str, Any]:
    base = website_of(company)
    if not base:
        return company
    domain = normalize_domain(base)
    parsed = urlparse(base if "://" in base else "https://" + base)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    pages_fetched = 0
    combined_text = ""
    evidence_url = origin
    all_flags: list[str] = []

    for path in _CONTACT_PATHS:
        if pages_fetched >= max_pages:
            break
        url = urljoin(origin + "/", path.lstrip("/"))
        if path != "/" and url.rstrip("/") == origin.rstrip("/"):
            continue
        result = fetch_url(url)
        pages_fetched += 1
        if not result.get("ok"):
            continue
        combined_text += " " + str(result.get("text") or "")
        evidence_url = str(result.get("url") or url)
        emails = extract_emails(str(result.get("html") or "") + " " + str(result.get("text") or ""))
        channels = list(company.get("contact_channels") or [])
        existing = {str(c.get("value") or "").lower() for c in channels}
        for em in emails[:3]:
            if em not in existing:
                channels.append({"type": "email", "value": em, "source": "website", "evidence_url": evidence_url})
                existing.add(em)
        # contact form heuristic
        html = str(result.get("html") or "")
        if re.search(r"<form[^>]+>|type=[\"']email[\"']|contact.?form", html, re.I):
            if "contact_form" not in {c.get("type") for c in channels}:
                channels.append(
                    {"type": "contact_form", "value": evidence_url, "source": "website", "evidence_url": evidence_url}
                )
        company["contact_channels"] = channels

        services, brands, flags = classify_from_text(
            str(result.get("text") or ""), source_url=evidence_url, source_type="website"
        )
        company["services"] = merge_services(company.get("services") or [], services)
        company["brands"] = merge_brands(company.get("brands") or [], brands)
        all_flags.extend(flags)

        ev = scan_text_for_chinese_evidence(str(result.get("text") or ""), source_url=evidence_url)
        if ev:
            company = apply_chinese_relevance(company, ev)

    if domain:
        company.setdefault("location", {})["website_domain"] = domain
    company["classification_flags"] = sorted(set(all_flags))
    company["business_type"] = infer_business_type(company, company.get("classification_flags"))
    if company.get("status") == "discovered":
        company["status"] = "enriched"
    # Name-only Chinese inference is forbidden — leave unknown if no evidence
    company = apply_chinese_relevance(company, None)
    company["notes"] = (company.get("notes") or "")  # keep
    _ = combined_text  # reserved for future LLM summary (never invent facts)
    return company
