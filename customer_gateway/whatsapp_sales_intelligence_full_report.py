"""Generate full WhatsApp Sales Intelligence report for CEO review."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway.contact_role_classifier import summarize_contact_roles

ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = ROOT / "reports"
FULL_MD_PATH = REPORTS_DIR / "whatsapp_sales_intelligence_full.md"
FULL_JSON_PATH = REPORTS_DIR / "whatsapp_sales_intelligence_full.json"

_ENGINE_CODE_RE = re.compile(r"\b(G4K[A-Z]{0,2}|G4KD|G4KJ|HR\d{2}[A-Z]{2,4})\b", re.I)
_ENGINE_TOPIC_RE = re.compile(r"\b(engine|gearbox|motor|moteur|发动机)\b", re.I)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _pick_talk(talk: dict[str, Any], key: str, fallback: str = "数据不足/未读取到") -> str:
    items = talk.get(key) or []
    if not items:
        return fallback
    top = items[0]
    text = (top.get("text") or "").strip()
    rate = top.get("success_rate_pct", 0)
    samples = top.get("samples", 0)
    if not text:
        return fallback
    return f"{text} （历史成功率 {rate}%，样本 {samples}）"


def _scenario_replies(talk: dict[str, Any], patterns: dict[str, Any]) -> dict[str, str]:
    high_open = (patterns.get("high_reply_openings") or [[""]])[0]
    high_quote = (patterns.get("high_conversion_quotes") or [[""]])[0]
    low_quote = (patterns.get("low_conversion_quotes") or [[""]])[0]

    return {
        "首次询盘回复": _pick_talk(talk, "top_opening"),
        "有库存回复": (
            _pick_talk(talk, "top_price_reply")
            if talk.get("top_price_reply")
            else (high_quote[0] if high_quote else "数据不足/未读取到")
        ),
        "无库存回复": (
            "Thank you for your enquiry. We are checking our verified supplier network "
            "and will revert with availability shortly. Please confirm model/year/qty/port."
        ),
        "价格太高回复": _pick_talk(talk, "top_negotiation"),
        "客户不回跟进": _pick_talk(talk, "top_follow_up"),
        "成交推进": _pick_talk(talk, "top_closing"),
        "低效报价格式（避免）": low_quote[0] if low_quote else "数据不足/未读取到",
        "高转化开场参考": high_open[0] if high_open else "数据不足/未读取到",
    }


def _engine_inquiry_stats(conversations: list[dict[str, Any]]) -> dict[str, Any]:
    code_hits: dict[str, int] = {}
    engine_threads = 0
    for conv in conversations:
        hit = False
        for msg in conv.get("messages", []):
            if msg.get("is_ceo"):
                continue
            text = msg.get("text", "")
            if _ENGINE_CODE_RE.search(text) or _ENGINE_TOPIC_RE.search(text):
                hit = True
                for m in _ENGINE_CODE_RE.findall(text):
                    code_hits[m.upper()] = code_hits.get(m.upper(), 0) + 1
        if hit:
            engine_threads += 1
    g4kj = sum(v for k, v in code_hits.items() if "G4KJ" in k)
    g4kd = sum(v for k, v in code_hits.items() if "G4KD" in k)
    return {
        "engine_enquiry_threads": engine_threads,
        "g4kj_mentions": g4kj,
        "g4kd_mentions": g4kd,
        "top_engine_codes": sorted(code_hits.items(), key=lambda x: -x[1])[:20],
    }


def _top_followup_customers(
    issues: dict[str, Any],
    profiles: list[dict[str, Any]],
    role_summary: dict[str, Any],
    *,
    limit: int = 10,
) -> list[dict[str, Any]]:
    candidates: list[tuple[int, str]] = []
    worth = set(issues.get("worth_reactivation") or [])
    reactivate = set(issues.get("silent_after_enquiry") or [])
    profile_map = {p.get("contact_name"): p for p in profiles}

    for contact, role in (role_summary.get("by_contact") or {}).items():
        if role not in ("A级客户", "B级客户", "潜在客户", "流失客户"):
            continue
        score = 0
        if contact in worth:
            score += 3
        if contact in reactivate:
            score += 2
        prof = profile_map.get(contact, {})
        if prof.get("potential_level") == "high":
            score += 2
        if prof.get("follow_up_needed"):
            score += 1
        if role in ("A级客户", "B级客户"):
            score += 1
        if score > 0:
            candidates.append((score, contact))

    candidates.sort(key=lambda x: (-x[0], x[1]))
    out: list[dict[str, Any]] = []
    for score, contact in candidates[:limit]:
        prof = profile_map.get(contact, {})
        out.append({
            "contact": contact,
            "tier": role_summary["by_contact"].get(contact),
            "score": score,
            "products": prof.get("interested_products", [])[:3],
            "country": prof.get("country", ""),
            "next_action": prof.get("next_action", ""),
        })
    return out


def _deal_patterns(conversations: list[dict[str, Any]]) -> dict[str, Any]:
    won = 0
    lost = 0
    for conv in conversations:
        msgs = conv.get("messages", [])
        text_blob = " ".join(m.get("text", "") for m in msgs)
        if re.search(r"\b(confirm order|payment sent|paid|deposit|成交)\b", text_blob, re.I):
            won += 1
        elif any(
            m.get("category") in ("enquiry", "price_request") for m in msgs if not m.get("is_ceo")
        ):
            lost += 1
    return {
        "won_threads": won,
        "unconverted_enquiry_threads": max(lost - won, 0),
        "note": "基于历史消息关键词与分类推断，非财务系统实账。",
    }


def build_full_report(analysis: dict[str, Any]) -> dict[str, Any]:
    """Build structured full report from run_sales_intelligence_analysis() output."""
    from customer_gateway.conversation_database import load_all_conversations
    from customer_gateway.customer_profile_builder import load_profiles

    conversations = load_all_conversations()
    profiles = load_profiles()
    performance = analysis.get("performance") or {}
    products = performance.get("products") or {}
    talk = analysis.get("talk_optimization") or {}
    patterns = analysis.get("patterns") or {}
    failures = analysis.get("failures") or {}
    customers = analysis.get("customers") or {}
    issues = performance.get("issues") or {}

    role_summary = summarize_contact_roles(
        conversations,
        customers_intel=customers,
        profiles=profiles,
    )
    engine_stats = _engine_inquiry_stats(conversations)
    scenarios = _scenario_replies(talk, patterns)
    followups = _top_followup_customers(issues, profiles, role_summary)
    ceo_analysis = performance.get("ceo_sales_analysis") or {}

    report = {
        "generated_at": analysis.get("generated_at") or _now(),
        "readonly": True,
        "auto_send": False,
        "auto_prompt_update": False,
        "totals": {
            "conversation_count": analysis.get("conversation_count", len(conversations)),
            "message_count": analysis.get("message_count", 0),
            "contact_count": role_summary["total_contacts"],
            "effective_customers": role_summary["effective_customers"],
        },
        "customer_classification": role_summary["customer_tiers"],
        "other_roles": role_summary["other_roles"],
        "classification_types_count": len(
            [k for k, v in role_summary["customer_tiers"].items() if v > 0]
        ),
        "top_products": (products.get("top_engines") or [])[:20],
        "top_engines": (products.get("top_engines") or [])[:20],
        "country_distribution": products.get("top_countries") or [],
        "top_followup_customers": followups,
        "best_sales_talk": {
            "effective_replies": ceo_analysis.get("effective_replies") or [],
            "high_conversion_openings": [x[0] for x in (patterns.get("high_reply_openings") or [])[:5]],
            "high_conversion_quotes": [x[0] for x in (patterns.get("high_conversion_quotes") or [])[:5]],
        },
        "failed_talk": {
            "weak_replies": ceo_analysis.get("weak_replies") or [],
            "low_conversion_quotes": [x[0] for x in (patterns.get("low_conversion_quotes") or [])[:5]],
            "failure_reasons": failures.get("reason_breakdown") or {},
            "sample_failures": (failures.get("failures") or [])[:10],
        },
        "recommended_replies": scenarios,
        "deal_patterns": _deal_patterns(conversations),
        "engine_inquiry_stats": engine_stats,
        "funnel": performance.get("funnel") or {},
        "ceo_summary": _ceo_learning_summary(analysis, role_summary, engine_stats, failures),
        "pending_reply_evolution": (analysis.get("reply_evolution") or {}).get("proposed", 0),
    }
    return report


def _ceo_learning_summary(
    analysis: dict[str, Any],
    role_summary: dict[str, Any],
    engine_stats: dict[str, Any],
    failures: dict[str, Any],
) -> str:
    tiers = role_summary["customer_tiers"]
    top_reason = max(
        (failures.get("reason_breakdown") or {"unknown": 0}).items(),
        key=lambda x: x[1],
        default=("unknown", 0),
    )[0]
    return (
        f"今日从 {analysis.get('conversation_count', 0)} 个 WhatsApp 会话、"
        f"{analysis.get('message_count', 0)} 条消息中学习。"
        f"识别有效客户 {role_summary['effective_customers']} 个；"
        f"A级 {tiers.get('A级客户', 0)}、B级 {tiers.get('B级客户', 0)}、"
        f"潜在 {tiers.get('潜在客户', 0)}。"
        f"发动机类询盘线程 {engine_stats.get('engine_enquiry_threads', 0)} 个，"
        f"G4KJ 提及 {engine_stats.get('g4kj_mentions', 0)}、"
        f"G4KD 提及 {engine_stats.get('g4kd_mentions', 0)}。"
        f"未成交主因: {top_reason}。"
        f"已生成话术优化建议 {analysis.get('reply_evolution', {}).get('proposed', 0)} 条，"
        f"等待 CEO Review，未自动改 Prompt、未自动发送。"
    )


def format_full_report_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# WhatsApp Sales Intelligence — Full Report",
        "",
        f"**生成时间:** {report.get('generated_at', _now())}",
        f"**只读:** {report.get('readonly')} | **自动发送:** {report.get('auto_send')} | "
        f"**自动改 Prompt:** {report.get('auto_prompt_update')}",
        "",
        "## 1. 总量",
        "",
        f"- 总聊天数（会话）: {report['totals']['conversation_count']}",
        f"- 总联系人数: {report['totals']['contact_count']}",
        f"- 总消息数: {report['totals']['message_count']}",
        f"- 有效客户数量: {report['totals']['effective_customers']}",
        "",
        "## 2. 客户分类",
        "",
    ]
    for tier, count in (report.get("customer_classification") or {}).items():
        lines.append(f"- {tier}: {count}")
    lines.extend(["", "## 3. 供应商 / 私人 / 系统", ""])
    for role, count in (report.get("other_roles") or {}).items():
        lines.append(f"- {role}: {count}")

    lines.extend(["", "## 4. 热门产品 TOP20", ""])
    for name, cnt in (report.get("top_products") or [])[:20]:
        lines.append(f"- {name}: {cnt}")
    if not report.get("top_products"):
        lines.append("- 数据不足/未读取到")

    lines.extend(["", "## 5. 热门发动机 TOP20", ""])
    for name, cnt in (report.get("top_engines") or [])[:20]:
        lines.append(f"- {name}: {cnt}")
    if not report.get("top_engines"):
        lines.append("- 数据不足/未读取到")

    lines.extend(["", "## 6. 国家分布", ""])
    for name, cnt in (report.get("country_distribution") or [])[:20]:
        lines.append(f"- {name}: {cnt}")
    if not report.get("country_distribution"):
        lines.append("- 数据不足/未读取到")

    lines.extend(["", "## 7. 最值得跟进客户 TOP10", ""])
    for item in report.get("top_followup_customers") or []:
        lines.append(
            f"- {item.get('contact')} [{item.get('tier')}] "
            f"产品: {', '.join(item.get('products') or []) or 'N/A'} "
            f"国家: {item.get('country') or 'N/A'}"
        )
    if not report.get("top_followup_customers"):
        lines.append("- 数据不足/未读取到")

    lines.extend(["", "## 8. 历史最佳销售话术", ""])
    for t in (report.get("best_sales_talk") or {}).get("effective_replies") or []:
        lines.append(f"- {t}")
    for t in (report.get("best_sales_talk") or {}).get("high_conversion_quotes") or []:
        lines.append(f"- {t}")
    if not lines[-1].startswith("- "):
        lines.append("- 数据不足/未读取到")

    lines.extend(["", "## 9. 历史失败话术 / 失败原因", ""])
    failed = report.get("failed_talk") or {}
    for reason, cnt in (failed.get("failure_reasons") or {}).items():
        lines.append(f"- {reason}: {cnt}")
    for t in failed.get("weak_replies") or []:
        lines.append(f"- 弱回复: {t}")

    lines.extend(["", "## 10. 新版推荐销售话术（待 CEO Review）", ""])
    for scenario, text in (report.get("recommended_replies") or {}).items():
        lines.append(f"### {scenario}")
        lines.append(text)
        lines.append("")

    eng = report.get("engine_inquiry_stats") or {}
    lines.extend([
        "## 11. 发动机询盘统计",
        "",
        f"- 发动机类询盘线程: {eng.get('engine_enquiry_threads', 0)}",
        f"- G4KJ 提及: {eng.get('g4kj_mentions', 0)}",
        f"- G4KD 提及: {eng.get('g4kd_mentions', 0)}",
        "",
        "## 12. CEO Summary",
        "",
        report.get("ceo_summary", "数据不足/未读取到"),
        "",
        "---",
        "*所有优化建议仅进入 CEO Review，不自动改 Prompt，不自动发送 WhatsApp。*",
    ])
    return "\n".join(lines)


def save_full_report(analysis: dict[str, Any]) -> dict[str, Any]:
    """Write reports/whatsapp_sales_intelligence_full.{md,json}."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report = build_full_report(analysis)
    FULL_JSON_PATH.write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    FULL_MD_PATH.write_text(format_full_report_markdown(report), encoding="utf-8")
    return {
        "ok": True,
        "markdown_path": str(FULL_MD_PATH),
        "json_path": str(FULL_JSON_PATH),
        "report": report,
    }
