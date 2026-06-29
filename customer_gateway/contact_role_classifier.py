"""Classify WhatsApp contacts for CEO sales intelligence reports."""

from __future__ import annotations

import re
from typing import Any

_CUSTOMER_TIERS = (
    "A级客户",
    "B级客户",
    "潜在客户",
    "浅互动客户",
    "流失客户",
    "无法判断客户",
)
_OTHER_ROLES = ("供应商", "私人", "系统/广告")

_SYSTEM_RE = re.compile(
    r"(whatsapp|end-to-end|encryption|security code|missed (voice|video) call|"
    r"changed the subject|left|joined|removed|broadcast|disappearing messages)",
    re.I,
)
_SUPPLIER_RE = re.compile(r"(工厂|供应商|供货|厂家|warehouse|stock confirm)", re.I)
_PERSONAL_RE = re.compile(r"(妈妈|爸爸|老婆|老公|宝宝|吃饭|回家|周末)", re.I)
_BUSINESS_RE = re.compile(
    r"\b(engine|gearbox|g4k|hyundai|toyota|price|fob|cif|quote|enquiry|half.?cut|motor)\b",
    re.I,
)


def classify_contact_role(
    contact: str,
    messages: list[dict[str, Any]],
    *,
    intel: dict[str, Any] | None = None,
    profile: dict[str, Any] | None = None,
) -> str:
    """Return one of customer tiers or supplier/personal/system roles."""
    name = (contact or "").strip()
    if not name or name.lower() in ("unknown", "you"):
        return "无法判断客户"

    all_text = " ".join(m.get("text", "") for m in messages)
    if _SYSTEM_RE.search(name) or _SYSTEM_RE.search(all_text[:200]):
        return "系统/广告"
    if _SUPPLIER_RE.search(name) or any(
        m.get("category") == "supplier_message" for m in messages if not m.get("is_ceo")
    ):
        return "供应商"

    customer_msgs = [m for m in messages if not m.get("is_ceo")]
    if not customer_msgs:
        return "无法判断客户"

    if len(customer_msgs) <= 2 and not _BUSINESS_RE.search(all_text):
        if _PERSONAL_RE.search(all_text):
            return "私人"
        if not any(m.get("category") in ("enquiry", "price_request", "availability_check") for m in customer_msgs):
            return "浅互动客户"

    intel = intel or {}
    profile = profile or {}
    deal = bool(intel.get("deal_closed"))
    churned = bool(intel.get("churned"))
    repeat = bool(intel.get("repeat_purchaser"))
    enquiry_freq = profile.get("enquiry_frequency", 0) or sum(
        1 for m in customer_msgs
        if m.get("category") in ("enquiry", "price_request", "availability_check")
    )
    potential = profile.get("potential_level", "medium")

    if churned and not deal:
        return "流失客户"
    if deal and (repeat or enquiry_freq >= 2):
        return "A级客户"
    if deal or (potential == "high" and enquiry_freq >= 2):
        return "B级客户"
    if enquiry_freq >= 1 or _BUSINESS_RE.search(all_text):
        return "潜在客户"
    if len(customer_msgs) <= 3:
        return "浅互动客户"
    return "无法判断客户"


def summarize_contact_roles(
    conversations: list[dict[str, Any]],
    *,
    customers_intel: dict[str, dict[str, Any]] | None = None,
    profiles: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Aggregate role/tier counts across conversations."""
    intel_map = (customers_intel or {}).get("customers", customers_intel or {})
    profile_map = {
        p.get("contact_name"): p for p in (profiles or []) if p.get("contact_name")
    }

    tier_counts: dict[str, int] = {t: 0 for t in _CUSTOMER_TIERS}
    other_counts: dict[str, int] = {r: 0 for r in _OTHER_ROLES}
    by_contact: dict[str, str] = {}

    for conv in conversations:
        contact = conv.get("contact", "unknown")
        msgs = conv.get("messages", [])
        role = classify_contact_role(
            contact,
            msgs,
            intel=intel_map.get(contact, {}),
            profile=profile_map.get(contact, {}),
        )
        by_contact[contact] = role
        if role in tier_counts:
            tier_counts[role] += 1
        elif role in other_counts:
            other_counts[role] += 1

    effective = (
        tier_counts["A级客户"]
        + tier_counts["B级客户"]
        + tier_counts["潜在客户"]
    )
    return {
        "by_contact": by_contact,
        "customer_tiers": tier_counts,
        "other_roles": other_counts,
        "effective_customers": effective,
        "total_contacts": len(by_contact),
    }
