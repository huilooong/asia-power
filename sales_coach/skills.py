"""Score Sales Skills from decision turns (0–100)."""

from __future__ import annotations

from typing import Any

from sales_coach.config import SALES_SKILLS


def _pct(ok: int, total: int, default: int = 50) -> int:
    if total <= 0:
        return default
    return int(round(100.0 * ok / total))


def score_skills(turns: list[dict[str, Any]]) -> dict[str, int]:
    """
    Deterministic skill scores from today's decision turns.
    Missing opportunity → lower score; good decision → higher.
    """
    engine_turns = [t for t in turns if (t.get("context") or {}).get("engine_enquiry")]
    need_vin = [t for t in turns if (t.get("context") or {}).get("should_ask_vin")]
    all_turns = turns

    vin_ok = sum(1 for t in need_vin if (t.get("decisions") or {}).get("ask_vin"))
    product_ok = sum(1 for t in engine_turns if (t.get("decisions") or {}).get("confirm_product"))
    accessory_ok = sum(1 for t in engine_turns if (t.get("decisions") or {}).get("confirm_accessory"))

    # Quotation timing: among engine turns that quoted, did they ask VIN first / avoid quote-before-vin?
    quote_turns = [t for t in engine_turns if (t.get("decisions") or {}).get("quote_now")]
    quote_good = sum(
        1
        for t in quote_turns
        if (t.get("decisions") or {}).get("ask_vin")
        or (t.get("context") or {}).get("customer_provided_vin")
        or not (t.get("context") or {}).get("quoted_before_vin")
    )
    # If no quotes, neutral-high (not punished for not quoting)
    quote_score = _pct(quote_good, len(quote_turns), default=70) if quote_turns else 70
    if any((t.get("context") or {}).get("quoted_before_vin") for t in turns):
        quote_score = min(quote_score, 35)

    inv_bad = sum(1 for t in all_turns if (t.get("decisions") or {}).get("promise_inventory"))
    inv_good = sum(1 for t in all_turns if (t.get("decisions") or {}).get("check_inventory"))
    if not all_turns:
        inv_score = 50
    elif inv_bad:
        inv_score = max(0, 40 - 15 * inv_bad + 10 * inv_good)
    else:
        inv_score = min(100, 75 + 5 * inv_good)

    alt_ok = sum(1 for t in engine_turns if (t.get("decisions") or {}).get("recommend_alternative"))
    # Only expect alternative sometimes; reward presence, don't require 100%
    alt_score = 55 if not engine_turns else min(100, 50 + int(40 * alt_ok / max(1, len(engine_turns))) + (20 if alt_ok else 0))

    follow_ok = sum(1 for t in all_turns if (t.get("decisions") or {}).get("follow_up"))
    trust_ok = sum(1 for t in all_turns if (t.get("decisions") or {}).get("build_trust"))
    close_ok = sum(1 for t in all_turns if (t.get("decisions") or {}).get("close_ask"))

    scores = {
        "VIN Confirmation": _pct(vin_ok, len(need_vin), default=50),
        "Product Confirmation": _pct(product_ok, len(engine_turns), default=50),
        "Accessory Confirmation": _pct(accessory_ok, len(engine_turns), default=45),
        "Quotation Timing": quote_score,
        "Inventory Risk": max(0, min(100, inv_score)),
        "Alternative Recommendation": alt_score,
        "Follow-up": _pct(follow_ok, len(all_turns), default=50),
        "Customer Trust": _pct(trust_ok, len(all_turns), default=60),
        "Closing": _pct(close_ok, len(all_turns), default=40),
    }
    # Ensure all catalogue keys exist
    return {k: int(scores.get(k, 50)) for k in SALES_SKILLS}


def skill_deltas(today: dict[str, int], yesterday: dict[str, int] | None) -> dict[str, dict[str, int | str]]:
    out: dict[str, dict[str, int | str]] = {}
    y = yesterday or {}
    for skill in SALES_SKILLS:
        t = int(today.get(skill, 50))
        p = int(y.get(skill, t))  # if no yesterday, delta 0 baseline same
        delta = t - p if yesterday is not None else 0
        trend = "up" if delta > 0 else ("down" if delta < 0 else "flat")
        out[skill] = {"yesterday": p if yesterday is not None else t, "today": t, "delta": delta, "trend": trend}
    return out
