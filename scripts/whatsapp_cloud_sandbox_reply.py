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
    return (
        "Thanks — we received your media.\n\n"
        "Please also type: vehicle model, year, engine code or VIN, "
        "and whether you need long block / complete engine / gearbox / accessories.\n\n"
        "www.asia-power.com"
    )


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
    m = _VIN_RE.search(inbound or "")
    vin = m.group(1) if m else ""
    head = f"Got your VIN: {vin}\n\n" if vin else "Got your VIN.\n\n"
    return (
        head
        + "We will check the matching engine with suppliers "
        + "(confirmation before any stock/price promise).\n\n"
        + "Please confirm:\n"
        + "• Long block / complete engine / gearbox?\n"
        + "• Quantity?\n"
        + "• Destination port?\n\n"
        + "Then we move to quotation (FOB / CIF).\n\n"
        + "www.asia-power.com"
    )


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

    try:
        from core.language_router import detect_language, resolve_target_language
        from customer_gateway.sales_message_classifier import classify_inbound_message
        from sales_core.sales_brain_draft import build_sales_brain_draft
    except Exception as exc:  # pragma: no cover
        print(json.dumps({"ok": False, "error": f"import:{exc}"}))
        return 1

    if not text:
        text = f"[{msg_type} message received]"

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

    out: dict[str, Any] = {
        "ok": True,
        "reply": reply,
        "risk_level": risk,
        "reason_code": reason,
        "category": draft.get("category"),
        "classification": draft.get("classification"),
        "source": "apsales_sandbox",
    }
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
