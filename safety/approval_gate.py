"""CEO approval gate for high-risk and critical actions."""

from __future__ import annotations

from safety.policy import APPROVAL_REQUIRED_RISKS, BLOCKED_WITHOUT_APPROVAL


def check_approval(
    tool_name: str,
    action: str,
    risk_level: str,
    *,
    ceo_approved: bool = False,
    dry_run: bool = False,
) -> tuple[bool, str]:
    """
    Return (allowed, reason).
    critical is blocked unless ceo_approved.
    high requires approval unless dry_run.
    """
    act = (action or "").lower().replace("_", "-")
    key = f"{tool_name}.{act}"
    risk = (risk_level or "low").lower()

    if dry_run:
        return True, ""

    if risk == "critical":
        if not ceo_approved:
            return False, (
                f"CRITICAL risk blocked: {tool_name} {act}. "
                "Append | approved only after CEO authorization."
            )
        return True, ""

    if key in BLOCKED_WITHOUT_APPROVAL and not ceo_approved:
        return False, (
            f"Action {key} requires CEO approval. "
            "Use dry-run first, then append | approved."
        )

    if risk in APPROVAL_REQUIRED_RISKS and not ceo_approved:
        return False, (
            f"{risk.upper()} risk: CEO approval required for {tool_name} {act}. "
            "Append | approved if authorized."
        )

    return True, ""


def record_approval_if_granted(
    tool_name: str,
    action: str,
    risk_level: str,
    command: str,
    *,
    ceo_approved: bool,
    approved_by: str = "CEO",
) -> None:
    if not ceo_approved:
        return
    from audit.logger import log_approval_granted
    log_approval_granted(
        action=f"{tool_name}.{action}",
        risk_level=risk_level,
        command=command,
        approved_by=approved_by,
        result="granted",
    )
