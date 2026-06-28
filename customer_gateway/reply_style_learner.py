"""Learn CEO reply style from parsed WhatsApp history."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from customer_gateway.gateway_readonly import STYLE_DIR, ensure_gateway_dirs

_GREETING_RE = re.compile(
    r"^(hi|hello|good (morning|afternoon|evening)|dear|thanks for|thank you for)\b",
    re.I,
)
_SALUTATION_RE = re.compile(r"\b(boss|my friend|brother|sir|madam|dear friend)\b", re.I)
_PRICE_RE = re.compile(
    r"\b(fob|cif|usd|\$|price is|quotation|quote|per unit|best price)\b",
    re.I,
)
_UNCERTAIN_STOCK_RE = re.compile(
    r"\b(let me check|i will check|need to confirm|not sure|verify with|"
    r"check with supplier|check availability|confirm stock)\b",
    re.I,
)
_INFO_REQUEST_RE = re.compile(
    r"\b(model|year|chassis|vin|destination|port|quantity|qty|how many|"
    r"which port|vehicle model)\b",
    re.I,
)
_REFUSAL_RE = re.compile(
    r"\b(cannot|can't|too low|below cost|minimum|best we can|sorry.*price)\b",
    re.I,
)
_FOLLOW_UP_RE = re.compile(
    r"\b(please confirm|waiting for|let me know|follow up|kindly advise|"
    r"please share|when you decide)\b",
    re.I,
)


def learn_ceo_style(parsed: list[dict[str, Any]]) -> dict[str, Any]:
    ensure_gateway_dirs()
    ceo_messages = _collect_ceo_messages(parsed)

    style = {
        "greeting_patterns": _top_matches(ceo_messages, _GREETING_RE, 5),
        "price_expression": _top_matches(ceo_messages, _PRICE_RE, 5),
        "uncertain_stock_phrases": _top_matches(ceo_messages, _UNCERTAIN_STOCK_RE, 5),
        "info_request_patterns": _top_matches(ceo_messages, _INFO_REQUEST_RE, 5),
        "low_price_refusal": _top_matches(ceo_messages, _REFUSAL_RE, 5),
        "follow_up_patterns": _top_matches(ceo_messages, _FOLLOW_UP_RE, 5),
        "salutation_habits": _salutation_habits(ceo_messages),
        "improvement_suggestions": _suggestions(parsed, ceo_messages),
        "ceo_message_count": len(ceo_messages),
        "note": "Internal analysis in Chinese; customer replies in customer language.",
    }

    STYLE_DIR.mkdir(parents=True, exist_ok=True)
    (STYLE_DIR / "ceo_style.json").write_text(
        json.dumps(style, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (STYLE_DIR / "ceo_style.md").write_text(_format_style_md(style), encoding="utf-8")
    return style


def load_ceo_style() -> dict[str, Any]:
    path = STYLE_DIR / "ceo_style.json"
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _collect_ceo_messages(parsed: list[dict[str, Any]]) -> list[str]:
    texts: list[str] = []
    for conv in parsed:
        for msg in conv.get("messages", []):
            if msg.get("is_ceo") and msg.get("text"):
                texts.append(msg["text"].strip())
    return texts


def _top_matches(texts: list[str], pattern: re.Pattern[str], limit: int) -> list[str]:
    hits = [t for t in texts if pattern.search(t)]
    if not hits:
        return []
    # Prefer shorter representative examples
    hits.sort(key=len)
    seen: set[str] = set()
    out: list[str] = []
    for h in hits:
        key = h[:60].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(h[:300])
        if len(out) >= limit:
            break
    return out


def _salutation_habits(texts: list[str]) -> list[str]:
    counter: Counter[str] = Counter()
    for t in texts:
        for m in _SALUTATION_RE.finditer(t):
            counter[m.group(0).lower()] += 1
    return [f"{word} ({count})" for word, count in counter.most_common(6)]


def _suggestions(parsed: list[dict[str, Any]], ceo_messages: list[str]) -> list[str]:
    tips: list[str] = []
    customer_msgs = [
        m for conv in parsed for m in conv.get("messages", [])
        if not m.get("is_ceo")
    ]
    enquiries = [m for m in customer_msgs if m.get("category") in (
        "enquiry", "availability_check", "price_request",
    )]
    unanswered = 0
    for conv in parsed:
        msgs = conv.get("messages", [])
        for i, msg in enumerate(msgs):
            if msg.get("is_ceo"):
                continue
            if msg.get("category") in ("enquiry", "price_request", "availability_check"):
                has_reply = any(
                    n.get("is_ceo") for n in msgs[i + 1 : i + 3]
                )
                if not has_reply:
                    unanswered += 1

    if unanswered:
        tips.append(f"{unanswered} product enquiries may lack immediate CEO follow-up — APSales can draft faster.")

    if not _top_matches(ceo_messages, _INFO_REQUEST_RE, 1) and enquiries:
        tips.append("CEO rarely asks for model/year/port — APSales drafts should prompt for missing specs.")

    if not _top_matches(ceo_messages, _UNCERTAIN_STOCK_RE, 1):
        tips.append("Add 'let me check supplier network' phrasing when stock is unconfirmed.")

    if len(ceo_messages) < 5:
        tips.append("Import more WhatsApp history to strengthen style learning.")

    if not tips:
        tips.append("Style corpus looks healthy — continue importing new chats monthly.")
    return tips


def _format_style_md(style: dict[str, Any]) -> str:
    lines = [
        "# CEO Reply Style (learned from WhatsApp history)",
        "",
        f"CEO messages analyzed: {style.get('ceo_message_count', 0)}",
        "",
        "## Greeting patterns",
    ]
    for item in style.get("greeting_patterns", []):
        lines.append(f"- {item}")
    lines.extend(["", "## Price expression"])
    for item in style.get("price_expression", []):
        lines.append(f"- {item}")
    lines.extend(["", "## Uncertain stock phrasing"])
    for item in style.get("uncertain_stock_phrases", []):
        lines.append(f"- {item}")
    lines.extend(["", "## Request vehicle/port details"])
    for item in style.get("info_request_patterns", []):
        lines.append(f"- {item}")
    lines.extend(["", "## Low price refusal"])
    for item in style.get("low_price_refusal", []):
        lines.append(f"- {item}")
    lines.extend(["", "## Follow-up / confirmation"])
    for item in style.get("follow_up_patterns", []):
        lines.append(f"- {item}")
    lines.extend(["", "## Salutation habits"])
    for item in style.get("salutation_habits", []):
        lines.append(f"- {item}")
    lines.extend(["", "## Improvement suggestions"])
    for item in style.get("improvement_suggestions", []):
        lines.append(f"- {item}")
    lines.append("")
    lines.append("*Read-only gateway — drafts only, never auto-send.*")
    return "\n".join(lines)
