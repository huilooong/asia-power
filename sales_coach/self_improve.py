"""Turn loading + Self-Improve orchestration."""

from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from sales_coach import config
from sales_coach.detectors import classify_customer_intent, run_all_detectors
from sales_coach.evidence import turns_for_day
from sales_coach.modules import LESSON_STATUSES
from sales_coach.regression_rules import REGRESSION_RULES, match_issues_to_regression
from sales_coach.sources import load_json, parse_day, save_json


def evidence_turn_as_detector_turn(row: dict[str, Any]) -> dict[str, Any]:
    """Adapt canonical Evidence schema to the detector's compact turn schema."""
    customer = row.get("customer") or {}
    reply_obj = row.get("reply") or {}
    decision = row.get("decision") or {}
    commercial = row.get("commercial_decision") or {}
    truth_guard = row.get("truth_guard") or {}
    flags = decision.get("flags") or {}
    evidence_items = commercial.get("evidence") or []
    evidence_types = {
        str(item.get("type") or "")
        for item in evidence_items
        if isinstance(item, dict)
    }
    inventory_matches = commercial.get("inventory_matches") or []
    inbound = str(customer.get("message") or "")
    reply = str(reply_obj.get("text") or row.get("outbound_reply") or "")
    evidence = {
        "supplier_query": bool(
            evidence_types & {"supplier_query", "supplier_result", "supplier_match"}
        ),
        "inventory_record": bool(
            inventory_matches
            or evidence_types & {"inventory_record", "inventory_match", "stock_record"}
        ),
        "approved_quote": bool(
            flags.get("quote_now")
            or evidence_types & {"approved_quote", "confirmed_quote", "team_quote"}
        ),
        "vin_decode": bool(
            flags.get("vin_enriched")
            or evidence_types & {"vin_decode", "verified_vin", "verified_vehicle"}
        ),
        "logistics_quote": bool(
            evidence_types & {"logistics_quote", "shipping_quote", "confirmed_delivery"}
        ),
        "policy_approval": bool(
            evidence_types & {"policy_approval", "ceo_approval"}
            or (row.get("ceo") or {}).get("modified")
        ),
    }
    return {
        "source": "evidence_whatsapp",
        "at": row.get("at"),
        "inbound": inbound,
        "reply": reply,
        "intent": customer.get("intent") or classify_customer_intent(inbound),
        "evidence": evidence,
        "evidence_id": row.get("evidence_id"),
        "customer_id": customer.get("customer_id"),
        "wamid_out": reply_obj.get("outbound_wamid"),
        "reason_code": truth_guard.get("reason_code") or decision.get("reason_code"),
        "risk_blocked": truth_guard.get("risk_blocked"),
    }


def load_evidence_turns_for_day(day: date, root: Path | None = None) -> list[dict[str, Any]]:
    return [
        evidence_turn_as_detector_turn(row)
        for row in turns_for_day(day.isoformat(), root=root)
    ]


def drafts_as_turns(drafts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for d in drafts:
        inbound = str(d.get("original_message") or "")
        reply = str(d.get("customer_reply_draft") or "")
        if not reply:
            continue
        evidence = {
            "supplier_query": bool(d.get("supplier_query_evidence")),
            "inventory_record": bool(
                (d.get("inventory_policy") == "allow_available")
                or d.get("inventory_hit")
                or d.get("matched_inventory")
            ),
            "approved_quote": bool(d.get("approved_quote")),
            "vin_decode": bool(d.get("vin_decode_ok")),
            "logistics_quote": bool(d.get("logistics_quote")),
            "policy_approval": bool(d.get("status") in {"approved", "sent"}),
        }
        out.append(
            {
                "source": "draft_queue",
                "at": d.get("created_at") or d.get("updated_at"),
                "inbound": inbound,
                "reply": reply,
                "draft_id": d.get("draft_id") or d.get("id"),
                "intent": classify_customer_intent(inbound),
                "evidence": evidence,
            }
        )
    return out


def _issue_id(module: str, rule_id: str, inbound: str, reply: str) -> str:
    h = hashlib.sha256(f"{module}|{rule_id}|{inbound[:80]}|{reply[:120]}".encode()).hexdigest()[:10]
    return f"{rule_id}-{h}"


def analyze_turns(turns: list[dict[str, Any]]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    for turn in turns:
        found = run_all_detectors(
            inbound=str(turn.get("inbound") or ""),
            reply=str(turn.get("reply") or ""),
            evidence=turn.get("evidence") or {},
        )
        for issue in found:
            issue["issue_id"] = _issue_id(
                str(issue.get("module")),
                str(issue.get("rule_id")),
                str(turn.get("inbound") or ""),
                str(turn.get("reply") or ""),
            )
            issue["source"] = turn.get("source")
            issue["at"] = turn.get("at")
            issue["requires_ceo_approval"] = True
            issue["root_cause"] = issue.get("why")
            issues.append(issue)
    return issues


def proposals_dir(root: Path | None = None) -> Path:
    return config.coach_output_dir(root) / "proposals"


def write_proposals(day: date, issues: list[dict[str, Any]], root: Path | None = None) -> Path:
    path = proposals_dir(root) / f"{day.isoformat()}.json"
    payload = {
        "day": day.isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(issues),
        "proposals": [
            {
                "issue_id": i.get("issue_id"),
                "severity": i.get("severity"),
                "module": i.get("module"),
                "evidence": [
                    {"inbound": i.get("inbound"), "reply": i.get("reply"), "at": i.get("at"), "source": i.get("source")}
                ],
                "root_cause": i.get("root_cause") or i.get("why"),
                "recommended_change": i.get("recommended_change"),
                "recommended_tests": i.get("recommended_tests") or [],
                "requires_ceo_approval": True,
                "rule_id": i.get("rule_id"),
                "title": i.get("title"),
                "expected_behavior": i.get("expected_behavior"),
            }
            for i in issues
        ],
    }
    save_json(path, payload)
    return path


def self_improve_lessons_path(root: Path | None = None) -> Path:
    return config.coach_memory_dir(root) / "self_improve_lessons.json"


def load_self_improve_lessons(root: Path | None = None) -> dict[str, Any]:
    data = load_json(self_improve_lessons_path(root), default=None)
    if not isinstance(data, dict):
        return {"lessons": [], "updated_at": None}
    data.setdefault("lessons", [])
    return data


def upsert_lessons_from_issues(
    *,
    day: date,
    issues: list[dict[str, Any]],
    root: Path | None = None,
) -> dict[str, Any]:
    """Write Progress Memory lessons with NEW/TRAINING/… status (no auto Prompt change)."""
    store = load_self_improve_lessons(root)
    by_rule = {str(x.get("rule_id")): x for x in store.get("lessons") or [] if x.get("rule_id")}

    # Mark regressions: graduated lesson whose rule_id fired again
    for issue in issues:
        rid = str(issue.get("rule_id") or "")
        if not rid:
            continue
        existing = by_rule.get(rid)
        if existing and existing.get("status") == "GRADUATED":
            existing["status"] = "REGRESSED"
            existing["regression_count"] = int(existing.get("regression_count") or 0) + 1
            existing["last_seen"] = day.isoformat()
            existing["consecutive_pass_days"] = 0
        elif existing:
            if existing.get("status") in {"NEW", "TRAINING", "VERIFIED", "REGRESSED"}:
                existing["status"] = "TRAINING"
            existing["last_seen"] = day.isoformat()
            existing["hit_count"] = int(existing.get("hit_count") or 0) + 1
        else:
            lesson = {
                "lesson_id": issue.get("issue_id"),
                "module": issue.get("module"),
                "skill": issue.get("rule_id"),
                "rule_id": rid,
                "discovered_at": day.isoformat(),
                "evidence": [{"inbound": issue.get("inbound"), "reply": issue.get("reply")}],
                "expected_behavior": issue.get("expected_behavior"),
                "verification_rule": rid,
                "status": "NEW",
                "consecutive_pass_days": 0,
                "regression_count": 0,
                "hit_count": 1,
                "title": issue.get("title"),
            }
            assert lesson["status"] in LESSON_STATUSES
            by_rule[rid] = lesson

    store["lessons"] = list(by_rule.values())
    store["updated_at"] = datetime.now(timezone.utc).isoformat()
    save_json(self_improve_lessons_path(root), store)
    return store


def pick_top_lessons(issues: list[dict[str, Any]], *, limit: int = 3) -> list[dict[str, Any]]:
    sev_rank = {"P0": 0, "P1": 1, "P2": 2}
    # Prefer unique rule_ids
    seen: set[str] = set()
    ranked = sorted(
        issues,
        key=lambda i: (sev_rank.get(str(i.get("severity")), 9), str(i.get("module"))),
    )
    out: list[dict[str, Any]] = []
    for issue in ranked:
        rid = str(issue.get("rule_id") or issue.get("issue_id"))
        if rid in seen:
            continue
        seen.add(rid)
        out.append(issue)
        if len(out) >= limit:
            break
    return out


def sample_correct_reply(rule_id: str) -> str:
    samples = {
        "price_no_advance": (
            "Yes — we can help with pricing.\n\n"
            "Please send VIN or model + year + engine code, what you need, qty, and port.\n\n"
            "www.asia-power.com"
        ),
        "claim_identified_suppliers": (
            "Thanks — noted.\n\n"
            "We can check through our verified China-based supplier network.\n"
            "Please share VIN or model/year/engine code so we verify the exact one."
        ),
        "claim_ready_stock": (
            "We will check availability after confirming the exact engine code / VIN."
        ),
        "claim_shipping_sla": (
            "Shipping time depends on the exact unit and destination — "
            "share VIN/model + port and we will check."
        ),
        "whatsapp_email_tone": "Hi — yes we can help. What engine code or VIN?",
        "too_many_questions": (
            "Got it. Please send VIN or model + year + engine code first."
        ),
        "leak_internal_tag": "Hi",
        "website_spam": "Hi — AsiaPower here. What do you need?",
    }
    return samples.get(rule_id, "Acknowledge → ask minimal next fact → no unsupported claims.")


def render_self_improve_markdown(
    *,
    day: date,
    issues: list[dict[str, Any]],
    top: list[dict[str, Any]],
    recurring: list[str],
    lessons_store: dict[str, Any],
    proposals_path: Path,
    progress_notes: list[str],
) -> str:
    lines: list[str] = [
        f"# Sales Coach Self-Improve — {day.isoformat()}",
        "",
        "目标：让子敬每天都比昨天更专业（不是 BI 日报）。",
        "",
        "## 1. Today’s Progress",
        "",
    ]
    if progress_notes:
        for n in progress_notes:
            lines.append(f"- {n}")
    else:
        lines.append("- 无证实进步（需对比昨日同规则再犯率）。")

    lines += ["", "## 2. Today’s Top 3 Lessons", ""]
    if not top:
        lines.append("- 今日检测器未发现高优问题（或无样本）。")
    for i, lesson in enumerate(top, 1):
        lines += [
            f"### Lesson {i}: {lesson.get('title')} ({lesson.get('module')} / {lesson.get('severity')})",
            "",
            f"- **真实客户消息：** {lesson.get('inbound')!r}",
            f"- **子敬实际回复：** {lesson.get('reply')!r}",
            f"- **问题：** {lesson.get('why')}",
            f"- **所属模块：** {lesson.get('module')}",
            f"- **为什么错：** {lesson.get('root_cause') or lesson.get('why')}",
            f"- **正确销售动作：** {lesson.get('expected_behavior')}",
            f"- **推荐回复示例：** {sample_correct_reply(str(lesson.get('rule_id')))!r}",
            f"- **明天如何验证：** 规则 `{lesson.get('rule_id')}` 不得再出现在 outbound。",
            f"- **建议改动：** {lesson.get('recommended_change')}",
            "",
        ]

    lines += ["## 3. Recurring Problems", ""]
    if recurring:
        for rid in recurring:
            lines.append(f"- `{rid}` — 昨日已教 / 已知回归规则，今日再次触发（最高优先级）")
    else:
        lines.append("- 无（相对 Progress Memory 中已有 lesson）再犯记录。")

    lines += ["", "## 4. Graduated Skills", ""]
    grads = [x for x in (lessons_store.get("lessons") or []) if x.get("status") == "GRADUATED"]
    if grads:
        for g in grads:
            lines.append(f"- {g.get('rule_id')} ({g.get('module')})")
    else:
        lines.append("- 尚无 GRADUATED（需连续验证通过）。")

    regs = [x for x in (lessons_store.get("lessons") or []) if x.get("status") == "REGRESSED"]
    if regs:
        lines += ["", "### Regressed", ""]
        for g in regs:
            lines.append(f"- {g.get('rule_id')} — 毕业后再犯，已重回 Tomorrow Focus")

    focus = [f"{x.get('module')}: {x.get('title')}" for x in top[:3]]
    lines += ["", "## 5. Tomorrow Focus", ""]
    if focus:
        for f in focus:
            lines.append(f"- {f}")
    else:
        lines.append("- 保持监测 9 条回归规则。")

    lines += [
        "",
        "## 6. Issue inventory (today)",
        "",
        f"- Total issues: **{len(issues)}**",
        f"- Regression rules defined: **{len(REGRESSION_RULES)}**",
        f"- Proposals JSON: `{proposals_path}`",
        "",
        "## Guardrails",
        "",
        "- 不自动修改 Prompt / Truth Guard / 生产部署",
        "- 只产出可审批建议（requires_ceo_approval=true）",
        "",
    ]
    return "\n".join(lines) + "\n"


def run_self_improve(
    day: str | date | None = None,
    *,
    root: Path | None = None,
    write: bool = True,
    extra_turns: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    root = root or config.workspace_root()
    d = parse_day(day)

    turns = load_evidence_turns_for_day(d, root)
    if extra_turns:
        turns.extend(extra_turns)

    prev = load_self_improve_lessons(root)
    prev_rules = {
        str(x.get("rule_id"))
        for x in (prev.get("lessons") or [])
        if x.get("status") in {"NEW", "TRAINING", "VERIFIED", "GRADUATED", "REGRESSED"}
    }

    issues = analyze_turns(turns)
    top = pick_top_lessons(issues, limit=3)
    recurring = [rid for rid in match_issues_to_regression(issues) if rid in prev_rules or True]
    # Recurring = known regression rule fired OR lesson already in memory
    recurring = sorted(
        {
            rid
            for rid in match_issues_to_regression(issues)
            if rid in prev_rules or any(r["rule_id"] == rid for r in REGRESSION_RULES)
        }
    )

    lessons_store = upsert_lessons_from_issues(day=d, issues=issues, root=root) if write else prev
    proposals_path = write_proposals(d, issues, root) if write else proposals_dir(root) / f"{d.isoformat()}.json"

    # Progress notes: greetings now Hi; price advance rule exists — evidence-based only
    progress_notes: list[str] = []
    if any(t.get("inbound", "").lower() in {"hello", "hi"} and t.get("reply", "").strip() == "Hi" for t in turns):
        progress_notes.append("Greeting：部分 Hello/Hi 已回短 `Hi`（有样本）。")
    if any(
        "we can help with pricing" in (t.get("reply") or "").lower()
        for t in turns
        if "how much" in (t.get("inbound") or "").lower() or "quotation" in (t.get("inbound") or "").lower()
    ):
        progress_notes.append("询价推进：已出现 pricing + VIN 索取话术样本。")
    if not progress_notes:
        progress_notes = []

    md = render_self_improve_markdown(
        day=d,
        issues=issues,
        top=top,
        recurring=recurring,
        lessons_store=lessons_store,
        proposals_path=proposals_path,
        progress_notes=progress_notes,
    )

    report_path = None
    if write:
        out = config.coach_output_dir(root) / f"{d.isoformat()}-self-improve.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(md, encoding="utf-8")
        report_path = out

    return {
        "day": d.isoformat(),
        "turns": len(turns),
        "issues": issues,
        "top_lessons": top,
        "recurring": recurring,
        "proposals_path": str(proposals_path),
        "report_path": str(report_path) if report_path else None,
        "markdown": md,
        "module_counts": _count_modules(issues),
    }


def _count_modules(issues: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for i in issues:
        m = str(i.get("module") or "UNKNOWN")
        counts[m] = counts.get(m, 0) + 1
    return counts
