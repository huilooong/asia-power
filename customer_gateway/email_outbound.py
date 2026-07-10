"""Phase 2 — send CEO-approved email drafts via Resend."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

from customer_gateway.draft_queue import load_draft, _draft_path, _now
from customer_gateway.email_inbound import EMAIL_THREADS_FILE, get_email_thread
from customer_gateway.email_router import outbound_mailbox_for_thread


def send_enabled() -> bool:
    return os.getenv("EMAIL_SEND_ENABLED", "").strip() == "1" and bool(
        os.getenv("RESEND_API_KEY", "").strip()
    )


def _domain() -> str:
    return os.getenv("EMAIL_PROXY_DOMAIN", "asia-power.com").strip() or "asia-power.com"


def from_address(mailbox: str) -> str:
    domain = _domain()
    fallback = os.getenv(
        "EMAIL_RESEND_FALLBACK_FROM",
        "AsiaPower Sales <onboarding@resend.dev>",
    )
    if os.getenv("EMAIL_RESEND_USE_FALLBACK", "1").strip() == "1" and mailbox in ("sales", "inquiry"):
        return os.getenv("EMAIL_FROM_SALES", fallback) or fallback
    defaults = {
        "sales": f"AsiaPower Sales <sales@{domain}>",
        "inquiry": f"AsiaPower Sales <sales@{domain}>",
        "supplier": f"AsiaPower Supplier <supplier@{domain}>",
    }
    env_keys = {
        "sales": "EMAIL_FROM_SALES",
        "inquiry": "EMAIL_FROM_INQUIRY",
        "supplier": "EMAIL_FROM_SUPPLIER",
    }
    key = env_keys.get(mailbox, "EMAIL_FROM_SALES")
    return os.getenv(key, defaults.get(mailbox, defaults["sales"]))


def reply_subject(subject: str) -> str:
    s = (subject or "").strip() or "(no subject)"
    return s if re.match(r"^re:", s, re.I) else f"Re: {s}"


def customer_email_from_thread(thread: dict[str, Any]) -> str:
    for msg in reversed(thread.get("messages") or []):
        if msg.get("direction") == "inbound":
            addr = (msg.get("from") or "").strip()
            if "@" in addr:
                return addr
    raise ValueError("Thread has no inbound customer email")


def thread_id_from_draft(draft: dict[str, Any]) -> str:
    tid = (draft.get("chat_id") or "").strip()
    if tid.startswith("em-"):
        return tid
    name = draft.get("customer_name") or ""
    m = re.search(r"email:(em-[^\s]+)", name)
    if m:
        return m.group(1)
    raise ValueError("Draft is not linked to an email thread")


def _resend_send(
    *,
    from_addr: str,
    to: str,
    subject: str,
    text: str,
    reply_to: str,
    in_reply_to: str = "",
) -> dict[str, Any]:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        raise ValueError("RESEND_API_KEY 未配置 — 见 data/knowledge-base/apsales-email-outreach-runbook.md")

    payload: dict[str, Any] = {
        "from": from_addr,
        "to": [to],
        "subject": subject,
        "text": text,
        "reply_to": reply_to,
    }
    if in_reply_to:
        payload["headers"] = {"In-Reply-To": in_reply_to, "References": in_reply_to}

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "AsiaPower-Email/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(body)
            msg = detail.get("message") or detail.get("error") or body
        except json.JSONDecodeError:
            msg = body or str(exc)
        raise ValueError(f"Resend 发送失败: {msg}") from exc


def append_outbound_to_thread(thread_id: str, outbound: dict[str, Any]) -> None:
    if not EMAIL_THREADS_FILE.is_file():
        raise ValueError("email-threads.json not found")
    data = json.loads(EMAIL_THREADS_FILE.read_text(encoding="utf-8"))
    for t in data.get("threads") or []:
        if t.get("threadId") != thread_id:
            continue
        t.setdefault("messages", []).append(outbound)
        t["updatedAt"] = outbound.get("sentAt", _now())
        t["lastOutboundAt"] = t["updatedAt"]
        break
    else:
        raise ValueError(f"Thread not found: {thread_id}")
    EMAIL_THREADS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def send_email_draft(draft_id: str, *, force: bool = False) -> dict[str, Any]:
    """Send approved email draft to customer. Returns send result metadata."""
    if not send_enabled() and not force:
        raise ValueError("邮件发送未启用：设置 EMAIL_SEND_ENABLED=1 和 RESEND_API_KEY")

    draft = load_draft(draft_id)
    if not draft:
        raise ValueError(f"Draft not found: {draft_id}")
    if draft.get("channel") != "email" and not (draft.get("customer_name") or "").startswith("email:"):
        raise ValueError("Not an email draft")
    if draft.get("status") == "sent":
        raise ValueError(f"Draft already sent: {draft_id}")
    if draft.get("status") not in ("approved", "pending") and not force:
        raise ValueError("Draft must be approved before send (or use force)")

    thread_id = thread_id_from_draft(draft)
    thread = get_email_thread(thread_id)
    if not thread:
        raise ValueError(f"Email thread not found: {thread_id}")

    to_email = customer_email_from_thread(thread)
    from customer_gateway.email_test_filter import is_test_or_bot_email, is_test_or_bot_thread

    if is_test_or_bot_thread(thread) or is_test_or_bot_email(to_email):
        raise ValueError(f"测试/机器人邮件不对外发送: {to_email}")
    body = (draft.get("customer_reply_draft") or "").strip()
    if not body:
        raise ValueError("Empty customer_reply_draft")

    mailbox = outbound_mailbox_for_thread(thread)
    subject = reply_subject(thread.get("subject") or "")
    from_addr = from_address(mailbox)

    last_inbound = next(
        (m for m in reversed(thread.get("messages") or []) if m.get("direction") == "inbound"),
        {},
    )
    resend = _resend_send(
        from_addr=from_addr,
        to=to_email,
        subject=subject,
        text=body,
        reply_to=thread.get("proxyReplyTo") or f"reply+{thread_id}@{_domain()}",
        in_reply_to=last_inbound.get("messageId") or "",
    )

    import uuid
    from datetime import datetime, timezone

    outbound = {
        "id": f"msg-{uuid.uuid4().hex[:8]}",
        "direction": "outbound",
        "from": from_addr,
        "to": to_email,
        "subject": subject,
        "text": body,
        "sentAt": datetime.now(timezone.utc).isoformat(),
        "resendId": resend.get("id"),
        "draftId": draft_id,
    }
    append_outbound_to_thread(thread_id, outbound)

    draft["status"] = "sent"
    draft["sent_at"] = _now()
    draft["sent_to"] = to_email
    draft["resend_id"] = resend.get("id")
    draft["updated_at"] = _now()
    _draft_path(draft_id).write_text(json.dumps(draft, indent=2, ensure_ascii=False), encoding="utf-8")

    return {
        "ok": True,
        "draft_id": draft_id,
        "thread_id": thread_id,
        "to": to_email,
        "from": from_addr,
        "subject": subject,
        "resend_id": resend.get("id"),
    }


def format_send_result(result: dict[str, Any]) -> str:
    return (
        "✅ 邮件已发送（Phase 2 · Resend）\n"
        f"草稿: {result.get('draft_id')}\n"
        f"收件人: {result.get('to')}\n"
        f"发件: {result.get('from')}\n"
        f"主题: {result.get('subject')}\n"
        f"Resend ID: {result.get('resend_id')}"
    )


def send_proactive_email(
    *,
    to: str,
    subject: str,
    text: str,
    mailbox: str = "sales",
    force: bool = False,
) -> dict[str, Any]:
    """Send a new outreach email (not a thread reply). CEO-approved only."""
    if not send_enabled() and not force:
        raise ValueError("邮件发送未启用：设置 EMAIL_SEND_ENABLED=1 和 RESEND_API_KEY")

    from customer_gateway.email_test_filter import is_test_or_bot_email

    to_email = (to or "").strip()
    if not to_email or "@" not in to_email:
        raise ValueError(f"Invalid recipient: {to}")
    if is_test_or_bot_email(to_email):
        raise ValueError(f"测试/机器人邮件不对外发送: {to_email}")

    body = (text or "").strip()
    if not body:
        raise ValueError("Empty email body")

    subj = (subject or "").strip() or "AsiaPower — auto parts from China"
    from_addr = from_address(mailbox)
    reply_to = os.getenv("EMAIL_APPROVAL_REPLY_TO", from_addr) or from_addr

    resend = _resend_send(
        from_addr=from_addr,
        to=to_email,
        subject=subj,
        text=body,
        reply_to=reply_to,
    )

    return {
        "ok": True,
        "to": to_email,
        "from": from_addr,
        "subject": subj,
        "resend_id": resend.get("id"),
    }


def format_proactive_send_result(result: dict[str, Any]) -> str:
    return (
        "✅ 主动开发邮件已发送\n"
        f"收件人: {result.get('to')}\n"
        f"发件: {result.get('from')}\n"
        f"主题: {result.get('subject')}\n"
        f"Resend ID: {result.get('resend_id')}"
    )
