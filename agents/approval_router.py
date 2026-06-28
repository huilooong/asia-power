"""Approval routing for business agents — LOW / MEDIUM / HIGH / CRITICAL."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from audit.logger import log_event


class ApprovalLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


ACTION_LEVELS: dict[str, ApprovalLevel] = {
    "record_note": ApprovalLevel.LOW,
    "internal_analysis": ApprovalLevel.LOW,
    "final_quote": ApprovalLevel.MEDIUM,
    "external_message": ApprovalLevel.MEDIUM,
    "payment_terms": ApprovalLevel.HIGH,
    "delivery_commitment": ApprovalLevel.CRITICAL,
    "refund_commitment": ApprovalLevel.CRITICAL,
    "deploy": ApprovalLevel.CRITICAL,
    "delete_data": ApprovalLevel.CRITICAL,
    "modify_constitution": ApprovalLevel.CRITICAL,
}


@dataclass
class ApprovalRequest:
    agent_id: str = "apsales"
    action: str = ""
    customer: str = ""
    product: str = ""
    risk_level: str = "medium"
    recommended_quote: str = ""
    reason: str = ""
    command: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


def classify_action(action: str) -> ApprovalLevel:
    key = (action or "").strip().lower().replace("-", "_")
    return ACTION_LEVELS.get(key, ApprovalLevel.MEDIUM)


def approval_route(level: ApprovalLevel) -> str:
    """Who handles the approval request."""
    if level == ApprovalLevel.LOW:
        return "agent_internal"
    if level == ApprovalLevel.MEDIUM:
        return "ceo_telegram"
    if level == ApprovalLevel.HIGH:
        return "apcoo_then_ceo"
    return "apcoo_review_ceo_approval"


def can_execute(level: ApprovalLevel, *, approved: bool, apcoo_reviewed: bool = False) -> bool:
    if level == ApprovalLevel.LOW:
        return True
    if level == ApprovalLevel.CRITICAL:
        return approved and apcoo_reviewed
    if level in (ApprovalLevel.MEDIUM, ApprovalLevel.HIGH):
        return approved
    return False


def format_ceo_approval_message(req: ApprovalRequest, level: ApprovalLevel) -> str:
    risk = req.risk_level or level.value
    lines = [
        "APSales Approval Request",
        "",
        f"Customer: {req.customer or '(unspecified)'}",
        f"Product: {req.product or '(unspecified)'}",
        f"Risk: {risk.capitalize()}",
    ]
    if req.recommended_quote:
        lines.append(f"Recommended Quote: {req.recommended_quote}")
    if req.reason:
        lines.append(f"Reason: {req.reason}")
    if level == ApprovalLevel.HIGH:
        lines.append("")
        lines.append("(Routed via APCOO review → CEO recommendation)")
    if level == ApprovalLevel.CRITICAL:
        lines.append("")
        lines.append("(CRITICAL — APCOO review required before CEO approval)")
    lines.extend([
        "",
        "Reply:",
        "approved",
        "or",
        "reject",
        "or",
        "revise: ...",
    ])
    return "\n".join(lines)


def route_approval(req: ApprovalRequest) -> dict[str, Any]:
    """Determine approval path and whether execution is allowed."""
    level = classify_action(req.action)
    route = approval_route(level)
    blocked = level != ApprovalLevel.LOW

    log_event(
        "approval_required" if blocked else "approval_internal",
        agent=req.agent_id,
        action=req.action,
        level=level.value,
        route=route,
        customer=req.customer,
    )

    return {
        "level": level.value,
        "route": route,
        "blocked_until_approval": blocked,
        "ceo_message": format_ceo_approval_message(req, level) if blocked else "",
        "can_execute": can_execute(level, approved=False),
    }


def parse_ceo_reply(text: str) -> dict[str, str]:
    """Parse CEO Telegram reply: approved | reject | revise: ..."""
    body = (text or "").strip().lower()
    if body in ("approved", "approve", "yes", "ok"):
        return {"status": "approved", "note": ""}
    if body.startswith("revise:") or body.startswith("revise："):
        note = text.split(":", 1)[-1].strip() if ":" in text else ""
        return {"status": "revise", "note": note}
    if body in ("reject", "rejected", "no", "denied"):
        return {"status": "rejected", "note": ""}
    return {"status": "unknown", "note": text.strip()}


def record_approval_granted(req: ApprovalRequest, *, approved_by: str = "CEO") -> None:
    from audit.logger import log_approval_granted
    level = classify_action(req.action)
    log_approval_granted(
        action=f"{req.agent_id}.{req.action}",
        risk_level=level.value,
        command=req.command or req.action,
        approved_by=approved_by,
        result="granted",
    )
    log_event("approval_granted", agent=req.agent_id, action=req.action, approved_by=approved_by)
