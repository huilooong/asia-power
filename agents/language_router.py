"""Backward-compatible re-exports — use core.language_router for new code."""

from core.language_router import (
    customer_draft_instruction,
    detect_customer_language,
    detect_language,
    get_router,
    init_language_policy,
    language_label,
    resolve_target_language,
)

__all__ = [
    "customer_draft_instruction",
    "detect_customer_language",
    "detect_language",
    "get_router",
    "init_language_policy",
    "language_label",
    "resolve_target_language",
]
