"""Evidence-bounded outreach sequence generation and validation."""

from __future__ import annotations

import re
from typing import Any

from agents.apbd.solo_trade.models import CampaignBrief, utc_now_iso

SEQUENCE_DAYS = (0, 3, 7, 14)
_URL_RE = re.compile(r"(?:https?://|www\.)", re.I)
_FIRST_TOUCH_BLOCKED = (
    "meeting",
    "call booking",
    "calendar",
    "attached",
    "attachment",
    "catalog",
    "price list",
    "quotation",
    "in stock",
    "guaranteed stock",
)


def _company_name(lead: dict[str, Any]) -> str:
    return str(lead.get("company") or lead.get("display_name") or "your company").strip()


def _first_name(lead: dict[str, Any]) -> str:
    contacts = lead.get("contact_persons") or []
    if contacts and isinstance(contacts[0], dict):
        name = str(contacts[0].get("name") or "").strip()
        if name:
            return name.split()[0]
    return "there"


def _evidence_line(lead: dict[str, Any], brief: CampaignBrief) -> str:
    business_type = str(lead.get("business_type") or lead.get("industry") or "").strip()
    country = str(lead.get("country") or "").strip()
    product = brief.product_keywords[0]
    if business_type and country:
        return f"I found {_company_name(lead)} while researching {business_type.lower()} businesses in {country}."
    if country:
        return f"I found {_company_name(lead)} while researching businesses in {country} that may work with {product}."
    return f"I found {_company_name(lead)} while researching businesses that may work with {product}."


def generate_sequence(lead: dict[str, Any], brief: CampaignBrief) -> list[dict[str, Any]]:
    """Create a conservative four-touch sequence without invented commercial facts."""
    company = _company_name(lead)
    first_name = _first_name(lead)
    product = brief.product_keywords[0]
    evidence = _evidence_line(lead, brief)
    subject = f"Quick question about {product} for {company}"
    messages = [
        (
            subject,
            f"Hi {first_name},\n\n{evidence} We work with verified suppliers of {product}. "
            "Would it be useful if I send a short, relevant introduction? If yes, just reply Sure.\n\nBest regards,\nAsiaPower",
        ),
        (
            f"Re: {subject}",
            f"Hi {first_name},\n\nFollowing up on my note about {product}. I can keep the introduction focused on "
            f"the needs of {company}, using only details you confirm. Would that be relevant?\n\nBest regards,\nAsiaPower",
        ),
        (
            f"Re: {subject}",
            f"Hi {first_name},\n\nA brief second follow-up. If {product} is not in your current sourcing plan, no action is needed. "
            "If it is relevant, reply with the product or specification you are seeking and we will verify before responding.\n\nBest regards,\nAsiaPower",
        ),
        (
            f"Closing the loop: {product}",
            f"Hi {first_name},\n\nI will close this thread for now. If {company} later needs help identifying verified suppliers "
            f"for {product}, reply to this email and we can restart from your requirements.\n\nBest regards,\nAsiaPower",
        ),
    ]
    sequence = [
        {
            "step": index + 1,
            "send_after_days": SEQUENCE_DAYS[index],
            "subject": item[0],
            "body": item[1],
            "status": "draft_only",
            "generated_at": utc_now_iso(),
            "evidence_sources": list((lead.get("score") or {}).get("source_urls") or lead.get("source_urls") or []),
        }
        for index, item in enumerate(messages)
    ]
    validate_sequence(sequence)
    return sequence


def validate_sequence(sequence: list[dict[str, Any]]) -> None:
    if len(sequence) != 4:
        raise ValueError("Outreach sequence must contain exactly four drafts")
    for expected_step, draft in enumerate(sequence, start=1):
        if int(draft.get("step") or 0) != expected_step:
            raise ValueError("Outreach sequence steps must be ordered from 1 to 4")
        if not str(draft.get("subject") or "").strip() or not str(draft.get("body") or "").strip():
            raise ValueError(f"Draft step {expected_step} requires a subject and body")
        if str(draft.get("status") or "") != "draft_only":
            raise ValueError("Generated outreach must remain draft_only")
    first = f"{sequence[0]['subject']} {sequence[0]['body']}".casefold()
    if _URL_RE.search(first):
        raise ValueError("First-touch draft must not contain links")
    blocked = [term for term in _FIRST_TOUCH_BLOCKED if term in first]
    if blocked:
        raise ValueError(f"First-touch draft contains blocked request or claim: {', '.join(blocked)}")
    if "reply sure" not in first.replace("\n", " ").casefold():
        raise ValueError("First-touch draft must ask for the minimal reply: Sure")


def prompt_contract() -> dict[str, Any]:
    """Machine-readable constraints shared with the prompt pack and UI."""
    return {
        "first_touch_goal": "earn a minimal Sure reply",
        "required": [
            "use only evidence supplied in the lead record",
            "separate verified facts from estimates",
            "keep all generated messages in draft_only status",
        ],
        "forbidden_first_touch": list(_FIRST_TOUCH_BLOCKED) + ["links"],
        "send_policy": "independent explicit approval is always required",
    }
