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
from sales_core.enquiry_context import (
    build_contextual_draft_en,
    build_contextual_draft_zh,
    internal_missing_line,
    parse_enquiry_facts,
    sales_reply_rules_addon,
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
    "/sales-intelligence", "/email", "/outreach", "/distribution",
)

# Longer prefixes must be checked before shorter ones (e.g. /sales-intelligence before /sales).
APSALES_ROUTE_PREFIXES = (
    "/sales-intelligence",
    "/whatsapp",
    "/conversations",
    "/learning",
    "/outreach",
    "/distribution",
    "/email",
    "/drafts",
    "/customer",
    "/pipeline",
    "/remember",
    "/recall",
    "/tools",
    "/tool ",
    "/sales ",
    "/sales",
    "/help",
    "/start",
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
    """True for APSales slash commands — not bare buyer enquiries."""
    text = (message or "").strip()
    if not text.startswith("/"):
        return False
    lower = text.lower()
    if lower.startswith("/sales-intelligence"):
        return True
    for prefix in APSALES_ROUTE_PREFIXES:
        if prefix in ("/sales", "/sales ", "/help", "/start"):
            continue
        if lower.startswith(prefix.lower()):
            return True
    if lower == "/sales" or lower.startswith("/sales "):
        return True
    if text == "/tools" or text.startswith("/tool "):
        return True
    if lower in ("/help", "/start"):
        return True
    return any(text.startswith(cmd) for cmd in APSALES_COMMANDS if cmd not in ("/sales",))


def is_slash_command(message: str) -> bool:
    return (message or "").strip().startswith("/")


def parse_sales_message(message: str) -> str:
    """Strip /sales and optional customer: prefix."""
    text = message.strip()
    lower = text.lower()
    if lower.startswith("/sales-intelligence"):
        return ""
    if lower.startswith("/sales"):
        text = text[6:].strip()
        if text.startswith("-intelligence"):
            return ""
        if text.lower().startswith("intelligence"):
            return ""
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
        "/email list — 邮件线程（sales@ / inquiry@ 转发）\n"
        "/email show <threadId> — 查看邮件\n"
        "/email process <threadId> — 生成回复草稿\n"
        "/email process-all — 处理全部待处理邮件\n\n"
        "/outreach scan — 主动开发候选（网站 Lead + WhatsApp 跟进）\n"
        "/outreach draft <candidate_id> — 生成开发信草稿\n"
        "/outreach queue — 待审批主动开发草稿\n\n"
        "/distribution — 推广渠道清单（Facebook、Instagram、X、论坛、WhatsApp 群等）\n"
        "/distribution plan — 本周推广动作摘要\n"
        "/distribution progress — 推广进度条 + 看板链接\n"
        "/distribution log group … — 登记加入小组（Telegram 通知 CEO）\n"
        "/distribution log post … — 登记已发布帖文\n\n"
        "原则：Read Only → Analyze → Draft → Telegram Approval。禁止自动发送 WhatsApp/邮件。\n"
        "平台定位：撮合买家与供应商，提升 GMV；默认不假设 AsiaPower 自有库存。\n"
        "输出：【内部分析】中文 + 【客户草稿】买家语言 (中/EN/FR/AR，自动识别)"
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
    from coo_core.cli_router import normalize_apsales_command

    text = normalize_apsales_command(message.strip())

    if text.lower().startswith("/sales-intelligence"):
        return dispatch_sales_intelligence_command(text)

    if text.lower().startswith("/whatsapp"):
        return dispatch_whatsapp_command(text)

    if text.lower().startswith("/drafts"):
        return dispatch_drafts_command(text)

    if text.lower().startswith("/conversations"):
        return dispatch_conversations_command(text)

    if text.lower().startswith("/learning"):
        return dispatch_learning_command(text)

    if text.lower().startswith("/email"):
        return dispatch_email_command(text)

    if text.lower().startswith("/outreach"):
        return dispatch_outreach_command(text)

    if text.lower().startswith("/distribution"):
        return dispatch_distribution_command(text)

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


def dispatch_email_command(message: str) -> str:
    from customer_gateway.email_inbound import (
        format_email_detail,
        format_email_list,
        get_email_thread,
        list_email_threads,
        process_email_thread,
        process_pending_emails,
    )

    text = (message or "").strip()
    body = text[len("/email"):].strip() if text.lower().startswith("/email") else text
    parts = body.split(maxsplit=1)
    action = (parts[0] if parts else "list").lower()
    arg = parts[1].strip() if len(parts) > 1 else ""

    if action in ("help", "?"):
        return (
            "子敬 · 邮件转发\n"
            "/email list — 收件线程\n"
            "/email show <threadId>\n"
            "/email process <threadId> — 生成草稿 + Telegram 通知\n"
            "/email process-all — 批量处理待处理邮件\n"
            "/email send <draft_id> — 发送已批准邮件（Phase 2 · Resend）\n"
            "/email send-status — 检查发信配置"
        )
    if action == "list":
        return format_email_list(list_email_threads(limit=25))
    if action == "show" and arg:
        thread = get_email_thread(arg)
        if not thread:
            return f"未找到邮件线程: {arg}"
        return format_email_detail(thread)
    if action == "process-all":
        drafts = process_pending_emails(limit=20)
        if not drafts:
            return "没有待处理邮件。"
        return f"已处理 {len(drafts)} 封邮件，草稿 ID:\n" + "\n".join(
            f"  - {d['draft_id']}" for d in drafts
        )
    if action == "process" and arg:
        try:
            draft = process_email_thread(arg)
            return (
                f"✅ 邮件已转为 APSales 草稿\n"
                f"draft_id: {draft['draft_id']}\n"
                f"查看: /drafts show {draft['draft_id']}"
            )
        except ValueError as exc:
            return f"Error: {exc}"
    if action == "send" and arg:
        from customer_gateway.email_outbound import format_send_result, send_email_draft, send_enabled

        if not send_enabled():
            return (
                "❌ 邮件发送未配置\n"
                "需在 .env 设置 RESEND_API_KEY 和 EMAIL_SEND_ENABLED=1\n"
                "见 data/knowledge-base/apsales-email-outreach-runbook.md Phase 2"
            )
        try:
            result = send_email_draft(arg.strip())
            return format_send_result(result)
        except ValueError as exc:
            return f"发送失败: {exc}"
    if action in ("send-status", "sendstatus"):
        from customer_gateway.email_outbound import send_enabled, from_address

        return (
            "子敬 · 邮件发信状态\n"
            f"启用: {'是' if send_enabled() else '否'}\n"
            f"inquiry 发件: {from_address('inquiry')}\n"
            f"sales 发件: {from_address('sales')}\n"
            "提供商: Resend (resend.com)"
        )
    return dispatch_email_command("/email help")


def dispatch_outreach_command(message: str) -> str:
    from customer_gateway.outreach_engine import (
        build_outreach_enquiry,
        format_outreach_queue,
        format_outreach_scan,
        list_outreach_drafts,
        save_outreach_draft,
        scan_outreach_candidates,
    )

    text = (message or "").strip()
    body = text[len("/outreach"):].strip() if text.lower().startswith("/outreach") else text
    parts = body.split(maxsplit=1)
    action = (parts[0] if parts else "scan").lower()
    arg = parts[1].strip() if len(parts) > 1 else ""

    if action in ("help", "?"):
        return (
            "子敬 · 主动找客户（CEO 批准后才发送）\n"
            "/outreach scan — 扫描候选\n"
            "/outreach draft <candidate_id> — 生成开发信草稿\n"
            "/outreach queue — 待审批队列"
        )
    if action == "scan":
        return format_outreach_scan(scan_outreach_candidates())
    if action == "queue":
        return format_outreach_queue(list_outreach_drafts())
    if action == "draft" and arg:
        candidates = scan_outreach_candidates(limit=100)
        cand = next((c for c in candidates if c["candidate_id"] == arg), None)
        if not cand:
            return f"未找到候选: {arg}\n先运行 /outreach scan"
        analysis = process_apsales_enquiry(build_outreach_enquiry(cand), channel="outreach")
        internal, _, draft_text = _split_apsales_sections(analysis)
        record = save_outreach_draft(cand, internal_analysis=internal, customer_draft=draft_text)
        return (
            f"✅ 主动开发草稿已创建（未发送）\n"
            f"outreach_id: {record['outreach_id']}\n"
            f"客户: {cand.get('name')} | 渠道: {cand.get('channel')}\n\n"
            f"—— 草稿 ——\n{draft_text[:800]}"
        )
    return dispatch_outreach_command("/outreach help")


def dispatch_distribution_command(message: str) -> str:
    """Show where to promote asia-power.com — playbook summary for 子敬."""
    from pathlib import Path

    text = (message or "").strip()
    body = text[len("/distribution"):].strip() if text.lower().startswith("/distribution") else text
    parts = body.split(maxsplit=2)
    action = (parts[0] if parts else "help").lower()
    sub = (parts[1] if len(parts) > 1 else "").lower()
    rest = parts[2] if len(parts) > 2 else (parts[1] if len(parts) == 2 and action == "log" else "")
    playbook = Path(__file__).resolve().parent.parent / "data/knowledge-base/apsales-distribution-playbook.md"

    if action in ("progress", "status"):
        from customer_gateway.distribution_progress import format_progress_text, get_progress
        data = get_progress()
        stale = f"\n⚠️ {data.get('stale_warning') or '无进展'}" if data.get("is_stale") else ""
        return format_progress_text() + stale

    if action == "log":
        return _dispatch_distribution_log(sub, rest)

    if action in ("help", "?", ""):
        return (
            "子敬 · 网站推广去哪发（市场总监 Playbook）\n"
            "/distribution plan — 本周动作摘要\n"
            "/distribution channels — 渠道优先级\n"
            "/distribution progress — 进度条 + 看板\n"
            "/distribution log group wave1-en-gh-ng | 组名 | URL | 截图说明\n"
            "/distribution log post wave1-en-gh-ng | A | facebook | EN-Ghana | 帖文URL | 落地页URL ||| 帖文全文\n"
            "看板: https://asia-power.com/admin/apsales-progress.html\n"
            f"完整文档: data/knowledge-base/apsales-distribution-playbook.md\n"
            "原则：所有公开发帖须 CEO 批准后再发。"
        )

    if action == "channels":
        return (
            "推广渠道优先级（子敬按序执行）\n\n"
            "🎯 KPI：进站 asia-power.com · 邮件 sales@asia-power.com · 社媒不硬销\n\n"
            "非洲按语言分区（§九 playbook）：\n"
            "· EN：Ghana/Nigeria/Kenya/TZ/UG/ZA → FB+IG+WhatsApp\n"
            "· FR：CI/Senegal/Cameroon/DRC → FB法语群+IG\n"
            "· AR：Morocco/Tunisia/Egypt → FB阿语群（低优先）\n"
            "· PT：Angola/Mozambique → FB+IG\n\n"
            "P0 · Facebook 汽配/Tokunbo 小组 + WhatsApp 社群\n"
            "P1 · Google 地图找客户 + 海关数据 + 论坛 + Instagram\n"
            "P2 · X 搜索 + LinkedIn + Alibaba 展示\n"
            "P3 · TikTok/YouTube + Reddit\n\n"
            "半切: https://asia-power.com/half-cuts/\n"
            "详情页格式: half-cuts/detail.html?slug=…\n"
            "方案 A–E: data/knowledge-base/apsales-promotion-schemes-v2.md\n"
            "发帖后每小时扫回复: scripts/apsales-social-reply-watch.py\n"
            "联系: sales@asia-power.com · WhatsApp +86 166 3880 1930"
        )

    if action == "plan":
        return (
            "子敬 · 推广上线计划（v2 · 目标：进站 + 邮件询盘）\n\n"
            "【第 1 波 · 英语】\n"
            "1. Ghana+Nigeria：方案 A + B（EN）→ FB Tokunbo 小组 + IG\n"
            "2. Kenya+TZ+Uganda：方案 A + D（EN）→ FB + IG\n\n"
            "【第 2 波 · 法语】\n"
            "3. Côte d'Ivoire+Senegal+Cameroon：方案 A + D（FR）→ FB法语群\n\n"
            "【第 3 波】\n"
            "4. South Africa+Zambia：方案 A + E → FB + X\n"
            "5. Angola+Mozambique：方案 A + B（PT）→ FB + IG\n\n"
            "【每小时 · 发帖后必做】\n"
            "6. 扫 FB/IG/X 回复 → 有客户问 → 起草跟进（引导进站+sales@）→ CEO批准才发\n"
            "7. 登记帖文到 social_posts_registry.json\n\n"
            "【每周固定】\n"
            "8. Google 地图 20 家 + 海关数据 10 进口商 + SEO TOP10\n"
            "9. 周三前交 CEO 审批包 · 周五流量/邮件周报\n\n"
            "全文方案: apsales-promotion-schemes-v2.md\n"
            "Playbook: apsales-distribution-playbook.md §九§十"
        )

    if action == "full" and playbook.is_file():
        content = playbook.read_text(encoding="utf-8")
        if len(content) > 12000:
            content = content[:12000] + "\n\n…(截断，请打开 playbook 文件阅读全文)"
        return content

    return dispatch_distribution_command("/distribution help")


def _dispatch_distribution_log(kind: str, rest: str) -> str:
    from customer_gateway.distribution_progress import format_progress_text, record_event

    raw = [p.strip() for p in (rest or "").split("|")]
    if kind == "group":
        if len(raw) < 3:
            return (
                "用法: /distribution log group <wave_id> | 组名 | 小组URL | [截图说明]\n"
                "例: /distribution log group wave1-en-gh-ng | Ghana Tokunbo Parts | https://facebook.com/groups/... | 已截图"
            )
        wave_id, name, url = raw[0], raw[1], raw[2]
        proof = raw[3] if len(raw) > 3 else ""
        result = record_event(
            "group_join",
            wave_id=wave_id,
            group_name=name,
            group_url=url,
            screenshot_note=proof,
        )
        return (
            f"✅ 已登记加入小组 · Telegram 已通知 {result.get('notified', 0)} 条\n\n"
            + format_progress_text()
        )

    if kind in ("post", "published"):
        content = ""
        rest_body = rest or ""
        if "|||" in rest_body:
            rest_body, content = rest_body.split("|||", 1)
            content = content.strip()
        raw = [p.strip() for p in rest_body.split("|")]
        if len(raw) < 5:
            return (
                "用法: /distribution log post <wave_id> | 方案 | 平台 | 市场 | 帖文URL | [落地页URL] ||| 帖文全文\n"
                "例: /distribution log post wave1-en-gh-ng | A | facebook | EN-Ghana | https://... | "
                "https://asia-power.com/half-cuts/ ||| Custom dismantling. Parts on demand..."
            )
        wave_id, scheme, platform, market, post_url = raw[:5]
        listing = raw[5] if len(raw) > 5 else "https://asia-power.com/half-cuts/"
        if not post_url.startswith("http"):
            return "帖文URL 必须是完整 https:// 链接"
        result = record_event(
            "post_published",
            wave_id=wave_id,
            scheme_id=scheme,
            platform=platform,
            market=market,
            post_url=post_url,
            listing_url=listing,
            post_content=content,
        )
        return (
            f"✅ 已登记发布帖文 · Telegram 已通知 {result.get('notified', 0)} 条\n\n"
            + format_progress_text()
        )

    if kind == "scan":
        count = int(raw[0]) if raw and raw[0].isdigit() else 1
        record_event("scan_done", posts_scanned=count)
        return "✅ 已登记回复扫描\n\n" + format_progress_text()

    if kind == "reply":
        if len(raw) < 2:
            return "用法: /distribution log reply | 平台 | 客户handle | [摘要]"
        platform, handle = raw[0], raw[1]
        snippet = raw[2] if len(raw) > 2 else ""
        record_event("reply_found", platform=platform, customer_handle=handle, snippet=snippet)
        return "✅ 已登记客户回复\n\n" + format_progress_text()

    return (
        "用法:\n"
        "/distribution log group …\n"
        "/distribution log post …\n"
        "/distribution log scan [数量]\n"
        "/distribution log reply | 平台 | handle"
    )


def _split_apsales_sections(text: str) -> tuple[str, str, str]:
    import re as _re
    raw = (text or "").strip()
    m = _re.split(r"【客户草稿[^】]*】", raw, maxsplit=1)
    if len(m) == 2:
        internal = m[0].replace("【内部分析】", "").strip()
        return internal, "Customer Draft", m[1].strip()
    return raw, "", ""


def build_apsales_enquiry_prompt(message: str, profile: dict, *, channel: str = "cli") -> str:
    lang = resolve_target_language("apsales", "buyer", message)
    forced = re.search(r"\[BUYER_LANGUAGE=([a-z]{2})\]", message or "", re.I)
    if forced:
        lang = forced.group(1).lower()
    inventory_hit, inventory_note = check_inventory_for_enquiry(message)
    ownership = inventory_ownership_label(inventory_hit)
    constitution = build_constitution_context_for_agent("apsales")
    base = build_apsales_system_prompt(profile)
    supply_line = supply_phrase(lang)

    from knowledge.guard import knowledge_system_addon
    from knowledge.runtime import bootstrap_knowledge_runtime, get_runtime

    bootstrap_knowledge_runtime()
    bundle = get_runtime().query(message, agent_id="apsales")
    gateway_ctx = bundle.format_context(max_chars=1200) if bundle.has_facts() else ""

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
        prompt += f"{knowledge_system_addon(bundle)}\n\n"

    if channel == "email":
        prompt += (
            "Email channel: use formal business email tone (salutation + structured body + closing). "
            "Do not include internal draft notes like '(Draft informed...)'.\n\n"
        )
    elif channel in ("outreach", "outreach_autopilot"):
        prompt += (
            "Outreach email re-engagement — you ARE 子敬 writing the email yourself:\n"
            f"- Customer draft language MUST be {language_label(lang)} only. Never Chinese in the customer draft.\n"
            "- Sound like a real AsiaPower salesperson (Zijing), not a CRM skeleton / mail-merge template.\n"
            "- Vary the opening and ask based on THIS customer's name/country/product — do not reuse the same 5-line stock paragraph for every lead.\n"
            "- Short: roughly 5–10 lines. Natural email, not WhatsApp bullets, not corporate filler.\n"
            "- Include www.asia-power.com once if useful. Do not invent stock or prices.\n"
            "- Ask at most ONE clear next question (e.g. engine code / model-year / destination port).\n"
            "- Forbidden in customer draft: MEMORY_TO_SAVE, APPROVAL_REQUEST, Draft informed, internal notes.\n"
            "- Sign as AsiaPower / Zijing sales style, not a robot.\n\n"
        )
    elif channel == "whatsapp_live":
        prompt += (
            "WhatsApp live channel rules from AsiaPower customer-service SOP:\n"
            "- Customer draft must be short, natural WhatsApp English only. Do not mix Chinese into the customer draft.\n"
            "- Promote the website naturally: include `www.asia-power.com` unless the buyer clearly just received it in the same conversation.\n"
            "- Do not write formal platform language, approval notes, AI notes, or '(Draft informed...)'.\n"
            "- Ask only the genuinely missing key fields, usually 1-4 short bullet lines.\n"
            "- For engine/gearbox enquiries, ask for year/model, engine size/code, gearbox type if relevant, VIN or photo when needed.\n"
            "- If stock/price is not verified, say we will check; do not invent stock or price.\n"
            "- Tone: concise, friendly, practical. Do not start every reply with `Hello sir`.\n\n"
        )

    prompt += sales_reply_rules_addon() + "\n"

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
        "CRITICAL: Read the buyer message carefully. Acknowledge every fact they already stated "
        "(product, quantity, destination, port, timeline). Never ask again for information they "
        "already provided. Only request genuinely missing fields.\n\n"
        f"【客户草稿 / Customer Draft ({language_label(lang)})】\n"
        f"{stock_rule}\n"
        "Professional platform sales tone. No AI/APCOO/approval exposure.\n"
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
    forced = re.search(r"\[BUYER_LANGUAGE=([a-z]{2})\]", message or "", re.I)
    if forced:
        lang = forced.group(1).lower()

    approval_info = check_quote_approval_needed(message)
    if approval_info and approval_info.get("blocked_until_approval"):
        return "需要审批 — 已阻断执行。\n\n" + approval_info.get("ceo_message", "")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        reply = _fallback_enquiry_response(message, inventory_hit, lang, channel=channel)
        detected = detect_language(message, scenario="buyer")
        _auto_save_enquiry_memory(message, reply, lang, detected, inventory_hit)
        memory_tool.log_conversation(message, reply, source="apsales", channel=channel, important=True)
        return reply

    try:
        client = OpenAI(api_key=api_key)
        reply = process_enquiry_with_openai(client, message, profile, channel=channel)
        reply = enforce_supply_language(reply, inventory_hit, lang)
        memory_tool.log_conversation(message, reply, source="apsales", channel=channel, important=True)
        return reply
    except Exception:
        reply = _fallback_enquiry_response(message, inventory_hit, lang, channel=channel)
        detected = detect_language(message, scenario="buyer")
        _auto_save_enquiry_memory(message, reply, lang, detected, inventory_hit)
        memory_tool.log_conversation(message, reply, source="apsales", channel=channel, important=True)
        return reply


def _fallback_enquiry_response(message: str, inventory_hit: bool, lang: str, *, channel: str = "cli") -> str:
    """Rule-based dual output when OpenAI unavailable (tests/CLI)."""
    keywords = ", ".join(extract_product_keywords(message)) or message[:80]
    ownership = inventory_ownership_label(inventory_hit)
    supply = supply_phrase(lang)
    gateway_ctx = get_gateway_context_for_enquiry(message)
    facts = parse_enquiry_facts(message, product_hint=keywords)

    internal = (
        "【内部分析】\n"
        f"- 买方需求：{message[:200]}\n"
        f"- 潜在供应商匹配：待通过供应商网络匹配 {keywords}\n"
        f"- 库存归属状态：{ownership}\n"
        "- 平台机会：新询价可转化为平台 GMV 撮合机会\n"
        f"- {internal_missing_line(facts)}\n"
        "- 审批要求：正式报价与外发消息需 CEO 审批\n"
    )
    if gateway_ctx:
        internal += "- WhatsApp 销售智能：已检索历史、画像与成交经验\n"

    if channel == "whatsapp_live":
        body = _build_whatsapp_fallback_draft(message, facts, keywords, lang)
        draft = f"【客户草稿 / Customer Draft ({language_label(lang)})】\n{body}"
    elif channel in ("outreach", "outreach_autopilot"):
        # Outreach must never fall back to Chinese customer copy for EN buyers.
        if lang == "zh":
            body = build_contextual_draft_zh(facts, supply)
        else:
            body = build_contextual_draft_en(facts, supply, keywords)
        draft = f"【客户草稿 / Customer Draft ({language_label(lang)})】\n{body}"
    elif lang == "zh":
        body = build_contextual_draft_zh(facts, supply)
        draft = f"【客户草稿 / Customer Draft ({language_label(lang)})】\n{body}"
    else:
        body = build_contextual_draft_en(facts, supply, keywords)
        draft = f"【客户草稿 / Customer Draft ({language_label(lang)})】\n{body}"
    if (
        channel not in ("whatsapp_live", "outreach", "outreach_autopilot")
        and gateway_ctx
        and "SOP" in gateway_ctx
    ):
        draft += "\n(Draft informed by sales intelligence — not sent.)"
    return f"{internal}\n\n{draft}"


def _build_whatsapp_fallback_draft(message: str, facts, keywords: str, lang: str) -> str:
    """Short SOP-style WhatsApp draft when model/API is unavailable."""
    product = (facts.product_hint or keywords or message[:80]).strip()
    if lang == "zh":
        lines = [
            f"收到，{product}。",
            "",
            "请也看一下我们网站：www.asia-power.com",
            "",
            "请发车型年份、发动机照片/VIN、目的地国家，我好帮你确认准确型号和价格。",
        ]
        return "\n".join(lines)

    lines = [
        f"Okay, noted — {product}.",
        "",
        "Please also visit our website: www.asia-power.com",
        "",
    ]
    if facts.is_engine_enquiry:
        lines.extend([
            "Please send:",
            "- Vehicle model and year",
            "- Engine photo or VIN",
            "- Engine only, or with gearbox/accessories",
            "- Destination country",
        ])
    else:
        lines.extend([
            "Please send the vehicle model, year, parts needed, and destination country.",
        ])
    lines.extend(["", "Then we will check the correct one for you. 🙏"])
    return "\n".join(lines)


def process_enquiry_with_openai(client, message: str, profile: dict, *, channel: str = "cli") -> str:
    model = AGENT_MODELS.get("apsales", AGENT_MODELS.get("sales", DEFAULT_MODEL))
    system = build_apsales_enquiry_prompt(message, profile, channel=channel)
    from coo_core.dispatcher import call_openai
    from knowledge.guard import audit_and_enforce
    from knowledge.runtime import get_runtime

    bundle = get_runtime().query(message, agent_id="apsales")
    reply = call_openai(client, model, system, message, knowledge_addon="\n")
    ok, audited = audit_and_enforce(reply, bundle=bundle)
    reply = audited if not ok else reply

    lang = resolve_target_language("apsales", "buyer", message)
    forced = re.search(r"\[BUYER_LANGUAGE=([a-z]{2})\]", message or "", re.I)
    if forced:
        lang = forced.group(1).lower()
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
