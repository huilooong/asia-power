"""APSales command handling and enquiry processing."""

from __future__ import annotations

import re

from agents.approval_router import ApprovalRequest, route_approval
from core.language_router import (
    customer_draft_instruction,
    detect_language,
    language_label,
    resolve_target_language,
)
from agents.profile_loader import load_profile
from config.models import AGENT_MODELS, DEFAULT_MODEL
from config.prompts import build_apsales_system_prompt
from coo_core.constitution_loader import build_constitution_context_for_agent
from sales_core.platform_supply import (
    STOCK_CLAIM_RE,
    extract_product_keywords,
    inventory_ownership_label,
    supply_phrase,
)
from tools import memory_tool
from tools.crm_tool import (
    format_customer_list,
    format_pipeline_summary,
    get_customer_summary,
    save_customer_record,
    update_pipeline_stage,
)
from customer_gateway.gateway_readonly import (
    dispatch_conversations_command,
    dispatch_drafts_command,
    dispatch_learning_command,
    dispatch_sales_intelligence_command,
    dispatch_whatsapp_command,
    format_customer_followups,
    get_gateway_context_for_enquiry,
    search_customers_and_history,
)
from tools.registry import ToolContext, list_tools, run_tool, run_tool_command

APSALES_COMMANDS = (
    "/help", "/tools", "/remember", "/recall", "/customer", "/pipeline",
    "/tool", "/sales", "/whatsapp", "/drafts", "/conversations", "/learning",
    "/sales-intelligence",
)

INTERNAL_SECTIONS = (
    "买方需求",
    "潜在供应商匹配",
    "库存归属状态",
    "平台机会",
    "缺失信息",
    "审批要求",
)


def is_apsales_command(message: str) -> bool:
    text = (message or "").strip()
    if text.lower().startswith("/sales"):
        return True
    if text.lower().startswith("/drafts"):
        return True
    if text == "/tools" or text.startswith("/tool "):
        return True
    return any(text.startswith(cmd) for cmd in APSALES_COMMANDS if cmd != "/sales")


def parse_sales_message(message: str) -> str:
    """Strip /sales and optional customer: prefix."""
    text = message.strip()
    if text.lower().startswith("/sales"):
        text = text[6:].strip()
    if text.lower().startswith("customer:"):
        text = text[9:].strip()
    return text


def apsales_help_text() -> str:
    return (
        "APSales — 平台 GMV 增长工作台（中文内部沟通）\n"
        "/help — this message\n"
        "/sales customer: <enquiry> — process buyer enquiry\n"
        "/tools — list allowed tools\n"
        "/tool <name> <action> [args] — run tool (approval gated)\n"
        "/remember [category] | <note> — save memory\n"
        "/recall <keyword> — search memory\n"
        "/customer — list CRM records\n"
        "/customer search <keyword> — search WhatsApp gateway history\n"
        "/customer followups — 跟进清单（中文）\n"
        "/customer <name> | country | lang | products | summary — save CRM\n"
        "/pipeline — show sales pipeline\n"
        "/pipeline <name> | stage — update stage\n"
        "/whatsapp import <path> — import WhatsApp .txt export (read-only)\n"
        "/whatsapp sync --readonly — 只读同步 WhatsApp 历史\n"
        "/whatsapp analyze — 销售智能分析报告（中文）\n"
        "/whatsapp report — 查看最新完整报告\n"
        "/whatsapp listen --readonly — 只读监听新消息\n"
        "/whatsapp listen status — 监听状态\n"
        "/drafts list — WhatsApp 回复草稿队列\n"
        "/drafts show <id> — 查看草稿\n"
        "/drafts approve <id> — 批准草稿（不发送）\n\n"
        "/conversations list — 只读聊天归档统计\n"
        "/conversations analyze — 分析 normalized 消息\n"
        "/learning candidates — 待审 learning 候选\n"
        "/learning approve <id> — CEO 批准写入 memory\n"
        "/learning reject <id> — 拒绝（不写入 memory）\n\n"
        "/sales-intelligence import — 全量历史导入 Conversation DB\n"
        "/sales-intelligence analyze — 销售智能分析\n"
        "/sales-intelligence dashboard — CEO Dashboard\n\n"
        "原则：Read Only → Analyze → Draft → Telegram Approval。禁止自动发送 WhatsApp。\n"
        "平台定位：撮合买家与供应商，提升 GMV；默认不假设 AsiaPower 自有库存。\n"
        "输出：【内部分析】中文 + 【客户草稿】买家语言 (EN/FR/AR)"
    )


def check_inventory_for_enquiry(message: str) -> tuple[bool, str]:
    """Run inventory tool search; return (hit, summary)."""
    for keyword in extract_product_keywords(message):
        result = run_tool(
            "inventory", "search", [keyword],
            ctx=ToolContext(source="apsales", channel="cli"),
        )
        if result.ok and "no inventory matches" not in result.output.lower():
            return True, result.output[:600]
    return False, "No inventory tool match for enquiry keywords."


def dispatch_apsales_command(message: str, channel: str = "cli") -> str:
    text = message.strip()

    if text.lower().startswith("/sales"):
        enquiry = parse_sales_message(text)
        if not enquiry:
            return "Usage: /sales customer: <buyer enquiry text>"
        return process_apsales_enquiry(enquiry, channel=channel)

    if text.startswith("/help") or text == "/start":
        return apsales_help_text()

    if text == "/tools":
        return list_tools()

    if text.startswith("/tool "):
        body = text[len("/tool "):].strip()
        ctx = ToolContext(source="apsales", channel=channel)
        return run_tool_command(body, ctx=ctx)

    if text.startswith("/remember"):
        body = text[len("/remember"):].strip()
        if not body:
            return "Usage: /remember [category] | <note>"
        category, _, content = body.partition("|")
        try:
            return memory_tool.remember(
                content.strip() or body,
                category=(category.strip().lower() or "general"),
                source="apsales",
            )
        except ValueError as exc:
            return f"Error: {exc}"

    if text.startswith("/recall"):
        keyword = text[len("/recall"):].strip()
        if not keyword:
            return "Usage: /recall <keyword>"
        return memory_tool.recall(keyword)

    if text.lower().startswith("/whatsapp"):
        return dispatch_whatsapp_command(text)

    if text.lower().startswith("/drafts"):
        return dispatch_drafts_command(text)

    if text.lower().startswith("/conversations"):
        return dispatch_conversations_command(text)

    if text.lower().startswith("/learning"):
        return dispatch_learning_command(text)

    if text.lower().startswith("/sales-intelligence"):
        return dispatch_sales_intelligence_command(text)

    if text.startswith("/customer"):
        body = text[len("/customer"):].strip()
        if not body:
            return format_customer_list()
        if body.lower().startswith("search"):
            keyword = body[6:].strip()
            return search_customers_and_history(keyword)
        if body.lower().startswith("followups"):
            return format_customer_followups()
        parts = [p.strip() for p in body.split("|")]
        if len(parts) < 2:
            return get_customer_summary(parts[0]) if parts else format_customer_list()
        return save_customer_record(
            parts[0],
            country=parts[1] if len(parts) > 1 else "",
            language=parts[2] if len(parts) > 2 else "en",
            interested_products=parts[3] if len(parts) > 3 else "",
            conversation_summary=parts[4] if len(parts) > 4 else "",
        )

    if text.startswith("/pipeline"):
        body = text[len("/pipeline"):].strip()
        if not body:
            return format_pipeline_summary()
        parts = [p.strip() for p in body.split("|")]
        if len(parts) >= 2:
            return update_pipeline_stage(parts[0], parts[1])
        return format_pipeline_summary()

    return f"Unknown command. Try /help"


def build_apsales_enquiry_prompt(message: str, profile: dict) -> str:
    lang = resolve_target_language("apsales", "buyer", message)
    inventory_hit, inventory_note = check_inventory_for_enquiry(message)
    ownership = inventory_ownership_label(inventory_hit)
    constitution = build_constitution_context_for_agent("apsales")
    base = build_apsales_system_prompt(profile)
    supply_line = supply_phrase(lang)

    stock_rule = (
        "Inventory tool CONFIRMED a catalog/supplier signal. You may reference matched availability "
        "but still do not claim AsiaPower owns the stock unless explicitly verified."
        if inventory_hit
        else (
            f"You MUST NOT say 'we have stock', 'we have it in stock', or imply AsiaPower owns inventory. "
            f"Use this supply wording: \"{supply_line}\""
        )
    )

    gateway_ctx = get_gateway_context_for_enquiry(message)

    prompt = (
        f"{constitution}\n\n---\n\n{base}\n\n"
        f"Platform GMV agent — NOT traditional self-operated sales.\n"
        f"Detected customer language: {language_label(lang)} ({lang}).\n"
        f"{customer_draft_instruction(lang)}\n\n"
        f"Inventory tool result: hit={inventory_hit}\n"
        f"Ownership status: {ownership}\n"
        f"Inventory notes: {inventory_note[:400]}\n\n"
    )
    if gateway_ctx:
        prompt += f"{gateway_ctx}\n\n"

    return (
        prompt
        + "For every enquiry output exactly two sections:\n\n"
        "【内部分析】\n"
        "（中文，必须包含以下小标题）\n"
        "- 买方需求：\n"
        "- 潜在供应商匹配：\n"
        "- 库存归属状态：\n"
        "- 平台机会：\n"
        "- 缺失信息：\n"
        "- 审批要求：\n\n"
        f"【客户草稿 / Customer Draft ({language_label(lang)})】\n"
        f"{stock_rule}\n"
        "Professional platform sales tone. No AI/APCOO/approval exposure. No Chinese.\n"
        "Do not invent final prices — explain FOB/CIF quote process if price unknown.\n"
    )


def enforce_supply_language(reply: str, inventory_hit: bool, lang: str = "en") -> str:
    """Post-process customer draft to remove unjustified stock claims."""
    if inventory_hit or not reply:
        return reply

    parts = re.split(r"(【客户草稿[^】]*】)", reply, maxsplit=1)
    if len(parts) < 3:
        draft_section = reply
        prefix = ""
    else:
        prefix, _, draft_section = parts[0], parts[1], parts[2]

    if STOCK_CLAIM_RE.search(draft_section):
        replacement = supply_phrase(lang)
        draft_section = STOCK_CLAIM_RE.sub(replacement, draft_section)
        if replacement not in draft_section:
            draft_section = draft_section.rstrip() + f"\n\n{replacement}"

    return (prefix + (parts[1] if len(parts) >= 3 else "") + draft_section).strip()


def process_apsales_enquiry(message: str, channel: str = "cli") -> str:
    """Process buyer enquiry — with or without OpenAI."""
    import os
    from openai import OpenAI

    profile = load_profile("apsales")
    inventory_hit, _ = check_inventory_for_enquiry(message)
    lang = resolve_target_language("apsales", "buyer", message)

    approval_info = check_quote_approval_needed(message)
    if approval_info and approval_info.get("blocked_until_approval"):
        return "需要审批 — 已阻断执行。\n\n" + approval_info.get("ceo_message", "")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        reply = _fallback_enquiry_response(message, inventory_hit, lang)
        detected = detect_language(message, scenario="buyer")
        _auto_save_enquiry_memory(message, reply, lang, detected, inventory_hit)
        memory_tool.log_conversation(message, reply, source="apsales", channel=channel, important=True)
        return reply

    try:
        client = OpenAI(api_key=api_key)
        reply = process_enquiry_with_openai(client, message, profile)
        reply = enforce_supply_language(reply, inventory_hit, lang)
        memory_tool.log_conversation(message, reply, source="apsales", channel=channel, important=True)
        return reply
    except Exception:
        reply = _fallback_enquiry_response(message, inventory_hit, lang)
        detected = detect_language(message, scenario="buyer")
        _auto_save_enquiry_memory(message, reply, lang, detected, inventory_hit)
        memory_tool.log_conversation(message, reply, source="apsales", channel=channel, important=True)
        return reply


def _fallback_enquiry_response(message: str, inventory_hit: bool, lang: str) -> str:
    """Rule-based dual output when OpenAI unavailable (tests/CLI)."""
    keywords = ", ".join(extract_product_keywords(message)) or message[:80]
    ownership = inventory_ownership_label(inventory_hit)
    supply = supply_phrase(lang)
    gateway_ctx = get_gateway_context_for_enquiry(message)

    internal = (
        "【内部分析】\n"
        f"- 买方需求：{message[:200]}\n"
        f"- 潜在供应商匹配：待通过供应商网络匹配 {keywords}\n"
        f"- 库存归属状态：{ownership}\n"
        "- 平台机会：新询价可转化为平台 GMV 撮合机会\n"
        "- 缺失信息：目标国家、数量、预算、交货期\n"
        "- 审批要求：正式报价与外发消息需 CEO 审批\n"
    )
    if gateway_ctx:
        internal += "- WhatsApp 销售智能：已检索历史、画像与成交经验\n"

    draft = (
        f"【客户草稿 / Customer Draft ({language_label(lang)})】\n"
        f"Thank you for your enquiry regarding {keywords}. "
        f"{supply} "
        "Please share quantity, destination port, and timeline so we can prepare an accurate FOB/CIF quotation."
    )
    if gateway_ctx and "SOP" in gateway_ctx:
        draft += "\n(Draft informed by sales intelligence — not sent.)"
    return f"{internal}\n\n{draft}"


def process_enquiry_with_openai(client, message: str, profile: dict) -> str:
    model = AGENT_MODELS.get("apsales", AGENT_MODELS.get("sales", DEFAULT_MODEL))
    system = build_apsales_enquiry_prompt(message, profile)
    from coo_core.dispatcher import call_openai
    reply = call_openai(client, model, system, message)

    lang = resolve_target_language("apsales", "buyer", message)
    inventory_hit, _ = check_inventory_for_enquiry(message)
    reply = enforce_supply_language(reply, inventory_hit, lang)
    detected = detect_language(message, scenario="buyer")
    _auto_save_enquiry_memory(message, reply, lang, detected, inventory_hit)
    return reply


def _auto_save_enquiry_memory(
    enquiry: str,
    reply: str,
    communication_lang: str,
    detected_lang: str,
    inventory_hit: bool,
) -> None:
    customer_guess = _guess_customer_name(enquiry)
    if not customer_guess:
        customer_guess = "inquiry-" + (extract_product_keywords(enquiry)[0] if extract_product_keywords(enquiry) else "general")
    try:
        save_customer_record(
            customer_guess,
            language=communication_lang,
            detected_language=detected_lang,
            communication_language=communication_lang,
            preferred_language=communication_lang,
            interested_products=", ".join(extract_product_keywords(enquiry)),
            conversation_summary=enquiry[:400],
            follow_up_status="open",
            source="apsales",
            buyer_or_supplier="buyer",
            demand_type="product_enquiry",
            matched_inventory_status="matched" if inventory_hit else "unchecked",
            platform_value="gmv_lead",
        )
    except Exception:
        pass


def _guess_customer_name(text: str) -> str:
    m = re.search(r"(?:customer|client|buyer|from)\s*[:\-]?\s*([A-Za-z0-9 \u4e00-\u9fff]{3,40})", text, re.I)
    if m:
        return m.group(1).strip()
    m = re.search(r"^([A-Z][A-Za-z0-9 &]{2,30})\s+(?:trading|motors|auto|ghana)", text, re.I)
    if m:
        return m.group(0).strip()[:40]
    return ""


def check_quote_approval_needed(message: str) -> dict | None:
    lower = message.lower()
    triggers = ("final quote", "confirm price", "delivery date", "refund", "send to customer")
    for t in triggers:
        if t in lower:
            action = {
                "final quote": "final_quote",
                "confirm price": "final_quote",
                "delivery date": "delivery_commitment",
                "refund": "refund_commitment",
                "send to customer": "external_message",
            }.get(t, "final_quote")
            return route_approval(ApprovalRequest(
                agent_id="apsales",
                action=action,
                reason=message[:200],
                command=message[:100],
            ))
    return None


def parse_enquiry_sections(reply: str) -> tuple[str, str]:
    """Split APSales dual output into internal analysis + customer draft."""
    parts = re.split(r"【客户草稿[^】]*】", reply, maxsplit=1)
    internal = parts[0].replace("【内部分析】", "").strip()
    draft = parts[1].strip() if len(parts) > 1 else ""
    return internal, draft


def _risk_for_category(category: str) -> str:
    return {
        "price_request": "high",
        "negotiation": "high",
        "payment": "high",
        "delivery_commitment": "critical",
        "complaint": "high",
        "availability_check": "medium",
        "enquiry": "medium",
        "shipping_request": "medium",
        "follow_up": "low",
    }.get(category, "medium")


def _next_action_for_category(category: str) -> str:
    return {
        "follow_up": "contact_today",
        "price_request": "contact_today",
        "negotiation": "contact_this_week",
        "availability_check": "contact_today",
        "enquiry": "contact_today",
        "complaint": "contact_today",
    }.get(category, "monitor")


def build_inbound_draft(
    message: str,
    *,
    customer_name: str,
    customer_hash: str,
    detected_language: str,
    communication_language: str,
    category: str,
    channel: str = "whatsapp_live",
) -> dict[str, str | bool]:
    """Structured draft for WhatsApp live inbound (APLive-001)."""
    reply = process_apsales_enquiry(message, channel=channel)
    internal, draft = parse_enquiry_sections(reply)

    inventory_hit, _ = check_inventory_for_enquiry(message)
    try:
        save_customer_record(
            customer_name,
            language=communication_language,
            detected_language=detected_language,
            communication_language=communication_language,
            preferred_language=communication_language,
            interested_products=", ".join(extract_product_keywords(message)),
            conversation_summary=message[:400],
            follow_up_status="open",
            source="whatsapp_live",
            buyer_or_supplier="buyer",
            demand_type=category,
            matched_inventory_status="matched" if inventory_hit else "unchecked",
            platform_value="gmv_lead",
        )
    except Exception:
        pass

    return {
        "customer_name": customer_name,
        "customer_hash": customer_hash,
        "detected_language": detected_language,
        "internal_analysis_zh": internal,
        "customer_reply_draft": draft,
        "risk_level": _risk_for_category(category),
        "approval_required": True,
        "next_action": _next_action_for_category(category),
    }
