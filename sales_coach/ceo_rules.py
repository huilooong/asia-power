"""CEO permanent rules — why modified, not how many times."""

from __future__ import annotations

import re
from typing import Any

from sales_coach.config import ceo_rules_path
from sales_coach.sources import load_json, save_json

# Map revision signals → permanent sales rules
_RULE_PATTERNS: list[tuple[re.Pattern[str], str, str]] = [
    (
        re.compile(r"库存|in stock|现货|promise|有货", re.I),
        "no_promise_inventory",
        "禁止承诺库存；只能说正在核实或已核实结果。",
    ),
    (
        re.compile(r"vin|车架", re.I),
        "ask_vin_before_commit",
        "发动机询盘在承诺适配/报价前应询问 VIN。",
    ),
    (
        re.compile(r"price|quote|报价|fob|cif", re.I),
        "quote_with_incoterms",
        "报价必须写清 Incoterms（FOB/CIF）与单位，避免模糊数字。",
    ),
    (
        re.compile(r"附件|accessory|gearbox|ecu", re.I),
        "confirm_accessories",
        "半截/总成报价前确认附件范围。",
    ),
    (
        re.compile(r"保证|guarantee|绝对", re.I),
        "no_absolute_guarantee",
        "禁止绝对化承诺；用可核实表述。",
    ),
]


def extract_ceo_rules_from_drafts(drafts: list[dict[str, Any]]) -> list[dict[str, str]]:
    found: list[dict[str, str]] = []
    seen: set[str] = set()
    for d in drafts:
        note = str(d.get("revision_note") or "").strip()
        status = str(d.get("status") or "")
        if status not in {"revised", "rejected"} and not note:
            continue
        blob = "\n".join(
            [
                note,
                str(d.get("internal_analysis_zh") or ""),
                str(d.get("risk_reason") or ""),
            ]
        )
        for cre, rule_id, text in _RULE_PATTERNS:
            if cre.search(blob) or cre.search(note):
                if rule_id in seen:
                    continue
                seen.add(rule_id)
                found.append(
                    {
                        "rule_id": rule_id,
                        "rule": text,
                        "why": note[:200] or f"CEO {status} on {d.get('draft_id')}",
                        "source_draft": str(d.get("draft_id") or ""),
                    }
                )
        # If CEO revised but no pattern matched, keep a generic why
        if note and not any(r["source_draft"] == d.get("draft_id") for r in found):
            rid = f"custom_{d.get('draft_id', 'x')[-8:]}"
            if rid not in seen:
                seen.add(rid)
                found.append(
                    {
                        "rule_id": rid,
                        "rule": f"CEO 改稿要点：{note[:160]}",
                        "why": note[:200],
                        "source_draft": str(d.get("draft_id") or ""),
                    }
                )
    return found


def merge_permanent_rules(new_rules: list[dict[str, str]], root=None) -> list[dict[str, Any]]:
    path = ceo_rules_path(root)
    existing = load_json(path, default={"rules": []}) or {"rules": []}
    rules = list(existing.get("rules") or [])
    by_id = {r.get("rule_id"): r for r in rules if isinstance(r, dict)}
    for nr in new_rules:
        rid = nr["rule_id"]
        if rid in by_id:
            by_id[rid]["last_seen_why"] = nr.get("why")
            by_id[rid]["hit_count"] = int(by_id[rid].get("hit_count") or 1) + 1
        else:
            by_id[rid] = {
                **nr,
                "hit_count": 1,
                "active": True,
            }
    merged = list(by_id.values())
    save_json(path, {"rules": merged})
    return merged


def check_rule_violations(turns: list[dict[str, Any]], rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Did today repeat a permanent CEO rule violation?"""
    violations: list[dict[str, Any]] = []
    for rule in rules:
        if not rule.get("active", True):
            continue
        rid = rule.get("rule_id")
        for t in turns:
            dec = t.get("decisions") or {}
            ctx = t.get("context") or {}
            bad = False
            if rid == "no_promise_inventory" and dec.get("promise_inventory"):
                bad = True
            if rid == "ask_vin_before_commit" and ctx.get("quoted_before_vin"):
                bad = True
            if rid == "confirm_accessories" and ctx.get("engine_enquiry") and not dec.get("confirm_accessory"):
                # soft: only flag if CEO rule exists and engine enquiry with quote
                if dec.get("quote_now"):
                    bad = True
            if rid == "no_absolute_guarantee" and not dec.get("build_trust"):
                bad = True
            if bad:
                violations.append(
                    {
                        "rule_id": rid,
                        "rule": rule.get("rule"),
                        "case": t.get("customer_excerpt") or "",
                        "draft_id": (t.get("meta") or {}).get("draft_id"),
                    }
                )
                break  # one example per rule per day
    return violations
