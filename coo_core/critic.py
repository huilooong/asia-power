"""COO Critic — review engineer/Cursor output before CEO approval (rule-based v0.3)."""

from __future__ import annotations

import re

# (pattern, issue, risk, required_change, score_penalty, force_status)
# force_status: None | "changes_required" | "rejected"
REVIEW_RULES: list[tuple[re.Pattern[str], str, str, str, int, str | None]] = [
    (
        re.compile(r"write.*memory.*direct|open\(.*memory/|Path\(.*memory/", re.I),
        "Writes memory files directly instead of Memory Tool",
        "Memory corruption and bypass of audit trail",
        "Route all memory writes through tools/memory_tool.py",
        35,
        "rejected",
    ),
    (
        re.compile(r"writes?\s+to\s+memory/|\.write_text\(.*memory", re.I),
        "Direct filesystem write to memory directory",
        "Breaks architecture rule: agents must not write memory directly",
        "Use save_memory(), save_decision(), or save_customer_note()",
        35,
        "rejected",
    ),
    (
        re.compile(r"\bfastapi\b|\bflask\b|\bdjango\b", re.I),
        "Adds web framework without approval",
        "Scope creep; premature infrastructure",
        "Remove FastAPI/Flask unless CEO explicitly approved",
        30,
        "changes_required",
    ),
    (
        re.compile(r"\bsqlite\b|\bpostgres|\bmysql\b|\bmongodb\b|\bredis\b", re.I),
        "Adds database layer without approval",
        "Violates local-file v0.3 constraint",
        "Use JSON/markdown storage via tools until approved",
        30,
        "changes_required",
    ),
    (
        re.compile(r"\bdocker\b|\bdockerfile\b", re.I),
        "Adds Docker without approval",
        "Deployment complexity not in v0.3 scope",
        "Defer containerization until CEO approval",
        25,
        "changes_required",
    ),
    (
        re.compile(r"\bcelery\b|\brabbitmq\b|\bkafka\b", re.I),
        "Adds async queue infrastructure",
        "Over-engineering for current stage",
        "Use local task_tool.json instead",
        25,
        "changes_required",
    ),
    (
        re.compile(r"api[_-]?key\s*=\s*['\"][^'\"]+['\"]|sk-[a-zA-Z0-9]{10,}", re.I),
        "Hard-coded secret or API key detected",
        "Security leak risk",
        "Load secrets from .env only; never commit keys",
        40,
        "rejected",
    ),
    (
        re.compile(r"removed?\s+.*router|broke?\s+.*main\.py|delete.*memory_tool", re.I),
        "May break Router / Memory Tool / main.py flow",
        "Regression on working CLI path",
        "Preserve existing main.py chat mode and tool layers",
        30,
        "changes_required",
    ),
]

POSITIVE_SIGNALS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"memory_tool|tools\.memory", re.I), "Uses Memory Tool"),
    (re.compile(r"task_tool|tools\.task", re.I), "Uses Task Tool"),
    (re.compile(r"unittest|test_", re.I), "Includes tests"),
    (re.compile(r"rule-based|small scope|minimal", re.I), "Keeps scope small"),
]


def review_text(output: str) -> dict:
    """Review text output and return structured critic verdict."""
    text = output or ""
    issues: list[str] = []
    risks: list[str] = []
    required_changes: list[str] = []
    score = 100
    worst_status = "approved"

    status_rank = {"approved": 0, "changes_required": 1, "rejected": 2}

    for pattern, issue, risk, change, penalty, force in REVIEW_RULES:
        if pattern.search(text):
            if issue:
                issues.append(issue)
            if risk:
                risks.append(risk)
            if change:
                required_changes.append(change)
            score -= penalty
            if force and status_rank.get(force, 0) > status_rank.get(worst_status, 0):
                worst_status = force

    positives: list[str] = []
    for pattern, label in POSITIVE_SIGNALS:
        if pattern.search(text):
            positives.append(label)
            score = min(100, score + 3)

    # No tests for new tool files
    if re.search(r"tools/\w+_tool\.py", text, re.I) and not re.search(
        r"test_\w+_tool|unittest", text, re.I
    ):
        issues.append("New tool added without corresponding tests")
        risks.append("Untested tools may break COO flows")
        required_changes.append("Add tests/test_<tool>_tool.py with unittest coverage")
        score -= 20
        if status_rank["changes_required"] > status_rank[worst_status]:
            worst_status = "changes_required"

    score = max(0, min(100, score))

    if not issues and score >= 80:
        status = "approved"
        reason = "Follows architecture; scope appears controlled."
    elif worst_status == "rejected" or score < 50:
        status = "rejected"
        reason = "Critical architecture or security violations detected."
    else:
        status = "changes_required"
        reason = "Address listed issues before CEO approval."

    if status_rank.get(worst_status, 0) > status_rank.get(status, 0):
        status = worst_status

    return {
        "status": status,
        "score": score,
        "issues": issues,
        "risks": risks,
        "required_changes": required_changes,
        "positives": positives,
        "decision_reason": reason,
    }


def format_review(result: dict) -> str:
    """Format critic result for CLI."""
    lines = [
        f"Status: {result['status'].upper()} (score: {result['score']}/100)",
        f"Reason: {result['decision_reason']}",
    ]
    if result.get("positives"):
        lines.extend(["", "Positives:"])
        for p in result["positives"]:
            lines.append(f"  + {p}")
    if result.get("issues"):
        lines.extend(["", "Issues:"])
        for issue in result["issues"]:
            lines.append(f"  - {issue}")
    if result.get("risks"):
        lines.extend(["", "Risks:"])
        for risk in result["risks"]:
            lines.append(f"  - {risk}")
    if result.get("required_changes"):
        lines.extend(["", "Required changes:"])
        for change in result["required_changes"]:
            lines.append(f"  → {change}")
    return "\n".join(lines)
