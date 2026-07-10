"""Poll WhatsApp Business App session for new inbound messages → WHATSAPP_LIVE_INBOX."""

from __future__ import annotations

import fcntl
import hashlib
import json
import re
from pathlib import Path
from typing import Any

from customer_gateway.whatsapp_business_session import (
    load_poll_state,
    save_poll_state,
    update_poll_stats,
    update_sync_time,
)
from customer_gateway.whatsapp_business_web_connector import (
    WhatsAppBusinessWebConnector,
    enforce_write_blocked,
)
from customer_gateway.whatsapp_live_adapter import NormalizedLiveMessage
from customer_gateway.whatsapp_live_readonly import inbox_dir

POLL_LOCK_PATH = Path(__file__).resolve().parent.parent / "memory" / "customer_gateway" / "whatsapp_poll.lock"


def _stable_body_key(msg: NormalizedLiveMessage) -> str:
    body = re.sub(r"\s+", " ", (msg.message or "").strip().lower())
    raw = f"{msg.chat_id}|{msg.contact_name}|{body}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def poll_readonly(*, force_connect: bool = True) -> dict[str, Any]:
    """
    Read new inbound messages via adapter and write normalized JSON to inbox.
    Does NOT send, reply, delete, or mark-read on WhatsApp.
    """
    POLL_LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    with POLL_LOCK_PATH.open("w") as lock_fh:
        try:
            fcntl.flock(lock_fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {
                "ok": True,
                "polled": 0,
                "new_messages": 0,
                "written": [],
                "inbox_dir": str(inbox_dir()),
                "adapter": "locked",
                "learning_processed": 0,
                "learning_candidates": 0,
                "message": "WhatsApp poll skipped: another poll is already running.",
            }

        conn = WhatsAppBusinessWebConnector()
        enforce_write_blocked("poll_readonly")

        if force_connect and not conn.status().get("connected"):
            conn.connect()

        messages = conn.adapter.fetch_new_messages()
        incoming = [m for m in messages if m.direction == "incoming"]

        poll_state = load_poll_state()
        seen = set(poll_state.get("polled_ids", []))
        seen_body_keys = set(poll_state.get("polled_body_keys", []))
        new_msgs: list[NormalizedLiveMessage] = []
        for msg in incoming:
            mid = msg.message_id or msg.to_inbox_json()["message_id"]
            body_key = _stable_body_key(msg)
            if mid in seen:
                continue
            if body_key in seen_body_keys:
                continue
            seen.add(mid)
            seen_body_keys.add(body_key)
            new_msgs.append(msg)

        written = _write_inbox_files(new_msgs)

        learning_stats: dict[str, Any] = {"processed": 0, "candidates_created": 0}
        if new_msgs:
            from customer_gateway.conversation_learning_pipeline import process_live_batch

            learning_stats = process_live_batch(new_msgs, source="poll")

        poll_state["polled_ids"] = sorted(seen)
        poll_state["polled_body_keys"] = sorted(seen_body_keys)[-5000:]
        poll_state["last_poll"] = new_msgs[0].sync_time if new_msgs else poll_state.get("last_poll")
        save_poll_state(poll_state)

        if new_msgs:
            update_sync_time()
        update_poll_stats(len(new_msgs))

        return {
            "ok": True,
            "polled": len(incoming),
            "new_messages": len(new_msgs),
            "written": written,
            "inbox_dir": str(inbox_dir()),
            "adapter": conn.adapter.name,
            "learning_processed": learning_stats.get("processed", 0),
            "learning_candidates": learning_stats.get("candidates_created", 0),
            "message": (
                f"只读轮询完成：收到 {len(incoming)} 条，新写入收件箱 {len(new_msgs)} 条。"
                "未发送 WhatsApp。"
            ),
        }


def _write_inbox_files(messages: list[NormalizedLiveMessage]) -> list[str]:
    directory = inbox_dir()
    directory.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    for msg in messages:
        data = msg.to_inbox_json()
        mid = data["message_id"]
        filename = f"biz_{mid[:16]}.json"
        path = directory / filename
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        written.append(filename)
    return written


def format_poll_result(result: dict[str, Any]) -> str:
    if not result.get("ok"):
        return f"轮询失败: {result.get('message', '')}"
    lines = [
        result.get("message", ""),
        "",
        f"适配器: {result.get('adapter', '')}",
        f"收件箱: {result.get('inbox_dir', '')}",
        f"写入文件: {len(result.get('written', []))}",
    ]
    for name in result.get("written", [])[:10]:
        lines.append(f"  - {name}")
    lines.append("")
    lines.append("下一步: /whatsapp listen --readonly")
    if result.get("learning_processed"):
        lines.append(
            f"学习归档: {result.get('learning_processed')} 条 → "
            f"candidates {result.get('learning_candidates', 0)}"
        )
    return "\n".join(lines)
