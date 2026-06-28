"""Telegram access control helpers (no network)."""

from __future__ import annotations


def parse_allowed_chat_ids(raw: str | None) -> set[str]:
    """Parse comma-separated chat_id whitelist."""
    if not raw:
        return set()
    return {part.strip() for part in raw.split(",") if part.strip()}


def is_private_chat(chat: dict | None) -> bool:
    """Only private chats are allowed for COO MVP."""
    return bool(chat) and chat.get("type") == "private"


def authorize_chat(chat: dict | None, allowed_chat_ids: set[str]) -> tuple[bool, str]:
    """
    Return (allowed, reason).
    reason is empty when allowed; otherwise a short rejection code.
    """
    if not chat:
        return False, "missing_chat"

    chat_id = str(chat.get("id", ""))
    if not is_private_chat(chat):
        return False, "non_private"

    if not allowed_chat_ids:
        return False, "whitelist_empty"

    if chat_id not in allowed_chat_ids:
        return False, "unauthorized"

    return True, ""
