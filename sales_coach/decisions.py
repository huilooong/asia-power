"""Extract Sales Decisions from customer → reply turns (heuristic, phase-1)."""

from __future__ import annotations

import re
from typing import Any

_ENGINE_RE = re.compile(
    r"\b(G4K[A-Z]|G4KD|G4KE|G4KJ|2KD|1KD|2TR|1HZ|4JB1|4JJ1|D4CB|engine|发动机|引擎|half[\s-]?cut)\b",
    re.I,
)
_VIN_ASK_RE = re.compile(r"\bvin\b|车架号|车辆识别", re.I)
_VIN_HAS_RE = re.compile(r"\b[A-HJ-NPR-Z0-9]{11,17}\b")
_QUOTE_RE = re.compile(r"\b(fob|cif|usd|price|quote|报价|价格|\$)\b", re.I)
_ACCESSORY_ASK_RE = re.compile(
    r"accessory|attachment|gearbox|ecu|电脑板|变速箱|附件|with\s+parts|含附件",
    re.I,
)
_ALT_RE = re.compile(r"alternative|instead|similar|替代|同级|也可|recommend", re.I)
_INVENTORY_PROMISE_RE = re.compile(
    r"\b(in stock|ready to ship|we have|现货|有货|马上发|立即发)\b",
    re.I,
)
_INVENTORY_CHECK_RE = re.compile(
    r"\b(check(ing)? (stock|availability)|核实|确认库存|looking into|verify)\b",
    re.I,
)
_FOLLOW_RE = re.compile(r"\b(follow up|next step|when can|方便|下一步|回复我|confirm)\b", re.I)
_TRUST_RISK_RE = re.compile(r"\b(guarantee|100%|definitely|保证|绝对|一定有)\b", re.I)
_CLOSE_RE = re.compile(r"\b(deposit|order|po\b|下单|定金|confirm order)\b", re.I)
_PRODUCT_CONFIRM_RE = re.compile(
    r"\b(confirm|you need|you(?:'re| are) looking|确认|您需要|机型)\b",
    re.I,
)


def _is_engine_enquiry(customer_text: str) -> bool:
    return bool(_ENGINE_RE.search(customer_text or ""))


def extract_decisions_for_turn(
    *,
    customer_text: str,
    reply_text: str,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Map one sales turn into decision flags.

    Positive decisions = good sales moves.
    Anti-patterns flagged separately.
    """
    cust = customer_text or ""
    reply = reply_text or ""
    engine = _is_engine_enquiry(cust)
    cust_has_vin = bool(_VIN_HAS_RE.search(cust)) or bool(re.search(r"\bvin\b", cust, re.I))

    decisions: dict[str, bool] = {
        "ask_clarifying": bool(re.search(r"\?|请|could you|please (share|confirm|advise)", reply, re.I)),
        "ask_vin": bool(_VIN_ASK_RE.search(reply)),
        "confirm_product": bool(_PRODUCT_CONFIRM_RE.search(reply) and _ENGINE_RE.search(reply + " " + cust)),
        "confirm_accessory": bool(_ACCESSORY_ASK_RE.search(reply)),
        "quote_now": bool(_QUOTE_RE.search(reply)),
        "defer_quote": bool(_QUOTE_RE.search(cust)) and not bool(_QUOTE_RE.search(reply)),
        "check_inventory": bool(_INVENTORY_CHECK_RE.search(reply)),
        "promise_inventory": bool(_INVENTORY_PROMISE_RE.search(reply)),
        "recommend_alternative": bool(_ALT_RE.search(reply)),
        "follow_up": bool(_FOLLOW_RE.search(reply)),
        "build_trust": not bool(_TRUST_RISK_RE.search(reply)),
        "close_ask": bool(_CLOSE_RE.search(reply)),
    }

    # Context tags for coaching
    context = {
        "engine_enquiry": engine,
        "customer_provided_vin": cust_has_vin,
        "should_ask_vin": engine and not cust_has_vin,
        "quoted_before_vin": bool(decisions["quote_now"] and engine and not cust_has_vin and not decisions["ask_vin"]),
    }

    return {
        "decisions": decisions,
        "context": context,
        "meta": meta or {},
        "customer_excerpt": cust[:240],
        "reply_excerpt": reply[:240],
    }


def extract_decisions_from_drafts(drafts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for d in drafts:
        turn = extract_decisions_for_turn(
            customer_text=str(d.get("original_message") or ""),
            reply_text=str(d.get("customer_reply_draft") or ""),
            meta={
                "draft_id": d.get("draft_id"),
                "customer": d.get("customer_name"),
                "status": d.get("status"),
                "revision_note": d.get("revision_note") or "",
                "channel": d.get("channel") or "",
            },
        )
        rows.append(turn)
    return rows


def extract_decisions_from_conversations(conversations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pair consecutive inbound→outbound messages within a day."""
    rows: list[dict[str, Any]] = []
    for conv in conversations:
        msgs = list(conv.get("day_messages") or [])
        contact = conv.get("contact")
        pending_in: str | None = None
        for m in msgs:
            text = str(m.get("text") or "")
            is_out = bool(m.get("is_ceo") or m.get("direction") == "outbound")
            if not is_out:
                pending_in = text
                continue
            if pending_in is not None:
                rows.append(
                    extract_decisions_for_turn(
                        customer_text=pending_in,
                        reply_text=text,
                        meta={"contact": contact, "source": "conversation"},
                    )
                )
                pending_in = None
    return rows
