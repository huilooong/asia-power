"""Fixed-format coach output — training plan, not a dashboard."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from sales_coach import config


def render_training_markdown(payload: dict[str, Any]) -> str:
    day = payload["day"]
    progress = payload["todays_progress"]
    lessons = payload["lessons"]
    graduated = payload.get("graduated_skills") or []
    graduated_today = payload.get("graduated_today") or []
    still_weak = payload.get("skills_still_weak") or []
    tomorrow = payload.get("tomorrow_focus") or []
    skill_table = payload.get("skill_trends") or {}

    lines: list[str] = [
        f"# Sales Coach — {day}",
        "",
        "> 训练 Sales Decision。不评分英语。不改 Prompt。每晚最多 3 课。",
        "",
        "## Today's Progress",
        "",
        f"今天相比昨天：最大的进步",
        "",
        f"**{progress.get('text') or '无'}**",
        "",
    ]
    if progress.get("reason") and progress.get("delta", 0) <= 0:
        lines.append(f"没有进步的原因：{progress['reason']}")
        lines.append("")

    lines.append("### Skill Trends（Sales Skill only）")
    lines.append("")
    lines.append("| Skill | Yesterday | Today | Progress |")
    lines.append("|-------|-----------|-------|----------|")
    for skill, row in skill_table.items():
        delta = int(row.get("delta") or 0)
        sign = f"+{delta}" if delta > 0 else str(delta)
        lines.append(f"| {skill} | {row.get('yesterday')} | {row.get('today')} | {sign} |")
    lines.append("")

    lines.extend(["## Today's Three Lessons", "", "### Today's Improvement Plan", ""])
    if not lessons:
        lines.append("_今日样本不足，无法形成训练课。_")
        lines.append("")
    for i, lesson in enumerate(lessons[:3], 1):
        case = lesson.get("case") or {}
        lines.append(f"### Lesson {i}")
        lines.append("")
        lines.append(f"**今天最需要改进的事情：** {lesson.get('title')}")
        lines.append("")
        lines.append(f"**为什么？** {lesson.get('why')}")
        lines.append("")
        lines.append(f"**以后怎么办？** {lesson.get('how')}")
        lines.append("")
        lines.append("**真实客户案例：**")
        lines.append("")
        lines.append(f"- 客户：{case.get('customer') or '（无）'}")
        lines.append(f"- 子敬回复：{case.get('reply') or '（无）'}")
        if case.get("draft_id"):
            lines.append(f"- 档案：`{case.get('draft_id')}`")
        lines.append("")

    lines.extend(["## Graduated Skills", ""])
    if graduated_today:
        lines.append("今日毕业：")
        lines.append("")
        for g in graduated_today:
            lines.append(f"- **{g.get('skill')}** — {g.get('evidence')}")
        lines.append("")
    if graduated:
        lines.append("已掌握（以后默认不再训练）：")
        lines.append("")
        for s in graduated:
            lines.append(f"- {s}")
        lines.append("")
    if not graduated and not graduated_today:
        lines.append("_尚无毕业技能。_")
        lines.append("")

    lines.extend(["## Skills Still Weak", ""])
    if still_weak:
        for w in still_weak:
            lines.append(f"- **{w.get('skill') or w.get('lesson')}** — {w.get('reason') or w.get('why')}")
    else:
        lines.append("_无（或今日无待验证弱项）。_")
    lines.append("")

    lines.extend(["## Tomorrow Focus", ""])
    for item in tomorrow[:3]:
        lines.append(f"- {item}")
    if not tomorrow:
        lines.append("- 按 Tonight 三课执行；明日 Coach 抽样验证。")
    lines.append("")

    lines.extend(
        [
            "## Definition of Success",
            "",
            "Sales Coach 成功 ≠ 报告漂亮。",
            "",
            "成功 = 子敬连续 30 天，每天都有明确、可验证的销售决策进步。",
            "",
            "## Guardrails",
            "",
            "- 不自动修改 Prompt / Sales Brain",
            "- 不回复客户",
            "- 不训练已毕业技能（除非再次触犯 CEO 永久规则）",
            "",
        ]
    )
    return "\n".join(lines)


def write_training_report(day: date, markdown: str, root: Path | None = None) -> Path:
    out_dir = config.coach_output_dir(root)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{day.isoformat()}-coach.md"
    path.write_text(markdown, encoding="utf-8")
    return path
