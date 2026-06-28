"""Build per-customer profiles from parsed WhatsApp conversations."""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway.gateway_readonly import PATTERNS_DIR, PROFILES_DIR, ensure_gateway_dirs

_NEGOTIATION_RE = re.compile(
    r"\b(too high|discount|cheaper|best price|lower|negotiate)\b", re.I,
)
_PRICE_SENSITIVE_RE = re.compile(
    r"\b(too expensive|too high|cheaper|discount|best price|lowest)\b", re.I,
)
_FOLLOW_UP_RE = re.compile(
    r"\b(any update|follow up|still waiting|checking back)\b", re.I,
)
_PORT_RE = re.compile(
    r"\b(tema|lagos|mombasa|cotonou|lome|abidjan|port)\b", re.I,
)


def build_all_profiles(parsed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ensure_gateway_dirs()
    by_contact: dict[str, list[dict[str, Any]]] = {}
    for conv in parsed:
        contact = conv.get("contact", "unknown")
        by_contact.setdefault(contact, []).extend(conv.get("messages", []))

    profiles: list[dict[str, Any]] = []
    for contact, messages in by_contact.items():
        profile = build_profile(contact, messages)
        profiles.append(profile)
        _save_profile(profile)

    _save_enquiry_patterns(parsed, profiles)
    return profiles


def build_profile(contact: str, messages: list[dict[str, Any]]) -> dict[str, Any]:
    customer_msgs = [m for m in messages if not m.get("is_ceo")]
    langs = Counter(m.get("language", "en") for m in customer_msgs if m.get("text"))
    products: Counter[str] = Counter()
    countries: Counter[str] = Counter()
    ports: Counter[str] = Counter()
    categories: Counter[str] = Counter()

    for m in customer_msgs:
        for p in m.get("product_keywords", []):
            products[p.upper()] += 1
        for c in m.get("countries_ports", []):
            if _PORT_RE.search(c) or c.lower() in ("tema", "lagos", "mombasa"):
                ports[c.title()] += 1
            elif c.upper() not in ("FOB", "CIF"):
                countries[c.title()] += 1
        cat = m.get("category", "unknown")
        if cat != "unknown":
            categories[cat] += 1

    negotiation_count = sum(1 for m in customer_msgs if _NEGOTIATION_RE.search(m.get("text", "")))
    price_sensitive = negotiation_count >= 2 or any(
        _PRICE_SENSITIVE_RE.search(m.get("text", "")) for m in customer_msgs
    )

    enquiry_freq = sum(
        1 for m in customer_msgs
        if m.get("category") in ("enquiry", "availability_check", "price_request")
    )
    last_ts = _latest_timestamp(messages)
    follow_up = (
        categories.get("follow_up", 0) > 0
        or any(_FOLLOW_UP_RE.search(m.get("text", "")) for m in customer_msgs)
    )

    potential = "medium"
    if products and (categories.get("price_request", 0) >= 2 or enquiry_freq >= 2):
        potential = "high"
    elif not products:
        potential = "low"

    response_quality = _assess_response_quality(messages)
    next_action = _next_action(potential, follow_up, categories, response_quality)

    return {
        "contact_name": contact,
        "preferred_language": langs.most_common(1)[0][0] if langs else "en",
        "country": countries.most_common(1)[0][0] if countries else "",
        "destination_port": ports.most_common(1)[0][0] if ports else "",
        "interested_products": [p for p, _ in products.most_common(10)],
        "enquiry_frequency": enquiry_freq,
        "countries_ports": [c for c, _ in countries.most_common(8)],
        "price_sensitivity": "high" if price_sensitive else "normal",
        "negotiation_style": (
            "active_bargainer" if negotiation_count >= 2
            else "occasional" if negotiation_count == 1
            else "standard"
        ),
        "response_quality": response_quality,
        "message_categories": dict(categories.most_common()),
        "last_contact": last_ts,
        "follow_up_needed": follow_up,
        "potential_level": potential,
        "next_action": next_action,
        "message_count": len(customer_msgs),
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    }


def _assess_response_quality(messages: list[dict[str, Any]]) -> str:
    """How well CEO responses progressed the conversation."""
    positive = 0
    negative = 0
    for i, msg in enumerate(messages):
        if not msg.get("is_ceo"):
            continue
        following = [m for m in messages[i + 1 : i + 3] if not m.get("is_ceo")]
        if not following:
            continue
        nxt = following[0]
        if nxt.get("category") in ("payment", "follow_up", "shipping_request"):
            positive += 1
        elif nxt.get("category") in ("negotiation", "complaint"):
            negative += 1
    if positive > negative:
        return "good"
    if negative > positive:
        return "needs_improvement"
    return "average"


def _next_action(
    potential: str,
    follow_up: bool,
    categories: Counter[str],
    response_quality: str,
) -> str:
    if categories.get("follow_up", 0) > 0:
        return "contact_today"
    if follow_up and potential == "high":
        return "contact_today"
    if follow_up and potential == "medium":
        return "contact_this_week"
    if potential == "low" and response_quality == "needs_improvement":
        return "archive"
    if potential in ("high", "medium") and response_quality != "good":
        return "reactivate"
    return "monitor"


def load_profiles() -> list[dict[str, Any]]:
    ensure_gateway_dirs()
    profiles: list[dict[str, Any]] = []
    for path in sorted(PROFILES_DIR.glob("*.json")):
        try:
            profiles.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return profiles


def find_profile_by_hint(hint: str, profiles: list[dict[str, Any]]) -> dict[str, Any] | None:
    hint_l = (hint or "").lower()
    for prof in profiles:
        name = prof.get("contact_name", "").lower()
        if name and name in hint_l:
            return prof
        for p in prof.get("interested_products", []):
            if p.lower() in hint_l:
                return prof
    return None


def format_followups_report(profiles: list[dict[str, Any]] | None = None) -> str:
    profiles = profiles or load_profiles()
    if not profiles:
        return "暂无客户画像。请先 /whatsapp import 或 /whatsapp sync --readonly"

    buckets: dict[str, list[str]] = {
        "今天联系": [],
        "本周联系": [],
        "重新激活": [],
        "持续观察": [],
        "归档": [],
    }
    action_map = {
        "contact_today": "今天联系",
        "contact_this_week": "本周联系",
        "reactivate": "重新激活",
        "archive": "归档",
        "monitor": "持续观察",
    }

    for p in profiles:
        action = p.get("next_action", "monitor")
        label = action_map.get(action, "持续观察")
        name = p.get("contact_name", "?")
        products = ", ".join(p.get("interested_products", [])[:3])
        buckets[label].append(f"{name}（{products or '无产品'} | {p.get('potential_level')}）")

    lines = ["客户跟进清单（中文）", "=" * 32, ""]
    for label, items in buckets.items():
        lines.append(f"## {label}")
        if items:
            for item in items:
                lines.append(f"  - {item}")
        else:
            lines.append("  （无）")
        lines.append("")
    lines.append("只读模式 — APSales 生成草稿，CEO 审批后发送。")
    return "\n".join(lines)


def _save_profile(profile: dict[str, Any]) -> Path:
    slug = re.sub(
        r"[^a-z0-9\u4e00-\u9fff]+", "-",
        profile.get("contact_name", "unknown").lower(),
    ).strip("-")[:48] or "unknown"
    path = PROFILES_DIR / f"{slug}.json"
    path.write_text(json.dumps(profile, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def _save_enquiry_patterns(
    parsed: list[dict[str, Any]],
    profiles: list[dict[str, Any]],
) -> None:
    products: Counter[str] = Counter()
    categories: Counter[str] = Counter()
    for conv in parsed:
        for msg in conv.get("messages", []):
            if msg.get("is_ceo"):
                continue
            for p in msg.get("product_keywords", []):
                products[p.upper()] += 1
            cat = msg.get("category", "unknown")
            if cat != "unknown":
                categories[cat] += 1

    data = {
        "top_products": products.most_common(20),
        "top_categories": categories.most_common(20),
        "profile_count": len(profiles),
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    }
    PATTERNS_DIR.mkdir(parents=True, exist_ok=True)
    (PATTERNS_DIR / "patterns.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def _latest_timestamp(messages: list[dict[str, Any]]) -> str:
    ts = [m.get("timestamp", "") for m in messages if m.get("timestamp")]
    return ts[-1] if ts else ""
