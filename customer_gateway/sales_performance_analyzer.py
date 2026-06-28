"""Sales performance analyzer — learn what works, not blind CEO imitation."""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any

from customer_gateway.message_classifier import classify_text

_QUOTE_RE = re.compile(r"\b(quotation|quote|fob|cif|usd|\$|price is)\b", re.I)
_WON_RE = re.compile(r"\b(confirm order|payment sent|paid|deposit|tt copy|lc opened)\b", re.I)
_TRUST_RE = re.compile(r"\b(thank|thanks|ok|great|good|perfect|appreciate)\b", re.I)
_INFO_GAP_RE = re.compile(
    r"\b(model|year|chassis|vin|quantity|qty|port|destination)\b", re.I,
)


def analyze_sales_performance(
    parsed: list[dict[str, Any]],
    profiles: list[dict[str, Any]],
) -> dict[str, Any]:
    """Answer the 10 intelligence questions + funnel + product rankings."""
    per_contact = _group_by_contact(parsed)
    funnel = _compute_funnel(per_contact)
    ceo_analysis = _analyze_ceo_replies(per_contact)
    followups = _followup_queues(profiles, per_contact)
    products = _product_intelligence(parsed)
    issues = _identify_issues(per_contact, profiles)
    sop = _propose_sop(issues, ceo_analysis, funnel)

    return {
        "overview": _overview(per_contact, profiles),
        "funnel": funnel,
        "products": products,
        "followups": followups,
        "ceo_sales_analysis": ceo_analysis,
        "issues": issues,
        "improvements": sop,
        "principle": "从历史中学习，但不要盲目模仿 CEO。目标是建立更高成交率的销售体系。",
    }


def _group_by_contact(parsed: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for conv in parsed:
        contact = conv.get("contact", "unknown")
        for msg in conv.get("messages", []):
            grouped[contact].append({**msg, "contact": contact})
    return dict(grouped)


def _overview(
    per_contact: dict[str, list[dict[str, Any]]],
    profiles: list[dict[str, Any]],
) -> dict[str, Any]:
    total = len(per_contact)
    active = sum(1 for msgs in per_contact.values() if _is_active(msgs))
    silent = sum(1 for msgs in per_contact.values() if _is_silent(msgs))
    high_value = sum(1 for p in profiles if p.get("potential_level") == "high")
    repeat = sum(1 for msgs in per_contact.values() if _enquiry_count(msgs) >= 2)
    return {
        "total_customers": total,
        "active_customers": active,
        "silent_customers": silent,
        "high_value_customers": high_value,
        "repeat_customers": repeat,
    }


def _is_active(msgs: list[dict[str, Any]]) -> bool:
    cats = {m.get("category") for m in msgs if not m.get("is_ceo")}
    return bool(cats & {"enquiry", "price_request", "follow_up", "availability_check"})


def _is_silent(msgs: list[dict[str, Any]]) -> bool:
    customer = [m for m in msgs if not m.get("is_ceo")]
    if not customer:
        return True
    last = customer[-1]
    return last.get("category") in ("follow_up", "enquiry") and not _has_ceo_after(msgs, last)


def _enquiry_count(msgs: list[dict[str, Any]]) -> int:
    return sum(
        1 for m in msgs
        if not m.get("is_ceo")
        and m.get("category") in ("enquiry", "availability_check", "price_request")
    )


def _has_ceo_after(msgs: list[dict[str, Any]], target: dict[str, Any]) -> bool:
    try:
        idx = msgs.index(target)
    except ValueError:
        return False
    return any(m.get("is_ceo") for m in msgs[idx + 1 : idx + 4])


def _compute_funnel(per_contact: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    stages = {"enquiry": 0, "reply": 0, "quote": 0, "follow_up": 0, "won": 0}
    total = max(len(per_contact), 1)

    for msgs in per_contact.values():
        customer_msgs = [m for m in msgs if not m.get("is_ceo")]
        if not customer_msgs:
            continue
        if any(m.get("category") in ("enquiry", "availability_check") for m in customer_msgs):
            stages["enquiry"] += 1
        if _ceo_replied_to_enquiry(msgs):
            stages["reply"] += 1
        if any(
            m.get("is_ceo") and _QUOTE_RE.search(m.get("text", ""))
            for m in msgs
        ) or any(m.get("category") == "price_request" for m in customer_msgs):
            stages["quote"] += 1
        if any(m.get("category") == "follow_up" for m in customer_msgs):
            stages["follow_up"] += 1
        if any(_WON_RE.search(m.get("text", "")) for m in msgs):
            stages["won"] += 1

    drop = {}
    keys = list(stages.keys())
    for i in range(len(keys) - 1):
        a, b = keys[i], keys[i + 1]
        drop[f"{a}_to_{b}"] = (
            round(100 * (1 - stages[b] / max(stages[a], 1)), 1)
        )

    return {
        "stages": stages,
        "drop_off_pct": drop,
        "total_contacts": len(per_contact),
    }


def _ceo_replied_to_enquiry(msgs: list[dict[str, Any]]) -> bool:
    for i, msg in enumerate(msgs):
        if msg.get("is_ceo"):
            continue
        if msg.get("category") in ("enquiry", "availability_check", "price_request"):
            if any(m.get("is_ceo") for m in msgs[i + 1 : i + 4]):
                return True
    return False


def _analyze_ceo_replies(per_contact: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    effective: list[str] = []
    weak: list[str] = []
    trust_building: list[str] = []
    churn_risk: list[str] = []

    for msgs in per_contact.values():
        for i, msg in enumerate(msgs):
            if not msg.get("is_ceo"):
                continue
            text = msg.get("text", "")
            if not text:
                continue
            outcome = _reply_outcome(msgs, i)
            snippet = text[:120]
            if outcome == "positive":
                effective.append(snippet)
                if _TRUST_RE.search(text):
                    trust_building.append(snippet)
            elif outcome == "negative":
                weak.append(snippet)
                churn_risk.append(snippet)

    return {
        "effective_replies": effective[:5],
        "weak_replies": weak[:5],
        "trust_building": trust_building[:3],
        "churn_risk_replies": churn_risk[:3],
        "note": "客观分析回复效果，不是评价 CEO 个人。",
    }


def _reply_outcome(msgs: list[dict[str, Any]], ceo_idx: int) -> str:
    following = msgs[ceo_idx + 1 : ceo_idx + 4]
    customer_next = [m for m in following if not m.get("is_ceo")]
    if not customer_next:
        return "neutral"
    nxt = customer_next[0]
    cat = nxt.get("category", classify_text(nxt.get("text", "")))
    text = nxt.get("text", "").lower()
    if cat in ("negotiation", "complaint") or "too high" in text or "expensive" in text:
        return "negative"
    if cat in ("payment", "follow_up") or _TRUST_RE.search(nxt.get("text", "")):
        return "positive"
    if cat in ("price_request", "shipping_request", "enquiry"):
        return "positive"
    return "neutral"


def _identify_issues(
    per_contact: dict[str, list[dict[str, Any]]],
    profiles: list[dict[str, Any]],
) -> dict[str, list[str]]:
    missed_followup: list[str] = []
    silent_after_enquiry: list[str] = []
    price_churn: list[str] = []
    slow_reply: list[str] = []
    no_next_step: list[str] = []
    low_trust: list[str] = []
    incomplete_info: list[str] = []
    no_formal_quote: list[str] = []
    reactivate: list[str] = []

    for contact, msgs in per_contact.items():
        customer_msgs = [m for m in msgs if not m.get("is_ceo")]

        if any(m.get("category") == "follow_up" for m in customer_msgs):
            if not _ceo_replied_to_enquiry(msgs):
                missed_followup.append(contact)

        if _is_silent(msgs):
            silent_after_enquiry.append(contact)

        if any(m.get("category") == "negotiation" for m in customer_msgs):
            price_churn.append(contact)

        for i, msg in enumerate(customer_msgs):
            if msg.get("category") in ("enquiry", "availability_check"):
                if not _has_ceo_after(msgs, msg):
                    slow_reply.append(contact)

        ceo_msgs = [m for m in msgs if m.get("is_ceo")]
        if ceo_msgs and not any(_INFO_GAP_RE.search(m.get("text", "")) for m in ceo_msgs):
            if any(m.get("category") in ("enquiry", "availability_check") for m in customer_msgs):
                incomplete_info.append(contact)

        if not any(
            m.get("is_ceo") and _QUOTE_RE.search(m.get("text", ""))
            for m in msgs
        ):
            if any(m.get("category") == "price_request" for m in customer_msgs):
                no_formal_quote.append(contact)

        if not any(_TRUST_RE.search(m.get("text", "")) for m in customer_msgs):
            if len(customer_msgs) >= 2:
                low_trust.append(contact)

        prof = next((p for p in profiles if p.get("contact_name") == contact), None)
        if prof and prof.get("follow_up_needed") and prof.get("potential_level") in ("high", "medium"):
            reactivate.append(contact)

    return {
        "missed_followup_opportunities": missed_followup,
        "silent_after_enquiry": silent_after_enquiry,
        "price_churn_customers": price_churn,
        "slow_or_no_reply": list(set(slow_reply)),
        "no_next_step_push": no_next_step,
        "low_trust_threads": low_trust,
        "incomplete_info_collection": list(set(incomplete_info)),
        "no_formal_quote": list(set(no_formal_quote)),
        "worth_reactivation": list(set(reactivate)),
    }


def _product_intelligence(parsed: list[dict[str, Any]]) -> dict[str, Any]:
    engines: Counter[str] = Counter()
    gearboxes: Counter[str] = Counter()
    halfcuts: Counter[str] = Counter()
    vehicles: Counter[str] = Counter()
    countries: Counter[str] = Counter()
    ports: Counter[str] = Counter()

    _ENGINE = re.compile(r"\b(G4K[A-Z]?|HR\d{2}[A-Z]{2,4}|engine|motor|moteur)\b", re.I)
    _GEAR = re.compile(r"\b(gearbox|transmission|cvt|at|mt)\b", re.I)
    _HALF = re.compile(r"\b(half.?cut|halfcut|nose cut)\b", re.I)
    _VEHICLE = re.compile(r"\b(hyundai|toyota|honda|nissan|tucson|corolla|camry)\b", re.I)

    for conv in parsed:
        for msg in conv.get("messages", []):
            text = msg.get("text", "")
            for kw in msg.get("product_keywords", []):
                ku = kw.upper()
                if _ENGINE.search(kw) or ku.startswith("G4") or ku == "ENGINE":
                    engines[ku] += 1
                if _GEAR.search(text):
                    gearboxes[kw.upper()] += 1
            if _HALF.search(text):
                halfcuts["HALF-CUT"] += 1
            for v in _VEHICLE.findall(text):
                vehicles[v.title()] += 1
            for c in msg.get("countries_ports", []):
                cl = c.strip()
                if cl.upper() in ("FOB", "CIF"):
                    continue
                if "port" in cl.lower() or cl.lower() in (
                    "tema", "lagos", "mombasa", "cotonou", "lome", "abidjan",
                ):
                    ports[cl.title()] += 1
                else:
                    countries[cl.title()] += 1

    return {
        "top_engines": engines.most_common(10),
        "top_gearboxes": gearboxes.most_common(10),
        "top_halfcuts": halfcuts.most_common(5),
        "top_vehicles": vehicles.most_common(10),
        "top_countries": countries.most_common(10),
        "top_ports": ports.most_common(10),
        "hottest_product": (engines.most_common(1) or [("N/A", 0)])[0][0],
        "easiest_to_close": _easiest_product(parsed),
        "hardest_to_close": _hardest_product(parsed),
    }


def _easiest_product(parsed: list[dict[str, Any]]) -> str:
    scores: Counter[str] = Counter()
    for conv in parsed:
        msgs = conv.get("messages", [])
        for i, msg in enumerate(msgs):
            if msg.get("is_ceo") or not msg.get("product_keywords"):
                continue
            for kw in msg.get("product_keywords", []):
                if _reply_outcome(msgs, i) == "positive" or any(
                    m.get("category") == "payment" for m in msgs[i:]
                ):
                    scores[kw.upper()] += 1
    return scores.most_common(1)[0][0] if scores else "N/A"


def _hardest_product(parsed: list[dict[str, Any]]) -> str:
    scores: Counter[str] = Counter()
    for conv in parsed:
        msgs = conv.get("messages", [])
        for msg in msgs:
            if msg.get("is_ceo") or not msg.get("product_keywords"):
                continue
            if msg.get("category") == "negotiation":
                for kw in msg.get("product_keywords", []):
                    scores[kw.upper()] += 1
    return scores.most_common(1)[0][0] if scores else "N/A"


def _followup_queues(
    profiles: list[dict[str, Any]],
    per_contact: dict[str, list[dict[str, Any]]],
) -> dict[str, list[str]]:
    today: list[str] = []
    this_week: list[str] = []
    reactivate: list[str] = []
    archive: list[str] = []

    for prof in profiles:
        name = prof.get("contact_name", "")
        potential = prof.get("potential_level", "low")
        follow = prof.get("follow_up_needed", False)
        cats = prof.get("message_categories", {})

        if potential == "low" and not follow:
            archive.append(name)
        elif cats.get("follow_up", 0) > 0 or prof.get("next_action") == "contact_today":
            today.append(name)
        elif follow and potential in ("high", "medium"):
            this_week.append(name)
        elif prof.get("next_action") == "reactivate":
            reactivate.append(name)

    return {
        "contact_today": today,
        "contact_this_week": this_week,
        "reactivate": reactivate,
        "archive": archive,
    }


def _propose_sop(
    issues: dict[str, list[str]],
    ceo_analysis: dict[str, Any],
    funnel: dict[str, Any],
) -> dict[str, Any]:
    return {
        "new_sales_sop": [
            "询价 30 分钟内出首条回复草稿（CEO 审批后发送）",
            "每条询价必须收集：车型/年份/VIN或发动机号/数量/目的港/交货期",
            "未确认库存前统一使用「供应商网络核实」话术，禁止承诺现货",
            "报价后 48 小时内自动提醒跟进（APSales 草稿，不自动发送）",
            "议价客户分层：高潜力保留方案，低毛利客户归档",
        ],
        "quote_templates": [
            "Thank you for your enquiry. We are checking availability from our verified China supplier network for {product}. Please confirm quantity and destination port for FOB/CIF quotation.",
            "Based on supplier feedback, we can prepare quotation for {product} to {port}. Final price subject to CEO approval.",
        ],
        "follow_up_process": [
            "Day 0: 回复询价 + 收集缺失信息",
            "Day 2: 发送报价跟进草稿",
            "Day 7: 沉默客户再激活草稿",
        ],
        "info_collection_template": [
            "Please share: vehicle model, year, engine code, quantity, destination port, and preferred Incoterm (FOB/CIF).",
        ],
        "whatsapp_reply_suggestions": [
            "使用专业称呼（boss/my friend）但避免过度承诺",
            "先确认需求，再给价格区间方向",
            "库存不确定时明确「正在核实供应商网络」",
        ],
        "closing_strategies": [
            "高潜力客户：多方案报价 + 交期选项",
            "价格敏感客户：强调 verified supplier 质量与售后",
            "沉默客户：轻量再激活，附热门产品推荐",
        ],
        "customer_segmentation": [
            "A 类：多次询价 + 明确港口 + 愿意谈价 → 高优先",
            "B 类：单次询价 + 信息不全 → 补信息后跟进",
            "C 类：仅比价无反馈 → 低优先归档",
        ],
        "apsales_priority": (
            "保留 CEO 有效做法（"
            + (ceo_analysis.get("effective_replies", [""])[0][:40] if ceo_analysis.get("effective_replies") else "礼貌开场")
            + "），改进弱回复模式，不盲目复制。"
        ),
        "funnel_focus": (
            f"当前最大流失在询价→回复（{funnel.get('drop_off_pct', {}).get('enquiry_to_reply', 0)}%）"
            if funnel.get("drop_off_pct") else "持续积累数据优化漏斗"
        ),
    }
