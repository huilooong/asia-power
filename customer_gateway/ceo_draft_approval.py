"""CEO email approval — request to weylonhui@gmail.com, reply 同意 → auto send."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

from audit.logger import log_event
from customer_gateway.draft_queue import load_draft, approve_draft
from customer_gateway.email_inbound import get_email_thread, latest_inbound_text

_DRAFT_ID_RE = re.compile(r"draft-[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9TUTC\-a-f0-9]+", re.I)
_APPROVE_RE = re.compile(
    r"(同意|批准|确认发送|批准发送|可以发|发吧|发送吧|approve|approved|send it|^send$|^yes$|^ok$|好的)",
    re.I | re.M,
)
_REJECT_RE = re.compile(r"^(拒绝|reject|不要发)\b", re.I)


def _ceo_reply_body(text: str) -> str:
    """Keep only CEO's new reply — strip Gmail/Outlook quoted thread below."""
    body = (text or "").strip()
    if not body:
        return ""
    lines: list[str] = []
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith(">"):
            break
        if re.search(r"AsiaPower Sales.*写道：", line, re.I):
            break
        if re.match(r"On .+ wrote:", stripped, re.I):
            break
        if stripped.startswith("-----Original Message-----"):
            break
        if re.match(r"From:.+Sent:", stripped, re.I):
            break
        lines.append(line)
    return "\n".join(lines).strip()


def ceo_email() -> str:
    return (
        os.getenv("CEO_APPROVAL_EMAIL", "").strip()
        or os.getenv("CEO_EMAIL", "").strip()
        or "weylonhui@gmail.com"
    )


def _resend_send(*, to: str, subject: str, text: str, reply_to: str = "") -> dict[str, Any]:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        raise ValueError("RESEND_API_KEY 未配置")
    from_addr = os.getenv("EMAIL_FROM_SALES", "AsiaPower Sales <sales@asia-power.com>")
    payload: dict[str, Any] = {
        "from": from_addr,
        "to": [to],
        "subject": subject,
        "text": text,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "User-Agent": "AsiaPower-Email/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"Resend 失败: {body[:200]}") from exc


def format_approval_request_email(draft: dict[str, Any]) -> tuple[str, str]:
    draft_id = draft.get("draft_id", "")
    customer = draft.get("customer_name", "")
    subject = f"[子敬待批 {draft_id}] 客户邮件回复"
    body = (
        f"CEO 您好，\n\n"
        f"子敬已起草一封客户邮件，请审阅。\n\n"
        f"草稿 ID: {draft_id}\n"
        f"客户: {customer}\n"
        f"语言: {draft.get('detected_language', 'en')}\n\n"
        f"—— 客户原咨询 ——\n"
        f"{(draft.get('original_message') or '')[:600]}\n\n"
        f"—— 建议回复（将发给客户）——\n"
        f"{draft.get('customer_reply_draft') or ''}\n\n"
        f"—— 如何批准 ——\n"
        f"直接回复本邮件，写「同意」即可自动发出（从 sales@asia-power.com）。\n"
        f"每封待批邮件请单独回复；系统不解析长段工作指示。\n"
        f"也可写：同意 {draft_id}\n\n"
        f"若不发送，请回复：不要发 {draft_id}\n"
        f"（测试/机器人邮件已自动排除，不会推送待批）\n"
    )
    return subject, body


def send_draft_approval_request(draft: dict[str, Any]) -> dict[str, Any] | None:
    """Email CEO for draft approval. Returns Resend result or None if skipped."""
    if not os.getenv("EMAIL_SEND_ENABLED", "").strip() == "1":
        return None
    if draft.get("channel") != "email" and not str(draft.get("customer_name", "")).startswith("email:"):
        return None
    thread_id = (draft.get("chat_id") or "").strip()
    if thread_id:
        thread = get_email_thread(thread_id)
        if thread:
            from customer_gateway.email_test_filter import is_test_or_bot_thread
            if is_test_or_bot_thread(thread):
                log_event("ceo_approval_skipped_test", draft_id=draft.get("draft_id"), thread_id=thread_id)
                return None
    to = ceo_email()
    subject, body = format_approval_request_email(draft)
    try:
        result = _resend_send(
            to=to,
            subject=subject,
            text=body,
            reply_to=os.getenv("EMAIL_APPROVAL_REPLY_TO", "sales@asia-power.com"),
        )
        log_event("ceo_approval_email_sent", draft_id=draft.get("draft_id"), to=to, resend_id=result.get("id"))
        return result
    except ValueError as exc:
        log_event("ceo_approval_email_failed", draft_id=draft.get("draft_id"), error=str(exc)[:200])
        return None


def _extract_draft_id(text: str, subject: str) -> str:
    for blob in (subject, text):
        m = _DRAFT_ID_RE.search(blob or "")
        if m:
            return m.group(0)
    return ""


def _is_ceo_sender(addr: str) -> bool:
    a = (addr or "").lower()
    ceo = ceo_email().lower()
    return ceo in a or "weylonhui@gmail.com" in a


def try_handle_ceo_approval(thread_id: str) -> str | None:
    """
    If latest inbound is CEO approving a draft, approve + send.
    Returns status message or None if not an approval reply.
    """
    thread = get_email_thread(thread_id)
    if not thread:
        return None
    inbound_msgs = [m for m in thread.get("messages") or [] if m.get("direction") == "inbound"]
    if not inbound_msgs:
        return None
    latest = inbound_msgs[-1]
    from_addr = latest.get("from") or ""
    if not _is_ceo_sender(from_addr):
        return None

    body = latest_inbound_text(thread) or latest.get("text") or ""
    subject = latest.get("subject") or thread.get("subject") or ""
    draft_id = _extract_draft_id(body, subject)
    reply = _ceo_reply_body(body)

    if _APPROVE_RE.search(reply):
        if not draft_id:
            return "收到 CEO 回信但未识别 draft_id，请写：同意 draft-xxxxx"
        draft = load_draft(draft_id)
        if not draft:
            return f"草稿不存在: {draft_id}"
        if draft.get("status") == "sent":
            return f"草稿已发送过: {draft_id}"
        if draft.get("status") == "rejected":
            from customer_gateway.draft_queue import _draft_path, _now
            draft["status"] = "pending"
            draft["updated_at"] = _now()
            _draft_path(draft_id).write_text(
                json.dumps(draft, indent=2, ensure_ascii=False), encoding="utf-8"
            )
        try:
            result = approve_draft(draft_id, approved_by="CEO-email", send=True)
            if result.get("_send_result"):
                from customer_gateway.email_outbound import format_send_result
                return format_send_result(result["_send_result"])
            if result.get("send_error"):
                return f"已批准但发送失败: {result['send_error']}"
            return f"已批准 {draft_id}（未发送）"
        except ValueError as exc:
            return f"批准失败: {exc}"

    if _REJECT_RE.search(reply):
        if draft_id:
            from customer_gateway.draft_queue import reject_draft
            reject_draft(draft_id, rejected_by="CEO-email")
            return f"已拒绝草稿 {draft_id}"
        return None

    return None
