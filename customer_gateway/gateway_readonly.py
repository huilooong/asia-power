"""Read-only Customer Gateway — paths, safety, CLI orchestration."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
GATEWAY_ROOT = ROOT / "memory" / "customer_gateway"

RAW_DIR = GATEWAY_ROOT / "whatsapp_raw"
PARSED_DIR = GATEWAY_ROOT / "whatsapp_parsed"
PROFILES_DIR = GATEWAY_ROOT / "customer_profiles"
PATTERNS_DIR = GATEWAY_ROOT / "enquiry_patterns"
REPORTS_DIR = GATEWAY_ROOT / "reports"
STYLE_DIR = GATEWAY_ROOT / "reply_style"  # legacy, kept for compat
SYNC_STATE_PATH = GATEWAY_ROOT / "sync_state.json"
INBOUND_MESSAGES_DIR = GATEWAY_ROOT / "inbound_messages"
DRAFT_QUEUE_DIR = GATEWAY_ROOT / "draft_queue"
PROCESSED_MESSAGES_PATH = GATEWAY_ROOT / "processed_messages.json"
LISTEN_STATE_PATH = GATEWAY_ROOT / "listen_state.json"

READONLY_MODE = True
CEO_SENDER_ALIASES = frozenset({"me", "you", "asia power", "asiapower", "ceo", "boss"})


def ensure_gateway_dirs() -> None:
    for d in (
        RAW_DIR, PARSED_DIR, PROFILES_DIR, PATTERNS_DIR, REPORTS_DIR, STYLE_DIR,
        INBOUND_MESSAGES_DIR, DRAFT_QUEUE_DIR,
    ):
        d.mkdir(parents=True, exist_ok=True)


def reconfigure_paths(base: Path) -> None:
    """Test helper — redirect gateway storage."""
    global GATEWAY_ROOT, RAW_DIR, PARSED_DIR, PROFILES_DIR, PATTERNS_DIR
    global REPORTS_DIR, STYLE_DIR, SYNC_STATE_PATH
    global INBOUND_MESSAGES_DIR, DRAFT_QUEUE_DIR, PROCESSED_MESSAGES_PATH, LISTEN_STATE_PATH
    GATEWAY_ROOT = base
    RAW_DIR = base / "whatsapp_raw"
    PARSED_DIR = base / "whatsapp_parsed"
    PROFILES_DIR = base / "customer_profiles"
    PATTERNS_DIR = base / "enquiry_patterns"
    REPORTS_DIR = base / "reports"
    STYLE_DIR = base / "reply_style"
    SYNC_STATE_PATH = base / "sync_state.json"
    INBOUND_MESSAGES_DIR = base / "inbound_messages"
    DRAFT_QUEUE_DIR = base / "draft_queue"
    PROCESSED_MESSAGES_PATH = base / "processed_messages.json"
    LISTEN_STATE_PATH = base / "listen_state.json"
    ensure_gateway_dirs()


def assert_readonly(operation: str) -> None:
    if not READONLY_MODE:
        raise RuntimeError(f"Gateway not in read-only mode: {operation}")
    blocked = ("send", "auto_send", "modify_raw", "commit_price", "commit_stock", "commit_delivery")
    if any(b in operation.lower() for b in blocked):
        raise PermissionError(f"Read-only gateway blocked: {operation}")


def dispatch_whatsapp_command(message: str) -> str:
    """Handle /whatsapp import|sync|analyze|report|style."""
    assert_readonly("whatsapp_command")
    text = (message or "").strip()
    body = text[len("/whatsapp"):].strip() if text.lower().startswith("/whatsapp") else text

    if not body or body.lower() == "help":
        return _help_text()

    if body.lower().startswith("import"):
        from customer_gateway.whatsapp_importer import import_whatsapp_txt

        path_str = body[6:].strip().strip('"').strip("'")
        if not path_str:
            return "Usage: /whatsapp import path/to/chat.txt"
        return import_whatsapp_txt(path_str)

    if body.lower().startswith("sync"):
        from customer_gateway.whatsapp_readonly_sync import format_sync_result, sync_readonly

        if "--readonly" not in body.lower() and "readonly" not in body.lower():
            return "Usage: /whatsapp sync --readonly"
        return format_sync_result(sync_readonly())

    if body.lower().startswith("business"):
        from customer_gateway.whatsapp_business_polling import format_poll_result, poll_readonly
        from customer_gateway.whatsapp_business_web_connector import business_connect, business_status

        rest = body[8:].strip().lower()
        if rest.startswith("connect"):
            return business_connect()
        if rest.startswith("status"):
            return business_status()
        if rest.startswith("poll"):
            if "--readonly" not in body.lower():
                return "Usage: /whatsapp business poll --readonly"
            return format_poll_result(poll_readonly())
        return (
            "WhatsApp Business App 连接器（只读）\n"
            "/whatsapp business connect — QR / 关联设备说明\n"
            "/whatsapp business status — 连接器状态\n"
            "/whatsapp business poll --readonly — 轮询新消息 → 收件箱\n"
        )

    if body.lower().startswith("listen"):
        from customer_gateway.whatsapp_live_readonly import (
            format_listen_result,
            listen_readonly,
            listen_status,
        )

        if "status" in body.lower():
            return listen_status()
        if "--readonly" not in body.lower():
            return "Usage: /whatsapp listen --readonly  或  /whatsapp listen status"
        return format_listen_result(listen_readonly())

    if body.lower() == "analyze":
        return run_intelligence_analysis()

    if body.lower() == "report":
        from customer_gateway.whatsapp_intelligence_report import load_latest_report

        return load_latest_report()

    if body.lower() == "style":
        return show_reply_style()

    return f"未知命令。{_help_text()}"


def _help_text() -> str:
    return (
        "Customer Gateway — WhatsApp 销售智能（只读）\n"
        "Read Only. Analyze First. Learn First. Improve First. No Auto Reply.\n"
        "从历史中学习，但不要盲目模仿 CEO。\n\n"
        "/whatsapp import <path/to/chat.txt> — 导入导出聊天记录\n"
        "/whatsapp sync --readonly — 只读同步（直连/导出目录）\n"
        "/whatsapp business connect — Business App 关联设备（QR）\n"
        "/whatsapp business status — Business 连接器状态\n"
        "/whatsapp business poll --readonly — 轮询新消息 → 收件箱\n"
        "/whatsapp listen --readonly — 消费收件箱 → 生成草稿\n"
        "/whatsapp listen status — 监听状态\n"
        "/whatsapp analyze — 生成销售智能分析报告\n"
        "/whatsapp report — 查看最新完整报告\n"
        "/drafts list — 草稿队列\n"
        "/customer followups — 跟进清单（中文）\n"
    )


def dispatch_drafts_command(message: str) -> str:
    """Handle /drafts list|show|approve|reject|revise."""
    from customer_gateway.draft_queue import (
        approve_draft,
        format_draft_detail,
        format_draft_list,
        list_drafts,
        load_draft,
        reject_draft,
        reject_misrouted_cli_drafts,
        revise_draft,
    )

    assert_readonly("drafts_command")
    text = (message or "").strip()
    body = text[len("/drafts"):].strip() if text.lower().startswith("/drafts") else text

    if not body or body.lower() == "help":
        return (
            "WhatsApp 回复草稿（Telegram 审批 — 本阶段不发送）\n"
            "/drafts list — 列出草稿\n"
            "/drafts show <draft_id> — 查看详情\n"
            "/drafts approve <draft_id> — CEO 批准草稿（不发送 WhatsApp）\n"
            "/drafts reject <draft_id> — 拒绝\n"
            "/drafts revise <draft_id> <修改意见> — 要求修改\n"
            "/drafts reject-misrouted — 拒绝 CLI 误路由草稿\n"
        )

    parts = body.split(maxsplit=2)
    action = parts[0].lower() if parts else "list"

    if action == "list":
        return format_draft_list(list_drafts())

    if action == "show" and len(parts) >= 2:
        draft = load_draft(parts[1])
        if not draft:
            return f"未找到草稿: {parts[1]}"
        return format_draft_detail(draft)

    if action == "approve" and len(parts) >= 2:
        try:
            draft_id = parts[1]
            do_send = "--send" in parts or body.endswith("--send")
            draft = approve_draft(draft_id, send=do_send)
            is_email = draft.get("channel") == "email" or (draft.get("customer_name") or "").startswith("email:")
            if draft.get("status") == "sent" and draft.get("_send_result"):
                from customer_gateway.email_outbound import format_send_result
                return format_send_result(draft["_send_result"])
            if draft.get("send_error"):
                return (
                    f"✅ 草稿已批准\nID: {draft['draft_id']}\n"
                    f"⚠️ 发送失败: {draft['send_error']}\n"
                    "配置 RESEND 后: /email send " + draft_id
                )
            if is_email:
                return (
                    f"✅ 邮件草稿已批准（未发送）\n"
                    f"ID: {draft['draft_id']}\n"
                    f"发送: /email send {draft_id}  或  /drafts approve {draft_id} --send"
                )
            return (
                f"✅ 草稿已批准（未发送 WhatsApp）\n"
                f"ID: {draft['draft_id']}\n"
                f"客户: {draft['customer_name']}\n"
                f"状态: {draft['status']}"
            )
        except ValueError as exc:
            return f"Error: {exc}"

    if action == "reject" and len(parts) >= 2:
        try:
            draft = reject_draft(parts[1])
            return f"已拒绝草稿 {draft['draft_id']}"
        except ValueError as exc:
            return f"Error: {exc}"

    if action == "reject-misrouted":
        ids = reject_misrouted_cli_drafts()
        if not ids:
            return "无待处理的 CLI 误路由草稿。"
        return f"已拒绝 {len(ids)} 条误路由草稿:\n" + "\n".join(f"  - {i}" for i in ids)

    if action == "revise" and len(parts) >= 3:
        try:
            draft = revise_draft(parts[1], parts[2])
            return f"已记录修改意见: {draft['draft_id']}\n{draft['revision_note']}"
        except ValueError as exc:
            return f"Error: {exc}"

    return dispatch_drafts_command("/drafts help")


def run_intelligence_analysis() -> str:
    """Full pipeline: classify → profiles → performance → report."""
    from customer_gateway.conversation_parser import load_all_parsed
    from customer_gateway.customer_profile_builder import build_all_profiles, load_profiles
    from customer_gateway.message_classifier import classify_messages
    from customer_gateway.whatsapp_intelligence_report import generate_intelligence_report

    ensure_gateway_dirs()
    parsed = load_all_parsed()
    if not parsed:
        return (
            "无可分析数据。请先：\n"
            "  /whatsapp import path/to/chat.txt\n"
            "  或 /whatsapp sync --readonly"
        )

    for conv in parsed:
        classify_messages(conv)
    build_all_profiles(parsed)
    profiles = load_profiles()
    result = generate_intelligence_report(parsed, profiles)

    try:
        from customer_gateway.reply_style_learner import learn_ceo_style
        learn_ceo_style(parsed)
    except Exception:
        pass

    return result["markdown"]


def run_full_analysis() -> str:
    """Alias for intelligence analysis."""
    return run_intelligence_analysis()


def show_reply_style() -> str:
    path = STYLE_DIR / "ceo_style.json"
    if not path.is_file():
        return "暂无历史风格数据。请运行 /whatsapp analyze"
    md_path = REPORTS_DIR / "latest_report.md"
    if md_path.is_file():
        return "请使用 /whatsapp report 查看完整销售智能报告（含 CEO 分析与改进建议）。"
    return path.read_text(encoding="utf-8") if path.is_file() else "暂无数据"


def get_gateway_context_for_enquiry(message: str, customer_hint: str = "") -> str:
    """Sales intelligence context for APSales — history, trends, SOP hints."""
    assert_readonly("context_read")
    from customer_gateway.conversation_parser import load_all_parsed, search_similar_product_replies
    from customer_gateway.customer_profile_builder import find_profile_by_hint, load_profiles
    from customer_gateway.sales_performance_analyzer import analyze_sales_performance
    from customer_gateway.whatsapp_intelligence_report import load_latest_report

    parsed = load_all_parsed()
    if not parsed:
        return ""

    profiles = load_profiles()
    analysis = analyze_sales_performance(parsed, profiles)
    keywords = _extract_keywords(message)

    sections: list[str] = [
        "--- WhatsApp 销售智能（只读）---",
        "原则：从历史学习，不盲目模仿 CEO；生成草稿，不自动发送。",
    ]

    profile = find_profile_by_hint(customer_hint or message, profiles)
    if profile:
        sections.append(
            f"客户画像: {profile.get('contact_name')} | "
            f"语言={profile.get('preferred_language')} | "
            f"国家={profile.get('country', '')} | "
            f"港口={profile.get('destination_port', '')} | "
            f"产品={', '.join(profile.get('interested_products', [])[:5])} | "
            f"潜力={profile.get('potential_level')} | "
            f"下一步={profile.get('next_action')}"
        )

    products = analysis.get("products", {})
    if products.get("top_engines"):
        top = products["top_engines"][0][0]
        sections.append(f"产品趋势: 热门发动机 {top}")

    similar = search_similar_product_replies(parsed, keywords, limit=2)
    if similar:
        sections.append("历史成交经验（参考，非照搬）:")
        for item in similar:
            sections.append(f"  - [{item.get('product')}] 客户问后 CEO 曾回复: {item.get('ceo_reply', '')[:150]}")

    imp = analysis.get("improvements", {})
    if imp.get("info_collection_template"):
        sections.append(f"SOP 信息收集: {imp['info_collection_template'][0][:120]}")
    if imp.get("whatsapp_reply_suggestions"):
        sections.append(f"回复建议: {imp['whatsapp_reply_suggestions'][0][:100]}")

    report_path = REPORTS_DIR / "latest_report.md"
    if report_path.is_file():
        sections.append("（完整报告: /whatsapp report）")

    from customer_gateway.reply_evolution import format_approved_context
    approved_ctx = format_approved_context()
    if approved_ctx:
        sections.append(approved_ctx)

    sections.append("Draft Only — 禁止自动发送 WhatsApp，禁止承诺价格/库存/交期。")
    return "\n".join(sections)


def search_customers_and_history(query: str) -> str:
    """/customer search <keyword> — profiles + matching messages."""
    assert_readonly("customer_search")
    from customer_gateway.conversation_parser import load_all_parsed, search_messages
    from customer_gateway.customer_profile_builder import load_profiles

    q = (query or "").strip().lower()
    if not q:
        return "Usage: /customer search <keyword>"

    profiles = load_profiles()
    parsed = load_all_parsed()
    hits: list[str] = []

    for prof in profiles:
        blob = json.dumps(prof, ensure_ascii=False).lower()
        if q in blob or q in prof.get("contact_name", "").lower():
            hits.append(
                f"画像: {prof.get('contact_name')} | "
                f"lang={prof.get('preferred_language')} | "
                f"产品={', '.join(prof.get('interested_products', [])[:5])} | "
                f"潜力={prof.get('potential_level')} | "
                f"下一步={prof.get('next_action')}"
            )

    msg_hits = search_messages(parsed, q, limit=5)
    for m in msg_hits:
        hits.append(
            f"消息 [{m.get('category')}] {m.get('contact')}: {m.get('text', '')[:120]}"
        )

    if not hits:
        return f"未找到: {query}\n请先 /whatsapp import 或 /whatsapp sync --readonly"
    lines = [f"客户网关搜索: {query}", ""]
    lines.extend(f"  - {h}" for h in hits[:15])
    return "\n".join(lines)


def format_customer_followups() -> str:
    from customer_gateway.customer_profile_builder import format_followups_report

    return format_followups_report()


def dispatch_conversations_command(message: str) -> str:
    """Handle /conversations list|analyze."""
    assert_readonly("conversations_command")
    from customer_gateway import conversation_paths as cp
    from customer_gateway.conversation_analyzer import list_analysis, save_analysis, analyze_normalized
    from customer_gateway.conversation_normalizer import (
        list_normalized,
        load_unanalyzed_normalized,
        save_normalized,
    )
    from customer_gateway.conversation_raw_archive import list_raw_messages

    text = (message or "").strip()
    body = text[len("/conversations"):].strip() if text.lower().startswith("/conversations") else text

    if not body or body.lower() == "help":
        return (
            "Conversation Learning Pipeline（只读归档 + 分析）\n"
            "/conversations list — 查看 raw / normalized / analysis 统计\n"
            "/conversations analyze — 分析尚未处理的 normalized 消息\n"
        )

    cp.ensure_conversation_dirs()
    action = body.split()[0].lower() if body else "list"

    if action == "list":
        raw_count = sum(1 for _ in cp.RAW_DIR.rglob("*.json"))
        norm_count = sum(1 for _ in cp.NORMALIZED_DIR.glob("*.json"))
        analysis_count = sum(1 for _ in cp.ANALYSIS_DIR.glob("*.json"))
        lines = [
            "Conversation Learning 归档（非长期记忆）",
            f"  raw: {raw_count}  normalized: {norm_count}  analysis: {analysis_count}",
            "",
            "最近 raw:",
        ]
        for item in list_raw_messages(limit=5):
            payload = item.get("payload") or {}
            lines.append(
                f"  - {item.get('message_id', '')[:12]} | "
                f"{payload.get('contact_name', '')} | "
                f"{str(payload.get('message', ''))[:50]}"
            )
        lines.append("")
        lines.append("最近 analysis:")
        for item in list_analysis(limit=5):
            lines.append(
                f"  - {item.get('classification')} | private={item.get('private_signal')} | "
                f"candidate={item.get('memory_candidate')} | "
                f"{str(item.get('contact_name', ''))[:20]}"
            )
        return "\n".join(lines)

    if action == "analyze":
        pending = load_unanalyzed_normalized()
        if not pending:
            return "无待分析 normalized 消息。"
        analyzed = 0
        candidates = 0
        from customer_gateway.learning_candidate_queue import enqueue_from_analysis

        for record in pending:
            analysis = analyze_normalized(record)
            save_analysis(analysis)
            analyzed += 1
            if analysis.get("memory_candidate"):
                cand = enqueue_from_analysis(analysis, record)
                if cand:
                    candidates += 1
        return (
            f"已分析 {analyzed} 条 normalized 消息，"
            f"新建 learning candidates {candidates} 条。"
        )

    return dispatch_conversations_command("/conversations help")


def dispatch_learning_command(message: str) -> str:
    """Handle /learning candidates|approve|reject."""
    assert_readonly("learning_command")
    from customer_gateway.learning_candidate_queue import (
        approve_candidate,
        format_candidates_list,
        list_candidates,
        reject_candidate,
    )

    text = (message or "").strip()
    body = text[len("/learning"):].strip() if text.lower().startswith("/learning") else text

    if not body or body.lower() == "help":
        return (
            "Learning Candidate Queue（CEO 审批后才写入正式 memory）\n"
            "/learning candidates — 待审候选\n"
            "/learning approve <candidate_id> — 批准并写入 memory\n"
            "/learning reject <candidate_id> — 拒绝（不写入 memory）\n"
        )

    parts = body.split(maxsplit=2)
    action = parts[0].lower() if parts else "candidates"

    if action in ("candidates", "list"):
        return format_candidates_list(list_candidates())

    if action == "approve" and len(parts) >= 2:
        try:
            result = approve_candidate(parts[1])
            return f"✅ Learning candidate 已批准并写入 memory:\n{result}"
        except ValueError as exc:
            return f"Error: {exc}"

    if action == "reject" and len(parts) >= 2:
        reason = parts[2] if len(parts) >= 3 else ""
        try:
            reject_candidate(parts[1], reason=reason)
            return f"已拒绝 candidate {parts[1]}（未写入 memory）"
        except ValueError as exc:
            return f"Error: {exc}"

    return dispatch_learning_command("/learning help")


def dispatch_sales_intelligence_command(message: str) -> str:
    """Handle /sales-intelligence import|analyze|dashboard|approve-reply|reject-reply."""
    assert_readonly("sales_intelligence_command")
    from customer_gateway.history_importer import run_full_history_import
    from customer_gateway.reply_evolution import (
        approve_reply,
        list_pending_replies,
        reject_reply,
    )
    from customer_gateway.sales_intelligence_engine import (
        format_dashboard_markdown,
        run_sales_intelligence_analysis,
    )
    from customer_gateway.whatsapp_sales_intelligence_full_report import (
        FULL_JSON_PATH,
        FULL_MD_PATH,
        format_full_report_markdown,
        save_full_report,
    )

    text = (message or "").strip()
    body = (
        text[len("/sales-intelligence"):].strip()
        if text.lower().startswith("/sales-intelligence")
        else text
    )

    if not body or body.lower() == "help":
        return (
            "APBRAIN-002 Sales Intelligence Engine（只读学习）\n"
            "/sales-intelligence import — 导入全部历史到 Conversation Database\n"
            "/sales-intelligence import --browser — 含 Browser 分页全量抓取\n"
            "/sales-intelligence analyze — 运行销售智能分析（阶段 2–7）\n"
            "/sales-intelligence extract-crm — 仅跑车辆询价提取 → vehicle_inquiries/\n"
            "/sales-intelligence report — 生成完整销售智能报告（md+json）\n"
            "/sales-intelligence dashboard — CEO Dashboard\n"
            "/sales-intelligence approve-reply <reply_id> — CEO 批准话术升级\n"
            "/sales-intelligence reject-reply <reply_id> — 拒绝话术升级\n"
            "/sales-intelligence pending — 待审话术列表\n"
            "/sales-intelligence verified-report — 已验证销售数据报告（无 LLM）\n"
            "/sales-intelligence truth-audit <text> — 审计回答是否含无来源数字\n"
        )

    parts = body.split(maxsplit=2)
    action = parts[0].lower()

    if action == "import":
        include_browser = "--browser" in body.lower()
        result = run_full_history_import(include_browser=include_browser)
        return result.get("message", str(result))

    if action == "extract-crm":
        from customer_gateway.vehicle_entity_extractor import run_vehicle_inquiry_extract
        from truth.customer_crm_intelligence import load_customer_crm_data

        extract = run_vehicle_inquiry_extract()
        crm = load_customer_crm_data(contact=None)
        assortment = (crm.get("assortment") or {}).get("value") or crm.get("assortment") or {}
        if not isinstance(assortment, dict):
            assortment = {}
        top_brands = assortment.get("top_brands") or []
        top_engines = assortment.get("top_engine_codes") or []
        return (
            f"CRM vehicle_inquiries 提取完成\n"
            f"- ok: {extract.get('ok')}\n"
            f"- contacts_with_inquiries: {extract.get('contacts_with_inquiries')}\n"
            f"- total_conversations: {extract.get('total_conversations')}\n"
            f"- output_dir: {extract.get('output_dir')}\n"
            f"- crm_available: {crm.get('available')}\n"
            f"- top_brands: {top_brands[:5]}\n"
            f"- top_engine_codes: {top_engines[:5]}\n"
            f"- error: {extract.get('error') or '—'}"
        )

    if action == "analyze":
        result = run_sales_intelligence_analysis()
        if not result.get("ok"):
            return result.get("message", "分析失败")
        d = result.get("dashboard", {})
        fr = result.get("full_report") or {}
        return (
            f"销售智能分析完成。\n"
            f"会话: {result.get('conversation_count')} | 消息: {result.get('message_count')}\n"
            f"活跃客户: {d.get('active_customers', 0)} | 重复客户: {d.get('repeat_customers', 0)}\n"
            f"最佳产品: {d.get('easiest_product')} | 最佳国家: {d.get('easiest_country')}\n"
            f"待 CEO 审批评审话术: {result.get('reply_evolution', {}).get('proposed', 0)} 条\n"
            f"完整报告: {fr.get('markdown_path', FULL_MD_PATH)}\n"
            "查看 Dashboard: /sales-intelligence dashboard | 报告: /sales-intelligence report"
        )

    if action == "report":
        import json as _json

        if FULL_JSON_PATH.is_file():
            report = _json.loads(FULL_JSON_PATH.read_text(encoding="utf-8"))
            return format_full_report_markdown(report)
        analyze = run_sales_intelligence_analysis()
        if not analyze.get("ok"):
            return "请先 /sales-intelligence import 再 analyze"
        saved = save_full_report(analyze)
        return (
            f"完整报告已生成:\n"
            f"- {saved.get('markdown_path')}\n"
            f"- {saved.get('json_path')}\n\n"
            + format_full_report_markdown(saved["report"])
        )

    if action == "dashboard":
        from customer_gateway import sales_intelligence_paths as sip
        import json as _json

        path = sip.DASHBOARD_DIR / "latest.json"
        if not path.is_file():
            analyze = run_sales_intelligence_analysis()
            if not analyze.get("ok"):
                return "请先 /sales-intelligence import 再 analyze"
            return format_dashboard_markdown(analyze)
        data = _json.loads(path.read_text(encoding="utf-8"))
        return format_dashboard_markdown({"dashboard": data})

    if action == "pending":
        pending = list_pending_replies()
        if not pending:
            return "无待审 Reply Evolution 话术。"
        lines = ["待 CEO 审批的话术升级:", ""]
        for v in pending[:15]:
            lines.append(
                f"- {v.get('reply_id')} | {v.get('category')} {v.get('version')} | "
                f"{v.get('success_rate_pct')}% | {str(v.get('text', ''))[:60]}"
            )
        return "\n".join(lines)

    if action == "verified-report":
        from truth.verified_sales_intelligence import build_verified_ceo_report
        return build_verified_ceo_report()

    if action == "truth-audit":
        audit_text = " ".join(parts[1:]).strip() if len(parts) > 1 else ""
        if not audit_text:
            return "Usage: /sales-intelligence truth-audit <answer text to audit>"
        from truth.answer_auditor import audit_answer
        from truth.truth_guard import reject_unsourced_numbers
        result = audit_answer(audit_text)
        rejected, reason = reject_unsourced_numbers(audit_text)
        lines = [
            f"passed: {result['passed'] and not rejected}",
            f"issues: {result.get('issues') or []}",
            f"unsafe_numbers: {result.get('unsafe_numbers') or []}",
        ]
        if rejected:
            lines.append(f"reject_unsourced_numbers: {reason}")
        return "\n".join(lines)

    if action == "approve-reply" and len(parts) >= 2:
        try:
            return approve_reply(parts[1])
        except ValueError as exc:
            return f"Error: {exc}"

    if action == "reject-reply" and len(parts) >= 2:
        try:
            return reject_reply(parts[1])
        except ValueError as exc:
            return f"Error: {exc}"

    return dispatch_sales_intelligence_command("/sales-intelligence help")


def _extract_keywords(message: str) -> list[str]:
    from sales_core.platform_supply import extract_product_keywords

    return extract_product_keywords(message)
