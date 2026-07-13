#!/usr/bin/env python3
"""APWA-002 / APSALES-P0: WhatsApp Cloud sandbox reply (allowlisted only).

No draft queue. No Telegram. No approval. Stdin JSON → stdout JSON.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from typing import Any


def _safe_media_reply(message_type: str) -> str:
    from sales_core.commercial_decision import decide_commercial

    cdr = decide_commercial("", media_type=message_type or "image")
    # Media-only: prefer inspect / plate ask
    if not cdr.reply:
        return (
            "Thanks — we received your media.\n\n"
            "Please send a clear engine plate photo (or VIN) so we can confirm "
            "the currently installed engine."
        )
    return cdr.reply


_INTERNAL_LEAK_RE = re.compile(
    r"(?:^|\n)\s*(?:MEMORY_TO_SAVE|DECISION_TO_SAVE|APPROVAL_REQUEST|APPROVAL_REQUIRED|"
    r"INTERNAL_NOTE|SYSTEM|DEBUG)\s*:.*$",
    re.I | re.M,
)
_APPROVAL_INLINE_RE = re.compile(r"\bAPPROVAL_REQUEST\b[:\s].*$", re.I | re.M)
_EMAIL_TONE_RE = re.compile(
    r"Dear\s+Customer|Dear\s+Sir|Best\s+regards|Looking\s+forward\s+to\s+your\s+reply|"
    r"AsiaPower\s+Sales\s+Team",
    re.I,
)
_VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{11,17})\b")


def _strip_internal_leaks(text: str) -> str:
    """Never send agent bookkeeping tags to WhatsApp customers."""
    cleaned = _INTERNAL_LEAK_RE.sub("", text or "")
    cleaned = _APPROVAL_INLINE_RE.sub("", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


def _vin_received_reply(inbound: str) -> str:
    """Think Before Reply: Vehicle Intelligence → Commercial Decision → WhatsApp."""
    try:
        from sales_core.vehicle_intelligence import enrich_and_decide, build_whatsapp_reply

        result = enrich_and_decide(inbound)
        return build_whatsapp_reply(result)
    except Exception:
        from sales_core.commercial_decision import decide_commercial

        cdr = decide_commercial(inbound or "")
        return cdr.reply


def _commercial_decide_reply(inbound: str, *, wa_id: str = "", media_type: str = "") -> dict[str, Any]:
    """NLU → Conversation State → Commercial Decision → dead-loop guard."""
    import hashlib

    from sales_core.commercial_decision import decide_commercial
    from sales_core.conversation_state import (
        apply_dead_loop_guard,
        conversation_id_for_wa,
        load_state,
        record_system_action,
        save_state,
        update_state_from_understanding,
    )
    from sales_core.message_understanding import understand_message

    customer_hash = hashlib.sha256((wa_id or "").encode()).hexdigest()[:16] if wa_id else ""
    cid = conversation_id_for_wa(wa_id) if wa_id else (customer_hash or "anon")
    state_before = load_state(cid)
    understanding = understand_message(
        inbound,
        conversation_id=cid,
        message_type=media_type or "text",
        previous_system_action=str(state_before.get("last_system_action") or ""),
        previous_customer_engine=str((state_before.get("customer_reported") or {}).get("engine_code") or ""),
    )
    state_after = update_state_from_understanding(state_before, understanding)

    cdr = decide_commercial(
        inbound,
        customer_hash=customer_hash,
        conversation_id=cid,
        media_type=media_type,
        prior_state=state_after,
        understanding=understanding,
    )
    nba, reply, blocked = apply_dead_loop_guard(
        state_after,
        next_best_action=cdr.next_best_action,
        reply=cdr.reply,
    )
    if blocked or nba != cdr.next_best_action:
        cdr.next_best_action = nba
        cdr.reply = reply
        cdr.decision_reason = (cdr.decision_reason or "") + " | dead_loop_guard"
        from sales_core.commercial_decision import _ASK_LABELS

        if nba in _ASK_LABELS:
            cdr.ask_keys = [nba]
            cdr.ask_list = [_ASK_LABELS[nba]]

    state_final = record_system_action(state_after, nba, reply)
    save_state(state_final)

    return {
        "ok": True,
        "reply": reply,
        "risk_level": "high" if cdr.commercial_risk == "high" else "low",
        "reason_code": "commercial_decision_v1",
        "category": cdr.customer_intent,
        "classification": "commercial_decision",
        "source": "commercial_decision",
        "next_action": nba,
        "commercial_decision": cdr.to_dict(),
        "message_understanding": understanding,
        "conversation_state": {
            "before": {
                "customer_reported": state_before.get("customer_reported"),
                "last_system_action": state_before.get("last_system_action"),
                "asked_actions": state_before.get("asked_actions"),
                "turn_count": state_before.get("turn_count"),
            },
            "after": {
                "customer_reported": state_final.get("customer_reported"),
                "last_system_action": state_final.get("last_system_action"),
                "asked_actions": state_final.get("asked_actions"),
                "unavailable_evidence": state_final.get("unavailable_evidence"),
                "turn_count": state_final.get("turn_count"),
            },
        },
        "repeated_action_blocked": blocked,
    }


def _risk_rewrite(text: str, inbound: str) -> tuple[str, str]:
    """Strip real price/stock/payment promises; advance price inquiries toward VIN/model."""
    from sales_core.zijing_reply_context import (
        is_price_inquiry,
        zijing_price_advance_reply,
    )

    body = _strip_internal_leaks(text or "")
    inbound_l = (inbound or "").lower()
    inbound_has_vin = bool(_VIN_RE.search(inbound or ""))

    # P0 Live Fix: APPROVAL_REQUEST / email tone must not reach WhatsApp
    if _EMAIL_TONE_RE.search(body) or re.search(
        r"MEMORY_TO_SAVE|APPROVAL_REQUEST|APPROVAL_REQUIRED|DECISION_TO_SAVE",
        body,
        re.I,
    ):
        if inbound_has_vin:
            return _vin_received_reply(inbound), "whatsapp_style_vin"
        reason = (
            "leak_stripped"
            if "APPROVAL" in body.upper() or "MEMORY_TO_SAVE" in body.upper()
            else "email_tone_rewrite"
        )
        return zijing_price_advance_reply(inbound), reason

    # Hard forbidden: invented numbers / stock / payment promises in outbound
    patterns = [
        r"\bwe have (?:it )?in stock\b",
        r"\bin stock\b",
        r"\bready to ship\b",
        r"\bguaranteed\b",
        r"\bUSD\s*\$?\s*\d",
        r"\$\s*\d",
        r"\bFOB\b.{0,20}\d",
        r"\bCIF\b.{0,20}\d",
        r"\bprice(?:\s+is)?\s*[:=]?\s*\d",
        r"\bbank\s+(?:account|transfer)\b",
        r"\bdeposit\b",
        r"\bwire transfer\b",
        r"现货",
        r"有货",
        r"付款",
        r"定金",
    ]
    hit = any(re.search(p, body, re.I) for p in patterns)
    asks_price = is_price_inquiry(inbound)
    asks_stock = bool(
        re.search(r"in\s*stock|available|have\s+you|库存|有货", inbound_l, re.I)
    )

    # Price intent: advance the deal (ask VIN/model) — never dead-end at "cannot quote"
    if asks_price:
        if hit or not body or "do not confirm" in body.lower() or "cannot quote" in body.lower():
            return zijing_price_advance_reply(inbound), "price_advance"
        # Already a safe advance-style reply without numbers
        return body, "ok"

    if not hit and not asks_stock:
        return body, "ok"

    if asks_stock and not hit:
        # Stock ask without inventing availability — still collect facts
        return zijing_price_advance_reply(inbound), "stock_advance"

    # Forbidden content in reply → replace with advance (not refusal)
    return zijing_price_advance_reply(inbound), "policy_blocked"


def main() -> int:
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError:
        print(json.dumps({"ok": False, "error": "invalid_json"}))
        return 1

    text = str(payload.get("text") or "").strip()
    msg_type = str(payload.get("message_type") or "text")
    name = str(payload.get("profile_name") or "WhatsApp Buyer")
    wa_id = str(payload.get("wa_id") or "")

    if msg_type in {"image", "audio", "video", "document", "sticker"} or (
        msg_type == "audio" or (payload.get("media") or {}).get("voice")
    ):
        if not text:
            reply = _safe_media_reply(msg_type)
            print(json.dumps({"ok": True, "reply": reply, "risk_level": "low", "source": "media_meta"}))
            return 0

    if not text:
        text = f"[{msg_type} message received]"

    # APSALES-DECISION-001: VIN / engine-code / price before LLM imports (Think Before Reply)
    vin_intel: dict[str, Any] | None = None
    if _VIN_RE.search(text):
        try:
            from sales_core.vehicle_intelligence import enrich_and_decide, build_whatsapp_reply

            decision = enrich_and_decide(text)
            reply = build_whatsapp_reply(decision)
            vin_intel = decision.to_dict()
            out: dict[str, Any] = {
                "ok": True,
                "reply": reply,
                "risk_level": "low",
                "reason_code": "vehicle_intelligence_vin",
                "category": "vin_provided",
                "classification": "vehicle_intelligence",
                "source": "vehicle_intelligence",
                "vehicle_intelligence": vin_intel,
                "commercial_decision": (vin_intel or {}).get("commercial_decision"),
                "next_action": decision.next_action,
            }
            print(json.dumps(out, ensure_ascii=False))
            return 0
        except Exception as exc:
            vin_intel = {"error": str(exc)[:200]}

    try:
        from sales_core.commercial_decision import _extract_engine_code, load_config
        from sales_core.message_understanding import understand_message
        from sales_core.zijing_reply_context import is_price_inquiry

        cfg = load_config()
        engine_hit = bool(_extract_engine_code(text, cfg))
        # NLU-001: also route when understanding finds engine_code / clarification acts
        mu_probe = understand_message(text, message_type=msg_type)
        nlu_engine = any(e.get("type") == "engine_code" for e in (mu_probe.get("entities") or []))
        nlu_act = mu_probe.get("communicative_act") or ""
        nlu_hit = nlu_engine or nlu_act in {
            "provide_information",
            "clarify_information",
            "correct_information",
            "answer_previous_question",
            "cannot_provide_requested_evidence",
            "send_alternative_evidence",
        }
        price_hit = is_price_inquiry(text)
    except Exception:
        engine_hit = bool(re.search(r"\bG4K[A-Z0-9]+\b|\b2SZ\b|\b[123][A-Z]{2}\b", text, re.I))
        nlu_hit = False
        price_hit = bool(re.search(r"how\s*much|best\s*price|quote|quotation", text, re.I))

    if engine_hit or nlu_hit or price_hit or re.search(r"conflict|replaced engine|swapped engine", text, re.I):
        try:
            out = _commercial_decide_reply(text, wa_id=wa_id, media_type=msg_type)
            if vin_intel:
                out["vehicle_intelligence"] = vin_intel
            print(json.dumps(out, ensure_ascii=False))
            return 0
        except Exception:
            pass

    try:
        from core.language_router import detect_language, resolve_target_language
        from customer_gateway.sales_message_classifier import classify_inbound_message
        from sales_core.sales_brain_draft import build_sales_brain_draft
    except Exception as exc:  # pragma: no cover
        # Last resort: still answer via commercial decision
        try:
            out = _commercial_decide_reply(text, wa_id=wa_id, media_type=msg_type)
            print(json.dumps(out, ensure_ascii=False))
            return 0
        except Exception:
            print(json.dumps({"ok": False, "error": f"import:{exc}"}))
            return 1

    classification = classify_inbound_message(text, contact_name=name)
    detected = detect_language(text, scenario="buyer")
    comm_lang = resolve_target_language("apsales", "buyer", text)
    customer_hash = hashlib.sha256(wa_id.encode()).hexdigest()[:16]

    draft = build_sales_brain_draft(
        text,
        customer_name=name or f"wa:{wa_id[-4:]}",
        customer_hash=customer_hash,
        detected_language=detected,
        communication_language=comm_lang,
        classification=classification,
        channel="whatsapp_live",  # enable zijing_quick_reply rules
    )

    try:
        from core.constitution_runtime import apply_constitution_runtime

        draft = apply_constitution_runtime(draft, context={"channel": "whatsapp_cloud_sandbox"})
    except Exception:
        pass

    reply = str(draft.get("customer_reply_draft") or "").strip()
    reply, reason = _risk_rewrite(reply, text)
    risk = "high" if reason in {"policy_blocked"} else str(draft.get("risk_level") or "medium")

    out = {
        "ok": True,
        "reply": reply,
        "risk_level": risk,
        "reason_code": reason,
        "category": draft.get("category"),
        "classification": draft.get("classification"),
        "source": "apsales_sandbox",
    }
    if vin_intel:
        out["vehicle_intelligence"] = vin_intel
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
