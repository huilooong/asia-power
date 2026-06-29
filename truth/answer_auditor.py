"""Audit agent answers for unsourced business statistics."""

from __future__ import annotations

import re

from truth.truth_guard import _SOURCE_MARKERS, _UNSOURCED_NUMBER_PATTERNS

_EXTRA_UNSAFE: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.I) for p in (
        r"g4kd\s*占\s*\d+",
        r"nigeria\s*\d{3,}",
        r"报价.*流失\s*\d+%",
        r"回复率提升\s*\d+%",
        r"\d+\s*个会话",
        r"\d+\s*条聊天",
        r"无来源",
    )
)


def _has_source_marker(text: str) -> bool:
    return any(m.search(text) for m in _SOURCE_MARKERS)


def audit_answer(answer: str) -> dict:
    """Detect unsourced numbers / percentages in a free-form answer."""
    body = (answer or "").strip()
    issues: list[str] = []
    unsafe: list[str] = []

    if not body:
        return {"passed": True, "issues": [], "unsafe_numbers": []}

    has_source = _has_source_marker(body)

    for pat in (*_UNSOURCED_NUMBER_PATTERNS, *_EXTRA_UNSAFE):
        for m in pat.finditer(body):
            token = m.group(0)
            if token not in unsafe:
                unsafe.append(token)

    if unsafe and not has_source:
        issues.append("contains_unsourced_numbers")
    if re.search(r"占\s*\d+%", body, re.I) and not has_source:
        issues.append("unsourced_share_percentage")
    if re.search(r"提升\s*\d+%", body, re.I) and not has_source:
        issues.append("unsourced_improvement_rate")
    if re.search(r"nigeria\s*\d{3,}", body, re.I) and not has_source:
        issues.append("unsourced_country_count")

    passed = not issues
    return {"passed": passed, "issues": issues, "unsafe_numbers": unsafe}
