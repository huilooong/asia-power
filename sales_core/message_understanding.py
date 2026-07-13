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
    r"(\d+)\s*(?:pcs|units?|sets?|engines?|pieces?|台|件)\b|"
    r"(?:qty|quantity|数量)\s*[:：]?\s*(\d+)|"
    r"(?:need|want|order)\s+(\d+)\b",
    re.I,
)
# Bare digit / word quantity — only valid as answer when prior ask_quantity
_BARE_QTY_RE = re.compile(r"^\s*(\d{1,4})\s*$")
_WORD_QTY = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "a": 1,
    "an": 1,
}
_WORD_QTY_RE = re.compile(
    r"^\s*(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)"
    r"(?:\s*(?:pcs|units?|sets?|engines?|pieces?|台|件))?\s*$",
    re.I,
)
_DEST_RE = re.compile(
    r"\b("
    r"tema|accra|dubai|lagos|apapa|mombasa|durban|abidjan|dar\s*es\s*salaam|"
    r"jebel\s*ali|sharjah|abu\s*dhabi|rotterdam|hamburg|los\s*angeles|long\s*beach|"
    r"ghana|nigeria|kenya|uae|dubai|tanzania|senegal|ivory\s*coast|cote\s*d'?ivoire|"
    r"south\s*africa|cameroon|benin|togo"
    r")\b|"
    r"(?:port|destination|目的港|港口)\s*[:：]?\s*([A-Za-z][A-Za-z\s\-]{1,40})",
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
_UNSURE_RE = re.compile(
    r"\b(?:maybe|not\s*sure|perhaps|possibly|might\s*be|i\s*think|大概|可能)\b",
    re.I,
)
_MECHANIC_RE = re.compile(r"\bmechanic\s*(?:said|says|told)|师傅\s*(?:说|讲)\b", re.I)

# Product scope answers (APSALES-NLU-002). Order matters — longer phrases first.
_SCOPE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"engine\s*\+\s*gearbox|engine\s+and\s+gearbox|with\s+gearbox", re.I), "engine_gearbox"),
    (re.compile(r"complete\s*engine|full\s*engine", re.I), "complete_engine"),
    (re.compile(r"long\s*block|光机", re.I), "long_block"),
    (re.compile(r"bare\s*engine|engine\s*only|裸机|裸发", re.I), "bare_engine"),
    (re.compile(r"half[\s-]?cut", re.I), "half_cut"),
    (re.compile(r"\bgearbox\b|变速箱", re.I), "gearbox"),
    # Standalone "complete" only valid as answer when prior ask_scope (checked below)
    (re.compile(r"^\s*complete\s*$", re.I), "complete_engine"),
]


def parse_product_scope(text: str, *, previous_system_action: str = "") -> dict[str, Any] | None:
    """Return product_scope entity or None. Standalone 'complete' needs ask_scope context."""
    raw = (text or "").strip()
    if not raw:
        return None
    for pat, normalized in _SCOPE_PATTERNS:
        if not pat.search(raw):
            continue
        # Bare word "complete" only after ask_scope
        if normalized == "complete_engine" and pat.pattern.startswith(r"^\s*complete"):
            if previous_system_action != "ask_scope":
                continue
        return {
            "type": "product_scope",
            "raw_value": raw[:80],
            "normalized_value": normalized,
            "source": "customer_text",
            "confidence": 0.95,
            "verification_status": "customer_reported",
        }
    return None


def parse_quantity(text: str, *, previous_system_action: str = "") -> dict[str, Any] | None:
    """Return quantity entity. Bare digits / word qty only after ask_quantity."""
    raw = (text or "").strip()
    if not raw:
        return None
    q: int | None = None
    conf = 0.9
    m = _QTY_RE.search(raw)
    if m:
        g = next((x for x in m.groups() if x), None)
        if g and str(g).isdigit():
            q = int(g)
    if q is None and previous_system_action == "ask_quantity":
        bm = _BARE_QTY_RE.match(raw)
        if bm:
            q = int(bm.group(1))
            conf = 0.95
        else:
            wm = _WORD_QTY_RE.match(raw)
            if wm:
                q = _WORD_QTY.get(wm.group(1).lower())
                conf = 0.93
    if q is None or q < 1 or q > 9999:
        return None
    return {
        "type": "quantity",
        "raw_value": raw[:40],
        "normalized_value": q,
        "source": "customer_text",
        "confidence": conf,
        "verification_status": "customer_reported",
    }


def parse_destination(text: str, *, previous_system_action: str = "") -> dict[str, Any] | None:
    """Return destination_port entity. Short place names preferred after ask_destination."""
    raw = (text or "").strip()
    if not raw:
        return None
    m = _DEST_RE.search(raw)
    if m:
        val = next((g for g in m.groups() if g), None) or m.group(0)
        norm = re.sub(r"\s+", " ", str(val).strip()).title()
        if norm.lower() in {"port", "destination", "港口", "目的港"}:
            return None
        return {
            "type": "destination_port",
            "raw_value": raw[:80],
            "normalized_value": norm,
            "source": "customer_text",
            "confidence": 0.9,
            "verification_status": "customer_reported",
        }
    # After ask_destination, a short single place token is accepted (e.g. "Tema", "Accra")
    if previous_system_action == "ask_destination":
        if re.match(r"^[A-Za-z][A-Za-z\s\-]{1,40}$", raw) and len(raw) <= 40:
            # Reject greetings / scope words
            reject = {
                "complete",
                "engine",
                "hello",
                "thanks",
                "yes",
                "no",
                "ok",
                "okay",
                "hi",
                "quantity",
            }
            if raw.lower().strip() not in reject and not raw.isdigit():
                return {
                    "type": "destination_port",
                    "raw_value": raw[:80],
                    "normalized_value": raw.strip().title(),
                    "source": "customer_text",
                    "confidence": 0.85,
                    "verification_status": "customer_reported",
                }
    return None


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
        reject = {
            "COMPLETE",
            "ENGINE",
            "PLEASE",
            "HELLO",
            "THANKS",
            "THANK",
            "YES",
            "NO",
            "OK",
            "OKAY",
            "PHOTO",
            "IMAGE",
            "GEARBOX",
            "QUANTITY",
            "PORT",
            "BLOCK",
            "LONG",
            "BARE",
            "FULL",
        }
        # Standalone engine codes must include a digit (2SZ, G4KD, 1NZ) — never plain English words
        if (
            cand not in reject
            and not cand.isdigit()
            and 2 <= len(cand) <= 12
            and any(ch.isdigit() for ch in cand)
            and re.match(r"^[0-9A-Z\-]+$", cand)
        ):
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

    qty_ent = parse_quantity(raw, previous_system_action=previous_system_action)
    if qty_ent:
        entities.append(qty_ent)

    dest_ent = parse_destination(raw, previous_system_action=previous_system_action)
    if dest_ent:
        entities.append(dest_ent)

    scope_ent = parse_product_scope(raw, previous_system_action=previous_system_action)
    if scope_ent:
        entities.append(scope_ent)

    cannot_plate = bool(_NO_PLATE_RE.search(raw))
    can_photo = bool(_CAN_PHOTO_RE.search(raw))
    is_correction = bool(_CORRECTION_RE.search(raw))
    is_clarification = bool(_CLARIFY_RE.search(raw)) or (
        bool([e for e in entities if e.get("type") == "engine_code"])
        and previous_system_action.startswith("ask_")
        and bool(previous_customer_engine)
    )
    # Context-bound answers driven by last_system_action (NLU-002)
    scope_answers_ask = previous_system_action == "ask_scope" and bool(scope_ent)
    qty_answers_ask = previous_system_action == "ask_quantity" and bool(qty_ent)
    dest_answers_ask = previous_system_action == "ask_destination" and bool(dest_ent)
    vin_answers_ask = previous_system_action in {"ask_vin", "ask_vin_plate"} and bool(vin_m)
    image_answers_evidence = previous_system_action in {
        "ask_engine_plate",
        "ask_engine_photo",
        "ask_vin_plate",
        "ask_vehicle_photo",
        "ask_oe_label",
    } and message_type in {"image", "photo", "document"}
    is_answer = bool(previous_system_action) and (
        is_clarification
        or bool(entities)
        or cannot_plate
        or can_photo
        or scope_answers_ask
        or qty_answers_ask
        or dest_answers_ask
        or vin_answers_ask
        or image_answers_evidence
        or message_type in {"image", "photo"}
    )

    engine_ents = [e for e in entities if e["type"] == "engine_code"]
    if is_correction and engine_ents and previous_customer_engine:
        # "not 2sz, it is 3sz" — keep last engine entity as correction target
        is_clarification = False

    if message_type in {"image", "photo", "document"} and not raw:
        act, intent = "send_alternative_evidence", "media_evidence"
    elif _GREETING_RE.match(raw) and not entities:
        act, intent = "greeting", "greeting"
    elif cannot_plate:
        act, intent = "cannot_provide_requested_evidence", "evidence_unavailable"
    elif can_photo and cannot_plate:
        act, intent = "send_alternative_evidence", "alternative_evidence"
    elif scope_answers_ask:
        # Context-bound: same words without ask_scope may be new_request
        act, intent = "answer_previous_question", "provide_scope"
    elif qty_answers_ask:
        act, intent = "answer_previous_question", "provide_quantity"
    elif dest_answers_ask:
        act, intent = "answer_previous_question", "provide_destination"
    elif vin_answers_ask:
        act, intent = "answer_previous_question", "provide_vin"
    elif image_answers_evidence:
        act, intent = "send_alternative_evidence", "media_evidence"
    elif scope_ent and not previous_system_action:
        act, intent = "new_request", "provide_scope"
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
    elif qty_ent and not previous_system_action:
        act, intent = "provide_information", "provide_quantity"
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
    if _MECHANIC_RE.search(raw) and engine_ents:
        for e in engine_ents:
            e["confidence"] = min(float(e.get("confidence") or 0.9), 0.70)
            e["secondary_source"] = "mechanic"
            e["soft_hedge"] = True

    ambiguities: list[str] = []
    if any(e.get("hedged") for e in engine_ents):
        ambiguities.append("hedged_engine_code")
    if any(e.get("soft_hedge") or e.get("secondary_source") == "mechanic" for e in engine_ents):
        ambiguities.append("secondary_source_claim")

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
        "unresolved_ambiguities": ambiguities,
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
