"""APBRAIN-002 Stage 1 — Import full WhatsApp history into Conversation Database."""

from __future__ import annotations

import hashlib
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


def _conv_content_hash(conv: dict[str, Any]) -> str:
    msgs = conv.get("messages", [])
    blob = "|".join(
        f"{m.get('timestamp', '')}|{m.get('sender', '')}|{m.get('text', '')}"
        for m in msgs
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _dominant_customer_contact(conv: dict[str, Any]) -> str:
    contact = (conv.get("contact") or "unknown").strip() or "unknown"
    senders: dict[str, int] = {}
    for m in conv.get("messages", []):
        if m.get("is_ceo"):
            continue
        sender = (m.get("sender") or "").strip()
        if sender and sender.lower() not in {"ceo", "you"}:
            senders[sender] = senders.get(sender, 0) + 1
    if senders:
        return max(senders.items(), key=lambda x: x[1])[0]
    return contact


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
    seen_hashes: set[str] = set()
    contacts = 0
    messages = 0
    skipped_duplicates = 0
    for conv in parsed:
        digest = _conv_content_hash(conv)
        if digest in seen_hashes:
            skipped_duplicates += 1
            continue
        seen_hashes.add(digest)
        classify_messages(conv)
        contact = _dominant_customer_contact(conv)
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
    return {
        "source": "whatsapp_parsed",
        "contacts": contacts,
        "messages": messages,
        "skipped_duplicates": skipped_duplicates,
    }


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


def _flush_browser_progress(meta: dict[str, Any], *, messages: int = 0) -> None:
    """Persist in-flight browser import progress (readonly state file only)."""
    sip.ensure_dirs()
    state = _load_import_state()
    state["browser_import"] = {
        "loaded_chats": meta.get("loaded_chats", 0),
        "processed_chats": meta.get("processed_chats", 0),
        "messages_imported": meta.get("messages_imported", messages),
        "skipped_private": meta.get("skipped_private", 0),
        "failed_chats": meta.get("failed_chats", 0),
        "data_coverage": meta.get("data_coverage", "unknown"),
        "limitation_reason": meta.get("limitation_reason", ""),
        "error": meta.get("error"),
        "in_progress": True,
    }
    state["last_import"] = _now()
    _save_import_state(state)


def import_from_browser(*, use_browser: bool = True) -> dict[str, Any]:
    """Paginated full-history import via browser Store API (read-only)."""
    if not use_browser:
        return {"source": "browser", "contacts": 0, "messages": 0, "skipped": True}

    from customer_gateway.whatsapp_browser_adapter import (
        WhatsAppBrowserAdapter,
        _hash_chat_id,
        history_batch_size,
        history_per_chat_limit,
        playwright_available,
    )

    if not playwright_available():
        return {"source": "browser", "contacts": 0, "messages": 0, "error": "playwright_unavailable"}

    adapter = WhatsAppBrowserAdapter()
    seen_contacts: set[str] = set()
    messages = 0

    def _persist_batch(batch: list[dict[str, Any]]) -> None:
        nonlocal messages
        by_chat: dict[tuple[str, str], list[dict[str, Any]]] = {}
        for rec in batch:
            contact = rec.get("contact_name", "unknown")
            raw_chat = rec.get("chat_id_raw") or contact
            chat_key = _hash_chat_id(raw_chat)
            is_ceo = rec.get("direction") == "outgoing"
            by_chat.setdefault((chat_key, contact), []).append(normalize_message(
                text=rec.get("message", ""),
                timestamp=rec.get("timestamp", ""),
                sender="CEO" if is_ceo else contact,
                is_ceo=is_ceo,
                direction=rec.get("direction", "incoming"),
                contact=contact,
            ))
        for (chat_key, contact), msgs in by_chat.items():
            save_conversation(contact, msgs, source="browser_history", conversation_id=chat_key)
            seen_contacts.add(contact)
            messages += len(msgs)
        meta = getattr(adapter, "last_import_meta", {}) or {}
        meta["messages_imported"] = messages
        _flush_browser_progress(meta, messages=messages)

    def _on_progress(done: int, total: int, _stats: dict[str, Any]) -> None:
        meta = getattr(adapter, "last_import_meta", {}) or {}
        _flush_browser_progress(meta, messages=messages)

    try:
        batches = adapter.fetch_history_batches(on_batch=_persist_batch, on_progress=_on_progress)
    except Exception as exc:
        meta = getattr(adapter, "last_import_meta", {}) or {}
        meta["error"] = str(exc)
        cov, reason = compute_data_coverage(meta)
        return {
            "source": "browser",
            "contacts": len(seen_contacts),
            "messages": messages,
            "error": str(exc),
            "import_meta": meta,
            "loaded_chats": meta.get("loaded_chats", 0),
            "processed_chats": meta.get("processed_chats", 0),
            "messages_imported": messages,
            "skipped_private": meta.get("skipped_private", 0),
            "failed_chats": meta.get("failed_chats", 0),
            "data_coverage": cov,
            "limitation_reason": reason,
        }

    meta = getattr(adapter, "last_import_meta", {}) or {}
    if not messages and batches:
        for batch in batches:
            _persist_batch(batch)

    coverage = meta.get("data_coverage", "unknown")
    limitation = meta.get("limitation_reason", "")

    return {
        "source": "browser",
        "contacts": len(seen_contacts),
        "messages": messages,
        "batches": len(batches),
        "batch_size": history_batch_size(),
        "per_chat_limit": history_per_chat_limit(),
        "unique_contacts": len(seen_contacts),
        "import_meta": meta,
        "loaded_chats": meta.get("loaded_chats", 0),
        "processed_chats": meta.get("processed_chats", 0),
        "messages_imported": messages,
        "skipped_private": meta.get("skipped_private", 0),
        "failed_chats": meta.get("failed_chats", 0),
        "data_coverage": coverage,
        "limitation_reason": limitation,
        "chats_in_store": meta.get("total_chats_in_store"),
        "chats_processed": meta.get("chats_processed"),
        "avg_msgs_in_store_per_chat": meta.get("avg_msgs_in_store_per_chat"),
        "error": meta.get("error"),
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

    # Persist per-contact tiers (previously only aggregate counts were kept).
    try:
        sip.ensure_dirs()
        tiers_payload = {
            "updated_at": _now(),
            "total_contacts": role_summary.get("total_contacts", len(role_summary.get("by_contact") or {})),
            "customer_tiers": role_summary["customer_tiers"],
            "other_roles": role_summary["other_roles"],
            "effective_customers": role_summary["effective_customers"],
            "by_contact": role_summary.get("by_contact") or {},
        }
        sip.CUSTOMER_TIERS_PATH.write_text(
            json.dumps(tiers_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    except OSError:
        pass

    # Phase 3 CRM: vehicle inquiry extract (wired; result recorded, never fails import).
    from customer_gateway.vehicle_entity_extractor import run_vehicle_inquiry_extract

    vehicle_extract = run_vehicle_inquiry_extract(all_convs)

    state = _load_import_state()
    state["last_full_import"] = _now()
    state["conversation_count"] = len(all_convs)
    state["message_count"] = total_msgs
    state["sources"] = results
    state["vehicle_inquiry_extract"] = vehicle_extract
    state["role_summary"] = {
        "customer_tiers": role_summary["customer_tiers"],
        "other_roles": role_summary["other_roles"],
        "effective_customers": role_summary["effective_customers"],
    }
    browser = next((r for r in results if r.get("source") == "browser"), None)
    if browser:
        state["browser_import"] = {
            "loaded_chats": browser.get("loaded_chats"),
            "processed_chats": browser.get("processed_chats"),
            "messages_imported": browser.get("messages_imported"),
            "skipped_private": browser.get("skipped_private"),
            "failed_chats": browser.get("failed_chats"),
            "data_coverage": browser.get("data_coverage"),
            "limitation_reason": browser.get("limitation_reason"),
            "error": browser.get("error"),
            "in_progress": False,
        }
    _save_import_state(state)

    tiers = role_summary["customer_tiers"]
    others = role_summary["other_roles"]
    msg = ""
    if include_browser and browser:
        cov = browser.get("data_coverage", "unknown")
        bmsgs = browser.get("messages_imported", 0)
        msg = (
            f"Browser 历史导入\n"
            f"- loaded_chats: {browser.get('loaded_chats', 0)}\n"
            f"- processed_chats: {browser.get('processed_chats', 0)}\n"
            f"- messages_imported: {bmsgs}\n"
            f"- failed_chats: {browser.get('failed_chats', 0)}\n"
            f"- DATA COVERAGE: {cov}"
        )
        if browser.get("limitation_reason"):
            msg += f"\n- limitation_reason: {browser['limitation_reason']}"
        if browser.get("error"):
            msg += f"\n- ERROR: {browser['error']}"
        if bmsgs <= 50:
            msg += (
                "\n\n⚠️ Browser 未读到有效历史（≤50 条）。"
                " 下方 DB 总量可能含 parsed/raw 旧归档，不能称为全量。"
                "\n  请确认: WHATSAPP_BROWSER_HEADLESS=false + 扫码登录 + 关闭占用 profile 的 Chrome。"
            )
        msg += "\n\n--- Conversation DB（合并所有来源）---"
    msg += (
        f"\n历史导入完成\n"
        f"- conversations imported: {len(all_convs)}\n"
        f"- messages imported: {total_msgs}\n"
        f"- contacts counted: {role_summary['total_contacts']}\n"
        f"- customer contacts (有效客户): {role_summary['effective_customers']}\n"
        f"- supplier contacts: {others.get('供应商', 0)}\n"
        f"- private/system contacts: {others.get('私人', 0) + others.get('系统/广告', 0)}\n"
        f"客户分类: A级 {tiers.get('A级客户', 0)} | B级 {tiers.get('B级客户', 0)} | "
        f"潜在 {tiers.get('潜在客户', 0)} | 浅互动 {tiers.get('浅互动客户', 0)} | "
        f"流失 {tiers.get('流失客户', 0)}\n"
        f"- vehicle_inquiries files: {vehicle_extract.get('contacts_with_inquiries', 0)} "
        f"(ok={vehicle_extract.get('ok')})"
    )
    if include_browser and browser:
        pass  # browser block already prepended
    elif browser:
        if browser.get("error"):
            msg += f"\nBrowser import: ERROR — {browser['error']}"
        else:
            msg += (
                f"\nBrowser batch: {browser.get('messages', 0)} msgs / "
                f"{browser.get('unique_contacts', 0)} contacts"
            )
            meta = browser.get("import_meta") or {}
            if meta.get("total_chats_in_store"):
                msg += (
                    f"\nBrowser store: {meta.get('total_chats_in_store')} chats, "
                    f"processed {meta.get('chats_processed')}, "
                    f"avg {meta.get('avg_msgs_in_store_per_chat', '?')} msgs/chat in Store"
                )
            limits = meta.get("limits") or {}
            if limits.get("note"):
                msg += f"\n限制: {limits['note']}"

    return {
        "ok": True,
        "conversation_count": len(all_convs),
        "message_count": total_msgs,
        "sources": results,
        "role_summary": role_summary,
        "vehicle_inquiry_extract": vehicle_extract,
        "message": msg,
    }
