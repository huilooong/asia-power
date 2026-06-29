"""WhatsApp read-only safety — block all write operations."""

from __future__ import annotations

from audit.logger import log_error, log_event

SEND_ENABLED = False
MARK_READ_ENABLED = False

_BLOCKED = (
    "send", "reply", "type", "click_send", "delete", "modify", "archive",
    "mark-read", "mark_read", "star", "unstar", "edit_contact", "call",
    "auto_reply", "auto_send",
)


class SafetyError(PermissionError):
    """WhatsApp write operation blocked in read-only phase."""


def assert_write_blocked(operation: str) -> None:
    op = (operation or "").lower()
    if any(token in op for token in _BLOCKED):
        log_error(f"WhatsApp safety blocked: {operation}", context="whatsapp_safety")
        log_event("whatsapp_safety_blocked", operation=operation, send_enabled=SEND_ENABLED)
        raise SafetyError(f"WhatsApp read-only blocked: {operation}")
