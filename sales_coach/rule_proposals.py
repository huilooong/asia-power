"""Cross-day pattern scan → evidence-backed problem list (Coach Read Only).

Coach 没有人类判断力,不代写规则——只把"哪里反复出问题、证据是什么"整理好。
规则怎么写,交给人(CEO / Claude)看了证据之后决定。
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sales_coach.config import COACH_READ_ONLY, coach_output_dir
from sales_coach.evidence import load_merged_turns

assert COACH_READ_ONLY is True

# customer_result facts that count as a "bad" outcome after a Decision's next_action.
_BAD_FACTS = {"ended", "silent"}
_DEFAULT_WINDOW_DAYS = 7
_DEFAULT_MIN_OCCURRENCES = 3


def _within_window(iso: str | None, since: datetime) -> bool:
    if not iso:
        return False
    try:
        at = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return False
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    return at >= since


def scan_patterns(
    *,
    channel: str = "whatsapp",
    root: Path | None = None,
    window_days: int = _DEFAULT_WINDOW_DAYS,
    min_occurrences: int = _DEFAULT_MIN_OCCURRENCES,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    """Group turns by decision.next_action; flag patterns with >= min_occurrences
    bad outcomes (decision_result=failed OR customer_result in {ended, silent})
    within the trailing window_days. Returns a list sorted by occurrence count desc.
    """
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    since = now - timedelta(days=window_days)

    turns = load_merged_turns(channel, root)
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for t in turns:
        if not _within_window(t.get("at"), since):
            continue
        decision = t.get("decision") or {}
        next_action = decision.get("next_action") or "?"
        dr = (t.get("decision_result") or {}).get("status")
        cr_fact = (t.get("customer_result") or {}).get("fact")
        is_bad = dr == "failed" or cr_fact in _BAD_FACTS
        if is_bad:
            buckets[next_action].append(t)

    patterns: list[dict[str, Any]] = []
    for next_action, bad_turns in buckets.items():
        if len(bad_turns) < min_occurrences:
            continue
        patterns.append({
            "next_action": next_action,
            "occurrences": len(bad_turns),
            "window_days": window_days,
            "evidence": [
                {
                    "evidence_id": t.get("evidence_id"),
                    "customer_message": (t.get("customer") or {}).get("message", ""),
                    "reply_text": (t.get("reply") or {}).get("text", ""),
                    "customer_result_fact": (t.get("customer_result") or {}).get("fact"),
                    "decision_result_status": (t.get("decision_result") or {}).get("status"),
                    "at": t.get("at"),
                }
                for t in bad_turns
            ],
        })

    patterns.sort(key=lambda p: p["occurrences"], reverse=True)
    return patterns


def build_rule_proposal_markdown(patterns: list[dict[str, Any]], *, window_days: int) -> str:
    if not patterns:
        return (
            f"# Coach 规则提案 — 过去 {window_days} 天\n\n"
            "> Coach 只整理证据,不代写规则；规则怎么写由人决定。\n\n"
            "过去这段时间没有发现重复 ≥ 门槛次数的失败模式,暂无提案。\n"
        )

    lines = [
        f"# Coach 规则提案 — 过去 {window_days} 天",
        "",
        "> Coach 只整理证据,不代写规则；规则怎么写由人决定。",
        "",
    ]
    for p in patterns:
        lines.append(
            f"## ⚠️ next_action=`{p['next_action']}` — {p['window_days']} 天内出问题 {p['occurrences']} 次"
        )
        for e in p["evidence"]:
            cust = str(e["customer_message"])[:100]
            reply = str(e["reply_text"])[:100]
            lines.append(
                f"- [{e['evidence_id']}] 客户:「{cust}」→ 回复:「{reply}」"
                f"→ 结果:`{e['customer_result_fact'] or '?'}` / DecisionResult:`{e['decision_result_status'] or '?'}`"
            )
        lines.append("")
        lines.append(
            "**建议**: 复核这个场景下的话术/时机,是否需要在 LIVE-RULES.md 里新增或调整一条规则(人工判断,Coach 不代写)。"
        )
        lines.append("")

    return "\n".join(lines)


def run_rule_proposal_scan(
    *,
    channel: str = "whatsapp",
    root: Path | None = None,
    window_days: int = _DEFAULT_WINDOW_DAYS,
    min_occurrences: int = _DEFAULT_MIN_OCCURRENCES,
    write: bool = True,
    now: datetime | None = None,
) -> dict[str, Any]:
    patterns = scan_patterns(
        channel=channel,
        root=root,
        window_days=window_days,
        min_occurrences=min_occurrences,
        now=now,
    )
    markdown = build_rule_proposal_markdown(patterns, window_days=window_days)
    out_path: Path | None = None
    if write:
        out_dir = coach_output_dir(root)
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%d")
        out_path = out_dir / f"{stamp}-rule-proposals.md"
        out_path.write_text(markdown, encoding="utf-8")
    return {
        "patterns": patterns,
        "markdown": markdown,
        "report_path": str(out_path) if out_path else None,
        "read_only": True,
    }
