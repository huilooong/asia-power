"""WeCom 子敬 (APSales) message handler — group + 1:1 dispatch."""

from __future__ import annotations

import traceback
from typing import Any

from coo_core.cli_router import resolve_agent_id
from coo_core.dispatcher import dispatch_message
from integrations.wecom_access import (
    authorize_wecom_message,
    extract_chat_id,
    extract_user_id,
    strip_bot_mention,
)
from integrations.wecom_config import WeComConfig
from integrations.wecom_group_upload import (
    handle_group_image_message,
    is_session_status_command,
    is_wecom_upload_command,
    process_wecom_upload_command,
    session_status_text,
)
from tools import message_tool

FALLBACK_REPLY_ZH = (
    "子敬已收到消息，但系统处理出错。\n"
    "请稍后重试，或联系 CEO。\n"
    "（错误已记录）"
)

HELP_REPLY_ZH = (
    "AsiaPower · 子龙（供应商助理）\n"
    "━━━━━━━━━━━━━━━━\n"
    "在群里 @AsiaPower 库存 Agent 即可，例如：\n"
    "· 发车辆照片 +「子龙032 上传」\n"
    "· 库存 / VIN / 发动机 / 车型咨询\n"
    "· 相册状态 / 子龙状态\n"
    "· 拆车厂经营与上架建议\n"
    "\n"
    "销售询价、报价、客户开发 → 子敬（WhatsApp/邮件）\n"
    "安全：子龙不谈最终成交价；不会自动对外发消息。"
)


def _route_agent_id(text: str) -> str:
    """Map keyword router → dispatch agent id (aligned with CLI/Telegram)."""
    agent = resolve_agent_id(text)
    if agent == "apcoo":
        return "apsales"
    return agent


def dispatch_wecom_message(
    text: str,
    *,
    user_id: str,
    chat_id: str = "",
    cfg: WeComConfig | None = None,
) -> str:
    """Route inbound WeCom text to the right AsiaPower agent."""
    body = (text or "").strip()
    if not body:
        return ""

    lower = body.lower()
    if lower in ("/ping", "ping"):
        from coo_core.health_check import ping_response
        return ping_response()
    if lower in ("/help", "/start", "帮助"):
        return HELP_REPLY_ZH

    if is_session_status_command(body):
        return session_status_text(chat_id, user_id=user_id)

    if is_wecom_upload_command(body):
        return process_wecom_upload_command(body, chat_id=chat_id, user_id=user_id, cfg=cfg)

    agent_id = _route_agent_id(body)
    source = "wecom_group" if chat_id else "wecom"
    try:
        reply = dispatch_message(body, source=source, user_id=user_id, agent_id=agent_id)
    except Exception as exc:
        print(f"[WeCom 子敬] dispatch error: {exc}\n{traceback.format_exc()}", flush=True)
        raise

    if not (reply or "").strip():
        return "子敬已收到，但暂时没有可回复的内容。试试 /help"
    return reply


def handle_wecom_xml_message(
    msg: dict[str, Any],
    *,
    cfg: WeComConfig,
) -> str:
    """
    Process decrypted XML dict. Returns plaintext reply (may be empty).
    Side effect: sends active reply via API when passive reply would be too long.
    """
    msg_type = (msg.get("MsgType") or msg.get("msgtype") or "").lower()
    if msg_type not in {"text", "image"}:
        return ""

    ok, reason = authorize_wecom_message(
        msg,
        allowed_chat_ids=set(cfg.allowed_chat_ids),
        allowed_user_ids=set(cfg.allowed_user_ids),
        require_at_mention=cfg.require_at_mention,
    )
    user_id = extract_user_id(msg)
    chat_id = extract_chat_id(msg)
    channel_id = chat_id or user_id

    if not ok:
        label = "image" if msg_type == "image" else (msg.get("Content") or "")
        message_tool.log_message("wecom", "inbound", channel_id, label, status=f"rejected:{reason}")
        return ""

    if msg_type == "image":
        message_tool.log_message("wecom", "inbound", channel_id, "image", status="ok")
        try:
            reply = handle_group_image_message(msg, cfg=cfg)
        except Exception:
            reply = "子龙：收图失败，请稍后重发。"
            message_tool.log_message("wecom", "outbound", channel_id, reply, status="error")
            _send_active_reply(reply=reply, user_id=user_id, chat_id=chat_id, cfg=cfg)
            return reply
        message_tool.log_message("wecom", "outbound", channel_id, reply, status="ok")
        if len(reply) > 1800:
            _send_active_reply(reply=reply, user_id=user_id, chat_id=chat_id, cfg=cfg)
            return "（详细回复已发送到群/会话，请上滑查看）"
        return reply

    content = strip_bot_mention(msg.get("Content") or "")
    if not content:
        return ""

    message_tool.log_message("wecom", "inbound", channel_id, content, status="ok")

    try:
        reply = dispatch_wecom_message(content, user_id=user_id, chat_id=chat_id, cfg=cfg)
    except Exception:
        message_tool.log_message("wecom", "outbound", channel_id, FALLBACK_REPLY_ZH, status="error")
        _send_active_reply(reply=FALLBACK_REPLY_ZH, user_id=user_id, chat_id=chat_id, cfg=cfg)
        return FALLBACK_REPLY_ZH

    message_tool.log_message("wecom", "outbound", channel_id, reply, status="ok")

    # Passive reply limit ~2048 chars; long stats reports → active send + empty passive
    if len(reply) > 1800:
        _send_active_reply(reply=reply, user_id=user_id, chat_id=chat_id, cfg=cfg)
        return "（详细回复已发送到群/会话，请上滑查看）"

    return reply


def _send_active_reply(
    *,
    reply: str,
    user_id: str,
    chat_id: str,
    cfg: WeComConfig,
) -> None:
    from integrations.wecom_client import send_text_to_group, send_text_to_user

    chunks = message_tool.split_message(reply, limit=1800)
    for chunk in chunks:
        if chat_id:
            send_text_to_group(chat_id, chunk, cfg=cfg)
        elif user_id:
            send_text_to_user(user_id, chunk, cfg=cfg)
