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
PEOPLE_EXTRACTION_VERSION = "visible-role-v2"
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
_SPANISH_CONTACT_PATHS = (
    "/",
    "/contacto",
    "/nosotros",
    "/quienes-somos",
    "/empresa",
    "/equipo",
    "/servicios",
    "/contact",
    "/about",
)
_LANGUAGE_CONTACT_PATHS = {
    "es": _SPANISH_CONTACT_PATHS,
    "pt": ("/", "/contato", "/sobre", "/empresa", "/equipe", "/servicos", "/contact", "/about"),
    "fr": ("/", "/contact", "/a-propos", "/qui-sommes-nous", "/entreprise", "/equipe", "/services", "/about"),
    "de": ("/", "/kontakt", "/uber-uns", "/ueber-uns", "/unternehmen", "/team", "/leistungen", "/contact"),
    "it": ("/", "/contatti", "/chi-siamo", "/azienda", "/squadra", "/servizi", "/contact", "/about"),
    "nl": ("/", "/contact", "/over-ons", "/bedrijf", "/team", "/diensten", "/about"),
    "tr": ("/", "/iletisim", "/hakkimizda", "/kurumsal", "/ekibimiz", "/hizmetler", "/contact"),
}
_COMMERCIAL_RESTRICTION_RE = re.compile(
    r"no unsolicited|do not send (?:us )?(?:unsolicited|commercial|marketing)|"
    r"commercial (?:email|e-mail|message)s? (?:are )?(?:not accepted|prohibited)|"
    r"no sales solicitation|marketing messages? prohibited|"
    r"pas de (?:courriels|messages) commerciaux|sollicitation commerciale interdite|"
    r"no (?:enviar|aceptamos) (?:correo|mensajes?) (?:comercial|publicitario)|"
    r"nao (?:envie|aceitamos) (?:email|mensagens?) (?:comercial|publicitario)",
    re.I,
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
    r"\b(co[- ]?owner(?!['’]s)|owner(?!['’]s)|founder|president|chief executive|ceo|director|general manager|"
    r"operations manager|parts manager|purchasing manager|procurement manager|service manager)\b",
    re.I,
)
_NAME_TOKEN_RE = re.compile(r"^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,30}\.?$")
_NAME_STOP_WORDS = {
    "a",
    "an",
    "about",
    "auto",
    "automotive",
    "centre",
    "client",
    "clients",
    "company",
    "customer",
    "garage",
    "group",
    "manager",
    "mechanic",
    "motors",
    "owner",
    "our",
    "originally",
    "president",
    "repair",
    "say",
    "says",
    "service",
    "services",
    "shop",
    "team",
    "testimonials",
    "the",
    "this",
    "tips",
    "vehicle",
    "we",
    "what",
}
_ROLE_TITLES = {
    "owner": "Owner",
    "co-owner": "Co-Owner",
    "co owner": "Co-Owner",
    "founder": "Founder",
    "president": "President",
    "chief executive": "Chief Executive",
    "ceo": "CEO",
    "director": "Director",
    "general manager": "General Manager",
    "operations manager": "Operations Manager",
    "parts manager": "Parts Manager",
    "purchasing manager": "Purchasing Manager",
    "procurement manager": "Procurement Manager",
    "service manager": "Service Manager",
}


class _RedirectHandler(urllib.request.HTTPRedirectHandler):
    """Add explicit HTTP 308 support for older urllib behavior."""

    def http_error_308(self, req: Any, fp: Any, code: int, msg: str, headers: Any) -> Any:
        return self.http_error_302(req, fp, code, msg, headers)


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _email_publication_context(raw_html: str, text: str, email: str) -> str:
    """Retain a short literal page excerpt around an observed public email."""
    for source in (text, raw_html):
        index = source.casefold().find(email.casefold())
        if index < 0:
            continue
        left = max(0, index - 140)
        right = min(len(source), index + len(email) + 140)
        return re.sub(r"\s+", " ", html_lib.unescape(source[left:right])).strip()[:400]
    return ""


def _commercial_restriction_check(text: str, evidence_url: str, checked_at: str) -> dict[str, str]:
    match = _COMMERCIAL_RESTRICTION_RE.search(text or "")
    if match:
        start = max(0, match.start() - 120)
        end = min(len(text), match.end() + 120)
        return {
            "status": "restriction_observed",
            "checked_at": checked_at,
            "evidence_url": evidence_url,
            "evidence_text": re.sub(r"\s+", " ", text[start:end]).strip()[:400],
        }
    return {
        "status": "none_observed_on_checked_page",
        "checked_at": checked_at,
        "evidence_url": evidence_url,
        "evidence_text": "",
    }


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip_depth = 0
        self._in_title = False
        self._title_chunks: list[str] = []
        self._meta_description = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style", "noscript"):
            self._skip_depth += 1
            return
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            values = {str(key or "").lower(): str(value or "") for key, value in attrs}
            name = values.get("name", "").lower()
            prop = values.get("property", "").lower()
            if name == "description" or prop == "og:description":
                self._meta_description = values.get("content", "").strip()

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript") and self._skip_depth:
            self._skip_depth -= 1
            return
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if not self._skip_depth and data and data.strip():
            self._chunks.append(data.strip())
            if self._in_title:
                self._title_chunks.append(data.strip())

    def text(self) -> str:
        return " ".join(self._chunks)

    def page_description(self) -> str:
        value = self._meta_description or " ".join(self._title_chunks)
        return re.sub(r"\s+", " ", value).strip()


class _VisibleBlockExtractor(HTMLParser):
    """Collect visible headings and short text blocks without scripts or styles."""

    _BLOCK_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "li"}

    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self._active_tag = ""
        self._chunks: list[str] = []
        self._blocks: list[tuple[str, str]] = []

    def _flush(self) -> None:
        text = re.sub(r"\s+", " ", " ".join(self._chunks)).strip()
        if self._active_tag and text:
            self._blocks.append((self._active_tag, text[:500]))
        self._active_tag = ""
        self._chunks = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style", "noscript"):
            self._skip_depth += 1
            return
        if not self._skip_depth and tag in self._BLOCK_TAGS:
            self._flush()
            self._active_tag = tag

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript") and self._skip_depth:
            self._skip_depth -= 1
            return
        if not self._skip_depth and tag == self._active_tag:
            self._flush()

    def handle_data(self, data: str) -> None:
        if not self._skip_depth and self._active_tag and data and data.strip():
            self._chunks.append(data.strip())

    def blocks(self) -> list[tuple[str, str]]:
        self._flush()
        return self._blocks


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
    return {
        "ok": True,
        "url": final,
        "text": text[:100_000],
        "html": html,
        "page_description": parser.page_description()[:500],
        "error": "",
    }


def website_of(company: dict[str, Any]) -> str:
    for channel in company.get("contact_channels") or []:
        if channel.get("type") == "website" and channel.get("value"):
            return str(channel["value"]).strip()
    return ""


def _person_page_in_company_scope(
    company: dict[str, Any], base_url: str, evidence_url: str, text: str
) -> bool:
    """Avoid attaching a parent-company team page to one location-specific lead."""
    base_path = urlparse(base_url).path.rstrip("/")
    if not base_path:
        return True
    evidence_path = urlparse(evidence_url).path.rstrip("/")
    if evidence_path == base_path or evidence_path.startswith(base_path + "/"):
        return True
    company_name = re.sub(
        r"[^a-z0-9]+", " ", str(company.get("display_name") or "").lower()
    ).strip()
    page_text = re.sub(r"[^a-z0-9]+", " ", str(text or "").lower())
    return bool(company_name and company_name in page_text)


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


def _clean_person_name(value: str, *, allow_single: bool = False) -> str:
    raw = html_lib.unescape(str(value or "")).strip(" \t\r\n,.:;|—–-()[]")
    raw = re.sub(r"^(?:meet|mr\.?|mrs\.?|ms\.?|dr\.?)\s+", "", raw, flags=re.I)
    raw = re.sub(r"\s+", " ", raw).strip()
    tokens = raw.split()
    if not tokens or len(tokens) > 4 or (len(tokens) == 1 and not allow_single):
        return ""
    if any(token.lower().strip(".'’-") in _NAME_STOP_WORDS for token in tokens):
        return ""
    if not all(_NAME_TOKEN_RE.fullmatch(token) for token in tokens):
        return ""
    return " ".join(tokens)


def _visible_role_title(value: str) -> str:
    text = re.sub(r"\s+", " ", html_lib.unescape(str(value or ""))).strip(" ,.:;|—–-")
    match = _DECISION_ROLE_RE.search(text)
    if not match:
        return ""
    if "owner-operated" in text.lower() or "owned and operated" in text.lower():
        return "Owner"
    if len(text) <= 80 and not re.search(r"[.!?]", text):
        return text
    return _ROLE_TITLES.get(match.group(0).lower(), match.group(0).title())


def _visible_people(raw_html: str, evidence_url: str) -> list[dict[str, Any]]:
    """Extract explicit visible name-role relationships from official page blocks."""
    parser = _VisibleBlockExtractor()
    try:
        parser.feed(raw_html or "")
        blocks = parser.blocks()
    except Exception:
        blocks = []

    found: dict[str, dict[str, Any]] = {}

    def add(name: str, title: str, evidence_text: str, confidence: float) -> None:
        clean_name = _clean_person_name(name, allow_single=confidence >= 0.95)
        clean_title = _visible_role_title(title)
        if not clean_name or not clean_title:
            return
        key = clean_name.lower()
        record = {
            "name": clean_name,
            "title": clean_title,
            "email": "",
            "linkedin_url": "",
            "source": "official_website_visible_text",
            "evidence_url": evidence_url,
            "evidence_text": re.sub(r"\s+", " ", evidence_text).strip()[:300],
            "verification_status": "official_site_visible_role",
            "confidence": confidence,
            "observed_at": _now(),
        }
        existing = found.get(key)
        if not existing or len(clean_title) > len(str(existing.get("title") or "")):
            found[key] = record

    # Strong heading/card formats: "Jane Smith — Owner" or "Owner | Jane Smith".
    for tag, block in blocks:
        if len(block) > 180:
            continue
        parts = re.split(r"\s*(?:—|–|\||:)\s*", block, maxsplit=1)
        if len(parts) == 2:
            left, right = parts
            if _DECISION_ROLE_RE.search(right):
                add(left, right, block, 0.97)
            if _DECISION_ROLE_RE.search(left):
                add(right, left, block, 0.97)

        # "Meet Jag. ... owner-operated" and similar explicit introduction blocks.
        meet = re.match(r"^meet\s+([^.!?—–|:]{2,60})[.!?—–|:]", block, flags=re.I)
        if meet and len(parts) != 2 and _DECISION_ROLE_RE.search(block):
            add(meet.group(1), block, block, 0.95)

        name_is_role = re.search(
            r"^(.{2,70}?)\s+(?:is|serves as)\s+(?:the|our)\s+(.{0,80})$",
            block,
            flags=re.I,
        )
        if name_is_role and _DECISION_ROLE_RE.search(name_is_role.group(2)):
            add(name_is_role.group(1), name_is_role.group(2), block, 0.96)

        shared_owners = re.search(
            r"\bowned and operated\s+by\s+"
            r"([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,30})\s*(?:&|and)\s*"
            r"([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,30})\s+"
            r"([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,30})\b",
            block,
            flags=re.I,
        )
        if shared_owners:
            add(
                f"{shared_owners.group(1)} {shared_owners.group(3)}",
                "Owner",
                block,
                0.97,
            )
            add(
                f"{shared_owners.group(2)} {shared_owners.group(3)}",
                "Owner",
                block,
                0.97,
            )

        by_name = re.search(
            r"\b(owned and operated|founded|established|started)\s+by\s+"
            r"([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,30}(?:\s+"
            r"[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,30}){0,3})\b",
            block,
        )
        if by_name and not shared_owners:
            title = "Owner" if by_name.group(1).lower().startswith("owned") else "Founder"
            add(by_name.group(2), title, block, 0.96)

        name_verb = re.search(
            r"^([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,30}(?:\s+"
            r"[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,30}){0,3})\s+"
            r"(founded|established|owns and operates)\b",
            block,
        )
        if name_verb:
            title = "Owner" if name_verb.group(2).lower().startswith("owns") else "Founder"
            add(name_verb.group(1), title, block, 0.96)

    # Team cards commonly use adjacent blocks: <h3>Jane Smith</h3><p>Parts Manager</p>.
    for index in range(len(blocks) - 1):
        tag_a, text_a = blocks[index]
        tag_b, text_b = blocks[index + 1]
        if not (tag_a.startswith("h") or tag_b.startswith("h")):
            continue
        name_a = _clean_person_name(text_a)
        name_b = _clean_person_name(text_b)
        meet_a = re.match(r"^meet\s+([^.!?—–|:]{2,60})[.!?—–|:]", text_a, flags=re.I)
        if (
            meet_a
            and tag_a.startswith("h")
            and tag_b in ("p", "li")
            and len(text_b) <= 180
            and _DECISION_ROLE_RE.search(text_b)
        ):
            add(meet_a.group(1), text_b, f"{text_a} {text_b}", 0.95)
        if (
            name_a
            and tag_a.startswith("h")
            and tag_b in ("p", "li")
            and len(text_b) <= 100
            and _DECISION_ROLE_RE.search(text_b)
        ):
            add(name_a, text_b, f"{text_a} — {text_b}", 0.92)

    return list(found.values())


def valid_visible_person_record(person: dict[str, Any]) -> bool:
    """Validate a stored visible-text person against the current conservative rules."""
    confidence = float(person.get("confidence") or 0)
    return bool(
        _clean_person_name(str(person.get("name") or ""), allow_single=confidence >= 0.95)
        and _visible_role_title(str(person.get("title") or ""))
        and person.get("evidence_url")
        and person.get("evidence_text")
    )


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
    existing_by_name = {
        str(item.get("name") or "").strip().lower(): index
        for index, item in enumerate(contacts)
        if item.get("name")
    }
    for person in people:
        key = str(person.get("name") or "").strip().lower()
        if not key:
            continue
        if key not in existing_by_name:
            existing_by_name[key] = len(contacts)
            contacts.append(person)
            continue
        current = contacts[existing_by_name[key]]
        evidence_urls = list(current.get("evidence_urls") or [])
        for evidence in (current.get("evidence_url"), person.get("evidence_url")):
            if evidence and evidence not in evidence_urls:
                evidence_urls.append(evidence)
        if evidence_urls:
            current["evidence_urls"] = evidence_urls
        if person.get("source") == "official_website_visible_text":
            visible_evidence = list(current.get("visible_role_evidence") or [])
            evidence_row = {
                "title": person.get("title"),
                "evidence_url": person.get("evidence_url"),
                "evidence_text": person.get("evidence_text"),
                "confidence": person.get("confidence"),
            }
            if evidence_row not in visible_evidence:
                visible_evidence.append(evidence_row)
            current["visible_role_evidence"] = visible_evidence
        for field in ("email", "linkedin_url"):
            if not current.get(field) and person.get(field):
                current[field] = person[field]
        current_title = str(current.get("title") or current.get("role") or "")
        new_title = str(person.get("title") or "")
        if new_title and len(new_title) > len(current_title):
            current["title"] = new_title
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
            "people_extraction_version": PEOPLE_EXTRACTION_VERSION,
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
            "people_extraction_version": PEOPLE_EXTRACTION_VERSION,
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
    people_pages_skipped_scope = 0
    emails_before = {
        str(channel.get("value") or "").lower()
        for channel in (company.get("contact_channels") or [])
        if channel.get("type") == "email"
    }

    country_code = str(company.get("country_code") or "").strip().upper()
    language = str(company.get("primary_language") or "").strip().casefold()
    contact_paths = _LANGUAGE_CONTACT_PATHS.get(
        language,
        _SPANISH_CONTACT_PATHS if country_code == "VE" else _CONTACT_PATHS,
    )
    page_urls = [base_url]
    page_urls.extend(
        urljoin(origin.rstrip("/") + "/", path.lstrip("/"))
        for path in contact_paths
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
        if url == base_url and not str(company.get("description") or "").strip():
            page_description = re.sub(
                r"\s+", " ", str(result.get("page_description") or "")
            ).strip()
            if page_description:
                company["description"] = page_description
                company["description_evidence_url"] = evidence_url

        channels = list(company.get("contact_channels") or [])
        existing = {
            str(channel.get("value") or "").lower(): index
            for index, channel in enumerate(channels)
            if channel.get("type") == "email" and channel.get("value")
        }
        for email in _emails_from_page(raw_html, text)[:5]:
            evidence_text = _email_publication_context(raw_html, text, email)
            restriction = _commercial_restriction_check(text, evidence_url, attempted_at)
            official_record = {
                "type": "email",
                "value": email,
                "source": "official_website",
                "evidence_url": evidence_url,
                "evidence_text": evidence_text,
                "verification_status": "unverified_public",
                "observed_at": attempted_at,
                "publication_entity": "recipient_company_official_website",
                "commercial_restriction_check": restriction,
                "send_eligible": False,
                "send_block_reason": "country_and_message_gate_not_completed",
            }
            if email in existing:
                channels[existing[email]].update(official_record)
            else:
                existing[email] = len(channels)
                channels.append(official_record)
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
        people: list[dict[str, Any]] = []
        if _person_page_in_company_scope(company, base_url, evidence_url, text):
            people.extend(_jsonld_people(raw_html, evidence_url))
            people.extend(_visible_people(raw_html, evidence_url))
        else:
            people_pages_skipped_scope += 1
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
        str(person.get("name") or "").strip().lower()
        for person in found_people
        if person.get("name") and person.get("title")
    }
    state = "complete" if pages_fetched else "failed"
    company["website_enrichment"] = {
        "status": state,
        "attempted_at": attempted_at,
        "pages_attempted": pages_attempted,
        "pages_fetched": pages_fetched,
        "people_extraction_version": PEOPLE_EXTRACTION_VERSION,
        "evidence_urls": list(dict.fromkeys(evidence_urls)),
        "new_email_count": len(emails_after - emails_before),
        "linkedin_links_found": len(unique_linkedin),
        "decision_makers_found": len(unique_people),
        "people_pages_skipped_scope": people_pages_skipped_scope,
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
    "client",
    "clients",
    "our",
    "say",
    "says",
