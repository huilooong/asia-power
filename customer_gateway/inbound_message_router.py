"""Route inbound WhatsApp messages through classifier → language → APSales → draft queue."""

from __future__ import annotations

from typing import Any

from audit.logger import log_event
from customer_gateway.approval_notification import notify_new_draft
from customer_gateway.draft_queue import save_draft
from customer_gateway.sales_message_classifier import (
    classify_inbound_message,
    should_generate_draft,
)
from customer_gateway.whatsapp_live_readonly import InboundMessage
from core.language_router import detect_language, resolve_target_language
from core.constitution_runtime import apply_constitution_runtime, estimate_inventory_confidence
from sales_core.apsales_handler import check_inventory_for_enquiry
from sales_core.platform_supply import extract_product_keywords
from sales_core.sales_brain_draft import build_sales_brain_draft


def route_inbound_batch(messages: list[InboundMessage]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for msg in messages:
        draft = route_inbound_message(msg)
        if draft:
            results.append(draft)
    return results


def route_inbound_message(msg: InboundMessage) -> dict[str, Any] | None:
    """Customer Gateway → Sales Brain Classifier → APSales → Draft (if allowed)."""
    classification = classify_inbound_message(msg.message, contact_name=msg.contact_name)

    if not should_generate_draft(classification):
        log_event(
            "inbound_message_ignored",
            message_id=msg.message_id,
            contact=msg.contact_name,
            classification=classification.classification,
            action=classification.action,
            reasoning=classification.reasoning_summary[:200],
        )
        return None

    detected = detect_language(msg.message, scenario="buyer")
    comm_lang = resolve_target_language("apsales", "buyer", msg.message)

    draft_payload = build_sales_brain_draft(
        msg.message,
        customer_name=msg.contact_name,
        customer_hash=msg.customer_hash,
        detected_language=detected,
        communication_language=comm_lang,
        classification=classification,
        channel="whatsapp_live",
    )

    inventory_hit, _ = check_inventory_for_enquiry(msg.message)
    inventory_confidence = estimate_inventory_confidence(
        inventory_hit=inventory_hit,
        message=msg.message,
    )
    draft_payload = apply_constitution_runtime(
        draft_payload,
        context={
            "message": msg.message,
            "intent": draft_payload.get("category"),
            "classification": classification.classification,
            "inventory_hit": inventory_hit,
            "inventory_confidence": inventory_confidence,
            "pricing_confidence": 0.55 if "price" in msg.message.lower() else 0.8,
            "role": "sales",
        },
    )

    if draft_payload.get("constitution_allowed") is False:
        log_event(
            "constitution_blocked_draft",
            message_id=msg.message_id,
            reason=draft_payload.get("constitution_reason", ""),
            risk=draft_payload.get("risk_level"),
        )

    draft_payload.update({
        "message_id": msg.message_id,
        "chat_id": msg.chat_id,
        "phone_number_hash": msg.phone_number_hash,
        "original_message": msg.message,
        "detected_language": detected,
        "products": extract_product_keywords(msg.message),
    })

    saved = save_draft(draft_payload)
    from customer_gateway.whatsapp_auto_sender import try_auto_send_low_risk

    auto_send = try_auto_send_low_risk(saved)
    if not auto_send.get("ok"):
        notify_new_draft(saved)
    return saved
