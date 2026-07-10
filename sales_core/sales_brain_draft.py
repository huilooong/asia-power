"""APLIVE-003 — Sales Brain draft generator (classifier + knowledge + memory rules)."""

from __future__ import annotations

from typing import Any

from core.language_router import language_label, resolve_target_language
from customer_gateway.customer_memory_rules import evaluate_memory_write
from customer_gateway.sales_knowledge import (
    advantages_bullet,
    build_engine_context,
    enquiry_fields_prompt,
    positioning_line,
)
from customer_gateway.sales_message_classifier import InboundClassification
from sales_core.apsales_handler import (
    check_inventory_for_enquiry,
    parse_enquiry_sections,
    process_apsales_enquiry,
)
from sales_core.platform_supply import extract_product_keywords, inventory_ownership_label, supply_phrase
from tools.crm_tool import save_customer_record


def _risk_for_classification(classification: str, intent: str) -> str:
    if classification == "customer_followup":
        return "low"
    if intent in ("price_request", "negotiation", "payment"):
        return "high"
    if intent in ("availability_check", "enquiry", "shipping_request"):
        return "medium"
    return "medium"


def _next_action(classification: str, intent: str) -> str:
    if classification == "customer_followup":
        return "contact_today"
    if intent in ("price_request", "availability_check", "enquiry"):
        return "contact_today"
    return "monitor"


def _knowledge_enhanced_fallback(
    message: str,
    *,
    lang: str,
    keywords: list[str],
    inventory_hit: bool,
    classification: InboundClassification,
) -> tuple[str, str]:
    """Rule-based draft when OpenAI unavailable — uses AsiaPower sales knowledge."""
    ownership = inventory_ownership_label(inventory_hit)
    supply = supply_phrase(lang)
    positioning = positioning_line(lang)
    advantages = advantages_bullet(lang)
    fields = enquiry_fields_prompt(lang)
    engine_ctx = build_engine_context(keywords, lang=lang)
    product_str = ", ".join(keywords) if keywords else message[:60]

    internal = (
        "【内部分析】\n"
        f"- 分类: {classification.classification}（置信度 {classification.confidence:.0%}）\n"
        f"- 推理: {classification.reasoning_summary}\n"
        f"- 买方需求: {message[:200]}\n"
        f"- AsiaPower 定位: {positioning_line('zh')}\n"
    )
    if engine_ctx:
        internal += f"- 产品知识: {build_engine_context(keywords, lang='zh') or engine_ctx}\n"
    internal += (
        f"- 库存归属状态: {ownership}\n"
        "- 平台机会: 中国发动机出口撮合\n"
        f"- 缺失信息: {enquiry_fields_prompt('zh')}\n"
        "- 审批要求: 正式报价需 CEO 审批，本阶段仅草稿\n"
    )

    draft_parts = [
        f"Thank you for your enquiry about {product_str}.",
        positioning,
    ]
    if engine_ctx:
        draft_parts.append(engine_ctx)
        draft_parts.append(
            "We can help confirm complete engine, with accessories, or long block/bare engine — "
            "please specify your requirement."
        )
    draft_parts.append(
        f"To prepare an accurate FOB/CIF quotation with photos, videos, and compression test where applicable, "
        f"please share: {fields}."
    )
    if not inventory_hit:
        draft_parts.append(supply)
    draft_parts.append(f"Our strengths: {advantages}.")

    draft = (
        f"【客户草稿 / Customer Draft ({language_label(lang)})】\n"
        + " ".join(draft_parts)
    )
    return internal, draft


def build_sales_brain_draft(
    message: str,
    *,
    customer_name: str,
    customer_hash: str,
    detected_language: str,
    communication_language: str,
    classification: InboundClassification,
    channel: str = "whatsapp_live",
) -> dict[str, Any]:
    """Build draft with Sales Brain v1 audit fields."""
    import os

    from sales_core.zijing_reply_context import zijing_quick_reply

    keywords = extract_product_keywords(message)
    inventory_hit, _ = check_inventory_for_enquiry(message)
    lang = communication_language or resolve_target_language("apsales", "buyer", message)
    memory = evaluate_memory_write(
        message,
        contact_name=customer_name,
        classification=classification.classification,
    )

    quick = zijing_quick_reply(message, contact_name=customer_name) if channel == "whatsapp_live" else None
    if quick:
        internal = (
            "【内部分析】\n"
            f"- 分类: {classification.classification}\n"
            f"- 推理: {classification.reasoning_summary}\n"
            f"- 子敬快速规则: 已匹配训练话术，无需 LLM\n"
        )
        draft = quick
    elif os.getenv("OPENAI_API_KEY"):
        reply = process_apsales_enquiry(message, channel=channel)
        internal, draft = parse_enquiry_sections(reply)
        if keywords and "G4KJ" in " ".join(keywords).upper():
            extra = build_engine_context(keywords, lang=lang)
            if extra and extra not in draft:
                draft = draft.rstrip() + f"\n\n{extra} Please confirm vehicle model, year, destination port, and quantity."
    else:
        internal, draft = _knowledge_enhanced_fallback(
            message,
            lang=lang,
            keywords=keywords,
            inventory_hit=inventory_hit,
            classification=classification,
        )

    if memory["memory_write"]:
        try:
            save_customer_record(
                customer_name,
                language=communication_language,
                detected_language=detected_language,
                communication_language=communication_language,
                preferred_language=communication_language,
                interested_products=", ".join(keywords),
                conversation_summary=message[:400],
                follow_up_status="open",
                source="whatsapp_live",
                buyer_or_supplier="buyer",
                demand_type=classification.intent_category,
                matched_inventory_status="matched" if inventory_hit else "unchecked",
                platform_value="gmv_lead",
            )
        except Exception:
            pass

    intent = classification.intent_category or "unknown"
    risk = "low" if quick else _risk_for_classification(classification.classification, intent)
    return {
        "customer_name": customer_name,
        "customer_hash": customer_hash,
        "detected_language": detected_language,
        "internal_analysis_zh": internal,
        "customer_reply_draft": draft,
        "risk_level": risk,
        "approval_required": not bool(quick),
        "next_action": _next_action(classification.classification, intent),
        "category": intent,
        "classification": classification.classification,
        "confidence": classification.confidence,
        "action": classification.action,
        "reasoning_summary": classification.reasoning_summary,
        "memory_write": memory["memory_write"],
        "memory_reason": memory["memory_reason"],
    }
