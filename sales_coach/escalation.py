"""Filter coach findings worth CEO Telegram approval (not every violation)."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sales_coach.config import coach_memory_dir, coach_output_dir, workspace_root
from sales_coach.rule_catalog import resolve_stable_rule_id, unclassified_id

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
    """Stable catalog rule_id only — never invent identity from free-text rule_hint."""
    return resolve_stable_rule_id(
        rule_id=str(violation.get("rule_id") or ""),
        rule_hint=str(violation.get("rule_hint") or violation.get("rule") or ""),
        allow_hint_alias=False,
    )


def normalize_rule_id_for_migration(violation: dict[str, Any]) -> str:
    """Migration helper: allow explicit legacy_aliases match on old hint-derived ids."""
    return resolve_stable_rule_id(
        rule_id=str(violation.get("rule_id") or ""),
        rule_hint=str(violation.get("rule_hint") or violation.get("rule") or ""),
        allow_hint_alias=True,
    )


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


def asked_record(state: dict[str, Any], rule_id: str) -> dict[str, Any]:
    return dict((state.get("asked") or {}).get(rule_id) or {})


def is_rejected(state: dict[str, Any], rule_id: str) -> bool:
    rec = asked_record(state, rule_id)
    status = str(rec.get("status") or "").lower()
    return status in {"rejected", "dismissed"}


def was_previously_asked(state: dict[str, Any], rule_id: str) -> bool:
    """True if CEO was asked at least once (any non-empty asked record)."""
    rec = asked_record(state, rule_id)
    return bool(rec.get("at") or rec.get("approval_id") or rec.get("status"))


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
    """Split violations into escalate (attention-worthy) vs digest-only.

    Escalate if confidence=high OR same *known* rule_id appears across ≥2 distinct
    customers/evidence. ``unclassified`` never uses the systemic (≥2) path.
    """
    now = now or _now()
    state = state if state is not None else {"asked": {}, "digest": []}
    unc = unclassified_id()
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
        systemic = rid != unc and len(distinct_keys) >= 2
        if not (has_high or systemic):
            digest.extend({**i, "rule_id": rid} for i in items)
            continue

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
        primary["all_evidence_ids"] = [
            str(i.get("evidence_id") or "") for i in items if i.get("evidence_id")
        ]
        eid = str(primary.get("evidence_id") or "")
        if is_rejected(state, rid):
            digest.append({**primary, "suppressed": "rejected"})
            continue
        if in_cooldown(rid, state, now=now, cooldown_days=cooldown_days, evidence_id=eid):
            digest.append({**primary, "suppressed": "cooldown"})
            continue
        escalate.append(primary)

    return {"escalate": escalate, "digest": digest}


def mark_asked(
    state: dict[str, Any],
    rule_id: str,
    *,
    approval_id: str = "",
    evidence_ids: list[str] | None = None,
    now: datetime | None = None,
    status: str = "asked",
    plan_path: str = "",
    recurrence: int | None = None,
) -> dict[str, Any]:
    now = now or _now()
    asked = state.setdefault("asked", {})
    prev = asked.get(rule_id) or {}
    eids = list(prev.get("evidence_ids") or [])
    for eid in evidence_ids or []:
        if eid and eid not in eids:
            eids.append(eid)
    prev_recurrence = int(prev.get("recurrence") or 0)
    next_recurrence = recurrence if recurrence is not None else prev_recurrence
    if status in {"asked", "auto_dispatched"} and recurrence is None:
        next_recurrence = prev_recurrence + (1 if status == "auto_dispatched" else 0)
        if status == "asked" and prev_recurrence == 0:
            next_recurrence = 1
    entry: dict[str, Any] = {
        "at": now.isoformat(),
        "approval_id": approval_id or str(prev.get("approval_id") or ""),
        "evidence_ids": eids[-40:],
        "status": status,
        "recurrence": next_recurrence,
    }
    if plan_path:
        entry["plan_path"] = plan_path
        history = list(prev.get("plan_paths") or [])
        if plan_path not in history:
            history.append(plan_path)
        entry["plan_paths"] = history[-20:]
    elif prev.get("plan_path"):
        entry["plan_path"] = prev.get("plan_path")
        entry["plan_paths"] = list(prev.get("plan_paths") or [])
    asked[rule_id] = entry
    return state


def mark_rejected(
    state: dict[str, Any],
    rule_id: str,
    *,
    approval_id: str = "",
    now: datetime | None = None,
    note: str = "",
) -> dict[str, Any]:
    now = now or _now()
    asked = state.setdefault("asked", {})
    prev = asked.get(rule_id) or {}
    asked[rule_id] = {
        **prev,
        "at": now.isoformat(),
        "approval_id": approval_id or str(prev.get("approval_id") or ""),
        "evidence_ids": list(prev.get("evidence_ids") or [])[-40:],
        "status": "rejected",
        "reject_note": (note or "")[:300],
    }
    return state


def mark_rejected_from_approval_record(
    record: dict[str, Any],
    *,
    root: Path | None = None,
    note: str = "",
) -> str:
    """Extract rule_id from an approval record and mark rejected in escalation state."""
    from sales_coach.dispatch_to_cursor import extract_rule_id_from_record

    rid = extract_rule_id_from_record(record)
    rid = resolve_stable_rule_id(rule_id=rid, allow_hint_alias=True)
    if rid == unclassified_id() and rid not in (record.get("request_text") or ""):
        # Still record under extracted raw if catalog miss — use resolved id
        pass
    state = load_escalation_state(root)
    mark_rejected(
        state,
        rid,
        approval_id=str(record.get("id") or ""),
        note=note,
    )
    save_escalation_state(state, root)
    return rid


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


def _synthetic_approval_record(item: dict[str, Any], *, recurrence: int) -> dict[str, Any]:
    rid = normalize_rule_id(item)
    eids = item.get("all_evidence_ids") or [item.get("evidence_id")]
    eids_s = ", ".join(str(x) for x in eids if x)
    why = (
        f"Coach 复发自动派工 {rid}（第 {recurrence} 次）"
        + (
            f", 本批重复 {item.get('repeat_count')} 次"
            if int(item.get("repeat_count") or 0) > 1
            else ""
        )
    )
    return {
        "id": f"AUTO-{rid[:40]}-{_now().strftime('%Y%m%d%H%M%S')}",
        "action": "agent_prompt_fix",
        "agent": "sales_coach",
        "why": why,
        "request_text": build_approval_request_text(item)
        + f" | recurrence={recurrence} | historical_evidence_ids={eids_s[:240]}",
        "status": "auto_dispatched",
        "human_only": False,
    }


def escalate_violations_to_ceo(
    violations: list[dict[str, Any]],
    *,
    root: Path | None = None,
    notify: bool = True,
) -> dict[str, Any]:
    """Filter + Telegram for brand-new rules; auto Cursor plan for known re-asks."""
    root = root or workspace_root()
    state = load_escalation_state(root)
    split = select_for_approval(violations, state=state)
    digest_path = append_digest_file(split["digest"], root=root)

    opened: list[dict[str, Any]] = []
    auto_plans: list[str] = []
    skipped_rejected = 0

    if notify and split["escalate"]:
        from sales_coach.dispatch_to_cursor import write_coach_fix_plan

        for item in split["escalate"]:
            rid = normalize_rule_id(item)
            if is_rejected(state, rid):
                skipped_rejected += 1
                continue

            if was_previously_asked(state, rid) and rid != unclassified_id():
                prev = asked_record(state, rid)
                recurrence = int(prev.get("recurrence") or 1) + 1
                # Merge historical evidence into the plan payload
                hist = list(prev.get("evidence_ids") or [])
                merged = list(dict.fromkeys(hist + list(item.get("all_evidence_ids") or [])))
                item = {**item, "all_evidence_ids": merged, "recurrence": recurrence}
                record = _synthetic_approval_record(item, recurrence=recurrence)
                plan_path = write_coach_fix_plan(record, root=root)
                mark_asked(
                    state,
                    rid,
                    approval_id=str(record.get("id") or ""),
                    evidence_ids=merged,
                    status="auto_dispatched",
                    plan_path=str(plan_path),
                    recurrence=recurrence,
                )
                auto_plans.append(str(plan_path))
                continue

            # Brand-new (or unclassified) → Telegram once
            from coo_core.approval_gate import request_and_notify

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
                status="asked",
                recurrence=1,
            )
            opened.append(rec)

    save_escalation_state(state, root)
    return {
        "escalate_count": len(split["escalate"]),
        "digest_count": len(split["digest"]),
        "opened": opened,
        "auto_plans": auto_plans,
        "skipped_rejected": skipped_rejected,
        "digest_path": str(digest_path) if digest_path else None,
    }
