"""Route inbound WhatsApp messages through classifier → language → APSales → draft queue."""

from __future__ import annotations

from typing import Any

from customer_gateway.approval_notification import notify_new_draft
from customer_gateway.draft_queue import save_draft
from customer_gateway.message_classifier import classify_text
from customer_gateway.whatsapp_live_readonly import InboundMessage
from core.language_router import detect_language, resolve_target_language
from sales_core.platform_supply import extract_product_keywords


def route_inbound_batch(messages: list[InboundMessage]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for msg in messages:
        draft = route_inbound_message(msg)
        if draft:
            results.append(draft)
    return results


def route_inbound_message(msg: InboundMessage) -> dict[str, Any] | None:
    """Customer Gateway → Classifier → Language Router → APSales → CRM → Draft."""
    from sales_core.apsales_handler import build_inbound_draft

    category = classify_text(msg.message, is_ceo=False)
    detected = detect_language(msg.message, scenario="buyer")
    comm_lang = resolve_target_language("apsales", "buyer", msg.message)

    draft_payload = build_inbound_draft(
        msg.message,
        customer_name=msg.contact_name,
        customer_hash=msg.customer_hash,
        detected_language=detected,
        communication_language=comm_lang,
        category=category,
        channel="whatsapp_live",
    )

    draft_payload.update({
        "message_id": msg.message_id,
        "chat_id": msg.chat_id,
        "phone_number_hash": msg.phone_number_hash,
        "original_message": msg.message,
        "detected_language": detected,
        "category": category,
        "products": extract_product_keywords(msg.message),
    })

    saved = save_draft(draft_payload)
    notify_new_draft(saved)
    return saved
