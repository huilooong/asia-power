"""Fixed regression rules for CEO-discovered issues (must auto-detect next time)."""

from __future__ import annotations

from typing import Any

from sales_coach.detectors import run_all_detectors

# The 9 issues CEO already found — must never require CEO to re-discover.
REGRESSION_RULES: list[dict[str, Any]] = [
    {
        "rule_id": "leak_memory_to_save",
        "module": "REPLY_FILTER",
        "severity": "P0",
        "description": "MEMORY_TO_SAVE leaked to WhatsApp",
        "match_rule_ids": ["leak_internal_tag"],
        "synthetic_inbound": "Hello",
        "synthetic_reply": "Hi\n\nMEMORY_TO_SAVE: category=customer | greeting",
    },
    {
        "rule_id": "leak_approval_request",
        "module": "REPLY_FILTER",
        "severity": "P0",
        "description": "APPROVAL_REQUEST leaked to WhatsApp",
        "match_rule_ids": ["leak_internal_tag"],
        "synthetic_inbound": "Need quote",
        "synthetic_reply": "Thanks\n\nAPPROVAL_REQUEST: please approve price",
    },
    {
        "rule_id": "price_no_advance",
        "module": "SALES_DECISION",
        "severity": "P0",
        "description": "Best price / quotation with no sales advance",
        "match_rule_ids": ["price_no_advance"],
        "synthetic_inbound": "Best price?",
        "synthetic_reply": "We cannot quote.",
    },
    {
        "rule_id": "claim_identified_suppliers",
        "module": "TRUTH_GUARD",
        "severity": "P0",
        "description": "Claimed suppliers found without query evidence",
        "match_rule_ids": ["claim_identified_suppliers"],
        "synthetic_inbound": "Need 2TR engine",
        "synthetic_reply": "We have identified verified suppliers within our platform network.",
    },
    {
        "rule_id": "claim_ready_stock",
        "module": "TRUTH_GUARD",
        "severity": "P0",
        "description": "Ready stock without inventory evidence",
        "match_rule_ids": ["claim_ready_stock"],
        "synthetic_inbound": "Do you have G4KD?",
        "synthetic_reply": "Yes, ready stock available now.",
    },
    {
        "rule_id": "claim_shipping_sla",
        "module": "TRUTH_GUARD",
        "severity": "P0",
        "description": "Non-standard delivery SLA or Guangzhou node without logistics evidence",
        "match_rule_ids": ["claim_shipping_sla"],
        "synthetic_inbound": "How long to Tema?",
        "synthetic_reply": "We ship from Guangzhou port in 7 working days.",
    },
    {
        "rule_id": "whatsapp_email_tone",
        "module": "REPLY_BUILDER",
        "severity": "P1",
        "description": "Dear Customer / Best regards on WhatsApp",
        "match_rule_ids": ["whatsapp_email_tone"],
        "synthetic_inbound": "I want used engine",
        "synthetic_reply": "Dear Customer,\n\nThank you for your inquiry.\n\nBest regards,\nSales Team",
    },
    {
        "rule_id": "too_many_questions",
        "module": "REPLY_BUILDER",
        "severity": "P1",
        "description": "Too many questions in one WhatsApp reply",
        "match_rule_ids": ["too_many_questions"],
        "synthetic_inbound": "Need engine",
        "synthetic_reply": (
            "Please share: model, year, VIN, engine code, long block or complete, "
            "gearbox?, accessories?, quantity, destination port, payment terms?"
        ),
    },
    {
        "rule_id": "website_spam",
        "module": "REPLY_BUILDER",
        "severity": "P2",
        "description": "Repeats website every message / multiple times",
        "match_rule_ids": ["website_spam"],
        "synthetic_inbound": "Hi",
        "synthetic_reply": "See www.asia-power.com\nAlso visit www.asia-power.com again.",
    },
]


def verify_regression_rules() -> list[dict[str, Any]]:
    """Each synthetic case must fire the expected detector rule_id."""
    results: list[dict[str, Any]] = []
    for rule in REGRESSION_RULES:
        found = run_all_detectors(
            inbound=rule["synthetic_inbound"],
            reply=rule["synthetic_reply"],
            evidence={},
        )
        found_ids = {i.get("rule_id") for i in found}
        expected = set(rule["match_rule_ids"])
        ok = bool(expected & found_ids)
        results.append(
            {
                "rule_id": rule["rule_id"],
                "module": rule["module"],
                "ok": ok,
                "expected": sorted(expected),
                "found": sorted(x for x in found_ids if x),
            }
        )
    return results


def match_issues_to_regression(issues: list[dict[str, Any]]) -> list[str]:
    """Return regression rule_ids that fired in this issue list."""
    fired: list[str] = []
    issue_ids = {i.get("rule_id") for i in issues}
    for rule in REGRESSION_RULES:
        if set(rule["match_rule_ids"]) & issue_ids:
            fired.append(rule["rule_id"])
    return fired
