"""Load verified sales data from reports/DB only — no LLM."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
REPORT_JSON = ROOT / "reports" / "whatsapp_sales_intelligence_full.json"
SI_ROOT = ROOT / "memory" / "sales_intelligence"
IMPORT_STATE = SI_ROOT / "import_state.json"
DASHBOARD_JSON = SI_ROOT / "dashboard" / "latest.json"
PATTERNS_JSON = SI_ROOT / "patterns" / "sales_patterns.json"
TALK_JSON = SI_ROOT / "patterns" / "talk_optimization.json"
FAILURES_JSON = SI_ROOT / "failures" / "failure_report.json"
PENDING_JSON = SI_ROOT / "reply_evolution" / "pending.json"
LATEST_ANALYSIS = SI_ROOT / "latest_analysis.json"


def _load_json(path: Path) -> Any | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _fmt_source(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def _with_source(value: Any, source: str) -> dict[str, Any]:
    return {"value": value, "source": source}


def _pick_coverage(report: dict | None, import_state: dict | None) -> str:
    cov = None
    if report:
        cov = report.get("data_coverage")
    if not cov and import_state:
        bi = import_state.get("browser_import") or {}
        cov = bi.get("data_coverage")
    cov = (cov or "unknown").lower()
    if cov == "full":
        return "partial"
    return cov if cov in ("partial", "unknown") else "unknown"


def load_verified_sales_data() -> dict[str, Any]:
    """Aggregate verified fields from on-disk reports and analysis artifacts."""
    source_files: list[str] = []
    limitations: list[str] = []

    report = _load_json(REPORT_JSON)
    if report:
        source_files.append(_fmt_source(REPORT_JSON))

    import_state = _load_json(IMPORT_STATE)
    if import_state:
        source_files.append(_fmt_source(IMPORT_STATE))

    dashboard = _load_json(DASHBOARD_JSON)
    if dashboard:
        source_files.append(_fmt_source(DASHBOARD_JSON))

    patterns = _load_json(PATTERNS_JSON)
    if patterns:
        source_files.append(_fmt_source(PATTERNS_JSON))

    talk = _load_json(TALK_JSON)
    if talk:
        source_files.append(_fmt_source(TALK_JSON))

    failures = _load_json(FAILURES_JSON)
    if failures:
        source_files.append(_fmt_source(FAILURES_JSON))

    pending = _load_json(PENDING_JSON)
    if pending is not None:
        source_files.append(_fmt_source(PENDING_JSON))

    analysis = _load_json(LATEST_ANALYSIS)
    if analysis:
        source_files.append(_fmt_source(LATEST_ANALYSIS))

    # browser import
    bi_report = (report or {}).get("browser_import") or {}
    bi_state = (import_state or {}).get("browser_import") or {}
    browser_import = {
        "loaded_chats": bi_state.get("loaded_chats") or bi_report.get("loaded_chats"),
        "processed_chats": bi_state.get("processed_chats") or bi_report.get("processed_chats"),
        "messages_imported": bi_state.get("messages_imported") or bi_report.get("messages_imported"),
        "failed_chats": bi_state.get("failed_chats") if bi_state else bi_report.get("failed_chats"),
        "skipped_private": bi_state.get("skipped_private") or bi_report.get("skipped_private"),
        "source": _fmt_source(IMPORT_STATE) if bi_state else (
            _fmt_source(REPORT_JSON) if bi_report else "unavailable"
        ),
    }

    # DB totals — prefer import_state when report looks like test stub
    report_conv = (report or {}).get("totals", {}).get("conversation_count", 0)
    state_conv = (import_state or {}).get("conversation_count", 0)
    analysis_conv = (analysis or {}).get("conversation_count", 0)
    conversations = max(state_conv, analysis_conv, report_conv if report_conv > 10 else 0)
    report_msgs = (report or {}).get("totals", {}).get("message_count", 0)
    state_msgs = (import_state or {}).get("message_count", 0)
    analysis_msgs = (analysis or {}).get("message_count", 0)
    messages = max(state_msgs, analysis_msgs, report_msgs if report_msgs > 50 else 0)
    db_source = _fmt_source(IMPORT_STATE) if state_conv else (
        _fmt_source(LATEST_ANALYSIS) if analysis_conv else _fmt_source(REPORT_JSON)
    )

    # customers
    role = (import_state or {}).get("role_summary") or {}
    report_tiers = (report or {}).get("customer_classification") or {}
    tiers = role.get("customer_tiers") or report_tiers or {}
    effective = (
        role.get("effective_customers")
        or (report or {}).get("totals", {}).get("effective_customers")
        or (analysis or {}).get("performance", {}).get("overview", {}).get("active_customers")
    )
    other_roles = role.get("other_roles") or (report or {}).get("other_roles") or {}

    # products / engines / countries
    perf = (analysis or {}).get("performance", {}) if analysis else {}
    products_block = perf.get("products") or {}
    top_engines = (report or {}).get("top_engines") or products_block.get("top_engines") or []
    top_products = (report or {}).get("top_products") or products_block.get("top_halfcuts") or []
    countries = (report or {}).get("country_distribution") or products_block.get("top_countries") or []

    engine_stats = (report or {}).get("engine_inquiry_stats") or {}
    if not engine_stats and analysis:
        engine_stats = (analysis.get("patterns") or {}).get("engine_stats") or {}

    top_followup = (report or {}).get("top_followup_customers") or []
    failure_reasons = (
        ((report or {}).get("failed_talk") or {}).get("failure_reasons")
        or (failures or {}).get("reason_breakdown")
        or {}
    )
    recommended = (report or {}).get("recommended_replies") or (talk or {})

    pending_list: list[dict[str, Any]] = []
    if isinstance(pending, list):
        pending_list = pending[:15]
    elif isinstance(pending, dict):
        pending_list = list(pending.get("pending", pending.get("versions", [])))[:15]

    coverage = _pick_coverage(report, import_state)
    limitation_reason = (
        bi_state.get("limitation_reason")
        or (report or {}).get("limitation_reason")
        or ""
    )
    if limitation_reason:
        limitations.append(limitation_reason)

    limitations.extend([
        "成交率/付款：无财务订单系统对接，不能输出成交金额或真实成交率。",
        "报价后24小时流失率：无 quote_event 时间索引，不能输出该比例。",
        "回复率提升/A/B：无实验数据，不能输出提升百分比。",
        "国家会话数（如 Nigeria 1100）：无可靠国家-会话索引，不能输出。",
    ])

    available = bool(source_files) and (conversations > 0 or browser_import.get("messages_imported"))

    return {
        "available": available,
        "source_files": source_files,
        "data_coverage": coverage,
        "browser_import": browser_import,
        "database_totals": {
            "conversations": _with_source(conversations, db_source),
            "messages": _with_source(messages, db_source),
        },
        "customers": {
            "valid_customer_count": _with_source(effective, db_source),
            "tiers": _with_source(tiers, db_source),
            "other_roles": _with_source(other_roles, db_source),
        },
        "top_products": _with_source(top_products, _fmt_source(LATEST_ANALYSIS) if top_products else "unavailable"),
        "top_engines": _with_source(top_engines, _fmt_source(REPORT_JSON) if top_engines else "unavailable"),
        "engine_inquiry_stats": _with_source(
            engine_stats,
            _fmt_source(REPORT_JSON) if engine_stats else "unavailable",
        ),
        "countries": _with_source(countries, "unavailable"),
        "top_followup_customers": _with_source(
            top_followup,
            _fmt_source(REPORT_JSON) if top_followup else "unavailable",
        ),
        "failure_reasons": _with_source(
            failure_reasons,
            _fmt_source(FAILURES_JSON) if failure_reasons else "unavailable",
        ),
        "recommended_replies": _with_source(
            recommended,
            _fmt_source(TALK_JSON) if recommended else "unavailable",
        ),
        "pending_reply_versions": _with_source(
            pending_list,
            _fmt_source(PENDING_JSON) if pending_list else "unavailable",
        ),
        "dashboard": _with_source(dashboard, _fmt_source(DASHBOARD_JSON) if dashboard else "unavailable"),
        "limitations": limitations,
    }


def _val(field: dict[str, Any] | Any) -> Any:
    if isinstance(field, dict) and "value" in field:
        return field["value"]
    return field


def _lines_top_pairs(pairs: list, *, limit: int = 10) -> list[str]:
    out: list[str] = []
    for item in (pairs or [])[:limit]:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            out.append(f"- {item[0]}: {item[1]}")
        elif isinstance(item, dict):
            out.append(f"- {item.get('contact', item)}")
        else:
            out.append(f"- {item}")
    return out or ["- unavailable"]


def build_verified_ceo_report(question: str = "") -> str:
    """Deterministic CEO report from verified files only."""
    data = load_verified_sales_data()
    if not data.get("available"):
        return (
            "AsiaPower Verified Sales Intelligence Report\n\n"
            "当前没有真实统计支持该问题，不能回答，不能编造。\n"
            "请先运行: /sales-intelligence import --browser && /sales-intelligence analyze"
        )

    bi = data["browser_import"]
    db = data["database_totals"]
    cust = data["customers"]
    conv = _val(db.get("conversations"))
    msgs = _val(db.get("messages"))
    eff = _val(cust.get("valid_customer_count"))
    tiers = _val(cust.get("tiers")) or {}
    engine_stats = _val(data.get("engine_inquiry_stats")) or {}
    failures = _val(data.get("failure_reasons")) or {}
    followups = _val(data.get("top_followup_customers")) or []
    recommended = _val(data.get("recommended_replies")) or {}

    lines = [
        "AsiaPower Verified Sales Intelligence Report",
        "",
        "Data Coverage:",
        f"- coverage: {data['data_coverage']}",
        f"- browser_import.messages_imported: {bi.get('messages_imported', 'unavailable')} "
        f"(source: {bi.get('source')})",
        f"- browser_import.processed_chats: {bi.get('processed_chats', 'unavailable')}",
        f"- browser_import.loaded_chats: {bi.get('loaded_chats', 'unavailable')}",
        f"- source_files: {', '.join(data.get('source_files', [])[:5])}",
        "",
        "Verified Facts:",
        f"- conversations: {conv} (source: {db['conversations']['source']})",
        f"- messages: {msgs} (source: {db['messages']['source']})",
        f"- valid_customer_count: {eff}",
    ]

    if tiers:
        tier_bits = ", ".join(f"{k} {v}" for k, v in tiers.items() if v)
        lines.append(f"- customer_tiers: {tier_bits}")

    if engine_stats:
        lines.append(
            f"- engine_enquiry_threads: {engine_stats.get('engine_enquiry_threads', 'unavailable')}"
        )
        lines.append(f"- g4kj_mentions: {engine_stats.get('g4kj_mentions', 'unavailable')}")
        lines.append(f"- g4kd_mentions: {engine_stats.get('g4kd_mentions', 'unavailable')}")

    top_eng = _val(data.get("top_engines"))
    if top_eng:
        lines.append("- top_engines:")
        lines.extend(_lines_top_pairs(top_eng, limit=10))
    else:
        lines.append("- top_engines: unavailable (engine regex 待清洗)")

    if failures:
        lines.append("- failure_reasons (keyword-inferred, source: failure_report.json):")
        for reason, count in sorted(failures.items(), key=lambda x: -x[1])[:6]:
            lines.append(f"  - {reason}: {count}")

    if followups:
        lines.append("- top_followup_customers:")
        for item in followups[:10]:
            if isinstance(item, dict):
                lines.append(
                    f"  - {item.get('contact')} [{item.get('tier', '')}]"
                )

    if isinstance(recommended, dict) and recommended:
        lines.append("- recommended_replies (CEO Review only, source: talk_optimization.json):")
        for k in ("首次询盘回复", "有库存回复", "客户不回跟进"):
            if recommended.get(k):
                lines.append(f"  - {k}: {str(recommended[k])[:120]}")

    lines.extend([
        "",
        "Not Available:",
        "- 成交率（财务确认）: 当前没有付款/订单数据，不能判断",
        "- 报价后24小时流失率: 当前没有可靠 quote_event 索引，不能判断",
        "- 回复率提升%: 没有 A/B 测试数据，不能判断",
        "- 国家会话排名 / 发动机型号占比: 没有真实统计字段，不能输出",
        "",
        "CEO Action:",
        "- 清洗 engine regex（G4KD 计数可能过宽）",
        "- 建立 quote_event index",
        "- 接入成交/付款数据后再分析成交率",
        "- 审阅 /sales-intelligence pending 话术（不自动改 Prompt）",
        "",
        "Audit Sources:",
    ])
    for sf in data.get("source_files", []):
        lines.append(f"- {sf}")

    if question:
        lines.extend(["", f"Question: {question.strip()[:200]}"])

    return "\n".join(lines)
