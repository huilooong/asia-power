#!/usr/bin/env python3
"""One-shot: reclassify Sales Coach pending approvals by stable rule_id.

Usage (dry-run default):
  ASIAPOWER_ROOT=/path python3 scripts/migrate-coach-pending-rule-ids.py
  ASIAPOWER_ROOT=/path python3 scripts/migrate-coach-pending-rule-ids.py --apply

Does NOT auto-deploy. Writes coach-fix-*.md for rule_ids with ≥2 pendings
(or already asked). Singles become one consolidated Telegram digest request
unless --apply-singles-telegram is set.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sales_coach.config import coach_memory_dir, workspace_root  # noqa: E402
from sales_coach.dispatch_to_cursor import write_coach_fix_plan  # noqa: E402
from sales_coach.escalation import (  # noqa: E402
    build_approval_request_text,
    is_rejected,
    load_escalation_state,
    mark_asked,
    save_escalation_state,
    was_previously_asked,
)
from sales_coach.rule_catalog import resolve_stable_rule_id, unclassified_id  # noqa: E402


def _pending_dir(root: Path) -> Path:
    return root / "memory" / "approvals" / "pending"


def _resolved_dir(root: Path) -> Path:
    return root / "memory" / "approvals" / "resolved"


def _load_pending(root: Path) -> list[dict]:
    d = _pending_dir(root)
    if not d.is_dir():
        return []
    out = []
    for path in sorted(d.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        if data.get("action") != "agent_prompt_fix":
            continue
        data["_path"] = str(path)
        out.append(data)
    return out


def _rule_id_from_record(rec: dict) -> str:
    text = str(rec.get("request_text") or "")
    rid = ""
    if "rule_id=" in text:
        rid = text.split("rule_id=", 1)[1].split("|", 1)[0].strip()
    hint = ""
    if "rule_hint=" in text:
        hint = text.split("rule_hint=", 1)[1].split("|", 1)[0].strip()
    # Old pendings stored free-text as rule_id=... — treat as legacy alias key.
    return resolve_stable_rule_id(
        rule_id=rid,
        rule_hint=hint or rid,
        allow_hint_alias=True,
    )


def _evidence_from_record(rec: dict) -> str:
    text = str(rec.get("request_text") or "")
    if "evidence_id=" in text:
        return text.split("evidence_id=", 1)[1].split("|", 1)[0].strip()
    return str(rec.get("id") or "")


def migrate_asked_keys(state: dict) -> dict[str, list[str]]:
    """Rewrite state['asked'] keys through legacy alias map. Returns merge log."""
    asked = dict(state.get("asked") or {})
    merged: dict[str, dict] = {}
    log: dict[str, list[str]] = defaultdict(list)
    for old_key, rec in asked.items():
        stable = resolve_stable_rule_id(
            rule_id=old_key,
            rule_hint=old_key,
            allow_hint_alias=True,
        )
        log[stable].append(old_key)
        prev = merged.get(stable) or {}
        eids = list(prev.get("evidence_ids") or [])
        for eid in rec.get("evidence_ids") or []:
            if eid and eid not in eids:
                eids.append(eid)
        status = str(prev.get("status") or rec.get("status") or "asked")
        if str(rec.get("status") or "").lower() in {"rejected", "dismissed"}:
            status = "rejected"
        # Prefer newer timestamp
        at = str(rec.get("at") or "")
        prev_at = str(prev.get("at") or "")
        use_rec = rec if at >= prev_at else prev or rec
        merged[stable] = {
            **use_rec,
            "evidence_ids": eids[-40:],
            "status": status,
            "legacy_keys": log[stable],
        }
    state["asked"] = merged
    return dict(log)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Write plans + move pendings")
    ap.add_argument(
        "--apply-singles-telegram",
        action="store_true",
        help="Also open Telegram approvals for single-occurrence new rule_ids",
    )
    ap.add_argument(
        "--root",
        default="",
        help="Workspace root (default ASIAPOWER_ROOT / repo root)",
    )
    args = ap.parse_args()
    root = Path(args.root).expanduser().resolve() if args.root else workspace_root()

    pending = _load_pending(root)
    state = load_escalation_state(root)
    alias_log = migrate_asked_keys(state)

    by_rule: dict[str, list[dict]] = defaultdict(list)
    for rec in pending:
        rid = _rule_id_from_record(rec)
        rec["_stable_rule_id"] = rid
        by_rule[rid].append(rec)

    report = {
        "at": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "pending_total": len(pending),
        "distinct_rule_ids": len(by_rule),
        "alias_merge": {k: v for k, v in alias_log.items() if len(v) > 1},
        "groups": {},
        "plans": [],
        "telegram": [],
        "moved": [],
        "apply": bool(args.apply),
    }

    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    unc = unclassified_id()

    for rid, items in sorted(by_rule.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        eids = [_evidence_from_record(i) for i in items]
        report["groups"][rid] = {
            "count": len(items),
            "approval_ids": [i.get("id") for i in items],
            "evidence_ids": eids,
            "rejected": is_rejected(state, rid),
            "previously_asked": was_previously_asked(state, rid),
        }
        if is_rejected(state, rid):
            continue

        should_plan = len(items) >= 2 or was_previously_asked(state, rid)
        if rid == unc:
            should_plan = False  # never auto-dispatch unclassified

        if should_plan:
            item = {
                "rule_id": rid,
                "confidence": "high",
                "evidence_id": eids[0] if eids else "",
                "all_evidence_ids": eids,
                "repeat_count": len(items),
                "distinct_count": len(set(eids)),
                "reason": f"pending backlog migration ({len(items)} tickets)",
                "rule_hint": rid,
                "customer_excerpt": str(items[0].get("request_text") or "")[:160],
            }
            recurrence = int((state.get("asked") or {}).get(rid, {}).get("recurrence") or 1)
            if was_previously_asked(state, rid):
                recurrence = max(recurrence, 1) + 1
            record = {
                "id": f"MIGRATE-{rid[:40]}-{day}",
                "action": "agent_prompt_fix",
                "agent": "sales_coach",
                "why": f"Coach 积压清理自动派工 {rid}（合并 {len(items)} 张 pending，第 {recurrence} 次）",
                "request_text": build_approval_request_text(item)
                + f" | recurrence={recurrence} | historical_evidence_ids={', '.join(eids)[:240]}",
                "status": "auto_dispatched",
            }
            report["groups"][rid]["action"] = "write_plan"
            if args.apply:
                path = write_coach_fix_plan(record, root=root)
                mark_asked(
                    state,
                    rid,
                    approval_id=str(record["id"]),
                    evidence_ids=eids,
                    status="auto_dispatched",
                    plan_path=str(path),
                    recurrence=recurrence,
                )
                report["plans"].append(str(path))
                for rec in items:
                    _archive_pending(rec, root, merged_into=str(path))
                    report["moved"].append(rec.get("id"))
            else:
                report["plans"].append(f"(dry-run) coach-fix-{rid}-{day}.md")
            continue

        # Singles: keep for one Telegram ask (optional)
        report["groups"][rid]["action"] = "telegram_once" if args.apply_singles_telegram else "keep_or_digest"
        if args.apply and args.apply_singles_telegram and rid != unc:
            from coo_core.approval_gate import request_and_notify

            item = {
                "rule_id": rid,
                "confidence": "high",
                "evidence_id": eids[0] if eids else "",
                "repeat_count": 1,
                "distinct_count": 1,
                "reason": "pending backlog single — ask CEO once",
                "rule_hint": rid,
            }
            rec = request_and_notify(
                "agent_prompt_fix",
                why=f"Coach 积压清理：新问题 {rid}（仅 1 张 pending）",
                request_text=build_approval_request_text(item),
                agent="sales_coach",
            )
            mark_asked(
                state,
                rid,
                approval_id=str(rec.get("id") or ""),
                evidence_ids=eids,
                status="asked",
                recurrence=1,
            )
            report["telegram"].append(rec.get("id"))
            for old in items:
                _archive_pending(old, root, merged_into=f"telegram:{rec.get('id')}")
                report["moved"].append(old.get("id"))

    if args.apply:
        save_escalation_state(state, root)

    out_dir = coach_memory_dir(root)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"pending-migration-{day}.json"
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "ok": True,
        "apply": args.apply,
        "pending_total": report["pending_total"],
        "distinct_rule_ids": report["distinct_rule_ids"],
        "plans": len(report["plans"]),
        "report": str(out_path),
        "top_groups": [
            {"rule_id": k, **{kk: vv for kk, vv in v.items() if kk in ("count", "action")}}
            for k, v in sorted(report["groups"].items(), key=lambda kv: -kv[1]["count"])[:15]
        ],
    }, ensure_ascii=False, indent=2))
    return 0


def _archive_pending(rec: dict, root: Path, *, merged_into: str) -> None:
    src = Path(rec["_path"])
    dest_dir = _resolved_dir(root)
    dest_dir.mkdir(parents=True, exist_ok=True)
    data = {k: v for k, v in rec.items() if not k.startswith("_")}
    data["status"] = "merged"
    data["merged_into"] = merged_into
    data["resolved_at"] = datetime.now(timezone.utc).isoformat()
    dest = dest_dir / src.name
    dest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    try:
        src.unlink()
    except FileNotFoundError:
        pass


if __name__ == "__main__":
    raise SystemExit(main())
