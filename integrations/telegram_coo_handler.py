"""Telegram COO bot handler — debug logging and guaranteed replies."""

from __future__ import annotations

import traceback
from typing import Any

from coo_core.dispatcher import dispatch_message
from tools import message_tool

FALLBACK_REPLY_ZH = (
    "APCOO 已收到你的消息。\n"
    "系统处理中发生异常。\n"
    "请稍后重试。\n"
    "（错误已记录）"
)

EMPTY_REPLY_FALLBACK = (
    "APCOO 已收到你的消息，但当前没有生成可发送的回复内容。\n"
    "请尝试 /help 或 /ping。"
)


def _debug(stage: str, **fields: Any) -> None:
    parts = [f"[COO Telegram DEBUG] {stage}"]
    for key, value in fields.items():
        parts.append(f"  {key}={value!r}")
    print("\n".join(parts), flush=True)


def dispatch_telegram_message(
    text: str,
    *,
    chat_id: str,
    user_id: str,
) -> str:
    """Route inbound Telegram text through APCOO with logging."""
    _debug("received", chat_id=chat_id, text=text, user_id=user_id)

    lower = text.strip().lower()
    if lower in ("/ping", "ping"):
        from coo_core.health_check import ping_response
        reply = ping_response()
        _debug("handler", route="ping", reply_len=len(reply))
        return reply

    if lower in ("/health", "health"):
        from coo_core.health_check import health_response
        reply = health_response()
        _debug("handler", route="health", reply_len=len(reply))
        return reply

    _debug("routing", agent="apcoo", handler="dispatch_message")
    try:
        reply = dispatch_message(text, source="telegram", user_id=user_id, agent_id="apcoo")
        _debug("openai_reply", reply_len=len(reply or ""), preview=(reply or "")[:120])
    except Exception as exc:
        _debug("dispatch_exception", error=str(exc), traceback=traceback.format_exc())
        raise

    if not (reply or "").strip():
        _debug("empty_reply_fallback")
        return EMPTY_REPLY_FALLBACK
    return reply


def handle_telegram_update(
    message: dict[str, Any],
    *,
    allowed: set[str],
) -> None:
    """Process one Telegram message update with guaranteed outbound reply."""
    from integrations.telegram_access import authorize_chat

    chat = message.get("chat") or {}
    chat_id = str(chat.get("id", ""))

    # Authorize before any download/transcription so we never spend Whisper
    # calls on unauthorized chats.
    ok, reason = authorize_chat(chat, allowed)
    if not ok:
        _debug("rejected", chat_id=chat_id, reason=reason)
        message_tool.log_message(
            "telegram", "inbound", chat_id, message.get("text") or "<non-text>",
            status=f"rejected:{reason}",
        )
        return

    text = (message.get("text") or "").strip()
    if not text and (message.get("voice") or message.get("audio")):
        from integrations.telegram_voice import transcribe_voice_message
        try:
            text = (transcribe_voice_message(message) or "").strip()
        except Exception as exc:
            _debug("voice_transcribe_failed", error=str(exc), traceback=traceback.format_exc())
            message_tool.send_telegram_message(chat_id, "🎙️ 语音识别失败,请重试或改用文字。")
            return
        _debug("voice_transcribed", chat_id=chat_id, text=text)
        if text:
            message_tool.send_telegram_message(chat_id, f"🎙️ 已识别:{text}")

    if not text:
        _debug("skip_empty_text", chat_id=chat_id)
        return

    message_tool.log_message("telegram", "inbound", chat_id, text, status="ok")
    user = message.get("from") or {}
    user_id = str(user.get("id", chat_id))

    reply = ""
    try:
        reply = dispatch_telegram_message(text, chat_id=chat_id, user_id=user_id)
        _debug("sendMessage", chat_id=chat_id, reply_len=len(reply))
        message_tool.send_telegram_message(chat_id, reply)
        message_tool.log_message("telegram", "outbound", chat_id, reply, status="ok")
    except Exception as exc:
        err = f"COO error: {exc}"
        _debug("handler_exception", error=str(exc), traceback=traceback.format_exc())
        message_tool.log_message("telegram", "outbound", chat_id, err, status="error")
        try:
            message_tool.send_telegram_message(chat_id, FALLBACK_REPLY_ZH)
            message_tool.log_message(
                "telegram", "outbound", chat_id, FALLBACK_REPLY_ZH, status="fallback",
            )
        except Exception as send_exc:
            _debug("send_fallback_failed", error=str(send_exc), traceback=traceback.format_exc())
