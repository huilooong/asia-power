"""Evidence-bound five-dimension scoring for B2B prospects."""

from __future__ import annotations

import re
from typing import Any

from agents.apbd.solo_trade.models import CampaignBrief

WEIGHTS = {
    "customer_match": 0.30,
    "purchase_intent": 0.25,
    "company_scale": 0.15,
    "import_likelihood": 0.15,
    "contact_quality": 0.15,
}

_TOKEN_ALIASES = {
    "autopartes": "parts",
    "distribuidores": "distributor",
    "distribuidor": "distributor",
    "engines": "engine",
    "importadores": "importer",
    "importador": "importer",
    "mayoristas": "wholesaler",
    "mayorista": "wholesaler",
    "motores": "engine",
    "motor": "engine",
    "repuestos": "parts",
    "talleres": "workshop",
    "taller": "workshop",
}
_TOKEN_STOPWORDS = {"a", "and", "de", "del", "for", "la", "of", "para", "the", "y"}


def _clamp(value: float) -> int:
    return int(round(max(0.0, min(100.0, value))))


def _blob(candidate: dict[str, Any]) -> str:
    values: list[str] = []
    for key in (
        "company",
        "display_name",
        "description",
        "business_type",
        "main_products",
        "match_reason",
        "query",
        "industry",
        "procurement_need",
    ):
        value = candidate.get(key)
        if isinstance(value, (list, tuple)):
            values.extend(str(item) for item in value)
        elif value:
            values.append(str(value))
    return " ".join(values).casefold()


def _canonical_tokens(value: str) -> tuple[str, ...]:
    tokens: list[str] = []
    for raw in re.findall(r"[a-záéíóúñ0-9]+", value.casefold()):
        token = _TOKEN_ALIASES.get(raw, raw)
        if token not in _TOKEN_STOPWORDS and token not in tokens:
            tokens.append(token)
    return tuple(tokens)


def _matched_terms(terms: tuple[str, ...], text: str) -> list[str]:
    text_tokens = set(_canonical_tokens(text))
    hits: list[str] = []
    concepts: set[tuple[str, ...]] = set()
    for term in terms:
        tokens = tuple(sorted(_canonical_tokens(term)))
        if not tokens or tokens in concepts:
            continue
        overlap = len(set(tokens) & text_tokens) / len(set(tokens))
        if term.casefold() in text or overlap >= 0.66:
            concepts.add(tokens)
            hits.append(term)
    return hits


def _contacts(candidate: dict[str, Any]) -> list[dict[str, Any]]:
    rows = [dict(row) for row in (candidate.get("contacts") or candidate.get("contact_channels") or []) if isinstance(row, dict)]
    field_map = {
        "public_email": "email",
        "email": "email",
        "public_phone": "phone",
        "phone": "phone",
        "whatsapp": "whatsapp",
        "website": "website",
    }
    for field, contact_type in field_map.items():
        value = str(candidate.get(field) or "").strip()
        if value and value.casefold() not in {"not published", "unknown", "n/a"}:
            rows.append(
                {
                    "type": contact_type,
                    "value": value,
                    "source": candidate.get("source_url") or candidate.get("website") or "candidate_record",
                    "verified": False,
                    "confidence": 0,
                }
            )
    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for row in rows:
        key = (str(row.get("type") or ""), str(row.get("value") or "").casefold())
        if not key[0] or not key[1] or key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


def _employee_count(candidate: dict[str, Any]) -> int | None:
    raw = candidate.get("employee_count")
    if raw is not None:
        try:
            return max(0, int(raw))
        except (TypeError, ValueError):
            pass
    text = str(candidate.get("employee_range") or candidate.get("company_size") or "")
    numbers = [int(value) for value in re.findall(r"\d+", text.replace(",", ""))]
    if not numbers:
        return None
    return int(sum(numbers[:2]) / min(2, len(numbers)))


def _source_urls(candidate: dict[str, Any], contacts: list[dict[str, Any]]) -> list[str]:
    urls: list[str] = []
    values = list(candidate.get("source_urls") or [])
    values.extend(
        [
            candidate.get("source_url"),
            candidate.get("company_page_url"),
            candidate.get("website"),
        ]
    )
    values.extend(contact.get("source") for contact in contacts)
    for raw in values:
        value = str(raw or "").strip()
        if value.startswith(("http://", "https://")) and value not in urls:
            urls.append(value)
    return urls


def score_candidate(candidate: dict[str, Any], brief: CampaignBrief) -> dict[str, Any]:
    text = _blob(candidate)
    contacts = _contacts(candidate)
    source_urls = _source_urls(candidate, contacts)
    notes: list[str] = []
    claims: list[dict[str, Any]] = []

    product_hits = _matched_terms(brief.product_keywords, text)
    type_hits = _matched_terms(brief.customer_types, text)
    candidate_country = str(candidate.get("country") or "").casefold()
    candidate_city = str(candidate.get("city") or "").casefold()
    market_hits = [
        market
        for market in brief.target_markets
        if market.casefold() in text
        or (candidate_country and candidate_country in market.casefold())
        or (candidate_city and candidate_city in market.casefold())
    ]
    match = min(60, len(product_hits) * 35) + min(30, len(type_hits) * 20) + min(10, len(market_hits) * 10)
    match = _clamp(match)
    if product_hits:
        notes.append(f"Product evidence matched: {', '.join(product_hits)}")
    if type_hits:
        notes.append(f"Customer type matched: {', '.join(type_hits)}")

    intent = 0
    intent_terms = ("importer", "distributor", "wholesaler", "procurement", "purchasing", "buyer", "fleet", "workshop")
    intent_matches = sorted({term for term in intent_terms if term in text})
    intent += min(45, len(intent_matches) * 12)
    intent += min(35, len(product_hits) * 20)
    if candidate.get("procurement_need"):
        intent += 20
        claims.append(
            {
                "claim": "Procurement need is present in the candidate record",
                "status": "inferred",
                "evidence": str(candidate.get("procurement_need")),
            }
        )
    intent = _clamp(intent)

    employees = _employee_count(candidate)
    scale = 0
    if employees is not None:
        if employees <= 10:
            scale = 35
        elif employees <= 50:
            scale = 55
        elif employees <= 200:
            scale = 70
        elif employees <= 1000:
            scale = 85
        else:
            scale = 95
        claims.append(
            {
                "claim": "Company scale estimate",
                "status": "inferred",
                "evidence": f"employee_count={employees}",
            }
        )
    elif candidate.get("official_registry_verified"):
        scale = 30
        notes.append("Official registry presence verified, employee count unknown")

    import_score = 0
    import_evidence = candidate.get("import_evidence") or []
    if candidate.get("import_history_verified"):
        import_score += 70
        claims.append(
            {
                "claim": "Import history",
                "status": "verified",
                "evidence": str(candidate.get("import_history_verified")),
            }
        )
    if "importer" in text or "import" in text:
        import_score += 20
    if isinstance(import_evidence, list) and import_evidence:
        import_score += min(30, len(import_evidence) * 10)
    if candidate.get("supplier_countries"):
        import_score += 15
    import_score = _clamp(import_score)

    contact_score = 0
    named_contacts = candidate.get("contact_persons") or []
    if named_contacts:
        contact_score += 20
    for contact in contacts:
        contact_type = str(contact.get("type") or "").casefold()
        verified = bool(contact.get("verified"))
        if contact_type == "email":
            value = str(contact.get("value") or "")
            generic = value.split("@", 1)[0].casefold() in {"info", "sales", "contact", "hello", "office", "support"} if "@" in value else True
            contact_score += 25 if verified and not generic else 18 if verified else 12
        elif contact_type == "phone":
            contact_score += 12
        elif contact_type == "whatsapp":
            contact_score += 15
        elif contact_type == "contact_form":
            contact_score += 8
        elif contact_type == "website":
            contact_score += 8
    contact_score = _clamp(contact_score)

    dimensions = {
        "customer_match": match,
        "purchase_intent": intent,
        "company_scale": _clamp(scale),
        "import_likelihood": import_score,
        "contact_quality": contact_score,
    }
    overall = round(sum(dimensions[key] * WEIGHTS[key] for key in WEIGHTS), 1)
    if overall >= 80:
        grade = "A"
    elif overall >= 65:
        grade = "B"
    elif overall >= 50:
        grade = "C"
    else:
        grade = "D"

    evidence_fields = sum(
        1
        for value in (
            product_hits,
            type_hits,
            source_urls,
            contacts,
            import_evidence,
            employees,
            candidate.get("procurement_need"),
        )
        if value
    )
    confidence = _clamp((evidence_fields / 7) * 100)
    if import_score == 0:
        notes.append("Import likelihood remains unknown because no import evidence was found")
    if scale == 0:
        notes.append("Company scale remains unknown because no employee or registry evidence was found")
    if contact_score == 0:
        notes.append("No public contact channel was found")

    return {
        "version": "solo-trade-score-v1",
        "overall_score": overall,
        "grade": grade,
        "confidence": confidence,
        "dimensions": dimensions,
        "weights": WEIGHTS,
        "notes": notes,
        "claims": claims,
        "source_urls": source_urls,
        "label_policy": {
            "purchase_intent": "estimate_not_probability",
            "import_likelihood": "estimate_not_verified_history_unless_marked",
        },
    }
