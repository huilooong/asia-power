"""APBRAIN-002 Stages 2–7 — Sales Intelligence analysis engine."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

from customer_gateway import sales_intelligence_paths as sip
from customer_gateway.conversation_database import load_all_conversations
from customer_gateway.message_classifier import classify_text
from customer_gateway.reply_style_learner import learn_ceo_style
from customer_gateway.sales_performance_analyzer import analyze_sales_performance

_WON_RE = re.compile(
    r"\b(confirm order|payment sent|paid|deposit|tt copy|lc opened|成交|已付款)\b",
    re.I,
)
_QUOTE_RE = re.compile(r"\b(quotation|quote|fob|cif|usd|\$|price is)\b", re.I)
_NEGOTIATE_RE = re.compile(r"\b(too high|too expensive|discount|cheaper|negotiate)\b", re.I)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _parse_ts(ts: str) -> datetime | None:
    if not ts:
        return None
    for fmt in ("%d/%m/%Y, %H:%M:%S", "%d/%m/%Y, %H:%M", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(ts.strip()[:19], fmt)
        except ValueError:
            continue
    return None


def _reply_minutes(msgs: list[dict[str, Any]], customer_idx: int) -> float | None:
    cust_ts = _parse_ts(msgs[customer_idx].get("timestamp", ""))
    if not cust_ts:
        return None
    for nxt in msgs[customer_idx + 1 : customer_idx + 6]:
        if nxt.get("is_ceo"):
            ceo_ts = _parse_ts(nxt.get("timestamp", ""))
            if ceo_ts:
                return max(0, (ceo_ts - cust_ts).total_seconds() / 60)
    return None


def analyze_customer_intelligence(conversations: list[dict[str, Any]]) -> dict[str, Any]:
    """Stage 2 — per-customer sales intelligence."""
    customers: dict[str, dict[str, Any]] = {}

    for conv in conversations:
        contact = conv.get("contact", "unknown")
        msgs = conv.get("messages", [])
        customer_msgs = [m for m in msgs if not m.get("is_ceo")]
        ceo_msgs = [m for m in msgs if m.get("is_ceo")]
        all_text = " ".join(m.get("text", "") for m in msgs)

        deal_count = sum(1 for m in msgs if _WON_RE.search(m.get("text", "")))
        negotiated = any(_NEGOTIATE_RE.search(m.get("text", "")) for m in customer_msgs)
        repeat = sum(
            1 for m in customer_msgs
            if m.get("category") in ("enquiry", "availability_check", "price_request")
        ) >= 2

        reply_times = []
        for i, m in enumerate(msgs):
            if not m.get("is_ceo") and m.get("category") in ("enquiry", "availability_check", "price_request"):
                rt = _reply_minutes(msgs, i)
                if rt is not None:
                    reply_times.append(rt)

        media_pref = sum(1 for m in customer_msgs if m.get("has_media")) > len(customer_msgs) * 0.2
        voice_pref = sum(1 for m in customer_msgs if m.get("has_voice")) > 0
        fob_pref = sum(1 for m in msgs if m.get("mentions_fob")) > sum(1 for m in msgs if m.get("mentions_cif"))
        cif_pref = sum(1 for m in msgs if m.get("mentions_cif")) > sum(1 for m in msgs if m.get("mentions_fob"))

        churned = (
            len(customer_msgs) > 0
            and customer_msgs[-1].get("category") in ("enquiry", "follow_up")
            and not any(m.get("is_ceo") for m in msgs[-3:])
            and deal_count == 0
        )

        customers[contact] = {
            "contact": contact,
            "message_count": len(msgs),
            "deal_closed": deal_count > 0,
            "deal_count": deal_count,
            "churned": churned,
            "negotiates": negotiated,
            "repeat_purchaser": repeat,
            "prefers_images": media_pref,
            "prefers_voice": voice_pref,
            "prefers_fob": fob_pref and not cif_pref,
            "prefers_cif": cif_pref and not fob_pref,
            "avg_reply_time_min": round(sum(reply_times) / len(reply_times), 1) if reply_times else None,
            "avg_deal_cycle_days": None,
            "avg_order_value_usd": None,
            "last_activity": (msgs[-1].get("timestamp") if msgs else ""),
            "summary": _customer_summary(deal_count, churned, negotiated, repeat),
        }

    sip.ensure_dirs()
    for contact, intel in customers.items():
        slug = re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "-", contact.lower()).strip("-")[:48] or "unknown"
        (sip.CUSTOMERS_DIR / f"{slug}.json").write_text(
            json.dumps(intel, indent=2, ensure_ascii=False), encoding="utf-8",
        )
    return {"customers": customers, "count": len(customers)}


def _customer_summary(deals: int, churned: bool, negotiates: bool, repeat: bool) -> str:
    parts = []
    if deals:
        parts.append(f"成交 {deals} 次")
    if repeat:
        parts.append("重复采购")
    if negotiates:
        parts.append("爱讨价还价")
    if churned:
        parts.append("疑似失联")
    return "；".join(parts) or "观察中"


def learn_conversation_patterns(conversations: list[dict[str, Any]]) -> dict[str, Any]:
    """Stage 3 — pattern learning (outcomes, not raw content storage)."""
    continue_after: Counter[str] = Counter()
    silence_after: Counter[str] = Counter()
    quote_won: Counter[str] = Counter()
    quote_lost: Counter[str] = Counter()
    opening_replied: Counter[str] = Counter()
    opening_silent: Counter[str] = Counter()
    country_direct_quote: Counter[str] = Counter()
    country_chat_first: Counter[str] = Counter()

    _COUNTRY = re.compile(r"\b(ghana|nigeria|togo|benin|dubai|china)\b", re.I)

    for conv in conversations:
        msgs = conv.get("messages", [])
        contact_blob = conv.get("contact", "") + " " + " ".join(m.get("text", "") for m in msgs[:3])
        country = "unknown"
        for name in ("Ghana", "Nigeria", "Togo", "Benin", "Dubai", "China"):
            if re.search(name, contact_blob, re.I):
                country = name
                break

        won = any(_WON_RE.search(m.get("text", "")) for m in msgs)

        for i, msg in enumerate(msgs):
            if not msg.get("is_ceo"):
                continue
            snippet = msg.get("text", "")[:80].lower()
            following = [m for m in msgs[i + 1 : i + 4] if not m.get("is_ceo")]
            if following:
                continue_after[snippet[:40]] += 1
            else:
                silence_after[snippet[:40]] += 1

            if _QUOTE_RE.search(msg.get("text", "")):
                if won:
                    quote_won[snippet[:40]] += 1
                else:
                    quote_lost[snippet[:40]] += 1

            if i < 3 and msg.get("is_ceo"):
                if following:
                    opening_replied[snippet[:40]] += 1
                else:
                    opening_silent[snippet[:40]] += 1

        customer_first = next((m for m in msgs if not m.get("is_ceo")), None)
        if customer_first and _QUOTE_RE.search(customer_first.get("text", "")):
            country_direct_quote[country] += 1
        elif customer_first:
            country_chat_first[country] += 1

    patterns = {
        "replies_that_continue_chat": continue_after.most_common(10),
        "replies_that_cause_silence": silence_after.most_common(10),
        "high_conversion_quotes": quote_won.most_common(10),
        "low_conversion_quotes": quote_lost.most_common(10),
        "high_reply_openings": opening_replied.most_common(10),
        "low_reply_openings": opening_silent.most_common(10),
        "countries_prefer_direct_quote": country_direct_quote.most_common(),
        "countries_prefer_chat_first": country_chat_first.most_common(),
        "principle": "学习销售规律，不存储完整聊天内容副本。",
    }
    sip.ensure_dirs()
    (sip.PATTERNS_DIR / "sales_patterns.json").write_text(
        json.dumps(patterns, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    return patterns


def optimize_talk(conversations: list[dict[str, Any]]) -> dict[str, Any]:
    """Stage 4 — top performing talk templates with success rates."""
    buckets: dict[str, list[tuple[str, bool]]] = defaultdict(list)

    for conv in conversations:
        msgs = conv.get("messages", [])
        won = any(_WON_RE.search(m.get("text", "")) for m in msgs)
        for i, msg in enumerate(msgs):
            if not msg.get("is_ceo"):
                continue
            text = msg.get("text", "")[:200]
            following = [m for m in msgs[i + 1 : i + 4] if not m.get("is_ceo")]
            positive = bool(following) and following[0].get("category") not in ("complaint",)

            if i == 0 or (i < 2 and not any(m.get("is_ceo") for m in msgs[:i])):
                buckets["opening"].append((text, positive))
            elif msg.get("category") == "follow_up" or "follow" in text.lower():
                buckets["follow_up"].append((text, positive))
            elif _QUOTE_RE.search(text):
                buckets["price_reply"].append((text, won))
            elif _NEGOTIATE_RE.search(text) or "discount" in text.lower():
                buckets["negotiation"].append((text, positive))
            elif _WON_RE.search(text) or "confirm" in text.lower():
                buckets["closing"].append((text, won))
            elif "sorry" in text.lower() or "apolog" in text.lower():
                buckets["recovery"].append((text, positive))

    def _top(bucket: str, limit: int = 3) -> list[dict[str, Any]]:
        items = buckets.get(bucket, [])
        if not items:
            return []
        scores: Counter[str] = Counter()
        totals: Counter[str] = Counter()
        for text, success in items:
            key = text[:100]
            totals[key] += 1
            if success:
                scores[key] += 1
        out = []
        for key, total in totals.most_common(limit):
            rate = round(100 * scores[key] / max(total, 1), 1)
            out.append({"text": key, "success_rate_pct": rate, "samples": total})
        return out

    talk = {
        "top_opening": _top("opening"),
        "top_follow_up": _top("follow_up"),
        "top_price_reply": _top("price_reply"),
        "top_negotiation": _top("negotiation"),
        "top_closing": _top("closing"),
        "top_recovery": _top("recovery"),
        "note": "Success rate = customer continued positively or deal closed.",
    }
    sip.ensure_dirs()
    (sip.PATTERNS_DIR / "talk_optimization.json").write_text(
        json.dumps(talk, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    return talk


def analyze_failures(conversations: list[dict[str, Any]]) -> dict[str, Any]:
    """Stage 5 — failure learning for non-converted threads."""
    failures: list[dict[str, Any]] = []
    reason_counts: Counter[str] = Counter()

    for conv in conversations:
        msgs = conv.get("messages", [])
        customer_msgs = [m for m in msgs if not m.get("is_ceo")]
        if not customer_msgs:
            continue
        if any(_WON_RE.search(m.get("text", "")) for m in msgs):
            continue
        if not any(m.get("category") in ("enquiry", "price_request", "availability_check") for m in customer_msgs):
            continue

        reasons: list[str] = []
        if any(_NEGOTIATE_RE.search(m.get("text", "")) for m in customer_msgs):
            reasons.append("price")
            reason_counts["price"] += 1
        if not any(m.get("is_ceo") for m in msgs):
            reasons.append("slow_reply")
            reason_counts["slow_reply"] += 1
        elif not any(_QUOTE_RE.search(m.get("text", "")) for m in msgs if m.get("is_ceo")):
            reasons.append("no_quote")
            reason_counts["no_quote"] += 1
        if re.search(r"\b(stock|available|inventory)\b", " ".join(m.get("text", "") for m in customer_msgs), re.I):
            if not any(m.get("is_ceo") for m in msgs[-5:]):
                reasons.append("inventory")
                reason_counts["inventory"] += 1
        if len(customer_msgs) >= 2 and not any(m.get("is_ceo") for m in msgs[-4:]):
            reasons.append("customer_churn")
            reason_counts["customer_churn"] += 1
        if not reasons:
            reasons.append("trust")
            reason_counts["trust"] += 1

        failures.append({
            "contact": conv.get("contact"),
            "reasons": reasons,
            "message_count": len(msgs),
            "last_message": customer_msgs[-1].get("text", "")[:100],
        })

    report = {
        "failed_threads": len(failures),
        "reason_breakdown": dict(reason_counts),
        "failures": failures[:50],
        "note": "未成交询盘分析 — 用于改进而非追责。",
    }
    sip.ensure_dirs()
    (sip.FAILURES_DIR / "failure_report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    return report


def build_ceo_dashboard(
    *,
    customers: dict[str, Any],
    patterns: dict[str, Any],
    talk: dict[str, Any],
    failures: dict[str, Any],
    performance: dict[str, Any],
) -> dict[str, Any]:
    """Stage 7 — CEO Sales Intelligence dashboard metrics."""
    products = performance.get("products", {})
    top_opening = (talk.get("top_opening") or [{}])[0]
    top_price = (talk.get("top_price_reply") or [{}])[0]

    reply_times = [
        c.get("avg_reply_time_min")
        for c in customers.get("customers", {}).values()
        if c.get("avg_reply_time_min") is not None
    ]
    best_reply_time = f"<{int(min(reply_times))}min" if reply_times else "数据不足"

    lengths = []
    for conv in load_all_conversations():
        for m in conv.get("messages", []):
            if m.get("is_ceo") and m.get("text"):
                wc = len(m["text"].split())
                if 20 < wc < 300:
                    lengths.append(wc)
    best_length = f"{int(sum(lengths)/len(lengths)*0.8)}~{int(sum(lengths)/len(lengths)*1.2)} words" if lengths else "120~180 words"

    dashboard = {
        "generated_at": _now(),
        "period": "all_history",
        "best_opening": {
            "text": top_opening.get("text", "N/A")[:80],
            "reply_rate_pct": top_opening.get("success_rate_pct", 0),
        },
        "best_quote_structure": {
            "text": top_price.get("text", "N/A")[:80],
            "close_rate_pct": top_price.get("success_rate_pct", 0),
        },
        "easiest_country": (products.get("top_countries") or [["N/A", 0]])[0][0],
        "easiest_product": products.get("hottest_product", "N/A"),
        "best_reply_length": best_length,
        "best_first_reply_time": best_reply_time,
        "failure_top_reason": max(
            failures.get("reason_breakdown", {"unknown": 0}).items(),
            key=lambda x: x[1],
            default=("unknown", 0),
        )[0],
        "active_customers": performance.get("overview", {}).get("active_customers", 0),
        "repeat_customers": performance.get("overview", {}).get("repeat_customers", 0),
    }
    sip.ensure_dirs()
    (sip.DASHBOARD_DIR / "latest.json").write_text(
        json.dumps(dashboard, indent=2, ensure_ascii=False), encoding="utf-8",
    )
    return dashboard


def _conversations_to_parsed(conversations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {"contact": c.get("contact"), "messages": c.get("messages", [])}
        for c in conversations
    ]


def run_sales_intelligence_analysis() -> dict[str, Any]:
    """Run APBRAIN-002 stages 2–7 on Conversation Database."""
    sip.ensure_dirs()
    conversations = load_all_conversations()
    if not conversations:
        return {
            "ok": False,
            "message": "无会话数据。请先运行 /sales-intelligence import",
        }

    parsed = _conversations_to_parsed(conversations)
    from customer_gateway.customer_profile_builder import build_all_profiles, load_profiles
    from customer_gateway.message_classifier import classify_messages

    for conv in parsed:
        classify_messages(conv)
    build_all_profiles(parsed)
    profiles = load_profiles()
    performance = analyze_sales_performance(parsed, profiles)
    learn_ceo_style(parsed)

    customers = analyze_customer_intelligence(conversations)
    patterns = learn_conversation_patterns(conversations)
    talk = optimize_talk(conversations)
    failures = analyze_failures(conversations)

    from customer_gateway.reply_evolution import propose_reply_versions

    evolution = propose_reply_versions(talk)

    dashboard = build_ceo_dashboard(
        customers=customers,
        patterns=patterns,
        talk=talk,
        failures=failures,
        performance=performance,
    )

    result = {
        "ok": True,
        "generated_at": _now(),
        "conversation_count": len(conversations),
        "message_count": sum(c.get("message_count", 0) for c in conversations),
        "customers": customers,
        "patterns": patterns,
        "talk_optimization": talk,
        "failures": failures,
        "reply_evolution": evolution,
        "dashboard": dashboard,
        "performance": performance,
    }

    (sip.SI_ROOT / "latest_analysis.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8",
    )

    from customer_gateway.whatsapp_sales_intelligence_full_report import save_full_report

    full = save_full_report(result)
    result["full_report"] = {
        "markdown_path": full.get("markdown_path"),
        "json_path": full.get("json_path"),
    }
    return result


def format_dashboard_markdown(data: dict[str, Any]) -> str:
    d = data.get("dashboard", {})
    lines = [
        "# Sales Intelligence — CEO Dashboard",
        "",
        f"**生成:** {d.get('generated_at', _now())}",
        "",
        "## 本月最佳表现（全历史基准）",
        "",
        f"- **最佳开场:** 回复率 {d.get('best_opening', {}).get('reply_rate_pct', 0)}%",
        f"  - `{d.get('best_opening', {}).get('text', '')[:100]}`",
        f"- **最佳报价结构:** 成交率 {d.get('best_quote_structure', {}).get('close_rate_pct', 0)}%",
        f"  - `{d.get('best_quote_structure', {}).get('text', '')[:100]}`",
        f"- **最容易成交国家:** {d.get('easiest_country', 'N/A')}",
        f"- **最容易成交产品:** {d.get('easiest_product', 'N/A')}",
        f"- **最佳回复长度:** {d.get('best_reply_length', 'N/A')}",
        f"- **最佳首次回复时间:** {d.get('best_first_reply_time', 'N/A')}",
        "",
        f"- **活跃客户:** {d.get('active_customers', 0)}",
        f"- **重复客户:** {d.get('repeat_customers', 0)}",
        f"- **主要失败原因:** {d.get('failure_top_reason', 'N/A')}",
        "",
        "---",
        "*所有优化建议需 CEO Review 批准后方可写入 Sales Brain。*",
    ]
    return "\n".join(lines)
