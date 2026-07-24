"""Chinese-service relevance — evidence only; never infer from names/faces/area."""

from __future__ import annotations

import re
from typing import Any

# Acceptable evidence phrases (public text)
_ACCEPT_PATTERNS = [
    (r"中文服务", "website_chinese_service"),
    (r"华语服务", "website_chinese_service"),
    (r"普通话", "website_mandarin_cantonese"),
    (r"粤语", "website_mandarin_cantonese"),
    (r"\bmandarin\b", "website_mandarin_cantonese"),
    (r"\bcantonese\b", "website_mandarin_cantonese"),
    (r"chinese[-\s]?speaking", "website_chinese_service"),
    (r"we speak chinese", "website_chinese_service"),
    (r"chinese service", "website_chinese_service"),
    (r"chinese[-\s]?owned", "self_declared_chinese_owned"),
    (r"servi[ce]+s?\s+in\s+chinese", "website_chinese_service"),
]


def scan_text_for_chinese_evidence(text: str, *, source_url: str = "") -> dict[str, Any] | None:
    blob = text or ""
    if not blob.strip():
        return None
    for pattern, etype in _ACCEPT_PATTERNS:
        m = re.search(pattern, blob, re.I)
        if not m:
            continue
        start = max(0, m.start() - 40)
        end = min(len(blob), m.end() + 40)
        snippet = re.sub(r"\s+", " ", blob[start:end]).strip()
        status = "confirmed_chinese_service"
        if etype == "self_declared_chinese_owned":
            status = "confirmed_chinese_business"
        return {
            "status": status,
            "evidence_type": etype,
            "evidence_text": snippet[:280],
            "evidence_url": source_url,
            "confidence": 0.85,
        }
    return None


def apply_chinese_relevance(company: dict[str, Any], evidence: dict[str, Any] | None) -> dict[str, Any]:
    cr = dict(company.get("chinese_relevance") or {})
    # Never downgrade human-confirmed without review
    if cr.get("reviewed_by") and cr.get("status") in (
        "confirmed_chinese_service",
        "confirmed_chinese_business",
        "disproved",
    ):
        return company
    if not evidence:
        if not cr.get("status"):
            cr = {
                "status": "unknown",
                "evidence_type": "",
                "evidence_text": "",
                "evidence_url": "",
                "confidence": 0.0,
                "reviewed_by": "",
                "reviewed_at": "",
            }
        company["chinese_relevance"] = cr
        return company
    # Upgrade only
    rank = {
        "unknown": 0,
        "probable_chinese_service": 1,
        "confirmed_chinese_service": 2,
        "confirmed_chinese_business": 3,
        "disproved": -1,
    }
    cur = rank.get(str(cr.get("status") or "unknown"), 0)
    nxt = rank.get(str(evidence.get("status") or "unknown"), 0)
    if nxt >= cur:
        company["chinese_relevance"] = {
            "status": evidence.get("status") or "unknown",
            "evidence_type": evidence.get("evidence_type") or "",
            "evidence_text": evidence.get("evidence_text") or "",
            "evidence_url": evidence.get("evidence_url") or "",
            "confidence": float(evidence.get("confidence") or 0),
            "reviewed_by": cr.get("reviewed_by") or "",
            "reviewed_at": cr.get("reviewed_at") or "",
        }
    return company
