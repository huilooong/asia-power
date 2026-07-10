"""InquiryReceived → Opportunity integration (APSALES-101)."""

from __future__ import annotations

import logging
from typing import Any, Callable

from domain.opportunity.identity import compute_customer_hash
from domain.opportunity import service as svc

logger = logging.getLogger("domain.opportunity.integration")

PublishFn = Callable[[str, dict[str, Any], str], Any]

EVENT_OPPORTUNITY_CREATED = "OpportunityCreated"
EVENT_OPPORTUNITY_UPDATED = "OpportunityUpdated"


def handle_inquiry_received(
    payload: dict[str, Any],
    *,
    event_id: str = "",
    publish: PublishFn | None = None,
) -> dict[str, Any]:
    payload = dict(payload or {})
    if event_id and not payload.get("event_id"):
        payload["event_id"] = event_id
    customer_hash = compute_customer_hash(payload)
    engine = (payload.get("engine") or payload.get("product") or "").strip()

    existing = svc.find_merge_candidate(customer_hash, engine)
    if existing:
        opp = svc.merge(existing["opportunity_id"], payload, correlation_id=event_id)
        action = "merged"
        event_name = EVENT_OPPORTUNITY_UPDATED
    else:
        opp = svc.create(customer_hash, payload, correlation_id=event_id)
        action = "created"
        event_name = EVENT_OPPORTUNITY_CREATED

    if publish:
        try:
            publish(
                event_name,
                {
                    "opportunity_id": opp["opportunity_id"],
                    "action": action,
                    "customer_hash": customer_hash,
                    "sales_stage": opp.get("sales_stage"),
                    "pipeline_stage": opp.get("pipeline_stage"),
                },
                event_id,
            )
        except Exception as exc:
            logger.warning("%s publish failed: %s", event_name, exc)

    try:
        from audit.logger import log_event
        log_event(
            "opportunity_created" if action == "created" else "opportunity_updated",
            opportunity_id=opp["opportunity_id"],
            customer_hash=customer_hash,
            action=action,
        )
    except OSError:
        pass

    return {"action": action, "opportunity_id": opp["opportunity_id"], "opportunity": opp}
