"""WhatsApp live read-only listener — inbound only, no send/modify."""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from audit.logger import log_error, log_event
from customer_gateway import gateway_readonly as gw
from customer_gateway.gateway_readonly import assert_readonly
from customer_gateway.whatsapp_connector import SEND_ENABLED, assert_send_blocked

LISTEN_MODE = "read_only"


@dataclass
class InboundMessage:
    message_id: str
    chat_id: str
    contact_name: str
    customer_hash: str
    phone_number_hash: str
    timestamp: str
    message: str
    detected_language: str = "en"
    media_placeholder: str | None = None
    source_file: str = ""


def inbox_dir() -> Path:
    env = os.getenv("WHATSAPP_LIVE_INBOX", "").strip()
    if env:
        return Path(env).expanduser()
    return gw.INBOUND_MESSAGES_DIR


def message_fingerprint(contact: str, timestamp: str, body: str) -> str:
    raw = f"{contact}|{timestamp}|{body}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def load_processed_ids() -> set[str]:
    gw.ensure_gateway_dirs()
    if not gw.PROCESSED_MESSAGES_PATH.is_file():
        return set()
    data = json.loads(gw.PROCESSED_MESSAGES_PATH.read_text(encoding="utf-8"))
    return set(data.get("processed_ids", []))


def save_processed_ids(ids: set[str]) -> None:
    gw.ensure_gateway_dirs()
    gw.PROCESSED_MESSAGES_PATH.write_text(
        json.dumps({
            "processed_ids": sorted(ids),
            "updated_at": _now(),
        }, indent=2),
        encoding="utf-8",
    )


def load_listen_state() -> dict[str, Any]:
    gw.ensure_gateway_dirs()
    if not gw.LISTEN_STATE_PATH.is_file():
        return {"mode": LISTEN_MODE, "send_enabled": SEND_ENABLED, "running": False}
    return json.loads(gw.LISTEN_STATE_PATH.read_text(encoding="utf-8"))


def save_listen_state(state: dict[str, Any]) -> None:
    gw.ensure_gateway_dirs()
    gw.LISTEN_STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def enforce_write_blocked(operation: str) -> None:
    """Block WhatsApp write ops; audit on violation."""
    blocked_ops = (
        "send", "reply", "delete", "modify", "mark-read", "mark_read",
        "auto_reply", "auto_send",
    )
    op = operation.lower()
    if any(b in op for b in blocked_ops):
        log_error(
            f"WhatsApp write blocked: {operation}",
            context="whatsapp_live_readonly",
        )
        log_event("whatsapp_write_blocked", operation=operation, mode=LISTEN_MODE)
        assert_send_blocked(operation)
    assert_readonly(operation)


def poll_inbound_inbox() -> list[InboundMessage]:
    """Read new inbound JSON/JSONL from live inbox directory."""
    enforce_write_blocked("poll_inbound")
    directory = inbox_dir()
    directory.mkdir(parents=True, exist_ok=True)
    messages: list[InboundMessage] = []

    for path in sorted(directory.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            msg = _parse_inbound_record(data, source_file=path.name)
            if msg:
                messages.append(msg)
        except (json.JSONDecodeError, OSError):
            continue

    jsonl = directory / "inbox.jsonl"
    if jsonl.is_file():
        for line in jsonl.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                msg = _parse_inbound_record(data, source_file="inbox.jsonl")
                if msg:
                    messages.append(msg)
            except json.JSONDecodeError:
                continue

    return messages


def _parse_inbound_record(data: dict[str, Any], *, source_file: str) -> InboundMessage | None:
    from core.language_router import detect_language
    from customer_gateway.whatsapp_connector import chat_id_for, hash_phone

    body = (data.get("message") or data.get("text") or "").strip()
    if not body:
        return None

    contact = (data.get("contact_name") or data.get("contact") or "unknown").strip()
    ts = (data.get("timestamp") or _now()).strip()
    phone_hint = (data.get("phone_hint") or data.get("phone") or "")
    mid = data.get("message_id") or message_fingerprint(contact, ts, body)

    return InboundMessage(
        message_id=mid,
        chat_id=data.get("chat_id") or chat_id_for(contact, source_file),
        contact_name=contact,
        customer_hash=hash_phone(contact, phone_hint or contact),
        phone_number_hash=hash_phone(contact, phone_hint or contact),
        timestamp=ts,
        message=body,
        detected_language=data.get("detected_language") or detect_language(body, scenario="buyer"),
        media_placeholder=data.get("media_placeholder"),
        source_file=source_file,
    )


def listen_readonly() -> dict[str, Any]:
    """
    Poll inbox for unprocessed inbound customer messages.
    Does NOT send, reply, delete, or modify WhatsApp.
    """
    enforce_write_blocked("listen_readonly")
    from customer_gateway.inbound_message_router import route_inbound_batch

    processed = load_processed_ids()
    inbound = poll_inbound_inbox()
    new_msgs = [m for m in inbound if m.message_id not in processed]

    results: list[dict[str, Any]] = []
    for msg in new_msgs:
        path = gw.INBOUND_MESSAGES_DIR / f"{msg.message_id[:16]}.json"
        path.write_text(json.dumps(asdict(msg), indent=2, ensure_ascii=False), encoding="utf-8")
        processed.add(msg.message_id)

    save_processed_ids(processed)

    if new_msgs:
        results = route_inbound_batch(new_msgs)

    state = {
        "mode": LISTEN_MODE,
        "send_enabled": SEND_ENABLED,
        "running": True,
        "last_listen": _now(),
        "inbox_dir": str(inbox_dir()),
        "polled": len(inbound),
        "new_messages": len(new_msgs),
        "drafts_created": len(results),
    }
    save_listen_state(state)

    return {
        "ok": True,
        "state": state,
        "drafts": results,
        "message": (
            f"只读监听完成：新消息 {len(new_msgs)} 条，生成草稿 {len(results)} 条。"
            "未发送 WhatsApp。"
        ),
    }


def listen_status() -> str:
    state = load_listen_state()
    processed = load_processed_ids()
    pending_inbox = inbox_dir()
    lines = [
        "WhatsApp 只读监听状态",
        "=" * 32,
        f"模式: {state.get('mode', LISTEN_MODE)}",
        f"发送能力: {'启用' if state.get('send_enabled') else '禁用（安全）'}",
        f"收件箱: {pending_inbox}",
        f"上次监听: {state.get('last_listen', '从未')}",
        f"已处理消息: {len(processed)}",
        f"上次新消息: {state.get('new_messages', 0)}",
        f"上次生成草稿: {state.get('drafts_created', 0)}",
        "",
        "命令: /whatsapp listen --readonly",
        "安全: 禁止 send/reply/delete/modify/mark-read",
    ]
    return "\n".join(lines)


def format_listen_result(result: dict[str, Any]) -> str:
    if not result.get("ok"):
        return f"监听失败: {result.get('message', '')}"
    lines = [result.get("message", ""), ""]
    for d in result.get("drafts", []):
        lines.append(f"草稿 {d.get('draft_id')} | {d.get('customer_name')} | {d.get('category', '')}")
    if not result.get("drafts"):
        lines.append("（无新消息）")
    lines.append("")
    lines.append("查看: /drafts list")
    return "\n".join(lines)
