"""WeCom access control — group chat whitelist (opposite of Telegram private-only MVP)."""

from __future__ import annotations

from typing import Any


def parse_allowed_ids(raw: str | None) -> set[str]:
    """Parse comma-separated id whitelist."""
    if not raw:
        return set()
    return {part.strip() for part in raw.split(",") if part.strip()}


def is_group_message(msg: dict[str, Any]) -> bool:
    """True when message originates from an internal group chat."""
    chat_type = (msg.get("ChatType") or msg.get("chattype") or "").lower()
    if chat_type == "group":
        return True
    return bool(msg.get("ChatId") or msg.get("chatid"))


def extract_chat_id(msg: dict[str, Any]) -> str:
    """Group chat id (ChatId) or empty for 1:1 app chat."""
    return str(msg.get("ChatId") or msg.get("chatid") or "")


def extract_user_id(msg: dict[str, Any]) -> str:
    return str(msg.get("FromUserName") or msg.get("fromusername") or "")


def strip_bot_mention(text: str, agent_id: str | None = None) -> str:
    """Remove @AsiaPower 库存 Agent / @子敬 / @应用名 prefix from group messages."""
    body = (text or "").strip()
    if not body:
        return body
    # WeCom may embed mention as XML; plain text often starts with @Name
    if body.startswith("@"):
        parts = body.split(None, 1)
        if len(parts) == 2:
            return parts[1].strip()
        return ""
    return body


def authorize_wecom_message(
    msg: dict[str, Any],
    *,
    allowed_chat_ids: set[str],
    allowed_user_ids: set[str],
    require_at_mention: bool = True,
) -> tuple[bool, str]:
    """
    Return (allowed, reason).
    Empty whitelists mean "allow all" once crypto verification passed.
    """
    if not msg:
        return False, "missing_message"

    user_id = extract_user_id(msg)
    chat_id = extract_chat_id(msg)
    in_group = is_group_message(msg)

    if allowed_user_ids and user_id and user_id not in allowed_user_ids:
        return False, "unauthorized_user"

    if in_group:
        if allowed_chat_ids and chat_id and chat_id not in allowed_chat_ids:
            return False, "unauthorized_chat"
    elif allowed_chat_ids:
        # 1:1 app chat — chat whitelist not applied unless user whitelist empty
        pass

    msg_type = (msg.get("MsgType") or msg.get("msgtype") or "").lower()
    if require_at_mention and in_group and msg_type == "text":
        # Images/files are passive batch input — no @ required in whitelisted groups.
        content = (msg.get("Content") or msg.get("content") or "").strip()
        if content.startswith("@"):
            content = strip_bot_mention(content)
        if not content:
            return False, "empty_after_mention"

    return True, ""
