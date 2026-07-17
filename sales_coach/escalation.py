"""Filter coach findings worth CEO Telegram approval (not every violation)."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sales_coach.config import coach_memory_dir, coach_output_dir, workspace_root

_STATE_NAME = "escalation_state.json"
_COOLDOWN_DAYS = 7


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _state_path(root: Path | None = None) -> Path:
    return coach_memory_dir(root) / _STATE_NAME


def load_escalation_state(root: Path | None = None) -> dict[str, Any]:
    path = _state_path(root)
    if not path.is_file():
        return {"asked": {}, "digest": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"asked": {}, "digest": []}
    if not isinstance(data, dict):
        return {"asked": {}, "digest": []}
    data.setdefault("asked", {})
    data.setdefault("digest", [])
    return data


def save_escalation_state(state: dict[str, Any], root: Path | None = None) -> None:
    path = _state_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_rule_id(violation: dict[str, Any]) -> str:
    raw = (
        violation.get("rule_id")
        or violation.get("rule_hint")
        or violation.get("rule")
        or "unknown"
    )
    text = str(raw).strip().lower()
    text = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in text)
    return (text[:80] or "unknown").strip("_")


def _parse_iso(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        at = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    return at


def in_cooldown(
    rule_id: str,
    state: dict[str, Any],
    *,
    now: datetime | None = None,
    cooldown_days: int = _COOLDOWN_DAYS,
    evidence_id: str = "",
) -> bool:
    """True if we already asked CEO about this rule_id recently (same evidence blocked)."""
    now = now or _now()
    asked = (state.get("asked") or {}).get(rule_id) or {}
    last_at = _parse_iso(asked.get("at"))
    if last_at is None:
        return False
    if now - last_at > timedelta(days=cooldown_days):
        return False
    # Same evidence again within cooldown → suppress; new evidence_id may re-ask
    prev_eids = set(str(x) for x in (asked.get("evidence_ids") or []))
    if evidence_id and evidence_id not in prev_eids:
        return False
    return True


def select_for_approval(
    violations: list[dict[str, Any]],
    *,
    state: dict[str, Any] | None = None,
    now: datetime | None = None,
    cooldown_days: int = _COOLDOWN_DAYS,
) -> dict[str, Any]:
    """Split violations into escalate (Telegram) vs digest-only.

    Escalate if confidence=high OR same rule_id appears across ≥2 distinct customers/evidence.
    """
    now = now or _now()
    state = state if state is not None else {"asked": {}, "digest": []}
    by_rule: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for v in violations or []:
        if not isinstance(v, dict):
            continue
        rid = normalize_rule_id(v)
        by_rule[rid].append(v)

    escalate: list[dict[str, Any]] = []
    digest: list[dict[str, Any]] = []

    for rid, items in by_rule.items():
        distinct_keys = {
            str(i.get("evidence_id") or i.get("customer_id") or id(i)) for i in items
        }
        has_high = any(str(i.get("confidence") or "").lower() == "high" for i in items)
        systemic = len(distinct_keys) >= 2
        if not (has_high or systemic):
            digest.extend(items)
            continue

        # Pick best evidence row for the card
        ranked = sorted(
            items,
            key=lambda i: (
                0 if str(i.get("confidence") or "").lower() == "high" else 1,
                str(i.get("evidence_id") or ""),
            ),
        )
        primary = dict(ranked[0])
        primary["rule_id"] = rid
        primary["repeat_count"] = len(items)
        primary["distinct_count"] = len(distinct_keys)
        eid = str(primary.get("evidence_id") or "")
        if in_cooldown(rid, state, now=now, cooldown_days=cooldown_days, evidence_id=eid):
            digest.append({**primary, "suppressed": "cooldown"})
            continue
        escalate.append(primary)

    return {"escalate": escalate, "digest": digest}


def mark_asked(
    state: dict[str, Any],
    rule_id: str,
    *,
    approval_id: str,
    evidence_ids: list[str] | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    now = now or _now()
    asked = state.setdefault("asked", {})
    prev = asked.get(rule_id) or {}
    eids = list(prev.get("evidence_ids") or [])
    for eid in evidence_ids or []:
        if eid and eid not in eids:
            eids.append(eid)
    asked[rule_id] = {
        "at": now.isoformat(),
        "approval_id": approval_id,
        "evidence_ids": eids[-20:],
    }
    return state


def append_digest_file(
    digest_items: list[dict[str, Any]],
    *,
    day: str | None = None,
    root: Path | None = None,
) -> Path | None:
    if not digest_items:
        return None
    day = day or _now().strftime("%Y-%m-%d")
    out = coach_output_dir(root) / f"{day}-coach-digest.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# Coach digest (no CEO approval required) — {day}",
        "",
        "Medium/low, one-off findings. Not pushed to Telegram.",
        "",
    ]
    for i, v in enumerate(digest_items, 1):
        lines.append(
            f"{i}. `{normalize_rule_id(v)}` conf={v.get('confidence')} "
            f"eid={v.get('evidence_id')} — {str(v.get('reason') or '')[:200]}"
        )
    prev = out.read_text(encoding="utf-8") if out.is_file() else ""
    block = "\n".join(lines) + "\n"
    if prev:
        out.write_text(prev.rstrip() + "\n\n---\n\n" + block, encoding="utf-8")
    else:
        out.write_text(block, encoding="utf-8")
    return out


def build_approval_request_text(item: dict[str, Any]) -> str:
    rid = normalize_rule_id(item)
    parts = [
        f"rule_id={rid}",
        f"confidence={item.get('confidence')}",
        f"repeat={item.get('repeat_count')} distinct={item.get('distinct_count')}",
        f"evidence_id={item.get('evidence_id') or ''}",
        f"reason={str(item.get('reason') or '')[:280]}",
        f"rule_hint={str(item.get('rule_hint') or '')[:160]}",
        f"customer_excerpt={str(item.get('customer_excerpt') or item.get('inbound') or '')[:160]}",
        f"agent_excerpt={str(item.get('agent_excerpt') or item.get('reply') or '')[:160]}",
    ]
    return " | ".join(parts)[:600]


def escalate_violations_to_ceo(
    violations: list[dict[str, Any]],
    *,
    root: Path | None = None,
    notify: bool = True,
) -> dict[str, Any]:
    """Filter + optionally open approval_gate cards. Returns summary."""
    root = root or workspace_root()
    state = load_escalation_state(root)
    split = select_for_approval(violations, state=state)
    digest_path = append_digest_file(split["digest"], root=root)

    opened: list[dict[str, Any]] = []
    if notify and split["escalate"]:
        from coo_core.approval_gate import request_and_notify

        for item in split["escalate"]:
            rid = normalize_rule_id(item)
            why = (
                f"Coach 发现 {rid} 违规"
                + (
                    f", 重复 {item.get('repeat_count')} 次"
                    if int(item.get("repeat_count") or 0) > 1
                    else " (high confidence)"
                )
            )
            rec = request_and_notify(
                "agent_prompt_fix",
                why=why,
                request_text=build_approval_request_text(item),
                agent="sales_coach",
            )
            mark_asked(
                state,
                rid,
                approval_id=str(rec.get("id") or ""),
                evidence_ids=[str(item.get("evidence_id") or "")],
            )
            opened.append(rec)

    save_escalation_state(state, root)
    return {
        "escalate_count": len(split["escalate"]),
        "digest_count": len(split["digest"]),
        "opened": opened,
        "digest_path": str(digest_path) if digest_path else None,
    }
