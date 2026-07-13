"""APSALES-EVIDENCE-001 — Read-only Evidence loader + Daily Summary.

Sales Coach MUST remain read-only:
- Does not modify production data
- Does not auto-modify Prompt
- Does not auto-modify Decision
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sales_coach.config import COACH_READ_ONLY, coach_output_dir, evidence_channel_dir

assert COACH_READ_ONLY is True


def _read_ndjson(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def load_merged_turns(channel: str = "whatsapp", root: Path | None = None) -> list[dict[str, Any]]:
    """Load turns + apply latest patch per evidence_id (read-only view)."""
    base = evidence_channel_dir(channel, root)
    turns = [t for t in _read_ndjson(base / "turns.ndjson") if t.get("type") == "evidence_turn"]
    patches = [p for p in _read_ndjson(base / "patches.ndjson") if p.get("type") == "evidence_patch"]
    latest: dict[str, dict[str, Any]] = {}
    for p in patches:
        eid = str(p.get("evidence_id") or "")
        if not eid:
            continue
        latest[eid] = p
    merged: list[dict[str, Any]] = []
    for t in turns:
        row = dict(t)
        p = latest.get(str(t.get("evidence_id") or ""))
        if p:
            if p.get("customer_result"):
                row["customer_result"] = p["customer_result"]
            if p.get("decision_result"):
                row["decision_result"] = p["decision_result"]
            if p.get("ceo"):
                row["ceo"] = p["ceo"]
            if p.get("live_fix"):
                row["live_fix"] = p["live_fix"]
        merged.append(row)
    return merged


def _day_key(iso: str | None) -> str:
    if not iso:
        return ""
    return str(iso)[:10]


def turns_for_day(day: str, channel: str = "whatsapp", root: Path | None = None) -> list[dict[str, Any]]:
    return [t for t in load_merged_turns(channel, root) if _day_key(t.get("at")) == day]


def build_daily_summary_markdown(day: str, turns: list[dict[str, Any]]) -> str:
    continued: list[str] = []
    stopped: list[str] = []
    proved: list[str] = []
    unproven: list[str] = []

    for t in turns:
        eid = t.get("evidence_id") or "?"
        cust = (t.get("customer") or {}).get("message") or ""
        excerpt = (cust[:80] + "…") if len(cust) > 80 else cust
        decision = t.get("decision") or {}
        next_action = decision.get("next_action") or "?"
        tg = t.get("truth_guard") or {}
        cr = t.get("customer_result") or {}
        dr = t.get("decision_result") or {}
        fact = cr.get("fact")
        dr_status = dr.get("status") or "pending"

        line = (
            f"- [{eid}] 客户：「{excerpt or '(empty)'}」→ Decision:`{next_action}` "
            f"→ TruthGuard:`{tg.get('verdict')}`/`{tg.get('reason_code')}` "
            f"→ CustomerResult:`{fact or 'pending'}` → DecisionResult:`{dr_status}`"
        )

        if fact in ("continued_chat", "sent_vin", "sent_model", "sent_image", "sent_qty", "sent_port", "asked_price"):
            continued.append(line)
        if fact in ("ended", "silent"):
            stopped.append(line)
        if dr_status == "succeeded":
            proved.append(line)
        if dr_status in ("pending", "inconclusive"):
            unproven.append(line)

    def block(title: str, items: list[str], empty: str) -> str:
        body = "\n".join(items) if items else f"- {empty}"
        return f"## {title}\n{body}\n"

    parts = [
        f"# Evidence Daily Summary — {day}",
        "",
        "> Sales Coach = Evidence Reader (Read Only). 不改生产 / 不改 Prompt / 不改 Decision。",
        "",
        block("① 为什么继续聊", continued, "今日无继续聊天的可观察证据。"),
        block("② 为什么停止", stopped, "今日无停止/沉默的可观察证据。"),
        block("③ 被证明有效的 Decision", proved, "今日尚无 Decision Result = succeeded。"),
        block("④ 尚无证据的 Decision", unproven, "今日无 pending/inconclusive 项。"),
        "",
        f"_turns={len(turns)}（仅供内部核对，不作为业务指标）_",
        "",
    ]
    return "\n".join(parts)


def run_evidence_daily_summary(
    day: str | None = None,
    *,
    channel: str = "whatsapp",
    write: bool = True,
    root: Path | None = None,
) -> dict[str, Any]:
    """Read-only summary. `write=True` only writes coach markdown under docs/ — never Evidence/production."""
    day = day or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    turns = turns_for_day(day, channel=channel, root=root)
    markdown = build_daily_summary_markdown(day, turns)
    out_path: Path | None = None
    if write:
        out_dir = coach_output_dir(root)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{day}-evidence.md"
        out_path.write_text(markdown, encoding="utf-8")
    return {
        "day": day,
        "channel": channel,
        "turns": len(turns),
        "report_path": str(out_path) if out_path else None,
        "markdown": markdown,
        "read_only": True,
    }
