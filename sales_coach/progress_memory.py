"""Progress Memory — yesterday train → today verify → graduate or continue."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sales_coach.config import progress_path
from sales_coach.sources import load_json, save_json


def load_progress(root=None) -> dict[str, Any]:
    data = load_json(progress_path(root), default=None)
    if not isinstance(data, dict):
        return {
            "active_lessons": [],
            "graduated_skills": [],
            "skill_history": {},
            "last_training_day": None,
        }
    data.setdefault("active_lessons", [])
    data.setdefault("graduated_skills", [])
    data.setdefault("skill_history", {})
    return data


def save_progress(data: dict[str, Any], root=None) -> None:
    save_json(progress_path(root), data)


def record_skill_day(progress: dict[str, Any], day: date, scores: dict[str, int]) -> None:
    hist = progress.setdefault("skill_history", {})
    hist[day.isoformat()] = scores
    progress["last_training_day"] = day.isoformat()


def yesterday_scores(progress: dict[str, Any], day: date) -> dict[str, int] | None:
    prev = (day - timedelta(days=1)).isoformat()
    hist = progress.get("skill_history") or {}
    row = hist.get(prev)
    return dict(row) if isinstance(row, dict) else None


def verify_active_lessons(
    *,
    progress: dict[str, Any],
    turns: list[dict[str, Any]],
    day: date,
) -> dict[str, Any]:
    """
    Check whether yesterday's lessons were actually practiced today.
    Graduate when evidence is strong; otherwise keep training.
    """
    graduated_today: list[dict[str, str]] = []
    still_weak: list[dict[str, str]] = []
    active = list(progress.get("active_lessons") or [])
    remaining: list[dict[str, Any]] = []

    for lesson in active:
        skill = lesson.get("skill") or ""
        check = lesson.get("check") or "generic"
        passed, evidence = _check_lesson(check, turns)
        if passed:
            graduated_today.append(
                {
                    "skill": skill,
                    "lesson": lesson.get("title") or skill,
                    "evidence": evidence,
                    "graduated_on": day.isoformat(),
                }
            )
            grads = progress.setdefault("graduated_skills", [])
            if skill and skill not in grads:
                grads.append(skill)
        else:
            still_weak.append(
                {
                    "skill": skill,
                    "lesson": lesson.get("title") or skill,
                    "reason": evidence,
                }
            )
            lesson["miss_streak"] = int(lesson.get("miss_streak") or 0) + 1
            remaining.append(lesson)

    progress["active_lessons"] = remaining
    return {
        "graduated_today": graduated_today,
        "still_weak_from_yesterday": still_weak,
        "active_remaining": remaining,
    }


def _check_lesson(check: str, turns: list[dict[str, Any]]) -> tuple[bool, str]:
    if not turns:
        return False, "今日无足够对话样本，无法验证。"

    if check == "ask_vin_on_engine":
        need = [t for t in turns if (t.get("context") or {}).get("should_ask_vin")]
        if not need:
            return True, "今日无「应问 VIN」的发动机询盘样本，暂视为无需再犯。"
        ok = sum(1 for t in need if (t.get("decisions") or {}).get("ask_vin"))
        rate = ok / len(need)
        if rate >= 0.7:
            return True, f"今日应问 VIN 的 {len(need)} 笔中有 {ok} 笔已问（≥70%）。"
        return False, f"今日应问 VIN 的 {len(need)} 笔中仅 {ok} 笔已问（<{int(rate*100)}%）。"

    if check == "no_promise_inventory":
        bad = [t for t in turns if (t.get("decisions") or {}).get("promise_inventory")]
        if not bad:
            return True, "今日未发现承诺库存话术。"
        return False, f"今日仍有 {len(bad)} 笔疑似承诺库存。"

    if check == "confirm_accessory":
        engine = [t for t in turns if (t.get("context") or {}).get("engine_enquiry")]
        if not engine:
            return True, "今日无发动机询盘样本。"
        ok = sum(1 for t in engine if (t.get("decisions") or {}).get("confirm_accessory"))
        if ok / len(engine) >= 0.5:
            return True, f"发动机询盘中 {ok}/{len(engine)} 确认了附件。"
        return False, f"发动机询盘中仅 {ok}/{len(engine)} 确认附件。"

    if check == "quote_after_facts":
        bad = [t for t in turns if (t.get("context") or {}).get("quoted_before_vin")]
        if not bad:
            return True, "今日未发现「未问 VIN 先报价」。"
        return False, f"今日仍有 {len(bad)} 笔未问 VIN 先报价。"

    if check == "confirm_product":
        engine = [t for t in turns if (t.get("context") or {}).get("engine_enquiry")]
        if not engine:
            return False, "今日无发动机询盘样本，无法验证产品确认（继续训练）。"
        ok = sum(1 for t in engine if (t.get("decisions") or {}).get("confirm_product"))
        if ok / len(engine) >= 0.7:
            return True, f"发动机询盘中 {ok}/{len(engine)} 做了产品确认。"
        return False, f"发动机询盘中仅 {ok}/{len(engine)} 做了产品确认。"

    if check == "follow_up":
        ok = sum(1 for t in turns if (t.get("decisions") or {}).get("follow_up"))
        if ok / len(turns) >= 0.7:
            return True, f"今日 {ok}/{len(turns)} 含明确下一步。"
        return False, f"今日仅 {ok}/{len(turns)} 含明确下一步。"

    if check == "customer_trust":
        bad = sum(1 for t in turns if not (t.get("decisions") or {}).get("build_trust"))
        if bad == 0:
            return True, "今日无绝对化承诺。"
        return False, f"今日仍有 {bad} 笔绝对化承诺风险。"

    if check == "recommend_alternative":
        engine = [t for t in turns if (t.get("context") or {}).get("engine_enquiry")]
        if not engine:
            return False, "今日无发动机询盘样本，无法验证替代推荐。"
        ok = sum(1 for t in engine if (t.get("decisions") or {}).get("recommend_alternative"))
        if ok >= 1:
            return True, f"今日至少 {ok} 笔给出替代路径。"
        return False, "今日发动机询盘均未给出替代推荐。"

    if check == "closing":
        # Closing is situational — only graduate if some closes appear when quotes exist
        quoted = [t for t in turns if (t.get("decisions") or {}).get("quote_now")]
        if not quoted:
            return False, "今日无报价回合，成交推进暂不毕业。"
        ok = sum(1 for t in quoted if (t.get("decisions") or {}).get("close_ask"))
        if ok / len(quoted) >= 0.5:
            return True, f"报价回合中 {ok}/{len(quoted)} 含成交推进。"
        return False, f"报价回合中仅 {ok}/{len(quoted)} 含成交推进。"

    # generic: do NOT auto-graduate — keep training until a specific check exists
    return False, "该训练点尚无专项验证规则，继续保留为活跃课。"


def set_active_lessons(progress: dict[str, Any], lessons: list[dict[str, Any]]) -> None:
    """Replace active training set with tonight's (max 3). Never re-add graduated skills."""
    graduated = set(progress.get("graduated_skills") or [])
    cleaned = []
    for lesson in lessons[:3]:
        skill = lesson.get("skill") or ""
        if skill and skill in graduated:
            continue
        cleaned.append(lesson)
    progress["active_lessons"] = cleaned
