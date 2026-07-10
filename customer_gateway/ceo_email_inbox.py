"""CEO personal mailbox weylon@ — notify only, no auto agent draft."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CEO_INBOX = ROOT / "memory" / "customer_gateway" / "ceo_email_inbox"


def _ensure_dir() -> None:
    CEO_INBOX.mkdir(parents=True, exist_ok=True)


def save_ceo_email(thread: dict[str, Any]) -> dict[str, Any]:
    _ensure_dir()
    tid = thread.get("threadId", "unknown")
    record = {
        "thread_id": tid,
        "mailbox": "weylon",
        "subject": thread.get("subject", ""),
        "messages": thread.get("messages") or [],
        "forward_hint": "weylonhui@gmail.com",
    }
    path = CEO_INBOX / f"{tid}.json"
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    return record


def format_ceo_email_notice(thread: dict[str, Any], latest: dict[str, Any]) -> str:
    body = (latest.get("text") or latest.get("textRedacted") or "")[:800]
    return (
        "📬 weylon@ 新邮件\n"
        f"Subject: {thread.get('subject', '?')}\n"
        f"From: {latest.get('from', '?')}\n\n"
        f"{body}\n\n"
        "说明：此邮箱目前仅收信+通知；对外回复 Phase 2 未开通。"
    )
