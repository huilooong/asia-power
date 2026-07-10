"""子敬 WhatsApp 自动回复 — 训练规则 + 快速话术（CEO 定稿写入此处 / SOP）."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOP_PATH = ROOT / "docs" / "customer-service-sop.md"

_GREETING_ONLY_RE = re.compile(
    r"^(?:hi+|hello+|hey+|good\s+(?:morning|afternoon|evening))[\s!?.]*$",
    re.I,
)
_HOW_ARE_YOU_RE = re.compile(
    r"^how\s+(?:are\s+you|you\s+doing|is\s+it\s+going)[\s!?.]*$",
    re.I,
)
_MORE_INFO_RE = re.compile(
    r"(?:can i get more info|more info on this|need more info)",
    re.I,
)


def zijing_training_rules_addon() -> str:
    """Condensed rules for APSales WhatsApp auto-reply prompt."""
    return (
        "Zijing (子敬) trained WhatsApp rules — MUST follow:\n"
        "- Sound like a real person texting, not a call center. Short lines.\n"
        "- Do NOT start every message with `Hello sir`.\n"
        "- Existing customer sent only `Hi`/`Hello` with no new question → reply `Hi` only.\n"
        "- Vague opener → website + ask need: www.asia-power.com + What you need?\n"
        "- Specific enquiry → still include www.asia-power.com once if not just sent.\n"
        "- Never auto-quote price, payment, shipping, container, duty, discount — escalate to CEO.\n"
        "- GHS / RMB / USD — never guess currency conversion.\n"
        "- Ghana local stock: say ready to collect in GHS when applicable.\n"
        "- China late night: say photos/videos tomorrow morning, don't promise instant.\n"
    )


def zijing_quick_reply(message: str, *, contact_name: str = "") -> str | None:
    """
    Rule-based instant reply for WhatsApp auto-send (no LLM).
    Returns plain English text only, or None to fall through to LLM draft.
    """
    body = (message or "").strip()
    if not body:
        return None

    if _GREETING_ONLY_RE.match(body):
        return "Hi"

    if _HOW_ARE_YOU_RE.match(body):
        return "Good thanks, you?\n\nwww.asia-power.com\n\nWhat you need?"

    if _MORE_INFO_RE.search(body):
        return (
            "Hello! Welcome to AsiaPower 🙏\n\n"
            "Please visit our website: www.asia-power.com\n\n"
            "What are you looking for?"
        )

    return None
