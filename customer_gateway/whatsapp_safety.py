"""WhatsApp read-only safety — block all write operations."""

from __future__ import annotations

import os

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


def low_risk_auto_send_enabled() -> bool:
    enabled = os.getenv("WHATSAPP_AUTO_SEND_LOW_RISK", "").strip().lower() in {"1", "true", "yes"}
    ack = os.getenv("WHATSAPP_AUTO_SEND_ACK_RISK", "").strip() == "I_UNDERSTAND_CUSTOMER_SEND_RISK"
    return enabled and ack


def assert_write_blocked(operation: str) -> None:
    op = (operation or "").lower()
    if any(token in op for token in _BLOCKED):
        log_error(f"WhatsApp safety blocked: {operation}", context="whatsapp_safety")
        log_event("whatsapp_safety_blocked", operation=operation, send_enabled=SEND_ENABLED)
        raise SafetyError(f"WhatsApp read-only blocked: {operation}")


def assert_low_risk_auto_send_allowed(operation: str) -> None:
    """Allow only the explicit low-risk auto-send lane when enabled."""
    if low_risk_auto_send_enabled():
        log_event("whatsapp_low_risk_send_allowed", operation=operation)
        return
    log_error(f"WhatsApp low-risk send disabled: {operation}", context="whatsapp_safety")
    log_event("whatsapp_low_risk_send_blocked", operation=operation)
    raise SafetyError("WHATSAPP_AUTO_SEND_LOW_RISK is not enabled")
