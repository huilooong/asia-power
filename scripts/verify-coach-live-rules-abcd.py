#!/usr/bin/env python3
"""Phase-0 check: ask LLM whether A/B/C/D fixture replies violate LIVE-RULES.

Uses one cheap call with injected fixtures (not full Evidence scan).
Skip with exit 0 if OPENAI_API_KEY missing.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except Exception:
    pass

FIXTURES = [
    {
        "id": "A",
        "label": "own_number_leak",
        "customer": "Please give me a number to call",
        "agent": "Sure, call me on +233249632526 anytime.",
        # agent echoed customer number (fixture assumes customer is 233249632526)
    },
    {
        "id": "B",
        "label": "internal_staff_as_customer",
        "customer": "[internal staff +233549135916] ok noted",
        "agent": "Hi! What VIN and engine are you looking for? See www.asia-power.com",
    },
    {
        "id": "C",
        "label": "price_no_currency",
        "customer": "How much for the engine?",
        "agent": "The price is 900. Ready when you are.",
    },
    {
        "id": "D",
        "label": "fake_verified",
        "customer": "I called support, no answer",
        "agent": "I checked the line myself — it is working fine on our side.",
    },
]


def main() -> int:
    if not os.getenv("OPENAI_API_KEY"):
        print("SKIP: OPENAI_API_KEY not set")
        return 0

    from sales_coach.llm_audit import audit_conversation, load_live_rules_text

    rules = load_live_rules_text(ROOT)
    if not rules.strip():
        print("FAIL: LIVE-RULES missing")
        return 1

    turns = []
    for i, fx in enumerate(FIXTURES):
        turns.append(
            {
                "at": f"2026-07-17T0{i}:00:00+00:00",
                "evidence_id": f"fixture-{fx['id']}",
                "customer": {"customer_id": f"wa:fixture{fx['id']}", "message": fx["customer"]},
                "reply": {"text": fx["agent"]},
            }
        )

    # One conversation so cost stays ~1 completion
    result = audit_conversation(turns, rules)
    viol = result.get("violations") or []
    print(json.dumps({"parse_error": result.get("parse_error"), "violations": viol}, ensure_ascii=False, indent=2))

    blob = json.dumps(viol, ensure_ascii=False).lower()
    checks = {
        "A": any(k in blob for k in ("number", "phone", "号码", "own")),
        "B": any(k in blob for k in ("internal", "staff", "同事", "whitelist", "白名单")),
        "C": any(k in blob for k in ("currency", "usd", "货币", "裸", "unit")),
        "D": any(k in blob for k in ("verif", "check", "核实", "编造")),
    }
    print("coverage_hits:", checks)
    # Soft pass: at least C+D+A strongly expected; B may be subtle
    ok = checks["A"] and checks["C"] and checks["D"]
    if not ok:
        print("FAIL: expected A/C/D flagged from fixtures")
        return 1
    print("PASS: A/C/D flagged (B optional):", checks["B"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
