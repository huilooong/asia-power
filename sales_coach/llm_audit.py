"""LLM conformance audit — read real Evidence turns against LIVE-RULES.md.

Coach Read Only:
- Judges whether replies match *existing* rules (evidence + reason).
- Does NOT invent new rules, edit LIVE-RULES.md, or trigger production changes.
- Parallel to structured rule_proposals.scan_patterns (silence/ended stats).
"""

from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from sales_coach.config import COACH_READ_ONLY, coach_memory_dir, coach_output_dir, workspace_root
from sales_coach.evidence import load_merged_turns
from sales_coach.rule_catalog import catalog_prompt_block, resolve_stable_rule_id, unclassified_id

assert COACH_READ_ONLY is True

LIVE_RULES_REL = Path("docs/zijing-training/LIVE-RULES.md")
GOOD_EXAMPLES_DIR_REL = Path("docs/zijing-training/good-examples")
CEO_EXAMPLES_REL = Path("data/knowledge-base/ceo-real-reply-examples-2026-07-14.md")

_DEFAULT_WINDOW_DAYS = 1  # cost control: only fresh Evidence by default
_MAX_CONVOS_PER_RUN = 40
_MAX_TURNS_PER_CONVO = 24
_AUDIT_STATE_NAME = "llm_audit_state.json"

AuditFn = Callable[[list[dict[str, Any]], str], dict[str, Any]]


def live_rules_path(root: Path | None = None) -> Path:
    return (root or workspace_root()) / LIVE_RULES_REL


def good_examples_dir(root: Path | None = None) -> Path:
    return (root or workspace_root()) / GOOD_EXAMPLES_DIR_REL


def load_live_rules_text(root: Path | None = None) -> str:
    path = live_rules_path(root)
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


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


def _customer_key(turn: dict[str, Any]) -> str:
    cust = turn.get("customer") or {}
    return str(
        cust.get("customer_id")
        or cust.get("conversation_id")
        or turn.get("channel")
        or "unknown"
    )


def group_turns_by_customer(turns: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for t in turns:
        buckets[_customer_key(t)].append(t)
    for key in buckets:
        buckets[key].sort(key=lambda t: str(t.get("at") or ""))
    return dict(buckets)


def _compact_turns_for_prompt(turns: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for t in turns[-_MAX_TURNS_PER_CONVO:]:
        out.append(
            {
                "evidence_id": t.get("evidence_id"),
                "at": t.get("at"),
                "customer_message": ((t.get("customer") or {}).get("message") or "")[:800],
                "reply_text": ((t.get("reply") or {}).get("text") or "")[:1200],
                "next_action": ((t.get("decision") or {}).get("next_action") or ""),
            }
        )
    return out


def _extract_json_object(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        return {"violations": [], "good_examples": [], "parse_error": "empty"}
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        return {"violations": [], "good_examples": [], "parse_error": "no_json"}
    try:
        data = json.loads(m.group(0))
        return data if isinstance(data, dict) else {"violations": [], "good_examples": []}
    except json.JSONDecodeError:
        return {"violations": [], "good_examples": [], "parse_error": "bad_json"}


def _system_prompt(rules_text: str) -> str:
    catalog_block = catalog_prompt_block()
    return (
        "You are AsiaPower Sales Coach (READ ONLY auditor).\n"
        "Your ONLY job: check whether each bot reply conforms to the EXISTING rules below.\n"
        "Do NOT invent new standards. Do NOT rewrite rules. Do NOT suggest new rule text.\n"
        "If unsure whether something violates a written rule, omit it (do not guess).\n"
        "Also identify strong GOOD examples that clearly follow the rules (e.g. VIN confirmed + pin ask).\n\n"
        "IMPORTANT — do not over-generalize listed phrases:\n"
        "Concrete phrases/examples listed in LIVE-RULES are a floor, not a license to widen the rule. "
        "Example: forbidding `Hi there!` / `Great news!` / `I'd be happy to help` / every-sentence "
        "`Hello sir` does NOT mean forbidding every Hi/Hello opening. "
        "Flag only an exact match to a listed phrase or a clear near-paraphrase of that same phrase "
        "(e.g. `Hi there.` ≈ `Hi there!`). "
        "Bare short greetings alone (`Hi!`, `Hello!`, `Hi,`, `Hey!`) are NOT violations of that ban.\n"
        "Apply the same discipline to other rules: do not invent stricter versions than the written text.\n\n"
        "RULE_ID IS MANDATORY FOR IDENTITY:\n"
        f"- Every violation MUST include rule_id chosen from the catalog (or `{unclassified_id()}`).\n"
        "- Never invent a new rule_id string. Never put free-text Chinese/English into rule_id.\n"
        "- rule_hint is human-readable display only; it is NOT used for dedupe/cooldown.\n\n"
        f"{catalog_block}\n\n"
        "Return ONLY valid JSON with this shape:\n"
        "{\n"
        '  "violations": [{"evidence_id":"...","rule_id":"<from catalog>","rule_hint":"...","reason":"...","confidence":"high|medium|low"}],\n'
        '  "good_examples": [{"evidence_id":"...","why_good":"...","rule_id":"<from catalog or empty>","rule_hint":"..."}]\n'
        "}\n"
        "confidence high = clear written-rule breach with an explicit rule quote; "
        "medium = likely but still must cite a real rule line; low = omit.\n"
        "Only include high/medium. Prefer fewer accurate findings. "
        "If you would write 'omitted' / 'no violation' / 'borderline', do not include that item at all.\n"
        "Do not invent rules that are not in LIVE-RULES.md "
        "(e.g. do not require a website link on every price confirm unless the rules say so).\n"
        "At most 3 good_examples per conversation.\n\n"
        "===== LIVE-RULES.md =====\n"
        f"{rules_text}\n"
        "===== END RULES =====\n"
    )


_BANNED_OPENING_RE = re.compile(
    r"\bhi\s+there\b|\bgreat\s+news\b|i'?d be happy to help|i would be happy to help|\bhello\s+sir\b",
    re.I,
)
_BARE_GREETING_CLAIM_RE = re.compile(
    r"\bhi!\b|\bhello!\b|\bhey!\b|\bhey there\b|"
    r"starts with ['\"]?(?:hi|hello|hey)[!.,]?['\"]?|"
    r"uses ['\"]?(?:hi|hello|hey)[!.,]?['\"]?|"
    r"opening with ['\"]?(?:hi|hello|hey)",
    re.I,
)


def _is_overbroad_banned_opening_violation(v: dict[str, Any], turns: list[dict[str, Any]]) -> bool:
    """Drop false positives that treat bare Hi!/Hello! as the banned-opening rule."""
    rid = str(v.get("rule_id") or "")
    hint = str(v.get("rule_hint") or "")
    reason = str(v.get("reason") or "")
    blob = f"{rid}\n{hint}\n{reason}"
    about_banned_openings = rid == "avoid_banned_opening_phrases" or bool(
        re.search(
            r"禁止开场|banned opening|prohibited opening|forbidden opening|"
            r"disallowed as (an )?opening|forbidden as an opening|"
            r"not allowed as (a )?greeting|prohibiting greetings|"
            r"hi there|great news|hello sir|i'?d be happy to help",
            blob,
            re.I,
        )
    )
    if not about_banned_openings:
        return False

    eid = str(v.get("evidence_id") or "")
    reply = ""
    for t in turns:
        if str(t.get("evidence_id") or "") == eid:
            reply = str(((t.get("reply") or {}).get("text") or ""))
            break
    if reply and _BANNED_OPENING_RE.search(reply):
        return False  # real listed phrase in the actual reply — keep
    return True


def audit_conversation(
    turns: list[dict[str, Any]],
    rules_text: str,
    *,
    llm_call: AuditFn | None = None,
) -> dict[str, Any]:
    """Audit one customer thread. llm_call optional for tests (inject fake judge)."""
    compact = _compact_turns_for_prompt(turns)
    if not compact:
        return {"violations": [], "good_examples": [], "turns_audited": 0}

    if llm_call is not None:
        result = llm_call(compact, rules_text)
    else:
        result = _call_llm_judge(compact, rules_text)

    violations = []
    for v in result.get("violations") or []:
        if not isinstance(v, dict):
            continue
        conf = str(v.get("confidence") or "medium").lower()
        if conf not in ("high", "medium"):
            continue
        if not v.get("evidence_id") or not v.get("reason"):
            continue
        reason = str(v.get("reason") or "")
        # Drop self-negating / hedged judgments the model sometimes still emits.
        low = reason.lower()
        if any(
            x in low
            for x in (
                "so omitted",
                "no violation",
                "not a violation",
                "borderline",
                "likely low confidence",
                "hence omitted",
            )
        ):
            continue
        stable_id = resolve_stable_rule_id(
            rule_id=str(v.get("rule_id") or ""),
            rule_hint=str(v.get("rule_hint") or ""),
            allow_hint_alias=False,
        )
        candidate = {
            "evidence_id": str(v.get("evidence_id")),
            "rule_id": stable_id,
            "rule_hint": str(v.get("rule_hint") or "")[:200],
            "reason": reason[:600],
            "confidence": conf,
        }
        if _is_overbroad_banned_opening_violation(candidate, turns):
            continue
        violations.append(candidate)

    goods = []
    for g in result.get("good_examples") or []:
        if not isinstance(g, dict):
            continue
        if not g.get("evidence_id") or not g.get("why_good"):
            continue
        goods.append(
            {
                "evidence_id": str(g.get("evidence_id")),
                "why_good": str(g.get("why_good") or "")[:600],
                "rule_id": resolve_stable_rule_id(
                    rule_id=str(g.get("rule_id") or ""),
                    rule_hint=str(g.get("rule_hint") or ""),
                    allow_hint_alias=False,
                ),
                "rule_hint": str(g.get("rule_hint") or "")[:200],
            }
        )
    goods = goods[:3]  # cap per conversation — avoid flooding the example library

    return {
        "violations": violations,
        "good_examples": goods,
        "turns_audited": len(compact),
        "parse_error": result.get("parse_error"),
    }


def _call_llm_judge(compact_turns: list[dict[str, Any]], rules_text: str) -> dict[str, Any]:
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not api_key:
        return {"violations": [], "good_examples": [], "parse_error": "no_openai_key"}

    from openai import OpenAI
    from coo_core.dispatcher import call_openai
    from config.models import DEFAULT_MODEL

    model = (os.getenv("COACH_AUDIT_MODEL") or "").strip() or DEFAULT_MODEL
    client = OpenAI(api_key=api_key, timeout=90.0, max_retries=1)
    user = (
        "Audit this WhatsApp conversation (customer_message → reply_text pairs).\n"
        "JSON only.\n\n"
        + json.dumps(compact_turns, ensure_ascii=False, indent=2)
    )
    try:
        text = call_openai(client, model, _system_prompt(rules_text), user, knowledge_addon="\n")
    except Exception as exc:  # noqa: BLE001
        return {"violations": [], "good_examples": [], "parse_error": f"{type(exc).__name__}: {exc}"}
    return _extract_json_object(text)


def _audit_state_path(root: Path | None = None) -> Path:
    return coach_memory_dir(root) / _AUDIT_STATE_NAME


def _load_audit_state(root: Path | None = None) -> dict[str, Any]:
    path = _audit_state_path(root)
    if not path.is_file():
        return {"audited_evidence_ids": [], "runs": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {"audited_evidence_ids": [], "runs": []}
    except (json.JSONDecodeError, OSError):
        return {"audited_evidence_ids": [], "runs": []}


def _save_audit_state(state: dict[str, Any], root: Path | None = None) -> None:
    path = _audit_state_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _lookup_turn(turns: list[dict[str, Any]], evidence_id: str) -> dict[str, Any] | None:
    for t in turns:
        if str(t.get("evidence_id") or "") == evidence_id:
            return t
    return None


def persist_good_examples(
    goods: list[dict[str, Any]],
    all_turns: list[dict[str, Any]],
    *,
    day: str,
    root: Path | None = None,
) -> list[str]:
    """Write good-example markdown files (aligned with zijing training examples)."""
    out_dir = good_examples_dir(root)
    out_dir.mkdir(parents=True, exist_ok=True)
    readme = out_dir / "README.md"
    if not readme.is_file():
        ceo_note = ""
        ceo_path = (root or workspace_root()) / CEO_EXAMPLES_REL
        if ceo_path.is_file():
            ceo_note = f"\nAlso see CEO voice corpus: `{CEO_EXAMPLES_REL}`.\n"
        readme.write_text(
            "# 子敬正例范本库（Coach LLM 沉淀）\n\n"
            "只存「对照 LIVE-RULES 表现好」的真实对话片段。\n"
            "Coach 不代写规则；这些例子给人审阅 / 训练用。\n"
            f"{ceo_note}\n"
            "格式：客户原话 → 子敬回复 → 为什么算好例子（对应哪条规则）。\n",
            encoding="utf-8",
        )

    written: list[str] = []
    for g in goods:
        eid = str(g.get("evidence_id") or "unknown")
        turn = _lookup_turn(all_turns, eid) or {}
        cust = ((turn.get("customer") or {}).get("message") or "").strip() or "(empty)"
        reply = ((turn.get("reply") or {}).get("text") or "").strip() or "(empty)"
        safe = re.sub(r"[^\w.\-+]+", "_", eid)[:80] or "unknown"
        path = out_dir / f"{day}-{safe}.md"
        body = (
            f"# Good Example — {day} — `{eid}`\n\n"
            f"## 客户原话\n\n```\n{cust[:2000]}\n```\n\n"
            f"## 子敬回复\n\n```\n{reply[:2000]}\n```\n\n"
            f"## 为什么算好例子\n\n"
            f"{g.get('why_good') or ''}\n\n"
            f"- 规则提示: {g.get('rule_hint') or '—'}\n"
            f"- 来源: Coach LLM conformance audit（只读，不改规则）\n"
        )
        path.write_text(body, encoding="utf-8")
        written.append(str(path))
    return written


def build_llm_audit_markdown(
    *,
    day: str,
    window_days: int,
    violations: list[dict[str, Any]],
    good_examples: list[dict[str, Any]],
    stats: dict[str, Any],
    all_turns: list[dict[str, Any]],
) -> str:
    skip_mode = stats.get("skip_audited", True)
    if skip_mode:
        window_note = f"过去 {window_days} 天（增量：跳过已审 evidence_id）"
    else:
        window_note = (
            f"过去 {window_days} 天（**FORCE**：忽略已审缓存，整窗重判 — "
            "`--force` / COACH_AUDIT_FORCE=1 / COACH_AUDIT_SKIP_AUDITED=0）"
        )
    lines = [
        f"# Coach LLM 对照 LIVE-RULES 审查 — {day}",
        "",
        "> Coach 只判断「是否符合已写好的规则」，给出证据。不代写规则、不改生产。",
        "",
        "## 覆盖与成本",
        "",
        f"- 时间窗: {window_note}",
        f"- 会话数(LLM 调用): {stats.get('llm_calls', 0)}",
        f"- turns 送审: {stats.get('turns_audited', 0)}",
        f"- 跳过已审 turns: {stats.get('skipped_already_audited', 0)}",
        f"- 模型: `{stats.get('model') or '—'}`",
        f"- 估算花费: {stats.get('cost_note') or '见模型单价 × 调用次数（本机未计费）'}",
        f"- parse/API 错误会话: {stats.get('error_conversations', 0)}",
        "",
        "## A. 违规（对照 LIVE-RULES）",
        "",
    ]
    if not violations:
        lines.append("本次未标记 high/medium 违规（或无新会话）。")
        lines.append("")
    else:
        for v in violations:
            turn = _lookup_turn(all_turns, v["evidence_id"]) or {}
            cust = str(((turn.get("customer") or {}).get("message") or ""))[:160]
            reply = str(((turn.get("reply") or {}).get("text") or ""))[:160]
            lines.append(
                f"### [{v['evidence_id']}] `{v.get('rule_id') or unclassified_id()}` "
                f"/ {v.get('rule_hint') or '?'} "
                f"（confidence={v.get('confidence')}）"
            )
            lines.append(f"- 客户:「{cust}」")
            lines.append(f"- 回复:「{reply}」")
            lines.append(f"- 原因: {v.get('reason')}")
            lines.append("")

    lines.extend(["## B. 好例子（正例沉淀）", ""])
    if not good_examples:
        lines.append("本次未沉淀正例。")
        lines.append("")
    else:
        for g in good_examples:
            lines.append(
                f"- [{g['evidence_id']}] {g.get('why_good')} "
                f"（规则提示: {g.get('rule_hint') or '—'}）"
            )
        lines.append("")
        lines.append(f"正例文件目录: `{GOOD_EXAMPLES_DIR_REL}/`")
        lines.append("")

    lines.extend(
        [
            "## 红线确认",
            "",
            "- 未修改 `LIVE-RULES.md`",
            "- 未自动改 bridge / prompt / Decision",
            "- 未把发现自动合并成「新规则建议」条文（给人决定）",
            "",
        ]
    )
    return "\n".join(lines)


def build_combined_rule_proposals_markdown(
    structured_md: str,
    llm_md: str,
) -> str:
    """Two clear sections — structured silence/ended patterns + LLM LIVE-RULES audit."""
    return (
        "# Coach 规则提案（双通道）\n\n"
        "> A = 结构化字段（沉默/终止）；B = LLM 读对话对照 LIVE-RULES。"
        "Coach 不代写规则。\n\n"
        "---\n\n"
        "## 通道 A — 结构化失败模式\n\n"
        + structured_md
        + "\n\n---\n\n"
        "## 通道 B — LLM 对照 LIVE-RULES\n\n"
        + llm_md
        + "\n"
    )


def run_llm_conformance_audit(
    *,
    channel: str = "whatsapp",
    root: Path | None = None,
    window_days: int = _DEFAULT_WINDOW_DAYS,
    max_conversations: int = _MAX_CONVOS_PER_RUN,
    write: bool = True,
    now: datetime | None = None,
    llm_call: AuditFn | None = None,
    skip_audited: bool = True,
    combine_with_structured: bool = True,
    report_suffix: str = "",
) -> dict[str, Any]:
    """Scan recent Evidence conversations with LLM vs LIVE-RULES; write reports only."""
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    day = now.strftime("%Y-%m-%d")
    suffix = (report_suffix or os.getenv("COACH_AUDIT_REPORT_SUFFIX") or "").strip()
    if suffix and not suffix.startswith("-"):
        suffix = f"-{suffix}"
    since = now - timedelta(days=window_days)

    rules_text = load_live_rules_text(root)
    if not rules_text.strip():
        return {
            "ok": False,
            "error": "LIVE-RULES.md missing",
            "day": day,
            "read_only": True,
        }

    all_turns = load_merged_turns(channel, root)
    window_turns = [t for t in all_turns if _within_window(t.get("at"), since)]

    state = _load_audit_state(root)
    audited_ids = set(str(x) for x in (state.get("audited_evidence_ids") or []))
    skipped = 0
    if skip_audited:
        fresh: list[dict[str, Any]] = []
        for t in window_turns:
            eid = str(t.get("evidence_id") or "")
            if eid and eid in audited_ids:
                skipped += 1
                continue
            fresh.append(t)
        window_turns = fresh

    by_customer = group_turns_by_customer(window_turns)
    # Prefer customers with more turns (richer context) but cap cost.
    ordered = sorted(by_customer.items(), key=lambda kv: -len(kv[1]))[:max_conversations]

    model = (os.getenv("COACH_AUDIT_MODEL") or "").strip() or os.getenv("DEFAULT_MODEL") or "gpt-4.1-mini"
    violations: list[dict[str, Any]] = []
    goods: list[dict[str, Any]] = []
    llm_calls = 0
    turns_audited = 0
    error_conversations = 0
    newly_audited: list[str] = []

    for _cust, turns in ordered:
        if not turns:
            continue
        # Injected llm_call gets compact turns via audit_conversation
        result = audit_conversation(turns, rules_text, llm_call=llm_call)
        llm_calls += 1
        turns_audited += int(result.get("turns_audited") or 0)
        if result.get("parse_error"):
            error_conversations += 1
        violations.extend(result.get("violations") or [])
        goods.extend(result.get("good_examples") or [])
        for t in turns:
            eid = str(t.get("evidence_id") or "")
            if eid:
                newly_audited.append(eid)

    stats = {
        "llm_calls": llm_calls,
        "turns_audited": turns_audited,
        "skipped_already_audited": skipped,
        "skip_audited": skip_audited,
        "model": model if llm_call is None else "injected",
        "error_conversations": error_conversations,
        "conversations_selected": len(ordered),
        "window_turns_available": len([t for t in all_turns if _within_window(t.get("at"), since)]),
        "cost_note": (
            f"~{llm_calls} chat completions (1 per customer thread). "
            "No $ meter in-process — check OpenAI usage dashboard."
        ),
    }

    markdown = build_llm_audit_markdown(
        day=day,
        window_days=window_days,
        violations=violations,
        good_examples=goods,
        stats=stats,
        all_turns=all_turns,
    )

    report_path: Path | None = None
    combined_path: Path | None = None
    good_paths: list[str] = []
    if write:
        out_dir = coach_output_dir(root)
        out_dir.mkdir(parents=True, exist_ok=True)
        report_path = out_dir / f"{day}-llm-audit{suffix}.md"
        report_path.write_text(markdown, encoding="utf-8")
        good_paths = persist_good_examples(goods, all_turns, day=day, root=root)

        if combine_with_structured:
            from sales_coach.rule_proposals import (
                build_rule_proposal_markdown,
                scan_patterns,
            )

            patterns = scan_patterns(channel=channel, root=root, now=now)
            structured = build_rule_proposal_markdown(patterns, window_days=7)
            combined = build_combined_rule_proposals_markdown(structured, markdown)
            combined_path = out_dir / f"{day}-rule-proposals{suffix}.md"
            combined_path.write_text(combined, encoding="utf-8")

        # State: remember audited ids (cap growth)
        audited_ids.update(newly_audited)
        state["audited_evidence_ids"] = sorted(audited_ids)[-5000:]
        runs = list(state.get("runs") or [])
        runs.append(
            {
                "at": now.isoformat(),
                "day": day,
                "llm_calls": llm_calls,
                "violations": len(violations),
                "good_examples": len(goods),
            }
        )
        state["runs"] = runs[-50:]
        _save_audit_state(state, root)

    return {
        "ok": True,
        "day": day,
        "violations": violations,
        "good_examples": goods,
        "stats": stats,
        "markdown": markdown,
        "report_path": str(report_path) if report_path else None,
        "combined_report_path": str(combined_path) if combined_path else None,
        "good_example_paths": good_paths,
        "read_only": True,
    }
