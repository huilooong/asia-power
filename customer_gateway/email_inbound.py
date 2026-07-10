"""Email inbound → APSales draft queue (子敬)."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent


def _email_data_dir() -> Path:
    env = os.getenv("EMAIL_DATA_DIR", "").strip()
    if env:
        return Path(env)
    inv = os.getenv("INVENTORY_SITE_ROOT", "").strip()
    if inv:
        return Path(inv) / "data"
    sibling = ROOT.parent / "inventory-site" / "data"
    if sibling.is_dir():
        return sibling
    return ROOT / "data"


EMAIL_THREADS_FILE = _email_data_dir() / "email-threads.json"
EMAIL_INBOX_DIR = ROOT / "memory" / "customer_gateway" / "email_inbox"


def _load_threads() -> list[dict[str, Any]]:
    if not EMAIL_THREADS_FILE.is_file():
        return []
    try:
        data = json.loads(EMAIL_THREADS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return list(data.get("threads") or [])


def list_email_threads(*, pending_only: bool = False, limit: int = 20) -> list[dict[str, Any]]:
    threads = _load_threads()
    if pending_only:
        threads = [t for t in threads if not t.get("processedByApsales")]
    return threads[:limit]


def get_email_thread(thread_id: str) -> dict[str, Any] | None:
    tid = (thread_id or "").strip()
    for t in _load_threads():
        if t.get("threadId") == tid:
            return t
    return None


def latest_inbound_text(thread: dict[str, Any]) -> str:
    messages = thread.get("messages") or []
    for msg in reversed(messages):
        if msg.get("direction") == "inbound":
            return (
                msg.get("textRedacted")
                or msg.get("text")
                or msg.get("subject")
                or ""
            ).strip()
    return (thread.get("subject") or "").strip()


def process_email_thread(thread_id: str) -> dict[str, Any]:
    """Route one email thread through the correct agent."""
    from customer_gateway.email_router import agent_for_thread

    thread = get_email_thread(thread_id)
    if not thread:
        raise ValueError(f"Email thread not found: {thread_id}")

    from customer_gateway.email_test_filter import is_test_or_bot_thread

    agent = agent_for_thread(thread)
    if agent == "apsales" and is_test_or_bot_thread(thread):
        from customer_gateway.email_proxy_bridge import mark_thread_processed
        from audit.logger import log_event

        mark_thread_processed(thread_id)
        log_event("email_skipped_test", thread_id=thread_id, subject=thread.get("subject", ""))
        return {
            "draft_id": f"skipped-test-{thread_id}",
            "customer_name": f"email:{thread_id}",
            "category": "test_skipped",
            "status": "skipped_test",
            "route_agent": "apsales",
        }

    if agent == "apinventory":
        from customer_gateway.supplier_email_inbound import save_supplier_email
        from customer_gateway.email_proxy_bridge import mark_thread_processed

        save_supplier_email(thread)
        mark_thread_processed(thread_id)
        thread["processedByAgent"] = True
        return {
            "draft_id": f"supplier-{thread_id}",
            "customer_name": f"supplier-email:{thread_id}",
            "category": "supplier_email",
            "status": "routed_to_apinventory",
            "route_agent": "apinventory",
        }
    if agent == "ceo":
        from customer_gateway.ceo_email_inbox import save_ceo_email
        from customer_gateway.email_proxy_bridge import mark_thread_processed

        save_ceo_email(thread)
        mark_thread_processed(thread_id)
        thread["processedByAgent"] = True
        return {
            "draft_id": f"ceo-{thread_id}",
            "category": "ceo_email",
            "status": "ceo_inbox",
            "route_agent": "ceo",
        }

    return _process_apsales_email_thread(thread_id, thread)


def _process_apsales_email_thread(thread_id: str, thread: dict[str, Any] | None = None) -> dict[str, Any]:
    """子敬 sales/inquiry email → APSales draft."""
    from customer_gateway.approval_notification import notify_new_draft
    from customer_gateway.draft_queue import save_draft
    from customer_gateway.email_proxy_bridge import mark_thread_processed
    from sales_core.apsales_handler import process_apsales_enquiry

    thread = thread or get_email_thread(thread_id)
    if not thread:
        raise ValueError(f"Email thread not found: {thread_id}")

    body = latest_inbound_text(thread)
    if not body:
        raise ValueError(f"Thread {thread_id} has no inbound body")

    subject = thread.get("subject") or "(no subject)"
    enquiry = f"[Email] Subject: {subject}\n\n{body}"
    from core.language_router import detect_language, resolve_target_language

    comm_lang = resolve_target_language("apsales", "buyer", body or subject)
    detected = detect_language(body or subject, scenario="buyer")
    analysis = process_apsales_enquiry(enquiry, channel="email")

    internal, _, draft_text = _split_apsales_reply(analysis)
    from sales_core.email_signature import finalize_email_draft

    draft_text = finalize_email_draft(draft_text, comm_lang)
    draft = save_draft({
        "customer_name": f"email:{thread_id}",
        "customer_hash": thread.get("customerEmailHash", ""),
        "original_message": enquiry,
        "internal_analysis_zh": internal,
        "customer_reply_draft": draft_text,
        "detected_language": comm_lang,
        "category": "email_enquiry",
        "classification": "buyer_enquiry",
        "channel": "email",
        "chat_id": thread_id,
        "message_id": (thread.get("messages") or [{}])[-1].get("id", ""),
        "risk_level": "medium",
        "approval_required": True,
        "next_action": "ceo_review_email_draft",
    })
    mark_thread_processed(thread_id)
    notify_new_draft(draft)
    return draft


def process_pending_emails(limit: int = 10) -> list[dict[str, Any]]:
    from customer_gateway.email_test_filter import is_test_or_bot_thread

    results: list[dict[str, Any]] = []
    for thread in list_email_threads(pending_only=True, limit=limit):
        if is_test_or_bot_thread(thread):
            try:
                from customer_gateway.email_proxy_bridge import mark_thread_processed
                mark_thread_processed(thread["threadId"])
            except Exception:
                pass
            continue
        try:
            results.append(process_email_thread(thread["threadId"]))
        except ValueError:
            continue
    return results


def _split_apsales_reply(text: str) -> tuple[str, str, str]:
    """Return (internal_zh, customer_label, customer_draft)."""
    raw = (text or "").strip()
    m = re.split(r"【客户草稿[^】]*】", raw, maxsplit=1)
    if len(m) == 2:
        internal = m[0].replace("【内部分析】", "").strip()
        return internal, "Customer Draft", m[1].strip()
    return raw, "", ""


def format_email_list(threads: list[dict[str, Any]]) -> str:
    if not threads:
        return "暂无邮件线程。等待 sales@asia-power.com 收到邮件或检查 Cloudflare Email Worker。"
    lines = ["子敬 · 邮件收件箱", ""]
    for t in threads:
        pending = "待处理" if not t.get("processedByApsales") and not t.get("processedByAgent") else "已处理"
        mailbox = t.get("mailbox") or "?"
        agent = t.get("routeAgent") or "apsales"
        preview = latest_inbound_text(t)[:80].replace("\n", " ")
        lines.append(
            f"- {t.get('threadId')} | {mailbox}@{agent} | {pending} | {t.get('subject', '?')}\n"
            f"  {preview}"
        )
    lines.append("")
    lines.append("处理: /email process <threadId>  |  /email process-all")
    return "\n".join(lines)


def format_email_detail(thread: dict[str, Any]) -> str:
    lines = [
        f"Thread: {thread.get('threadId')}",
        f"Subject: {thread.get('subject')}",
        f"Proxy reply: {thread.get('proxyReplyTo', '—')}",
        f"Status: {thread.get('status')} | APSales: {'已处理' if thread.get('processedByApsales') else '待处理'}",
        "",
    ]
    for msg in thread.get("messages") or []:
        lines.append(f"— {msg.get('direction')} @ {msg.get('receivedAt', '?')}")
        lines.append(msg.get("textRedacted") or msg.get("text") or "")
        lines.append("")
    lines.append(f"生成草稿: /email process {thread.get('threadId')}")
    return "\n".join(lines)
