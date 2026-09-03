"""Small pre-sales CRM state machine with evidence requirements."""

from __future__ import annotations

from collections import Counter
from typing import Any

from agents.apbd.solo_trade.models import CRMStatus, utc_now_iso

ALLOWED_TRANSITIONS: dict[CRMStatus, set[CRMStatus]] = {
    CRMStatus.NEW: {CRMStatus.RESEARCHED, CRMStatus.DISQUALIFIED, CRMStatus.REJECTED},
    CRMStatus.RESEARCHED: {CRMStatus.DRAFT_READY, CRMStatus.DISQUALIFIED, CRMStatus.REJECTED},
    CRMStatus.DRAFT_READY: {CRMStatus.APPROVAL_PENDING, CRMStatus.REJECTED},
    CRMStatus.APPROVAL_PENDING: {CRMStatus.APPROVED, CRMStatus.REJECTED},
    CRMStatus.APPROVED: {CRMStatus.SENT, CRMStatus.REJECTED},
    CRMStatus.SENT: {CRMStatus.OPENED, CRMStatus.REPLIED, CRMStatus.QUALIFIED, CRMStatus.DISQUALIFIED},
    CRMStatus.OPENED: {CRMStatus.REPLIED, CRMStatus.QUALIFIED, CRMStatus.DISQUALIFIED},
    CRMStatus.REPLIED: {CRMStatus.QUALIFIED, CRMStatus.DISQUALIFIED},
    CRMStatus.QUALIFIED: set(),
    CRMStatus.DISQUALIFIED: set(),
    CRMStatus.REJECTED: set(),
}


def transition_status(
    lead: dict[str, Any],
    target: CRMStatus | str,
    *,
    actor: str,
    reason: str,
) -> dict[str, Any]:
    current = CRMStatus(str(lead.get("status") or CRMStatus.NEW.value))
    target_status = target if isinstance(target, CRMStatus) else CRMStatus(str(target))
    if target_status == current:
        return lead
    if target_status not in ALLOWED_TRANSITIONS[current]:
        raise ValueError(f"Invalid CRM transition: {current.value} -> {target_status.value}")
    if not actor.strip() or not reason.strip():
        raise ValueError("CRM transitions require actor and reason")
    lead["status"] = target_status.value
    lead.setdefault("status_history", []).append(
        {
            "from": current.value,
            "to": target_status.value,
            "at": utc_now_iso(),
            "actor": actor.strip(),
            "reason": reason.strip(),
        }
    )
    return lead


def record_activity(
    lead: dict[str, Any],
    event_type: str,
    *,
    source: str,
    evidence_ref: str,
    note: str = "",
) -> dict[str, Any]:
    event = event_type.strip().casefold()
    if event not in {"draft_created", "approval_requested", "sent", "opened", "replied", "qualified", "note"}:
        raise ValueError(f"Unsupported CRM activity: {event_type}")
    if event in {"sent", "opened", "replied"} and (not source.strip() or not evidence_ref.strip()):
        raise ValueError(f"{event} requires a provider or manual evidence reference")
    if event == "opened" and source.strip().casefold() in {"gmail", "gmail_api"}:
        raise ValueError("Gmail API delivery alone cannot prove an email open")
    lead.setdefault("activities", []).append(
        {
            "event": event,
            "at": utc_now_iso(),
            "source": source.strip(),
            "evidence_ref": evidence_ref.strip(),
            "note": note.strip(),
        }
    )
    target_by_event = {
        "opened": CRMStatus.OPENED,
        "replied": CRMStatus.REPLIED,
        "qualified": CRMStatus.QUALIFIED,
    }
    target = target_by_event.get(event)
    if target:
        transition_status(lead, target, actor=source, reason=f"Evidence event: {event}")
    return lead


def build_dashboard(campaign: dict[str, Any]) -> dict[str, Any]:
    leads = list(campaign.get("leads") or [])
    statuses = Counter(str(lead.get("status") or CRMStatus.NEW.value) for lead in leads)
    scores = [float((lead.get("score") or {}).get("overall_score")) for lead in leads if (lead.get("score") or {}).get("overall_score") is not None]
    replies = statuses[CRMStatus.REPLIED.value] + statuses[CRMStatus.QUALIFIED.value]
    sent = sum(
        statuses[key]
        for key in (
            CRMStatus.SENT.value,
            CRMStatus.OPENED.value,
            CRMStatus.REPLIED.value,
            CRMStatus.QUALIFIED.value,
            CRMStatus.DISQUALIFIED.value,
        )
    )
    return {
        "generated_at": utc_now_iso(),
        "campaign_id": campaign.get("campaign_id"),
        "lead_count": len(leads),
        "status_counts": dict(statuses),
        "average_score": round(sum(scores) / len(scores), 1) if scores else None,
        "sent_count": sent,
        "reply_count": replies,
        "reply_rate": round(replies / sent * 100, 1) if sent else None,
        "approval_pending": statuses[CRMStatus.APPROVAL_PENDING.value],
        "measurement_notes": [
            "Reply rate is calculated only when at least one send has provider evidence.",
            "Open events require provider webhook or explicit manual evidence.",
            "Scores are evidence estimates, not purchase probabilities.",
        ],
    }
