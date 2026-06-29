"""APBRAIN-002 Stage 1 — Import full WhatsApp history into Conversation Database."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway import conversation_paths as cp
from customer_gateway import sales_intelligence_paths as sip
from customer_gateway.conversation_database import normalize_message, save_conversation
from customer_gateway.conversation_parser import load_all_parsed
from customer_gateway.enterprise_audit import load_all_raw_messages
from customer_gateway.message_classifier import classify_messages


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _load_import_state() -> dict[str, Any]:
    sip.ensure_dirs()
    if not sip.IMPORT_STATE_PATH.is_file():
        return {"imported_message_ids": [], "last_import": None}
    return json.loads(sip.IMPORT_STATE_PATH.read_text(encoding="utf-8"))


def _save_import_state(state: dict[str, Any]) -> None:
    sip.ensure_dirs()
    state["last_import"] = _now()
    sip.IMPORT_STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def import_from_parsed() -> dict[str, Any]:
    """Import all whatsapp_parsed conversations (full .txt export history)."""
    parsed = load_all_parsed()
    contacts = 0
    messages = 0
    for conv in parsed:
        classify_messages(conv)
        contact = conv.get("contact", "unknown")
        msgs = []
        for m in conv.get("messages", []):
            msgs.append(normalize_message(
                text=m.get("text", ""),
                timestamp=m.get("timestamp", ""),
                sender=m.get("sender", contact),
                is_ceo=m.get("is_ceo", False),
                contact=contact,
            ))
        if msgs:
            save_conversation(contact, msgs, source="whatsapp_parsed")
            contacts += 1
            messages += len(msgs)
    return {"source": "whatsapp_parsed", "contacts": contacts, "messages": messages}


def import_from_raw_archive() -> dict[str, Any]:
    """Import all memory/conversations/raw/ messages (live poll archive)."""
    raw = load_all_raw_messages()
    by_contact: dict[str, list[dict[str, Any]]] = {}
    for rec in raw:
        contact = rec.get("contact_name", "unknown")
        payload = rec.get("payload") or rec
        by_contact.setdefault(contact, []).append(normalize_message(
            text=rec.get("text", ""),
            timestamp=rec.get("timestamp") or payload.get("timestamp", ""),
            sender=contact,
            is_ceo=False,
            direction="incoming",
            contact=contact,
        ))

    contacts = 0
    messages = 0
    for contact, msgs in by_contact.items():
        save_conversation(contact, msgs, source="conversations_raw")
        contacts += 1
        messages += len(msgs)
    return {"source": "conversations_raw", "contacts": contacts, "messages": messages}


def import_from_normalized() -> dict[str, Any]:
    """Import normalized live messages if present."""
    norm_dir = cp.NORMALIZED_DIR
    if not norm_dir.is_dir():
        return {"source": "normalized", "contacts": 0, "messages": 0}

    by_contact: dict[str, list[dict[str, Any]]] = {}
    for path in norm_dir.glob("*.json"):
        try:
            rec = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        contact = rec.get("contact_name", "unknown")
        by_contact.setdefault(contact, []).append(normalize_message(
            text=rec.get("text", ""),
            timestamp=rec.get("timestamp", ""),
            sender=contact,
            is_ceo=False,
            contact=contact,
        ))

    contacts = 0
    messages = 0
    for contact, msgs in by_contact.items():
        save_conversation(contact, msgs, source="normalized")
        contacts += 1
        messages += len(msgs)
    return {"source": "normalized", "contacts": contacts, "messages": messages}


def import_from_browser(*, use_browser: bool = True) -> dict[str, Any]:
    """Paginated full-history import via browser Store API (read-only)."""
    if not use_browser:
        return {"source": "browser", "contacts": 0, "messages": 0, "skipped": True}

    from customer_gateway.whatsapp_browser_adapter import (
        WhatsAppBrowserAdapter,
        history_batch_size,
        history_per_chat_limit,
        playwright_available,
    )

    if not playwright_available():
        return {"source": "browser", "contacts": 0, "messages": 0, "error": "playwright_unavailable"}

    adapter = WhatsAppBrowserAdapter()
    try:
        batches = adapter.fetch_history_batches()
    except Exception as exc:
        return {"source": "browser", "contacts": 0, "messages": 0, "error": str(exc)}

    seen_contacts: set[str] = set()
    messages = 0
    total_chats_reported = 0
    for batch in batches:
        by_contact: dict[str, list[dict[str, Any]]] = {}
        for rec in batch:
            contact = rec.get("contact_name", "unknown")
            is_ceo = rec.get("direction") == "outgoing"
            by_contact.setdefault(contact, []).append(normalize_message(
                text=rec.get("message", ""),
                timestamp=rec.get("timestamp", ""),
                sender="CEO" if is_ceo else contact,
                is_ceo=is_ceo,
                direction=rec.get("direction", "incoming"),
                contact=contact,
            ))
        for contact, msgs in by_contact.items():
            save_conversation(contact, msgs, source="browser_history")
            seen_contacts.add(contact)
            messages += len(msgs)

    return {
        "source": "browser",
        "contacts": len(seen_contacts),
        "messages": messages,
        "batches": len(batches),
        "batch_size": history_batch_size(),
        "per_chat_limit": history_per_chat_limit(),
        "unique_contacts": len(seen_contacts),
    }


def run_full_history_import(*, include_browser: bool = False) -> dict[str, Any]:
    """Stage 1 — merge all sources into Conversation Database."""
    sip.ensure_dirs()
    results = [
        import_from_parsed(),
        import_from_raw_archive(),
        import_from_normalized(),
    ]
    if include_browser:
        results.append(import_from_browser())

    from customer_gateway.conversation_database import load_all_conversations
    from customer_gateway.contact_role_classifier import summarize_contact_roles

    all_convs = load_all_conversations()
    total_msgs = sum(c.get("message_count", 0) for c in all_convs)
    role_summary = summarize_contact_roles(all_convs)

    state = _load_import_state()
    state["last_full_import"] = _now()
    state["conversation_count"] = len(all_convs)
    state["message_count"] = total_msgs
    state["sources"] = results
    state["role_summary"] = {
        "customer_tiers": role_summary["customer_tiers"],
        "other_roles": role_summary["other_roles"],
        "effective_customers": role_summary["effective_customers"],
    }
    _save_import_state(state)

    tiers = role_summary["customer_tiers"]
    others = role_summary["other_roles"]
    msg = (
        f"历史导入完成：{len(all_convs)} 个会话，{total_msgs} 条消息。\n"
        f"有效客户: {role_summary['effective_customers']} | "
        f"A级: {tiers.get('A级客户', 0)} B级: {tiers.get('B级客户', 0)} "
        f"潜在: {tiers.get('潜在客户', 0)}\n"
        f"供应商: {others.get('供应商', 0)} | 私人: {others.get('私人', 0)} | "
        f"系统/广告: {others.get('系统/广告', 0)}"
    )
    browser = next((r for r in results if r.get("source") == "browser"), None)
    if browser and not browser.get("error"):
        msg += (
            f"\nBrowser: {browser.get('messages', 0)} 条 / "
            f"{browser.get('unique_contacts', browser.get('contacts', 0))} 联系人 "
            f"({browser.get('batches', 0)} 批, per_chat={browser.get('per_chat_limit', '?')})"
        )

    return {
        "ok": True,
        "conversation_count": len(all_convs),
        "message_count": total_msgs,
        "sources": results,
        "role_summary": role_summary,
        "message": msg,
    }
