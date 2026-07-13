#!/usr/bin/env python3
"""APSALES-NLU-001 — Conversation State load / update / dead-loop guards."""

from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = ROOT / "data" / "whatsapp_cloud" / "conversation_state"

_IDENTITY_ACTIONS = {
    "ask_engine_plate",
    "ask_engine_photo",
    "ask_vin",
    "ask_vin_plate",
    "ask_oe_label",
    "ask_registration",
    "ask_vehicle_photo",
}


def conversation_id_for_wa(wa_id: str) -> str:
    digits = re.sub(r"\D", "", wa_id or "") or "unknown"
    return f"wa:{digits}"


def _path(conversation_id: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9:_-]+", "_", conversation_id or "unknown")[:80]
    return STATE_DIR / f"{safe}.json"


def empty_state(conversation_id: str = "") -> dict[str, Any]:
    return {
        "conversation_id": conversation_id,
        "known": {},
        "customer_reported": {},
        "provider_reported": {},
        "verified": {},
        "conflicting": {},
        "missing": ["product_scope", "quantity", "destination_port", "installed_engine_evidence"],
        "asked_actions": [],
        "customer_answers": [],
        "unavailable_evidence": [],
        "last_customer_act": "",
        "last_system_action": "",
        "last_outbound_hash": "",
        "last_outbound_excerpt": "",
        "turn_count": 0,
        "updated_at": "",
    }


def load_state(conversation_id: str) -> dict[str, Any]:
    p = _path(conversation_id)
    if not p.is_file():
        return empty_state(conversation_id)
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            return empty_state(conversation_id)
        base = empty_state(conversation_id)
        base.update(raw)
        base["conversation_id"] = conversation_id
        return base
    except Exception:
        return empty_state(conversation_id)


def save_state(state: dict[str, Any]) -> Path:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    cid = str(state.get("conversation_id") or "unknown")
    state = dict(state)
    state["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    p = _path(cid)
    p.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return p


def _norm_reply(text: str) -> str:
    t = re.sub(r"\s+", " ", (text or "").strip().lower())
    t = re.sub(r"[^\w\s]", "", t)
    return t[:400]


def outbound_hash(text: str) -> str:
    return hashlib.sha256(_norm_reply(text).encode()).hexdigest()[:16]


def update_state_from_understanding(
    state: dict[str, Any],
    understanding: dict[str, Any],
) -> dict[str, Any]:
    """Merge Message Understanding into Conversation State (before Decision)."""
    st = dict(state or empty_state())
    st.setdefault("customer_reported", {})
    st.setdefault("known", {})
    st.setdefault("unavailable_evidence", [])
    st.setdefault("customer_answers", [])
    st.setdefault("asked_actions", [])
    st.setdefault("missing", [])
    st["turn_count"] = int(st.get("turn_count") or 0) + 1
    st["last_customer_act"] = understanding.get("communicative_act") or ""

    answers = list(st.get("customer_answers") or [])
    answers.append(
        {
            "act": understanding.get("communicative_act"),
            "intent": understanding.get("intent"),
            "excerpt": understanding.get("raw_text_excerpt") or "",
            "entities": [
                {"type": e.get("type"), "value": e.get("normalized_value")}
                for e in (understanding.get("entities") or [])
            ],
        }
    )
    st["customer_answers"] = answers[-20:]

    from sales_core.message_understanding import primary_engine_code

    engine_claim = primary_engine_code(understanding)
    if engine_claim:
        prev = (st.get("customer_reported") or {}).get("engine_code")
        eng_ents = [
            e
            for e in (understanding.get("entities") or [])
            if e.get("type") == "engine_code" and str(e.get("normalized_value")) == engine_claim
        ]
        conf = (eng_ents[0].get("confidence", 0.9) if eng_ents else 0.9)
        if understanding.get("is_correction") and prev and str(prev) != str(engine_claim):
            st.setdefault("conflicting", {})["engine_code"] = {
                "previous": prev,
                "new": engine_claim,
            }
            hist = list((st.get("customer_reported") or {}).get("engine_code_history") or [])
            if prev not in hist:
                hist.append(prev)
            st["customer_reported"]["engine_code_history"] = hist[-10:]
        st["customer_reported"]["engine_code"] = engine_claim
        st["customer_reported"]["engine_code_confidence"] = conf
        st["customer_reported"]["engine_code_status"] = "customer_reported"
        st["known"]["claimed_engine_code"] = engine_claim
        st["missing"] = [m for m in (st.get("missing") or []) if m != "engine_code_claim"]

    for e in understanding.get("entities") or []:
        et = e.get("type")
        val = e.get("normalized_value")
        if not et or val in (None, "") or et == "engine_code":
            continue
        if et == "vin":
            st["customer_reported"]["vin"] = val
            st["known"]["vin"] = val
        elif et == "quantity":
            st["customer_reported"]["quantity"] = val
            st["known"]["quantity"] = val
            st["missing"] = [m for m in (st.get("missing") or []) if m != "quantity"]

    if understanding.get("cannot_provide_plate"):
        if "engine_plate" not in st["unavailable_evidence"]:
            st["unavailable_evidence"].append("engine_plate")
        st["missing"] = [m for m in (st.get("missing") or []) if m != "engine_plate"]

    if understanding.get("offers_photo_alternative"):
        st["customer_reported"]["offers_engine_photo"] = True

    return st


def record_system_action(state: dict[str, Any], action: str, reply: str) -> dict[str, Any]:
    st = dict(state)
    st["last_system_action"] = action or ""
    asked = list(st.get("asked_actions") or [])
    if action:
        asked.append(action)
    st["asked_actions"] = asked[-30:]
    st["last_outbound_hash"] = outbound_hash(reply)
    st["last_outbound_excerpt"] = (reply or "")[:180]
    return st


def would_repeat_action(state: dict[str, Any], action: str) -> bool:
    """Same next_best_action must not fire on consecutive turns."""
    if not action:
        return False
    last = state.get("last_system_action") or ""
    return action == last


def would_repeat_reply(state: dict[str, Any], reply: str) -> bool:
    h = outbound_hash(reply)
    return bool(h) and h == (state.get("last_outbound_hash") or "")


def alternate_identity_action(state: dict[str, Any], preferred: str) -> str:
    """When plate already asked / unavailable, pick next identity path."""
    asked = set(state.get("asked_actions") or [])
    unavailable = set(state.get("unavailable_evidence") or [])
    order = [
        "ask_engine_photo",
        "ask_vin",
        "ask_vin_plate",
        "ask_registration",
        "ask_oe_label",
        "request_manual_review",
    ]
    if preferred and preferred not in asked and preferred not in {
        f"ask_{u}" if not u.startswith("ask_") else u for u in unavailable
    }:
        # Still allow preferred if not repeating
        if preferred == "ask_engine_plate" and (
            "engine_plate" in unavailable or "ask_engine_plate" in asked
        ):
            preferred = ""
        elif preferred and not would_repeat_action(state, preferred):
            return preferred
    for a in order:
        if a in asked:
            continue
        if a == "ask_engine_plate" and "engine_plate" in unavailable:
            continue
        if would_repeat_action(state, a):
            continue
        return a
    return "request_manual_review"


def apply_dead_loop_guard(
    state: dict[str, Any],
    *,
    next_best_action: str,
    reply: str,
) -> tuple[str, str, bool]:
    """Return (action, reply, blocked). May switch action/reply to avoid repeats."""
    blocked = False
    action = next_best_action
    out = reply

    if would_repeat_action(state, action) or (
        action == "ask_engine_plate" and "engine_plate" in (state.get("unavailable_evidence") or [])
    ):
        blocked = True
        action = alternate_identity_action(state, "")
        out = _fallback_reply_for_action(state, action)

    if would_repeat_reply(state, out):
        blocked = True
        action = alternate_identity_action(state, action if action != next_best_action else "")
        out = _fallback_reply_for_action(state, action)
        # Final hard stop: if still same hash, force manual-review wording
        if would_repeat_reply(state, out):
            action = "request_manual_review"
            out = (
                "Thanks for the update. To avoid repeating the same request, "
                "our team will review your engine details shortly."
            )

    return action, out, blocked


def _fallback_reply_for_action(state: dict[str, Any], action: str) -> str:
    code = (state.get("customer_reported") or {}).get("engine_code") or ""
    ack = f"Got it — you’re confirming the engine code as {code}." if code else "Got it."
    if action == "ask_engine_photo":
        return (
            f"{ack}\n\n"
            "To avoid supplying the wrong version, please send a clear photo of the engine if available."
        )
    if action == "ask_vin":
        return f"{ack}\n\nIf easier, please send the VIN (or VIN plate photo)."
    if action == "ask_vin_plate":
        return f"{ack}\n\nPlease send a VIN plate photo so we can continue matching."
    if action == "ask_registration":
        return f"{ack}\n\nPlease send a vehicle registration photo as an alternative."
    if action == "ask_oe_label":
        return f"{ack}\n\nPlease send a clear OE / parts label photo."
    if action == "request_manual_review":
        return (
            f"{ack}\n\n"
            "We’ll review manually so we don’t risk the wrong unit — thank you for your patience."
        )
    if action == "ask_engine_plate":
        return (
            f"{ack}\n\n"
            "Please send a clear engine plate photo so we can confirm the currently installed engine."
        )
    return ack


def decision_inputs_from_state(state: dict[str, Any]) -> dict[str, Any]:
    """Structured facts Commercial Decision may consume (not raw keyword only)."""
    cr = state.get("customer_reported") or {}
    return {
        "engine_code_customer_reported": cr.get("engine_code") or "",
        "engine_code_confidence": float(cr.get("engine_code_confidence") or 0),
        "vin_customer_reported": cr.get("vin") or "",
        "quantity": cr.get("quantity"),
        "unavailable_evidence": list(state.get("unavailable_evidence") or []),
        "asked_actions": list(state.get("asked_actions") or []),
        "last_system_action": state.get("last_system_action") or "",
        "offers_engine_photo": bool(cr.get("offers_engine_photo")),
        "turn_count": int(state.get("turn_count") or 0),
    }
