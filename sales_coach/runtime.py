"""Evening training run — discover → train → verify → (no auto prompt write)."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from sales_coach import config
from sales_coach.ceo_rules import (
    check_rule_violations,
    extract_ceo_rules_from_drafts,
    merge_permanent_rules,
)
from sales_coach.decisions import extract_decisions_from_conversations, extract_decisions_from_drafts
from sales_coach.progress_memory import (
    load_progress,
    record_skill_day,
    save_progress,
    set_active_lessons,
    verify_active_lessons,
    yesterday_scores,
)
from sales_coach.report import render_training_markdown, write_training_report
from sales_coach.skills import score_skills, skill_deltas
from sales_coach.sources import load_conversations_for_day, load_drafts_for_day, parse_day
from sales_coach.training import biggest_progress, pick_three_lessons


def run_evening_training(
    day: str | date | None = None,
    *,
    root: Path | None = None,
    write: bool = True,
) -> dict[str, Any]:
    """
    Nightly Sales Coach:

    1) Read today's dialogues (drafts + conversations)
    2) Extract Sales Decisions
    3) Compare CEO modifications → permanent rules
    4) Score Sales Skills vs yesterday
    5) Verify yesterday lessons (Progress Memory)
    6) Output max 3 lessons + progress (no Prompt mutation)
    """
    root = root or config.workspace_root()
    d = parse_day(day)

    drafts = load_drafts_for_day(d, root)
    conversations = load_conversations_for_day(d, root)
    turns = extract_decisions_from_drafts(drafts) + extract_decisions_from_conversations(conversations)

    progress = load_progress(root)
    verification = verify_active_lessons(progress=progress, turns=turns, day=d)

    new_rules = extract_ceo_rules_from_drafts(drafts)
    all_rules = merge_permanent_rules(new_rules, root)
    violations = check_rule_violations(turns, all_rules)

    today_scores = score_skills(turns)
    y_scores = yesterday_scores(progress, d)
    deltas = skill_deltas(today_scores, y_scores)
    record_skill_day(progress, d, today_scores)

    lessons = pick_three_lessons(
        skill_deltas=deltas,
        turns=turns,
        rule_violations=violations,
        still_weak=verification.get("still_weak_from_yesterday") or [],
        graduated_skills=list(progress.get("graduated_skills") or []),
    )
    set_active_lessons(progress, lessons)
    save_progress(progress, root)

    todays_progress = biggest_progress(deltas)
    still_weak = list(verification.get("still_weak_from_yesterday") or [])
    # also list lowest non-graduated skills as weak
    graduated = set(progress.get("graduated_skills") or [])
    for skill, row in sorted(deltas.items(), key=lambda kv: int(kv[1].get("today") or 0)):
        if skill in graduated:
            continue
        if int(row.get("today") or 0) < 60 and not any(w.get("skill") == skill for w in still_weak):
            still_weak.append({"skill": skill, "reason": f"今日得分 {row.get('today')}"})
        if len(still_weak) >= 5:
            break

    tomorrow_focus = [f"{x['title']}：{x['how']}" for x in lessons[:3]]

    payload: dict[str, Any] = {
        "day": d.isoformat(),
        "todays_progress": todays_progress,
        "lessons": lessons,
        "graduated_skills": list(progress.get("graduated_skills") or []),
        "graduated_today": verification.get("graduated_today") or [],
        "skills_still_weak": still_weak,
        "tomorrow_focus": tomorrow_focus,
        "skill_trends": deltas,
        "ceo_rules_new": new_rules,
        "ceo_rule_violations": violations,
        "decision_turns": len(turns),
        "drafts": len(drafts),
    }

    markdown = render_training_markdown(payload)
    payload["markdown"] = markdown
    if write:
        path = write_training_report(d, markdown, root)
        payload["report_path"] = str(path)
    return payload


# Back-compat alias (old CLI name) — still coach, not BI.
def run_daily_review(*args, **kwargs):
    return run_evening_training(*args, **kwargs)
