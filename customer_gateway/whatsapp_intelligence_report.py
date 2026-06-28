"""Generate WhatsApp Sales Intelligence Report (中文, CEO-facing)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway.gateway_readonly import REPORTS_DIR, ensure_gateway_dirs
from customer_gateway.sales_performance_analyzer import analyze_sales_performance


def generate_intelligence_report(
    parsed: list[dict[str, Any]],
    profiles: list[dict[str, Any]],
) -> dict[str, Any]:
    analysis = analyze_sales_performance(parsed, profiles)
    report_md = format_report_markdown(analysis)
    report_json = {
        "title": "WhatsApp Sales Intelligence Report",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "principle": analysis.get("principle"),
        "analysis": analysis,
    }

    ensure_gateway_dirs()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    md_path = REPORTS_DIR / f"sales_intelligence_{ts}.md"
    json_path = REPORTS_DIR / f"sales_intelligence_{ts}.json"
    latest_md = REPORTS_DIR / "latest_report.md"
    latest_json = REPORTS_DIR / "latest_report.json"

    md_path.write_text(report_md, encoding="utf-8")
    json_path.write_text(json.dumps(report_json, indent=2, ensure_ascii=False), encoding="utf-8")
    latest_md.write_text(report_md, encoding="utf-8")
    latest_json.write_text(json.dumps(report_json, indent=2, ensure_ascii=False), encoding="utf-8")

    return {"markdown": report_md, "paths": {"md": str(md_path), "json": str(json_path)}}


def load_latest_report() -> str:
    path = REPORTS_DIR / "latest_report.md"
    if path.is_file():
        return path.read_text(encoding="utf-8").strip()
    return "尚无报告。请运行 /whatsapp analyze 或 /whatsapp report"


def format_report_markdown(analysis: dict[str, Any]) -> str:
    ov = analysis.get("overview", {})
    funnel = analysis.get("funnel", {})
    products = analysis.get("products", {})
    followups = analysis.get("followups", {})
    ceo = analysis.get("ceo_sales_analysis", {})
    issues = analysis.get("issues", {})
    imp = analysis.get("improvements", {})

    lines = [
        "# WhatsApp 销售智能报告",
        "",
        f"> {analysis.get('principle', '')}",
        "",
        "**模式：只读分析 | 不自动发送 | 不盲目模仿 CEO**",
        "",
        "---",
        "",
        "## 1. 总体分析",
        "",
        f"- 总客户数：{ov.get('total_customers', 0)}",
        f"- 活跃客户：{ov.get('active_customers', 0)}",
        f"- 沉默客户：{ov.get('silent_customers', 0)}",
        f"- 高价值客户：{ov.get('high_value_customers', 0)}",
        f"- 复购/重复询价客户：{ov.get('repeat_customers', 0)}",
        "",
        "## 2. 产品分析",
        "",
        "### 排行榜",
    ]

    for label, key in [
        ("发动机", "top_engines"),
        ("变速箱", "top_gearboxes"),
        ("半切车", "top_halfcuts"),
        ("车型", "top_vehicles"),
        ("国家", "top_countries"),
        ("港口", "top_ports"),
    ]:
        items = products.get(key, [])
        lines.append(f"**{label}：**")
        if items:
            for name, count in items[:5]:
                lines.append(f"- {name}: {count}")
        else:
            lines.append("- （暂无数据）")
        lines.append("")

    lines.extend([
        f"- 最热门产品：{products.get('hottest_product', 'N/A')}",
        f"- 最容易成交产品：{products.get('easiest_to_close', 'N/A')}",
        f"- 最难成交产品：{products.get('hardest_to_close', 'N/A')}",
        "",
        "## 3. 销售漏斗",
        "",
        "询价 → 回复 → 报价 → 跟进 → 成交",
        "",
    ])
    stages = funnel.get("stages", {})
    for stage, count in stages.items():
        lines.append(f"- {stage}: {count}")
    lines.append("")
    lines.append("**流失率：**")
    for k, pct in funnel.get("drop_off_pct", {}).items():
        lines.append(f"- {k}: {pct}%")

    lines.extend(["", "## 4. 跟进分析", ""])
    for label, key in [
        ("今天应联系", "contact_today"),
        ("本周应联系", "contact_this_week"),
        ("重新激活", "reactivate"),
        ("永久归档", "archive"),
    ]:
        names = followups.get(key, [])
        lines.append(f"**{label}：** {', '.join(names[:8]) if names else '无'}")
    lines.append("")

    lines.extend(["## 5. CEO 销售分析（客观，非个人评价）", ""])
    lines.append("**效果较好的回复：**")
    for r in ceo.get("effective_replies", [])[:3]:
        lines.append(f"- \"{r}\"")
    if not ceo.get("effective_replies"):
        lines.append("- （数据不足）")
    lines.append("")
    lines.append("**容易流失客户的回复模式：**")
    for r in ceo.get("weak_replies", [])[:3]:
        lines.append(f"- \"{r}\"")
    if not ceo.get("weak_replies"):
        lines.append("- （暂无明显弱回复样本）")
    lines.append("")

    lines.extend(["## 6. 改进建议（APSales 销售体系升级）", ""])
    lines.append("### 新销售 SOP")
    for item in imp.get("new_sales_sop", []):
        lines.append(f"- {item}")
    lines.append("")
    lines.append("### 报价模板")
    for item in imp.get("quote_templates", []):
        lines.append(f"- {item}")
    lines.append("")
    lines.append("### 跟进流程")
    for item in imp.get("follow_up_process", []):
        lines.append(f"- {item}")
    lines.append("")
    lines.append("### 信息收集模板")
    for item in imp.get("info_collection_template", []):
        lines.append(f"- {item}")
    lines.append("")
    lines.append("### WhatsApp 回复建议")
    for item in imp.get("whatsapp_reply_suggestions", []):
        lines.append(f"- {item}")
    lines.append("")
    lines.append("### 成交策略")
    for item in imp.get("closing_strategies", []):
        lines.append(f"- {item}")
    lines.append("")
    lines.append("### 客户分类标准")
    for item in imp.get("customer_segmentation", []):
        lines.append(f"- {item}")
    lines.append("")

    lines.extend(["## 关键问题诊断", ""])
    diag_map = [
        ("有成交机会却未跟进", "missed_followup_opportunities"),
        ("询价后沉默", "silent_after_enquiry"),
        ("因价格流失", "price_churn_customers"),
        ("回复过慢或无回复", "slow_or_no_reply"),
        ("未推动下一步", "no_next_step_push"),
        ("信任建立不足", "low_trust_threads"),
        ("信息收集不完整", "incomplete_info_collection"),
        ("未形成正式报价", "no_formal_quote"),
        ("值得重新激活", "worth_reactivation"),
    ]
    for label, key in diag_map:
        names = issues.get(key, [])
        lines.append(f"- {label}：{len(names)} 个" + (f"（{', '.join(names[:3])}）" if names else ""))

    lines.extend([
        "",
        "---",
        "",
        "**APSales 结论：** 从历史中学习有效做法，改进弱环节，建立比当前更高成交率的标准化全球销售体系。",
        "",
        "*只读模式 — 未发送任何 WhatsApp 消息。*",
    ])
    return "\n".join(lines)
