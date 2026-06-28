"""Parse WhatsApp exported .txt conversations into structured messages."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from core.language_router import detect_language
from customer_gateway.gateway_readonly import CEO_SENDER_ALIASES, PARSED_DIR, ensure_gateway_dirs
from sales_core.platform_supply import extract_product_keywords

# [DD/MM/YYYY, HH:MM:SS] Name: message
_BRACKET_RE = re.compile(
    r"^\[(\d{1,2}/\d{1,2}/\d{2,4},\s*\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.*)$",
)
# 01/06/2024, 10:30 - Name: message  (Android)
_DASH_RE = re.compile(
    r"^(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2})\s*-\s*([^:]+):\s*(.*)$",
)

_COUNTRY_PORT_RE = re.compile(
    r"\b(Ghana|Togo|Benin|Nigeria|Kenya|Tanzania|Dubai|Lagos|Tema|Abidjan|"
    r"Mombasa|Dar es Salaam|Cotonou|Lome|Accra|Douala|Luanda|"
    r"FOB|CIF|[A-Z]{2,3}\s+port)\b",
    re.I,
)
_ATTACHMENT_RE = re.compile(
    r"^(<Media omitted>|\u200e?image omitted|\u200e?video omitted|"
    r".+\.(jpg|jpeg|png|pdf|opus|mp4|webp))$",
    re.I,
)


def parse_whatsapp_txt(path: Path, *, original_name: str = "") -> dict[str, Any]:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    messages: list[dict[str, Any]] = []
    contact_name = _guess_contact_from_filename(path.stem)

    for line in lines:
        line = line.strip()
        if not line:
            continue
        parsed = _parse_line(line)
        if not parsed:
            if messages:
                messages[-1]["text"] += "\n" + line
            continue

        ts, sender, body = parsed
        is_ceo = _is_ceo_sender(sender)
        if not is_ceo and sender.strip():
            contact_name = sender.strip()

        attachment = None
        if _ATTACHMENT_RE.match(body.strip()):
            attachment = body.strip()

        messages.append({
            "timestamp": ts,
            "sender": sender.strip(),
            "is_ceo": is_ceo,
            "text": body,
            "attachment": attachment,
            "product_keywords": extract_product_keywords(body),
            "countries_ports": _extract_countries_ports(body),
            "language": detect_language(body, scenario="buyer"),
            "category": "unknown",
        })

    return {
        "source_file": original_name or path.name,
        "raw_file": path.name,
        "contact": contact_name,
        "message_count": len(messages),
        "messages": messages,
        "parsed_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    }


def _parse_line(line: str) -> tuple[str, str, str] | None:
    m = _BRACKET_RE.match(line)
    if m:
        return m.group(1), m.group(2), m.group(3)

    m = _DASH_RE.match(line)
    if m:
        ts = f"{m.group(1)}, {m.group(2)}"
        return ts, m.group(3), m.group(4)
    return None


def _is_ceo_sender(sender: str) -> bool:
    return sender.strip().lower() in CEO_SENDER_ALIASES


def _guess_contact_from_filename(stem: str) -> str:
    # 20240601-103015_Ghana Motors Trading_abc123
    parts = stem.split("_")
    if len(parts) >= 2:
        candidate = parts[1]
        if candidate and not candidate.isdigit():
            return candidate.replace("-", " ")
    return "unknown"


def _extract_countries_ports(text: str) -> list[str]:
    found: list[str] = []
    for m in _COUNTRY_PORT_RE.finditer(text or ""):
        val = m.group(0).strip()
        if val.lower() not in {x.lower() for x in found}:
            found.append(val)
    return found[:5]


def save_parsed_conversation(conversation: dict[str, Any]) -> Path:
    ensure_gateway_dirs()
    contact = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", conversation.get("contact", "unknown").lower()).strip("-")
    slug = contact[:48] or "unknown"
    raw = conversation.get("raw_file", "chat")
    digest = raw[:20].replace(" ", "")
    out = PARSED_DIR / f"{slug}_{digest}.json"
    out.write_text(json.dumps(conversation, indent=2, ensure_ascii=False), encoding="utf-8")
    return out


def load_all_parsed() -> list[dict[str, Any]]:
    ensure_gateway_dirs()
    results: list[dict[str, Any]] = []
    for path in sorted(PARSED_DIR.glob("*.json")):
        try:
            results.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return results


def search_messages(
    parsed: list[dict[str, Any]],
    query: str,
    *,
    limit: int = 10,
) -> list[dict[str, Any]]:
    q = query.lower()
    hits: list[dict[str, Any]] = []
    for conv in parsed:
        contact = conv.get("contact", "")
        for msg in conv.get("messages", []):
            blob = (msg.get("text") or "").lower()
            kws = " ".join(msg.get("product_keywords", [])).lower()
            if q in blob or q in kws or q in contact.lower():
                hits.append({**msg, "contact": contact})
                if len(hits) >= limit:
                    return hits
    return hits


def search_similar_product_replies(
    parsed: list[dict[str, Any]],
    keywords: list[str],
    *,
    limit: int = 3,
) -> list[dict[str, Any]]:
    if not keywords:
        return []
    keyset = {k.upper() for k in keywords}
    results: list[dict[str, Any]] = []

    for conv in parsed:
        msgs = conv.get("messages", [])
        for i, msg in enumerate(msgs):
            msg_keys = {k.upper() for k in msg.get("product_keywords", [])}
            if not keyset & msg_keys:
                continue
            product = next(iter(keyset & msg_keys), keywords[0])
            ceo_reply = ""
            for nxt in msgs[i + 1 : i + 4]:
                if nxt.get("is_ceo") and nxt.get("text"):
                    ceo_reply = nxt["text"]
                    break
            if ceo_reply:
                results.append({
                    "product": product,
                    "customer_message": msg.get("text", "")[:200],
                    "ceo_reply": ceo_reply,
                    "contact": conv.get("contact"),
                })
            if len(results) >= limit:
                return results
    return results
