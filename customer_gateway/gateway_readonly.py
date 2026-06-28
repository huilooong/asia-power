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

READONLY_MODE = True
CEO_SENDER_ALIASES = frozenset({"me", "you", "asia power", "asiapower", "ceo", "boss"})


def ensure_gateway_dirs() -> None:
    for d in (RAW_DIR, PARSED_DIR, PROFILES_DIR, PATTERNS_DIR, REPORTS_DIR, STYLE_DIR):
        d.mkdir(parents=True, exist_ok=True)


def reconfigure_paths(base: Path) -> None:
    """Test helper — redirect gateway storage."""
    global GATEWAY_ROOT, RAW_DIR, PARSED_DIR, PROFILES_DIR, PATTERNS_DIR
    global REPORTS_DIR, STYLE_DIR, SYNC_STATE_PATH
    GATEWAY_ROOT = base
    RAW_DIR = base / "whatsapp_raw"
    PARSED_DIR = base / "whatsapp_parsed"
    PROFILES_DIR = base / "customer_profiles"
    PATTERNS_DIR = base / "enquiry_patterns"
    REPORTS_DIR = base / "reports"
    STYLE_DIR = base / "reply_style"
    SYNC_STATE_PATH = base / "sync_state.json"
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
        "/whatsapp analyze — 生成销售智能分析报告\n"
        "/whatsapp report — 查看最新完整报告\n"
        "/customer followups — 跟进清单（中文）\n"
    )


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


def _extract_keywords(message: str) -> list[str]:
    from sales_core.platform_supply import extract_product_keywords

    return extract_product_keywords(message)
