"""Supplier email → 子龙 (APInventory) inbox."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SUPPLIER_INBOX = ROOT / "memory" / "customer_gateway" / "supplier_email_inbox"


def _ensure_dir() -> None:
    SUPPLIER_INBOX.mkdir(parents=True, exist_ok=True)


def save_supplier_email(thread: dict[str, Any]) -> dict[str, Any]:
    _ensure_dir()
    tid = thread.get("threadId", "unknown")
    record = {
        "thread_id": tid,
        "mailbox": thread.get("mailbox", "supplier"),
        "subject": thread.get("subject", ""),
        "from_hash": thread.get("customerEmailHash", ""),
        "messages": thread.get("messages") or [],
        "status": "pending",
    }
    path = SUPPLIER_INBOX / f"{tid}.json"
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    return record


def format_supplier_email_notice(thread: dict[str, Any], latest: dict[str, Any]) -> str:
    preview = (latest.get("textRedacted") or latest.get("text") or "")[:400]
    return (
        "📧 新供应商邮件（子龙）\n"
        f"Thread: {thread.get('threadId')}\n"
        f"Subject: {thread.get('subject', '?')}\n"
        f"From: {latest.get('from', '?')}\n\n"
        f"{preview}\n\n"
        f"子龙查看: python main.py \"/email show {thread.get('threadId')}\""
    )
