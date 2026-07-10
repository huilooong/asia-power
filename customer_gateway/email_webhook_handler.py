"""Inbound email webhook — CEO approval + 子敬 auto draft."""

from __future__ import annotations

import json
import os
from typing import Any

from customer_gateway.ceo_draft_approval import _is_ceo_sender, try_handle_ceo_approval
from customer_gateway.email_inbound import get_email_thread, process_email_thread
from customer_gateway.email_router import agent_for_thread
from customer_gateway.email_test_filter import is_test_or_bot_thread


def auto_process_enabled() -> bool:
    return os.getenv("EMAIL_AUTO_PROCESS", "1").strip() == "1"


def handle_inbound_email_webhook(thread_id: str) -> dict[str, Any]:
    """
    Called after each /api/email/inbound ingest.
    1. CEO 回信「同意」→ 自动发送
    2. 子敬 sales/inquiry 来信 → 自动起草 + 发 CEO 审批邮件
    """
    tid = (thread_id or "").strip()
    if not tid:
        return {"kind": "skip", "reason": "empty_thread_id"}

    approval_msg = try_handle_ceo_approval(tid)
    if approval_msg:
        return {"kind": "ceo_approval", "message": approval_msg}

    if not auto_process_enabled():
        return {"kind": "skip", "reason": "auto_process_disabled"}

    thread = get_email_thread(tid)
    if not thread:
        return {"kind": "skip", "reason": "thread_not_found"}

    agent = agent_for_thread(thread)
    if agent != "apsales":
        return {"kind": "skip", "reason": f"agent_{agent}"}

    if is_test_or_bot_thread(thread):
        from customer_gateway.email_proxy_bridge import mark_thread_processed
        from audit.logger import log_event

        mark_thread_processed(tid)
        log_event("email_skipped_test", thread_id=tid, subject=thread.get("subject", ""))
        return {"kind": "skip", "reason": "test_or_bot_email"}

    inbound_msgs = [m for m in thread.get("messages") or [] if m.get("direction") == "inbound"]
    if inbound_msgs and _is_ceo_sender(inbound_msgs[-1].get("from") or ""):
        return {"kind": "skip", "reason": "ceo_sender"}

    try:
        draft = process_email_thread(tid)
        return {
            "kind": "draft",
            "draft_id": draft.get("draft_id", ""),
            "message": f"子敬已自动起草 {draft.get('draft_id', '')}，CEO 审批邮件已发送",
        }
    except ValueError as exc:
        return {"kind": "error", "message": str(exc)[:300]}


def main() -> None:
    import sys

    tid = sys.argv[1] if len(sys.argv) > 1 else ""
    print(json.dumps(handle_inbound_email_webhook(tid), ensure_ascii=False))


if __name__ == "__main__":
    main()
