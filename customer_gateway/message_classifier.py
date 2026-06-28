"""Classify WhatsApp messages by business intent."""

from __future__ import annotations

import re
from typing import Any

CATEGORIES = (
    "enquiry",
    "price_request",
    "shipping_request",
    "availability_check",
    "negotiation",
    "follow_up",
    "complaint",
    "payment",
    "supplier_message",
    "unknown",
)

_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("price_request", re.compile(
        r"\b(price|how much|cost|quotation|quote|fob|cif|usd|\$|€|£)\b", re.I,
    )),
    ("shipping_request", re.compile(
        r"\b(ship|shipping|delivery|freight|port|eta|lead time|logistics|cif|fob)\b", re.I,
    )),
    ("availability_check", re.compile(
        r"\b(available|in stock|have\b|do you have|stock|supply)\b", re.I,
    )),
    ("negotiation", re.compile(
        r"\b(too high|too expensive|discount|cheaper|best price|lower|negotiate|counter)\b", re.I,
    )),
    ("follow_up", re.compile(
        r"\b(follow up|following up|any update|still waiting|remind|checking back)\b", re.I,
    )),
    ("complaint", re.compile(
        r"\b(complaint|unhappy|delay|wrong|damaged|refund|disappointed|problem)\b", re.I,
    )),
    ("payment", re.compile(
        r"\b(pay|payment|transfer|tt|lc|letter of credit|deposit|invoice|bank)\b", re.I,
    )),
    ("supplier_message", re.compile(
        r"\b(工厂|供应商|供货|库存确认|厂家)\b",
    )),
    ("enquiry", re.compile(
        r"\b(engine|gearbox|motor|moteur|moteur|hyundai|toyota|g4k|half.?cut|truck)\b", re.I,
    )),
]


def classify_text(text: str, *, is_ceo: bool = False) -> str:
    body = (text or "").strip()
    if not body:
        return "unknown"
    if body.endswith((".jpg", ".jpeg", ".png", ".pdf", ".opus", ".mp4")) or "<Media omitted>" in body:
        return "enquiry" if not is_ceo else "follow_up"

    scores: dict[str, int] = {}
    for cat, pattern in _RULES:
        if pattern.search(body):
            scores[cat] = scores.get(cat, 0) + 1

    if not scores:
        return "unknown"
    return max(scores, key=scores.get)


def classify_messages(conversation: dict[str, Any]) -> dict[str, Any]:
    """Annotate each message with category in-place and return conversation."""
    for msg in conversation.get("messages", []):
        msg["category"] = classify_text(msg.get("text", ""), is_ceo=msg.get("is_ceo", False))
    return conversation
