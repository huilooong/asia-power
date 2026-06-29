"""Normalize raw WhatsApp messages into a standard conversation schema."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway import conversation_paths as cp
from customer_gateway.whatsapp_connector import hash_phone


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def normalized_path(message_id: str) -> Path:
    return cp.NORMALIZED_DIR / f"{message_id[:32]}.json"


def normalized_exists(message_id: str) -> bool:
    return normalized_path(message_id).is_file()


def normalize_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Build normalized record from inbox/raw payload."""
    contact = (payload.get("contact_name") or payload.get("contact") or "unknown").strip()
    text = (payload.get("message") or payload.get("text") or "").strip()
    phone_hash = payload.get("phone_number_hash") or hash_phone(contact, contact)
    message_id = str(payload.get("message_id") or "").strip()
    conversation_id = str(payload.get("chat_id") or payload.get("conversation_id") or phone_hash)

    return {
        "message_id": message_id,
        "conversation_id": conversation_id,
        "contact_name": contact,
        "contact_hash": hash_phone(contact, contact),
        "phone_hash": phone_hash,
        "timestamp": payload.get("timestamp") or _now(),
        "direction": payload.get("direction") or "incoming",
        "text": text,
        "source": payload.get("source") or "whatsapp_business_app",
        "connector": payload.get("connector") or "business_web_readonly",
        "read_only": True,
        "normalized_at": _now(),
    }


def save_normalized(record: dict[str, Any]) -> Path | None:
    cp.ensure_conversation_dirs()
    message_id = str(record.get("message_id") or "").strip()
    if not message_id or not record.get("text"):
        return None
    path = normalized_path(message_id)
    if path.is_file():
        return path
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def list_normalized(*, limit: int = 20) -> list[dict[str, Any]]:
    cp.ensure_conversation_dirs()
    files = sorted(cp.NORMALIZED_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    out: list[dict[str, Any]] = []
    for path in files[:limit]:
        try:
            out.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return out


def load_unanalyzed_normalized() -> list[dict[str, Any]]:
    from customer_gateway.conversation_analyzer import analysis_exists

    cp.ensure_conversation_dirs()
    pending: list[dict[str, Any]] = []
    for path in sorted(cp.NORMALIZED_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime):
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        mid = str(record.get("message_id") or "")
        if mid and not analysis_exists(mid):
            pending.append(record)
    return pending
