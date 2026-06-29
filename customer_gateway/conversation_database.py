"""APBRAIN-002 — Conversation Database with per-contact timelines."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway import sales_intelligence_paths as sip
from customer_gateway.gateway_readonly import CEO_SENDER_ALIASES
from customer_gateway.message_classifier import classify_text

_WON_RE = re.compile(
    r"\b(confirm order|payment sent|paid|deposit|tt copy|lc opened|成交|已付款|已发货)\b",
    re.I,
)
_QUOTE_RE = re.compile(
    r"\b(quotation|quote|fob|cif|usd|\$|price is|报价)\b",
    re.I,
)
_ENQUIRY_RE = re.compile(
    r"\b(enquiry|inquiry|do you have|price|available|engine|gearbox)\b",
    re.I,
)
_MEDIA_RE = re.compile(r"\[media\]|image omitted|video omitted|\.(jpg|opus|mp4)", re.I)
_VOICE_RE = re.compile(r"\.opus|\[voice\]|audio", re.I)
_FOB_RE = re.compile(r"\bfob\b", re.I)
_CIF_RE = re.compile(r"\bcif\b", re.I)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _slug(contact: str) -> str:
    slug = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", (contact or "unknown").lower()).strip("-")
    return (slug[:48] or "unknown")


def conversation_path(contact: str) -> Path:
    return sip.CONVERSATIONS_DIR / f"{_slug(contact)}.json"


def timeline_path(contact: str) -> Path:
    return sip.TIMELINES_DIR / f"{_slug(contact)}.json"


def _parse_ts(ts: str) -> datetime | None:
    if not ts:
        return None
    for fmt in (
        "%d/%m/%Y, %H:%M:%S",
        "%d/%m/%Y, %H:%M",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(ts.strip()[:19], fmt)
        except ValueError:
            continue
    return None


def _msg_key(msg: dict[str, Any]) -> str:
    return f"{msg.get('timestamp', '')}|{msg.get('sender', '')}|{msg.get('text', '')[:80]}"


def merge_messages(existing: list[dict[str, Any]], new_msgs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = {_msg_key(m) for m in existing}
    merged = list(existing)
    for msg in new_msgs:
        if _msg_key(msg) not in seen:
            merged.append(msg)
            seen.add(_msg_key(msg))
    merged.sort(key=lambda m: _parse_ts(m.get("timestamp", "")) or datetime.min)
    return merged


def normalize_message(
    *,
    text: str,
    timestamp: str = "",
    sender: str = "",
    is_ceo: bool | None = None,
    direction: str = "incoming",
    contact: str = "",
) -> dict[str, Any]:
    if is_ceo is None:
        is_ceo = sender.strip().lower() in CEO_SENDER_ALIASES or direction == "outgoing"
    cat = classify_text(text, is_ceo=is_ceo)
    return {
        "timestamp": timestamp or _now(),
        "sender": sender or contact,
        "is_ceo": is_ceo,
        "direction": "outgoing" if is_ceo else "incoming",
        "text": text,
        "category": cat,
        "has_media": bool(_MEDIA_RE.search(text)),
        "has_voice": bool(_VOICE_RE.search(text)),
        "mentions_fob": bool(_FOB_RE.search(text)),
        "mentions_cif": bool(_CIF_RE.search(text)),
    }


def build_timeline(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build milestone timeline for a conversation."""
    events: list[dict[str, Any]] = []
    customer_msgs = [m for m in messages if not m.get("is_ceo")]
    ceo_msgs = [m for m in messages if m.get("is_ceo")]

    if customer_msgs:
        first = customer_msgs[0]
        events.append({
            "date": (first.get("timestamp") or "")[:10],
            "event": "first_contact",
            "label": "第一次联系",
            "message_preview": first.get("text", "")[:80],
        })

    for msg in customer_msgs:
        text = msg.get("text", "")
        cat = msg.get("category", "")
        ts = (msg.get("timestamp") or "")[:10]
        if cat in ("enquiry", "availability_check", "price_request") or _ENQUIRY_RE.search(text):
            if not any(e["event"] == "first_enquiry" for e in events):
                events.append({
                    "date": ts,
                    "event": "first_enquiry",
                    "label": "第一次询价",
                    "message_preview": text[:80],
                })
            break

    for msg in ceo_msgs:
        if _QUOTE_RE.search(msg.get("text", "")):
            events.append({
                "date": (msg.get("timestamp") or "")[:10],
                "event": "first_quote",
                "label": "第一次报价",
                "message_preview": msg.get("text", "")[:80],
            })
            break

    for msg in messages:
        if _WON_RE.search(msg.get("text", "")):
            events.append({
                "date": (msg.get("timestamp") or "")[:10],
                "event": "first_deal",
                "label": "第一次成交",
                "message_preview": msg.get("text", "")[:80],
            })
            break

    enquiry_years = sorted({
        (m.get("timestamp") or "")[:4]
        for m in customer_msgs
        if m.get("category") in ("enquiry", "availability_check", "price_request")
        and (m.get("timestamp") or "")[:4].isdigit()
    })
    if len(enquiry_years) >= 2:
        events.append({
            "date": enquiry_years[-1],
            "event": "repeat_purchase",
            "label": "再次采购",
            "message_preview": f"跨 {enquiry_years[0]}–{enquiry_years[-1]} 年复购信号",
        })

    latest_product = ""
    for msg in reversed(customer_msgs):
        if re.search(r"\bG4K[A-Z]?|1NZ|2KD|engine\b", msg.get("text", ""), re.I):
            latest_product = msg.get("text", "")[:60]
            break
    if latest_product:
        events.append({
            "date": (customer_msgs[-1].get("timestamp") or "")[:10] if customer_msgs else "",
            "event": "latest_enquiry",
            "label": "最近询盘",
            "message_preview": latest_product,
        })

    return events


def save_conversation(contact: str, messages: list[dict[str, Any]], *, source: str = "import") -> dict[str, Any]:
    sip.ensure_dirs()
    path = conversation_path(contact)
    existing: list[dict[str, Any]] = []
    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            existing = data.get("messages", [])
        except (json.JSONDecodeError, OSError):
            existing = []

    merged = merge_messages(existing, messages)
    sources = [source]
    if path.is_file():
        try:
            old = json.loads(path.read_text(encoding="utf-8"))
            sources = sorted(set(old.get("sources", []) + [source]))
        except (json.JSONDecodeError, OSError):
            pass

    record = {
        "contact": contact,
        "conversation_id": _slug(contact),
        "message_count": len(merged),
        "messages": merged,
        "sources": sources,
        "updated_at": _now(),
    }

    path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")

    timeline = build_timeline(merged)
    timeline_path(contact).write_text(
        json.dumps({
            "contact": contact,
            "timeline": timeline,
            "updated_at": _now(),
        }, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return record


def load_all_conversations() -> list[dict[str, Any]]:
    sip.ensure_dirs()
    out: list[dict[str, Any]] = []
    for path in sorted(sip.CONVERSATIONS_DIR.glob("*.json")):
        try:
            out.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return out


def load_timeline(contact: str) -> list[dict[str, Any]]:
    path = timeline_path(contact)
    if not path.is_file():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("timeline", [])
