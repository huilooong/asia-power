"""Build tonight's Improvement Plan — max 3 lessons with real cases."""

from __future__ import annotations

from typing import Any

from sales_coach.config import SALES_SKILLS


_SKILL_TO_CHECK = {
    "VIN Confirmation": "ask_vin_on_engine",
    "Inventory Risk": "no_promise_inventory",
    "Accessory Confirmation": "confirm_accessory",
    "Quotation Timing": "quote_after_facts",
    "Product Confirmation": "confirm_product",
    "Follow-up": "follow_up",
    "Customer Trust": "customer_trust",
    "Alternative Recommendation": "recommend_alternative",
    "Closing": "closing",
}


def _case_for_skill(skill: str, turns: list[dict[str, Any]]) -> dict[str, str]:
    for t in turns:
        dec = t.get("decisions") or {}
        ctx = t.get("context") or {}
        meta = t.get("meta") or {}
        if skill == "VIN Confirmation" and ctx.get("should_ask_vin") and not dec.get("ask_vin"):
            return {
                "customer": (t.get("customer_excerpt") or "")[:180],
                "reply": (t.get("reply_excerpt") or "")[:180],
                "draft_id": str(meta.get("draft_id") or meta.get("contact") or ""),
            }
        if skill == "Inventory Risk" and dec.get("promise_inventory"):
            return {
                "customer": (t.get("customer_excerpt") or "")[:180],
                "reply": (t.get("reply_excerpt") or "")[:180],
                "draft_id": str(meta.get("draft_id") or ""),
            }
        if skill == "Quotation Timing" and ctx.get("quoted_before_vin"):
            return {
                "customer": (t.get("customer_excerpt") or "")[:180],
                "reply": (t.get("reply_excerpt") or "")[:180],
                "draft_id": str(meta.get("draft_id") or ""),
            }
        if skill == "Accessory Confirmation" and ctx.get("engine_enquiry") and not dec.get("confirm_accessory"):
            return {
                "customer": (t.get("customer_excerpt") or "")[:180],
                "reply": (t.get("reply_excerpt") or "")[:180],
                "draft_id": str(meta.get("draft_id") or ""),
            }
        if skill == "Alternative Recommendation" and ctx.get("engine_enquiry") and not dec.get("recommend_alternative"):
            return {
                "customer": (t.get("customer_excerpt") or "")[:180],
                "reply": (t.get("reply_excerpt") or "")[:180],
                "draft_id": str(meta.get("draft_id") or ""),
            }
        if skill == "Follow-up" and not dec.get("follow_up"):
            return {
                "customer": (t.get("customer_excerpt") or "")[:180],
                "reply": (t.get("reply_excerpt") or "")[:180],
                "draft_id": str(meta.get("draft_id") or ""),
            }
        if skill == "Customer Trust" and not dec.get("build_trust"):
            return {
                "customer": (t.get("customer_excerpt") or "")[:180],
                "reply": (t.get("reply_excerpt") or "")[:180],
                "draft_id": str(meta.get("draft_id") or ""),
            }
        if skill == "Product Confirmation" and ctx.get("engine_enquiry") and not dec.get("confirm_product"):
            return {
                "customer": (t.get("customer_excerpt") or "")[:180],
                "reply": (t.get("reply_excerpt") or "")[:180],
                "draft_id": str(meta.get("draft_id") or ""),
            }
        if skill == "Closing" and not dec.get("close_ask"):
            return {
                "customer": (t.get("customer_excerpt") or "")[:180],
                "reply": (t.get("reply_excerpt") or "")[:180],
                "draft_id": str(meta.get("draft_id") or ""),
            }
    # fallback first turn
    if turns:
        t = turns[0]
        meta = t.get("meta") or {}
        return {
            "customer": (t.get("customer_excerpt") or "")[:180],
            "reply": (t.get("reply_excerpt") or "")[:180],
            "draft_id": str(meta.get("draft_id") or meta.get("contact") or ""),
        }
    return {"customer": "（今日无样本）", "reply": "", "draft_id": ""}


_SKILL_PLAYBOOK = {
    "VIN Confirmation": (
        "发动机询盘未先问 VIN，导致适配判断与报价风险上升。",
        "以后凡发动机/半截询盘且客户未给 VIN：先问 VIN，再谈适配与价格。",
    ),
    "Product Confirmation": (
        "未复述确认客户要的机型/总成范围，容易答非所问。",
        "回复开头用一句话确认产品（机型+总成类型），再往下问。",
    ),
    "Accessory Confirmation": (
        "未确认附件范围，后续容易因「含不含电脑板/变速箱」反复扯皮。",
        "报价或核库前主动确认附件清单。",
    ),
    "Quotation Timing": (
        "关键事实未齐就报价，CEO 改稿与客户预期失控风险高。",
        "先问 VIN/目的港/数量，再给带 Incoterms 的报价。",
    ),
    "Inventory Risk": (
        "出现疑似承诺库存的表述，违反可核实销售原则。",
        "只说「正在核实」或「已核实结果」，禁止「现货/马上发」类空头承诺。",
    ),
    "Alternative Recommendation": (
        "无货或不确定时未给替代路径，客户容易流失。",
        "在无法确认原型号时，给出 1 个可核替代并说明差异。",
    ),
    "Follow-up": (
        "回复缺少下一步，对话容易断。",
        "每封回复结尾给一个明确下一步（要资料 / 给时效 / 约确认）。",
    ),
    "Customer Trust": (
        "出现绝对化承诺，损害信任。",
        "改用可核实措辞，把保证换成核实动作。",
    ),
    "Closing": (
        "推进成交的动作偏弱（在事实已齐时）。",
        "事实齐备时礼貌确认意向/定金节点，但不施压。",
    ),
}


def pick_three_lessons(
    *,
    skill_deltas: dict[str, dict[str, int | str]],
    turns: list[dict[str, Any]],
    rule_violations: list[dict[str, Any]],
    still_weak: list[dict[str, str]],
    graduated_skills: list[str],
) -> list[dict[str, Any]]:
    """Priority: rule violations → failed yesterday lessons → weakest / declining skills."""
    graduated = set(graduated_skills or [])
    candidates: list[tuple[int, str, str, str]] = []
    # priority, skill, why, action

    for v in rule_violations:
        # map rule to skill
        rid = v.get("rule_id") or ""
        skill = "Inventory Risk"
        if "vin" in rid:
            skill = "VIN Confirmation"
        elif "accessor" in rid:
            skill = "Accessory Confirmation"
        elif "quote" in rid:
            skill = "Quotation Timing"
        elif "guarantee" in rid:
            skill = "Customer Trust"
        if skill in graduated:
            continue
        candidates.append(
            (
                100,
                skill,
                f"再次触犯 CEO 永久规则：{v.get('rule')}",
                _SKILL_PLAYBOOK.get(skill, ("需改进。", "按规则执行。"))[1],
            )
        )

    for w in still_weak:
        skill = w.get("skill") or ""
        if not skill or skill in graduated:
            continue
        candidates.append(
            (
                90,
                skill,
                f"昨日训练点今日未达标：{w.get('reason')}",
                _SKILL_PLAYBOOK.get(skill, ("继续训练。", "按昨日要点执行。"))[1],
            )
        )

    # weakest / declining
    ranked = []
    for skill in SALES_SKILLS:
        if skill in graduated:
            continue
        row = skill_deltas.get(skill) or {}
        today = int(row.get("today") or 50)
        delta = int(row.get("delta") or 0)
        ranked.append((today, delta, skill))
    ranked.sort(key=lambda x: (x[0], x[1]))  # low score first, then declining

    for today, delta, skill in ranked:
        why, action = _SKILL_PLAYBOOK.get(skill, ("该技能偏弱。", "按标准销售决策执行。"))
        if delta < 0:
            why = f"{why}（较昨日 {delta}）"
        priority = 80 - today // 2
        candidates.append((priority, skill, why, action))

    # dedupe by skill, keep highest priority
    best: dict[str, tuple[int, str, str, str]] = {}
    for item in candidates:
        skill = item[1]
        if skill not in best or item[0] > best[skill][0]:
            best[skill] = item

    top = sorted(best.values(), key=lambda x: -x[0])[:3]
    lessons: list[dict[str, Any]] = []
    for _, skill, why, action in top:
        case = _case_for_skill(skill, turns)
        lessons.append(
            {
                "title": skill,
                "skill": skill,
                "why": why,
                "how": action,
                "case": case,
                "check": _SKILL_TO_CHECK.get(skill, "generic"),
            }
        )
    return lessons


def biggest_progress(skill_deltas: dict[str, dict[str, int | str]]) -> dict[str, Any]:
    best_skill = None
    best_delta = -999
    for skill, row in skill_deltas.items():
        delta = int(row.get("delta") or 0)
        if delta > best_delta:
            best_delta = delta
            best_skill = skill
    if best_skill is None or best_delta <= 0:
        return {
            "skill": best_skill or "",
            "delta": best_delta if best_delta != -999 else 0,
            "text": "今日相对昨日没有可证实的技能分上升。",
            "reason": "样本不足、或关键决策（如先问 VIN）仍未稳定做到。",
        }
    row = skill_deltas[best_skill]
    return {
        "skill": best_skill,
        "delta": best_delta,
        "yesterday": row.get("yesterday"),
        "today": row.get("today"),
        "text": f"{best_skill}：{row.get('yesterday')} → {row.get('today')}（+{best_delta}）",
        "reason": "",
    }
