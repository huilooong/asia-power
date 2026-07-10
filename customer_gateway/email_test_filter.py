"""Skip test / bot / internal probe emails — not real customer enquiries."""

from __future__ import annotations

import os
import re
from typing import Any

_TEST_LOCALS = frozenset({"test", "ceo-test", "buyer", "noreply", "no-reply"})
_TEST_DOMAINS = frozenset({
    "test.com", "test.test", "example.com", "example.org", "example.net",
    "asiapower.local", "localhost", "invalid",
})
_BOT_SUBJECT_RE = re.compile(
    r"(cloudflare\s+live\s+test|deploy\s+test|live\s+test|webhook\s+test|bot\s+test|health\s*check)",
    re.I,
)
_BOT_BODY_RE = re.compile(
    r"(cloudflare\s+live\s+test|deploy\s+test\s+g4kj|this\s+is\s+a\s+test\s+email)",
    re.I,
)


def _extract_email(addr: str) -> str:
    raw = (addr or "").strip().lower()
    m = re.search(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", raw)
    return m.group(0) if m else raw


def is_test_or_bot_email(addr: str) -> bool:
    """True for probe addresses like buyer@test.com or ceo-test@asiapower.local."""
    email = _extract_email(addr)
    if not email or "@" not in email:
        return False
    extra = os.getenv("EMAIL_TEST_BLOCKLIST", "").strip()
    if extra:
        blocked = {x.strip().lower() for x in extra.split(",") if x.strip()}
        if email in blocked:
            return True
    local, domain = email.split("@", 1)
    if domain in _TEST_DOMAINS:
        return True
    if domain.endswith(".test") or domain.endswith(".example") or domain.endswith(".invalid"):
        return True
    if local in _TEST_LOCALS and domain in _TEST_DOMAINS:
        return True
    if local.startswith("ceo-test") or local.startswith("test-"):
        return True
    return False


def is_test_or_bot_thread(thread: dict[str, Any]) -> bool:
    """True if thread looks like automated test, not a real buyer."""
    subject = thread.get("subject") or ""
    if _BOT_SUBJECT_RE.search(subject):
        return True
    for msg in thread.get("messages") or []:
        if msg.get("direction") != "inbound":
            continue
        if is_test_or_bot_email(msg.get("from") or ""):
            return True
        body = msg.get("text") or msg.get("textRedacted") or ""
        if _BOT_BODY_RE.search(body):
            return True
        if _BOT_SUBJECT_RE.search(msg.get("subject") or ""):
            return True
    return False


def skip_reason(thread: dict[str, Any]) -> str:
    if not is_test_or_bot_thread(thread):
        return ""
    return "test_or_bot_email"
