"""Notify CEO via APSales Telegram when new WhatsApp drafts arrive."""

from __future__ import annotations

import os
import re
from typing import Any

from audit.logger import log_event


CEO_REQUIRED_CATEGORIES = {
    "price_request",
    "negotiation",
    "payment",
    "shipping_request",
    "delivery_commitment",
    "complaint",
}

CEO_REQUIRED_RE = re.compile(
    r"\b(price|quote|discount|reduce|payment|pay|deposit|contract|shipping|freight|"
    r"duty|import duty|clearing|clearance|tema|container|deadline|refund|"
    r"complete car|whole car|export|legal|cut into parts|tax)\b|"
    r"(报价|价格|付款|定金|合同|运费|海运|关税|清关|特马|货柜|集装箱|退款|整车|出口|切割|税率)",
    re.I,
)


def should_notify_ceo(draft: dict[str, Any]) -> bool:
    """Only notify Telegram when CEO participation is actually needed."""
    if os.getenv("APSALES_NOTIFY_ALL_DRAFTS", "").strip().lower() in {"1", "true", "yes"}:
        return True

    is_email = draft.get("channel") == "email" or str(draft.get("customer_name", "")).startswith("email:")
    if is_email:
        return True

    risk = str(draft.get("risk_level") or "").lower()
    if risk in {"high", "critical"}:
        return True

    category = str(draft.get("category") or draft.get("classification") or "").lower()
    if category in CEO_REQUIRED_CATEGORIES:
        return True

    constitution_reason = str(draft.get("constitution_reason") or "").lower()
    if draft.get("constitution_allowed") is False and not (
        risk in {"", "low"} and "sales role denied: send" in constitution_reason
    ):
        return True

    text = "\n".join(
        str(draft.get(key) or "")
        for key in ("original_message", "customer_reply_draft")
    )
    if CEO_REQUIRED_RE.search(text):
        return True

    return False


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
    Notify CEO: email (weylonhui@gmail.com) + optional Telegram.
    Email channel drafts → approval request email; reply 同意 → auto send.
    """
    from customer_gateway.ceo_draft_approval import send_draft_approval_request

    is_email = draft.get("channel") == "email" or str(draft.get("customer_name", "")).startswith("email:")
    if is_email:
        send_draft_approval_request(draft)

    if not should_notify_ceo(draft):
        log_event(
            "draft_notification_skipped",
            draft_id=draft.get("draft_id"),
            customer=draft.get("customer_name"),
            risk=draft.get("risk_level"),
            category=draft.get("category"),
            reason="not_ceo_required",
        )
        return "Telegram skipped: low-risk draft does not require CEO participation."

    body = format_draft_telegram_notification(draft)
    if is_email:
        body = (
            "📧 子敬邮件草稿 — 审批已发 CEO 邮箱\n"
            f"草稿: {draft.get('draft_id')}\n"
            f"CEO 邮箱回复「同意」即可自动发出（sales@）\n\n"
            + body
        )
    log_event(
        "draft_notification",
        draft_id=draft.get("draft_id"),
        customer=draft.get("customer_name"),
    )

    token = (
        os.getenv("APSALES_TELEGRAM_BOT_TOKEN")
        or os.getenv("ASIAPOWER_TELEGRAM_BOT_TOKEN")
        or ""
    ).strip()
    chat_ids = (
        os.getenv("APSALES_TELEGRAM_ALLOWED_CHAT_IDS")
        or os.getenv("ASIAPOWER_TELEGRAM_CHAT_ID")
        or ""
    ).strip()
    if not token or not chat_ids:
        return body

    from integrations.telegram_access import parse_allowed_chat_ids
    from tools.message_tool import send_telegram_message

    for chat_id in parse_allowed_chat_ids(chat_ids):
        try:
            send_telegram_message(chat_id, body, token=token)
        except Exception as exc:
            log_event(
                "draft_notification_failed",
                draft_id=draft.get("draft_id"),
                chat_id=chat_id,
                error=str(exc)[:200],
            )
    return body
