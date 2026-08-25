"""Deterministic normalization helpers for lead records."""

from __future__ import annotations

import html as html_lib
import re
from urllib.parse import unquote, urlparse

_SUFFIX_RE = re.compile(
    r"\b(ltd|limited|llc|inc|plc|co\.?|company|enterprises|group|corp|corporation|auto|garage|shop)\b\.?",
    re.I,
)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_PHONE_DIGITS = re.compile(r"\D+")
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PLACEHOLDER_EMAIL_LOCAL_PARTS = {
    "email",
    "example",
    "filler",
    "name",
    "sample",
    "test",
    "user",
    "you",
    "yourname",
}
_PLACEHOLDER_EMAIL_DOMAINS = {
    "domain.com",
    "example.com",
    "example.org",
    "godaddy.com",
    "indiantypefoundry.com",
}
_BAD_EMAIL_PARTS = (
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    "sentry.io",
    "wixpress",
    "cloudflare",
)
_BAD_EMAIL_PREFIXES = ("noreply@", "no-reply@", "donotreply@", "do-not-reply@")


def normalize_name(name: str) -> str:
    s = (name or "").strip().lower()
    s = _SUFFIX_RE.sub(" ", s)
    s = _NON_ALNUM.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def normalize_phone(phone: str) -> str:
    digits = _PHONE_DIGITS.sub("", phone or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits


def normalize_domain(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    if "://" not in raw:
        raw = "https://" + raw
    try:
        host = urlparse(raw).netloc.lower()
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    # Drop social / aggregator hosts as "official domain"
    blocked = (
        "facebook.com",
        "fb.com",
        "instagram.com",
        "linkedin.com",
        "yelp.",
        "yellowpages.",
        "bbb.org",
        "google.com",
        "maps.app.goo.gl",
    )
    if any(b in host for b in blocked):
        return ""
    return host


def extract_emails(text: str) -> list[str]:
    found = _EMAIL_RE.findall(text or "")
    out: list[str] = []
    seen: set[str] = set()
    for e in found:
        el = e.lower()
        if el in seen:
            continue
        if any(x in el for x in (".png", ".jpg", "example.com", "sentry.io", "wixpress")):
            continue
        seen.add(el)
        out.append(el)
    return out


def clean_public_email(value: str) -> str:
    """Return a conservative normalized public email, or empty for obvious artifacts."""
    raw = html_lib.unescape(html_lib.unescape(unquote(str(value or "")))).strip().lower()
    if raw.startswith("mailto:"):
        raw = raw[7:]
    raw = raw.split("?", 1)[0]
    match = _EMAIL_RE.search(raw)
    if not match:
        return ""
    email = match.group(0).lower()
    if email.startswith(_BAD_EMAIL_PREFIXES) or any(part in email for part in _BAD_EMAIL_PARTS):
        return ""
    local, domain = email.rsplit("@", 1)
    if len(local) < 2 or local in _PLACEHOLDER_EMAIL_LOCAL_PARTS:
        return ""
    if domain in _PLACEHOLDER_EMAIL_DOMAINS:
        return ""
    if domain.startswith(".") or ".." in domain:
        return ""
    return email


def normalize_address(addr: str) -> str:
    s = (addr or "").strip().lower()
    s = s.replace(",", " ")
    s = re.sub(r"\s+", " ", s)
    return s
