"""Notify CEO via APSales Telegram when new WhatsApp drafts arrive."""

from __future__ import annotations

import os
from typing import Any

from audit.logger import log_event


def format_draft_telegram_notification(draft: dict[str, Any]) -> str:
    """Chinese notification for CEO Telegram."""
    lines = [
        "📩 新 WhatsApp 客户消息（只读）",
        "",
        f"客户: {draft.get('customer_name', '?')}",
        f"草稿 ID: {draft.get('draft_id')}",
        f"分类: {draft.get('category', '?')} | 风险: {draft.get('risk_level', '?')}",
        f"语言: {draft.get('detected_language', 'en')}",
        f"需 CEO 审批: {'是' if draft.get('approval_required') else '否'}",
        f"建议下一步: {draft.get('next_action', 'monitor')}",
        "",
        "—— 客户说了什么 ——",
        (draft.get("original_message") or "")[:400],
        "",
        "—— APSales 内部分析（摘要）——",
        _analysis_summary(draft.get("internal_analysis_zh", "")),
        "",
        "—— 建议回复草稿（未发送）——",
        (draft.get("customer_reply_draft") or "")[:500],
        "",
        f"查看完整: /drafts show {draft.get('draft_id')}",
        "批准: /drafts approve " + str(draft.get("draft_id", "")),
        "",
        "⚠️ 本阶段不自动发送 WhatsApp。approve = 同意草稿，非发送。",
    ]
    return "\n".join(lines)


def _analysis_summary(text: str, max_lines: int = 6) -> str:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    return "\n".join(lines[:max_lines]) if lines else "（见 /drafts show）"


def notify_new_draft(draft: dict[str, Any]) -> str:
    """
    Push draft notification to APSales Telegram whitelisted chats.
    Returns formatted message (always); sends if token configured.
    """
    body = format_draft_telegram_notification(draft)
    log_event(
        "draft_notification",
        draft_id=draft.get("draft_id"),
        customer=draft.get("customer_name"),
    )

    token = os.getenv("APSALES_TELEGRAM_BOT_TOKEN", "").strip()
    chat_ids = os.getenv("APSALES_TELEGRAM_ALLOWED_CHAT_IDS", "").strip()
    if not token or not chat_ids:
        return body

    from integrations.telegram_access import parse_allowed_chat_ids
    from tools.message_tool import send_apsales_telegram_message

    for chat_id in parse_allowed_chat_ids(chat_ids):
        try:
            send_apsales_telegram_message(chat_id, body)
        except Exception as exc:
            log_event(
                "draft_notification_failed",
                draft_id=draft.get("draft_id"),
                chat_id=chat_id,
                error=str(exc)[:200],
            )
    return body
