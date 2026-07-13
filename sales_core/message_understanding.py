#!/usr/bin/env python3
"""APSALES-NLU-001 — Message Understanding (deterministic-first).

No hidden CoT. Outputs auditable structured understanding only.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

# Toyota-style short codes (2SZ, 1NZ, 3SZ…) + common AsiaPower codes
_ENGINE_WHITELIST = re.compile(
    r"\b("
    r"G4K[A-Z0-9]+|G4NA|G4FC|G4FG|G4KE|G4KD|"
    r"HR1[56]DE|MR20DE|QR25DE?|VQ35DE?|"
    r"[123]\s?[A-Z]{2}(?:-?[A-Z0-9]+)?|"
    r"[A-Z]\d{2}[A-Z]\d?|"
    r"1KD(?:-FTV)?|2KD(?:-FTV)?|2TR(?:-FE)?|2AZ(?:-FE)?|1AZ(?:-FE)?|"
    r"K24A\d?|R20A\d?|L15A\d?"
    r")\b",
    re.I,
)
_ENGINE_PHRASE = re.compile(
    r"(?:engine\s*code|engine\s*no\.?|engine\s*number|eng(?:ine)?\s*code|"
    r"code\s*(?:is|：|:)|机型|发动机(?:代码|型号)?)\s*(?:is|为|＝|=|：|:)?\s*"
    r"([A-Z0-9][A-Z0-9\-]{1,11})",
    re.I,
)
_STANDALONE_CODE = re.compile(r"^\s*([A-Z0-9][A-Z0-9\-]{1,11})\s*$", re.I)
_VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b", re.I)
_QTY_RE = re.compile(
    r"(\d+)\s*(?:pcs|units?|sets?|engines?|台|件)\b|"
    r"(?:qty|quantity|数量)\s*[:：]?\s*(\d+)",
    re.I,
)
_NO_PLATE_RE = re.compile(
    r"(?:don'?t|do not|no|without|can'?t|cannot|没(?:有)?|无法).{0,24}"
    r"(?:plate|nameplate|铭牌)|"
    r"(?:plate|铭牌).{0,16}(?:don'?t|do not|no|没|无法)",
    re.I,
)
_CAN_PHOTO_RE = re.compile(
    r"(?:can|could|will)?\s*(?:send|share|provide).{0,20}(?:photo|picture|image|照片)|"
    r"(?:photo|picture).{0,12}(?:ok|fine|available|可以)",
    re.I,
)
_CORRECTION_RE = re.compile(
    r"\b(?:not|isn'?t|不是|错了|actually|correction)\b.{0,40}\b|"
    r"\bit\s+is\s+not\b",
    re.I,
)
_CLARIFY_RE = re.compile(
    r"(?:engine\s*code\s*is|i\s*mean|confirm(?:ing)?|yes[,.]?\s*it\s*is|"
    r"mechanic\s*(?:said|says)|code\s*is)\b",
    re.I,
)
_GREETING_RE = re.compile(r"^\s*(hi|hello|hey|good\s*(?:day|morning)|你好|您好)\b", re.I)
_PRICE_RE = re.compile(r"how\s*much|best\s*price|quote|quotation|报价|多少钱", re.I)
_SHIP_RE = re.compile(r"\b(?:ship|shipping|freight|cif|fob|port|eta)\b", re.I)
_UNSURE_RE = re.compile(r"\b(?:maybe|not\s*sure|perhaps|possibly|might\s*be|大概|可能)\b", re.I)


def _norm_engine(raw: str) -> str:
    s = re.sub(r"\s+", "", (raw or "").upper())
    s = s.replace("－", "-")
    return s


def _extract_engine_entities(text: str) -> list[dict[str, Any]]:
    t = text or ""
    found: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(raw: str, conf: float, via: str) -> None:
        norm = _norm_engine(raw)
        if not norm or len(norm) < 2 or norm in seen:
            return
        # Reject pure numbers / too short noise
        if norm.isdigit() or len(norm) > 12:
            return
        seen.add(norm)
        found.append(
            {
                "type": "engine_code",
                "raw_value": raw.strip(),
                "normalized_value": norm,
                "source": "customer_text",
                "confidence": conf,
                "verification_status": "customer_reported",
                "extraction": via,
            }
        )

    for m in _ENGINE_PHRASE.finditer(t):
        add(m.group(1), 0.99 if not _UNSURE_RE.search(t) else 0.55, "phrase")
    for m in _ENGINE_WHITELIST.finditer(t):
        add(m.group(1), 0.95 if not _UNSURE_RE.search(t) else 0.55, "whitelist")
    sm = _STANDALONE_CODE.match(t.strip())
    if sm and not found:
        cand = _norm_engine(sm.group(1))
        # Accept Toyota-like / alphanumeric short codes customers use as engine codes
        if re.match(r"^[0-9]?[A-Z]{1,3}[0-9A-Z\-]{0,8}$", cand) and not cand.isdigit():
            add(sm.group(1), 0.90 if not _UNSURE_RE.search(t) else 0.50, "standalone")
    return found


def understand_message(
    text: str,
    *,
    message_id: str = "",
    conversation_id: str = "",
    message_type: str = "text",
    previous_system_action: str = "",
    previous_customer_engine: str = "",
) -> dict[str, Any]:
    """Return auditable Message Understanding object (no CoT)."""
    raw = (text or "").strip()
    entities = _extract_engine_entities(raw)

    vin_m = _VIN_RE.search(raw)
    if vin_m:
        entities.append(
            {
                "type": "vin",
                "raw_value": vin_m.group(1),
                "normalized_value": vin_m.group(1).upper(),
                "source": "customer_text",
                "confidence": 0.95,
                "verification_status": "customer_reported",
            }
        )

    qty_m = _QTY_RE.search(raw)
    if qty_m:
        q = next((g for g in qty_m.groups() if g), None)
        if q:
            entities.append(
                {
                    "type": "quantity",
                    "raw_value": q,
                    "normalized_value": int(q),
                    "source": "customer_text",
                    "confidence": 0.9,
                    "verification_status": "customer_reported",
                }
            )

    cannot_plate = bool(_NO_PLATE_RE.search(raw))
    can_photo = bool(_CAN_PHOTO_RE.search(raw))
    is_correction = bool(_CORRECTION_RE.search(raw))
    is_clarification = bool(_CLARIFY_RE.search(raw)) or (
        bool(entities)
        and previous_system_action.startswith("ask_")
        and bool(previous_customer_engine)
    )
    is_answer = bool(previous_system_action) and (
        is_clarification or bool(entities) or cannot_plate or can_photo or message_type in {"image", "photo"}
    )

    engine_ents = [e for e in entities if e["type"] == "engine_code"]
    if is_correction and engine_ents and previous_customer_engine:
        # "not 2sz, it is 3sz" — keep last engine entity as correction target
        is_clarification = False

    if _GREETING_RE.match(raw) and not entities:
        act, intent = "greeting", "greeting"
    elif cannot_plate:
        act, intent = "cannot_provide_requested_evidence", "evidence_unavailable"
    elif can_photo and cannot_plate:
        act, intent = "send_alternative_evidence", "alternative_evidence"
    elif is_correction and engine_ents:
        act, intent = "correct_information", "engine_inquiry"
    elif is_clarification and engine_ents:
        act, intent = "clarify_information", "engine_inquiry"
    elif is_answer and engine_ents:
        act, intent = "answer_previous_question", "engine_inquiry"
    elif engine_ents:
        act, intent = "provide_information", "engine_inquiry"
    elif vin_m:
        act, intent = "provide_information", "vin_inquiry"
    elif _PRICE_RE.search(raw):
        act, intent = "ask_price", "price_request"
    elif _SHIP_RE.search(raw):
        act, intent = "ask_shipping", "shipping_request"
    elif message_type in {"image", "photo", "document"}:
        act, intent = "send_alternative_evidence", "media_evidence"
    elif not raw:
        act, intent = "unknown", "unknown"
    else:
        act, intent = "new_request", "general_enquiry"

    if _UNSURE_RE.search(raw) and engine_ents:
        for e in engine_ents:
            e["confidence"] = min(float(e.get("confidence") or 0.9), 0.55)
            e["hedged"] = True

    return {
        "message_id": message_id or f"mu-{uuid.uuid4().hex[:12]}",
        "conversation_id": conversation_id or "",
        "language": "en",
        "message_type": message_type or "text",
        "communicative_act": act,
        "intent": intent,
        "entities": entities,
        "references_previous_turn": bool(previous_system_action) and (is_clarification or is_answer or is_correction),
        "is_clarification": is_clarification,
        "is_correction": is_correction,
        "is_answer_to_previous_question": is_answer,
        "cannot_provide_plate": cannot_plate,
        "offers_photo_alternative": can_photo,
        "unresolved_ambiguities": (["hedged_engine_code"] if any(e.get("hedged") for e in engine_ents) else []),
        "raw_text_excerpt": raw[:200],
    }


def primary_engine_code(understanding: dict[str, Any]) -> str:
    ents = [
        e
        for e in (understanding.get("entities") or [])
        if e.get("type") == "engine_code" and e.get("normalized_value")
    ]
    if not ents:
        return ""
    # "It is not 2sz, it is 3sz" — correction target is the last stated code
    if understanding.get("is_correction") and len(ents) > 1:
        return str(ents[-1]["normalized_value"])
    best = max(ents, key=lambda e: float(e.get("confidence") or 0))
    return str(best["normalized_value"])
