#!/usr/bin/env python3
"""APSALES-DECISION-001 — Commercial Decision Rules V1.

Falls inside existing Sales Decision. No new Engine.
No hidden CoT — only auditable Commercial Decision Records.
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "commercial-decision-v1.json"

_DEFAULT_CONFIG: dict[str, Any] = {
    "version": "v1",
    "confidence": {"advance_min": 0.90, "caution_min": 0.60},
    "whatsapp_channel": {
        "max_words": 60,
        "max_paragraphs": 3,
        "max_questions": 2,
        "default_questions": 1,
        "include_website_by_default": False,
        "forbid_phrases": [
            "Dear Customer",
            "Dear Sir",
            "Best regards",
            "Looking forward to your reply",
            "AsiaPower Sales Team",
        ],
    },
    "wholesaler_quantity_min": 5,
    "known_wholesaler_hashes": [],
    "engine_code_pattern": (
        r"\b(G4K[A-Z0-9]+|G4NA|G4FC|G4FG|HR1[56]DE|MR20DE|QR25DE?|VQ35DE?|"
        r"[123][A-Z]{2}(?:-[A-Z0-9]+)?|1NZ|2NZ|2AZ|1AZ|1KD(?:-FTV)?|2KD(?:-FTV)?|"
        r"2TR(?:-FE)?|K24A\d?|R20A\d?)\b"
    ),
}
_ENGINE_PHRASE_RE = re.compile(
    r"(?:engine\s*code|engine\s*no\.?|engine\s*number|code\s*is)\s*(?:is|为|：|:)?\s*"
    r"([A-Z0-9][A-Z0-9\-]{1,11})",
    re.I,
)

_SCOPE_RE = re.compile(
    r"long\s*block|complete\s*engine|full\s*engine|bare\s*engine|engine\s*only|"
    r"engine\s*\+\s*gearbox|with\s+gearbox|half[\s-]?cut|gearbox|变速箱|光机|总成|"
    r"^\s*complete\s*$",
    re.I,
)
_QTY_RE = re.compile(
    r"(\d+)\s*(?:pcs|units?|sets?|engines?|台|件)\b|"
    r"(?:qty|quantity|数量)\s*[:：]?\s*(\d+)|"
    r"(?:need|want|order)\s+(\d+)\b",
    re.I,
)
_PORT_RE = re.compile(
    r"\b(port|tema|lagos|mombasa|durban|abidjan|harbour|harbor|港口|apapa)\b",
    re.I,
)
_PRICE_RE = re.compile(
    r"how\s*much|best\s*price|lowest\s*price|\bquotation\b|\bquote\b|\bpricing\b|"
    r"\bcost\b|报价|多少钱|什么价|价格",
    re.I,
)
_VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{11,17})\b", re.I)
_CONFLICT_HINT_RE = re.compile(
    r"conflict|doesn'?t match|not matching|wrong engine|different engine|"
    r"replaced engine|swapped engine|changed engine",
    re.I,
)
_PLATE_HINT_RE = re.compile(r"plate|铭牌|nameplate|engine\s*label", re.I)
_PHOTO_HINT_RE = re.compile(r"photo|picture|image|照片|pic\b", re.I)
_WHOLESALER_HINT_RE = re.compile(
    r"wholesaler|wholesale|distributor|dealer|批量|批发",
    re.I,
)

_ASK_LABELS = {
    "ask_scope": "Long block or complete engine?",
    "ask_quantity": "Quantity?",
    "ask_destination": "Destination port?",
    "ask_engine_plate": "Clear photo of the engine plate/nameplate?",
    "ask_engine_photo": "Clear photo of the engine currently installed?",
    "ask_vin": "VIN (or VIN plate photo)?",
    "ask_vin_plate": "VIN plate photo?",
    "ask_oe_label": "OE / parts label photo?",
    "ask_vehicle_photo": "Vehicle photo?",
    "ask_registration": "Vehicle registration photo?",
}


def load_config(path: Path | None = None) -> dict[str, Any]:
    p = path or CONFIG_PATH
    cfg = json.loads(json.dumps(_DEFAULT_CONFIG))
    if p.is_file():
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                cfg.update(raw)
                if isinstance(raw.get("confidence"), dict):
                    cfg["confidence"] = {**_DEFAULT_CONFIG["confidence"], **raw["confidence"]}
                if isinstance(raw.get("whatsapp_channel"), dict):
                    cfg["whatsapp_channel"] = {
                        **_DEFAULT_CONFIG["whatsapp_channel"],
                        **raw["whatsapp_channel"],
                    }
        except (json.JSONDecodeError, OSError):
            pass
    return cfg


def _engine_code_re(cfg: dict[str, Any]) -> re.Pattern[str]:
    return re.compile(
        str(cfg.get("engine_code_pattern") or _DEFAULT_CONFIG["engine_code_pattern"]),
        re.I,
    )


@dataclass
class ActionScore:
    action: str
    score: float = 0.0
    sales_progress: float = 0.0
    risk_reduction: float = 0.0
    evidence_gain: float = 0.0
    customer_effort: float = 0.0
    delay_cost: float = 0.0

    def compute(self) -> float:
        self.score = (
            self.sales_progress
            + self.risk_reduction
            + self.evidence_gain
            - self.customer_effort
            - self.delay_cost
        )
        return self.score


@dataclass
class CommercialDecision:
    decision_id: str = ""
    conversation_id: str = ""
    customer_intent: str = "unknown"
    customer_type: str = "unknown"
    product_type: str = "unknown"
    claimed_identity: dict[str, Any] = field(default_factory=dict)
    evidence: list[dict[str, Any]] = field(default_factory=list)
    evidence_confidence: float = 0.0
    commercial_risk: str = "medium"
    risk_reasons: list[str] = field(default_factory=list)
    known: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    sales_stage: str = "identify"
    objective: str = ""
    next_best_action: str = "wait_customer"
    expected_result: str = ""
    alternative_actions: list[str] = field(default_factory=list)
    human_review_required: bool = False
    decision_reason: str = ""
    ask_keys: list[str] = field(default_factory=list)
    ask_list: list[str] = field(default_factory=list)
    reply: str = ""
    module: str = "SALES_DECISION"
    version: str = "commercial_decision_v1"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _extract_qty(text: str) -> int | None:
    m = _QTY_RE.search(text or "")
    if not m:
        return None
    raw = m.group(1) or m.group(2) or m.group(3)
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _has_scope(text: str) -> bool:
    return bool(_SCOPE_RE.search(text or ""))


def _has_port(text: str) -> bool:
    return bool(_PORT_RE.search(text or ""))


def _extract_engine_code(text: str, cfg: dict[str, Any]) -> str:
    t = text or ""
    pm = _ENGINE_PHRASE_RE.search(t)
    if pm:
        return re.sub(r"\s+", "", pm.group(1).upper())
    m = _engine_code_re(cfg).search(t)
    if m:
        return re.sub(r"\s+", "", m.group(1).upper())
    # Standalone short code (e.g. "2sz")
    sm = re.match(r"^\s*([A-Z0-9][A-Z0-9\-]{1,11})\s*$", t.strip(), re.I)
    if sm:
        cand = re.sub(r"\s+", "", sm.group(1).upper())
        if re.match(r"^[0-9]?[A-Z]{1,3}[0-9A-Z\-]{0,8}$", cand) and not cand.isdigit():
            return cand
    return ""


def _word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", text or ""))


def _question_count(text: str) -> int:
    return (text or "").count("?")


def apply_channel_policy(reply: str, cfg: dict[str, Any] | None = None) -> str:
    """WhatsApp policy: compress if over limit; never naive mid-word truncate."""
    cfg = cfg or load_config()
    ch = cfg.get("whatsapp_channel") or {}
    text = (reply or "").strip()
    for phrase in ch.get("forbid_phrases") or []:
        text = re.sub(re.escape(phrase), "", text, flags=re.I)
    text = re.sub(
        r"(?:^|\n)\s*(?:MEMORY_TO_SAVE|DECISION_TO_SAVE|APPROVAL_REQUEST|APPROVAL_REQUIRED|"
        r"INTERNAL_NOTE|SYSTEM|DEBUG)\s*:.*$",
        "",
        text,
        flags=re.I | re.M,
    )
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not ch.get("include_website_by_default", False):
        text = re.sub(r"\n*www\.asia-power\.com\n*", "\n", text).strip()

    max_words = int(ch.get("max_words") or 60)
    max_paras = int(ch.get("max_paragraphs") or 3)
    max_q = int(ch.get("max_questions") or 2)

    if _word_count(text) > max_words or _question_count(text) > max_q:
        paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        kept: list[str] = []
        for p in paras[:max_paras]:
            sents = re.split(r"(?<=[.!?])\s+", p)
            chunk: list[str] = []
            for s in sents:
                trial = " ".join(chunk + [s]).strip()
                if _word_count("\n\n".join(kept + [trial])) > max_words:
                    break
                chunk.append(s)
            if chunk:
                kept.append(" ".join(chunk))
            if _word_count("\n\n".join(kept)) >= max_words - 5:
                break
        text = "\n\n".join(kept).strip() or (text.split("\n")[0][:180])

    if _question_count(text) > max_q:
        out_parts: list[str] = []
        q_seen = 0
        for sent in re.split(r"(?<=[.!?])\s+", text):
            if "?" in sent:
                if q_seen >= max_q:
                    continue
                q_seen += 1
            out_parts.append(sent)
        text = " ".join(out_parts).strip()
    return text.strip()


def _score_pick(candidates: list[ActionScore]) -> tuple[str, list[str]]:
    for c in candidates:
        c.compute()
    ranked = sorted(candidates, key=lambda c: c.score, reverse=True)
    if not ranked:
        return "wait_customer", []
    return ranked[0].action, [c.action for c in ranked[1:4]]


def _customer_type(
    text: str,
    *,
    customer_hash: str,
    cfg: dict[str, Any],
    qty: int | None,
) -> str:
    hashes = {str(h) for h in (cfg.get("known_wholesaler_hashes") or [])}
    if customer_hash and customer_hash in hashes:
        return "wholesaler"
    if _WHOLESALER_HINT_RE.search(text or ""):
        return "wholesaler"
    min_q = int(cfg.get("wholesaler_quantity_min") or 5)
    if qty is not None and qty >= min_q:
        return "wholesaler"
    if re.search(r"workshop|garage|mechanic|维修", text or "", re.I):
        return "repairer"
    return "unknown"


def _base_confidence_from_snapshot(snapshot: Any | None) -> float:
    if snapshot is None:
        return 0.0
    ok = bool(getattr(snapshot, "ok", False))
    vs = str(getattr(snapshot, "verification_status", "") or "")
    engine = str(getattr(snapshot, "engine_code", "") or "")
    if vs in {"verified", "manual_reviewed"}:
        return 0.95 if engine else 0.92
    if getattr(snapshot, "knowledge_hit", False) and ok:
        return 0.91 if engine else 0.88
    if ok and vs == "provider_reported":
        return 0.72 if engine else 0.65
    if ok:
        return 0.62
    return 0.35


def _AS(
    action: str,
    sp: float,
    rr: float,
    eg: float,
    ce: float,
    dc: float,
) -> ActionScore:
    return ActionScore(
        action=action,
        sales_progress=sp,
        risk_reduction=rr,
        evidence_gain=eg,
        customer_effort=ce,
        delay_cost=dc,
    )


def decide_commercial(
    message: str,
    *,
    snapshot: Any | None = None,
    customer_hash: str = "",
    conversation_id: str = "",
    media_type: str = "",
    conflict: bool = False,
    plate_evidence: bool = False,
    photo_evidence: bool = False,
    plate_engine_code: str = "",
    config: dict[str, Any] | None = None,
    prior_state: dict[str, Any] | None = None,
    understanding: dict[str, Any] | None = None,
) -> CommercialDecision:
    """Return one next_best_action + auditable record + channel reply.

    APSALES-NLU-001: may consume structured prior_state / understanding.
    Commercial Decision still does not invent NLU — it uses merged facts.
    """
    cfg = config or load_config()
    advance_min = float((cfg.get("confidence") or {}).get("advance_min", 0.90))
    caution_min = float((cfg.get("confidence") or {}).get("caution_min", 0.60))

    text = (message or "").strip()
    qty = _extract_qty(text)
    engine_claim = _extract_engine_code(text, cfg)
    prior = prior_state or {}
    prior_cr = prior.get("customer_reported") or {}
    prior_engine = str(prior_cr.get("engine_code") or "")
    prior_asked = list(prior.get("asked_actions") or [])
    unavailable = set(prior.get("unavailable_evidence") or [])
    last_action = str(prior.get("last_system_action") or "")
    if qty is None and prior_cr.get("quantity") is not None:
        try:
            qty = int(prior_cr.get("quantity"))
        except (TypeError, ValueError):
            qty = prior_cr.get("quantity")

    # Merge conversation state: customer already claimed an engine code
    if not engine_claim and prior_engine:
        engine_claim = prior_engine
    if understanding:
        try:
            from sales_core.message_understanding import primary_engine_code

            pe = primary_engine_code(understanding)
            if pe:
                engine_claim = pe
        except Exception:
            for e in understanding.get("entities") or []:
                if e.get("type") == "engine_code" and e.get("normalized_value"):
                    engine_claim = str(e["normalized_value"])
                    break
        if understanding.get("cannot_provide_plate"):
            unavailable.add("engine_plate")
        if understanding.get("offers_photo_alternative"):
            photo_evidence = photo_evidence or False
            prior_cr = {**prior_cr, "offers_engine_photo": True}

    has_vin = bool(_VIN_RE.search(text)) or bool(
        getattr(snapshot, "vin", "") if snapshot else ""
    ) or bool(prior_cr.get("vin"))
    # Scope from this message OR prior known/customer_reported OR understanding entity
    prior_scope = str(
        (prior.get("known") or {}).get("product_scope")
        or prior_cr.get("product_scope")
        or ""
    )
    understanding_scope = ""
    if understanding:
        for e in understanding.get("entities") or []:
            if e.get("type") == "product_scope" and e.get("normalized_value"):
                understanding_scope = str(e["normalized_value"])
                break
    has_scope = bool(_has_scope(text) or prior_scope or understanding_scope)
    product_scope_value = understanding_scope or prior_scope or ""
    if has_scope and not product_scope_value and _has_scope(text):
        try:
            from sales_core.message_understanding import parse_product_scope

            pe = parse_product_scope(text, previous_system_action=last_action)
            if pe:
                product_scope_value = str(pe.get("normalized_value") or "")
        except Exception:
            product_scope_value = "complete_engine" if re.search(r"complete", text, re.I) else "known_scope"

    has_port = _has_port(text)
    price_intent = bool(_PRICE_RE.search(text))
    ctype = _customer_type(text, customer_hash=customer_hash, cfg=cfg, qty=qty)

    plate_evidence = plate_evidence or bool(_PLATE_HINT_RE.search(text) and media_type)
    photo_evidence = photo_evidence or (
        media_type in {"image", "photo"} or bool(_PHOTO_HINT_RE.search(text) and media_type)
    )
    # Image after we asked for plate/photo counts as evidence received (pending review)
    if media_type in {"image", "photo", "document"} and (
        prior.get("requested_evidence_received")
        or last_action in {"ask_engine_plate", "ask_engine_photo"}
        or prior.get("last_requested_evidence") in {"engine_plate", "engine_photo"}
    ):
        photo_evidence = True
    conflict = conflict or bool(_CONFLICT_HINT_RE.search(text))
    if plate_engine_code and engine_claim and plate_engine_code.upper() != engine_claim.upper():
        conflict = True
    snap_engine = str(getattr(snapshot, "engine_code", "") or "") if snapshot else ""
    if plate_engine_code and snap_engine and plate_engine_code.upper() != snap_engine.upper():
        conflict = True

    evidence: list[dict[str, Any]] = []
    if has_vin and snapshot is not None:
        evidence.append(
            {
                "type": "vin_snapshot",
                "source": getattr(snapshot, "provider_source", "vin"),
                "verification_status": getattr(snapshot, "verification_status", "unverified"),
                "confidence": getattr(snapshot, "confidence", "none"),
            }
        )
    if engine_claim:
        evidence.append(
            {
                "type": "claimed_engine_code",
                "source": "customer_text",
                "value": engine_claim,
                "verification_status": "customer_reported",
            }
        )
    if plate_evidence:
        evidence.append({"type": "engine_plate", "source": "customer_media"})
    if photo_evidence:
        evidence.append({"type": "engine_photo", "source": "customer_media"})

    conf = _base_confidence_from_snapshot(snapshot)
    if plate_evidence and not conflict:
        conf = max(conf, 0.91)
    if photo_evidence and not conflict:
        conf = max(conf, 0.75)
    if engine_claim and ctype == "wholesaler" and (qty or 0) >= int(
        cfg.get("wholesaler_quantity_min") or 5
    ):
        conf = max(conf, 0.88)

    policy = cfg.get("customer_reported_policy") or {}
    working_min = float(
        (cfg.get("confidence") or {}).get("customer_reported_working_min", 0.72)
    )
    confusion_codes = {
        str(x).upper() for x in (policy.get("high_confusion_engine_codes") or [])
    }
    repairer_verify = bool(policy.get("repairer_default_verify", True))

    claim_hedged = False
    claim_secondary = False
    if understanding:
        for e in understanding.get("entities") or []:
            if e.get("type") != "engine_code":
                continue
            if e.get("hedged"):
                claim_hedged = True
            if e.get("soft_hedge") or e.get("secondary_source") == "mechanic":
                claim_secondary = True
        if "hedged_engine_code" in (understanding.get("unresolved_ambiguities") or []):
            claim_hedged = True
        if "secondary_source_claim" in (understanding.get("unresolved_ambiguities") or []):
            claim_secondary = True
    if re.search(r"\b(?:maybe|not\s*sure|i\s*think|perhaps|possibly|might\s*be)\b", text, re.I):
        claim_hedged = True
    if re.search(r"\bmechanic\s*(?:said|says|told)\b", text, re.I):
        claim_secondary = True

    high_confusion = bool(engine_claim and engine_claim.upper() in confusion_codes)
    # CEO 2026-07-13: customer_reported is a usable working assumption — not ignored,
    # and not "default distrust". Verify only when commercial risk justifies it.
    needs_verify = bool(
        conflict
        or claim_hedged
        or claim_secondary
        or (repairer_verify and ctype == "repairer")
        or (high_confusion and ctype == "repairer")
    )
    # Clear customer claim → usable working confidence (still ≠ verified)
    if engine_claim and not plate_evidence and not photo_evidence and not conflict:
        if needs_verify and (claim_hedged or claim_secondary):
            conf = min(conf, 0.50) if conf else 0.45
        elif needs_verify and ctype == "repairer":
            conf = min(conf, 0.48) if conf else 0.45
        else:
            conf = max(conf, working_min)

    if conflict:
        conf = min(conf, 0.35)
    # Clarification of same code raises claim confidence slightly (still not verified)
    if understanding and understanding.get("is_clarification") and engine_claim and not claim_hedged:
        conf = max(conf, working_min)

    known: list[str] = []
    missing: list[str] = []
    if has_vin:
        known.append("vin")
    if snap_engine:
        known.append("vin_engine_code")
    if engine_claim:
        known.append("claimed_engine_code")
    if has_scope:
        known.append("product_scope")
        if product_scope_value:
            known.append(f"product_scope:{product_scope_value}")
    else:
        missing.append("product_scope")
    if qty is not None:
        known.append("quantity")
    else:
        missing.append("quantity")
    if has_port:
        known.append("destination_port")
    else:
        missing.append("destination_port")
    if plate_evidence:
        known.append("engine_plate")
    if photo_evidence:
        known.append("engine_photo")

    risk_reasons: list[str] = []
    if conflict:
        risk_reasons.append("vin_or_claim_conflicts_with_installed_engine_evidence")
    if engine_claim and needs_verify and not plate_evidence and not photo_evidence:
        if claim_hedged:
            risk_reasons.append("customer_uncertainty_hedged_claim")
        elif claim_secondary:
            risk_reasons.append("secondary_source_claim_needs_soft_verify")
        elif ctype == "repairer":
            risk_reasons.append("repairer_high_mismatch_cost")
        else:
            risk_reasons.append("verification_justified_by_commercial_risk")
    if snapshot is not None and not getattr(snapshot, "ok", False) and has_vin:
        risk_reasons.append("vin_decode_failed_or_low_trust")
    if price_intent and conf < advance_min and needs_verify:
        risk_reasons.append("price_intent_with_insufficient_identity_confidence")

    if conflict or (needs_verify and engine_claim and conf < caution_min and ctype != "wholesaler"):
        commercial_risk = "high"
    elif engine_claim and not plate_evidence and not photo_evidence:
        commercial_risk = "medium"  # working assumption — usable, not verified
    elif conf < advance_min:
        commercial_risk = "medium"
    else:
        commercial_risk = "low"

    if conflict:
        intent = "identity_conflict"
    elif has_vin:
        intent = "vin_provided"
    elif price_intent:
        intent = "price_request"
    elif engine_claim:
        intent = "engine_code_claim"
    elif media_type in {"image", "photo", "document"}:
        intent = "media_evidence"
    else:
        intent = "general_enquiry"

    product_type = "engine"
    if re.search(r"gearbox|变速箱", text, re.I):
        product_type = "gearbox"
    elif re.search(r"half[\s-]?cut", text, re.I):
        product_type = "half_cut"

    candidates: list[ActionScore] = []
    human = False
    stage = "identify"
    objective = ""
    reason = ""

    plate_already_asked = "ask_engine_plate" in prior_asked or last_action == "ask_engine_plate"
    plate_unavailable = "engine_plate" in unavailable
    clarifying_claim = bool(
        understanding
        and (understanding.get("is_clarification") or understanding.get("is_answer_to_previous_question"))
        and engine_claim
    )
    scope_just_answered = bool(
        understanding
        and understanding.get("communicative_act") == "answer_previous_question"
        and understanding.get("intent") == "provide_scope"
    ) or (last_action == "ask_scope" and has_scope)
    image_fulfills_request = bool(
        photo_evidence
        and (
            last_action in {"ask_engine_plate", "ask_engine_photo"}
            or prior.get("last_requested_evidence") in {"engine_plate", "engine_photo"}
            or prior.get("requested_evidence_received")
            or prior.get("pending_image_review")
        )
    )

    if conflict:
        candidates = [
            _AS("request_manual_review", 1, 5, 2, 1, 1),
            _AS("ask_engine_plate", 2, 4, 4, 2, 1),
            _AS("decline_wrong_supply", 0, 5, 0, 1, 2),
        ]
        stage, objective = "manual_review", "Resolve factory vs installed engine conflict"
        reason = "Conflict — Trust First; do not auto-pick VIN"
        human = True
    elif image_fulfills_request:
        # P1: image received for requested evidence — never re-ask same plate/photo
        if engine_claim and not has_scope:
            candidates = [_AS("ask_scope", 4, 1, 1, 1, 0)]
            stage, objective = "scope", "Image received; continue commercial"
        elif engine_claim and qty is None:
            candidates = [_AS("ask_quantity", 4, 1, 1, 1, 0)]
            stage, objective = "commercial_fields", "Image received; quantity next"
        elif engine_claim and not has_port:
            candidates = [_AS("ask_destination", 4, 1, 1, 1, 0)]
            stage, objective = "commercial_fields", "Image received; destination next"
        elif engine_claim:
            candidates = [_AS("check_supplier", 4, 1, 0, 0, 0), _AS("prepare_quote", 4, 1, 0, 0, 1)]
            stage, objective = "quote_ready", "Image received; advance"
        else:
            candidates = [_AS("request_manual_review", 3, 2, 2, 1, 0)]
            stage, objective = "manual_review", "Pending image review"
        reason = "Customer sent requested image — acknowledge; do not re-ask"
        commercial_risk = "medium"
    elif has_vin and snapshot is not None and not getattr(snapshot, "ok", False):
        candidates = [
            _AS("ask_engine_plate", 3, 4, 4, 2, 1),
            _AS("ask_engine_photo", 2, 3, 3, 2, 1),
            _AS("ask_vin_plate", 2, 3, 3, 2, 1),
            _AS("ask_registration", 1, 2, 2, 2, 1),
        ]
        stage, objective = "confirm_identity", "One high-value evidence after VIN failure"
        reason = "VIN failed/low trust — not scope/qty/port trio"
    elif engine_claim and ctype == "wholesaler" and conf >= caution_min:
        if not has_scope:
            candidates = [_AS("ask_scope", 4, 1, 1, 1, 0)]
            stage = "scope"
        elif qty is None:
            candidates = [_AS("ask_quantity", 4, 1, 1, 1, 0)]
            stage = "commercial_fields"
        elif not has_port:
            candidates = [_AS("ask_destination", 4, 1, 1, 1, 0)]
            stage = "commercial_fields"
        else:
            candidates = [_AS("check_supplier", 5, 1, 0, 0, 0), _AS("prepare_quote", 5, 1, 0, 0, 1)]
            stage = "quote_ready"
        objective = "Advance wholesale with low identity friction"
        reason = "Wholesaler/batch — reduce friction unless anomaly"
        commercial_risk = "low" if conf >= advance_min else "medium"
    elif engine_claim and needs_verify and conf < caution_min:
        # Verify only when risk justifies — not default distrust
        if plate_unavailable or clarifying_claim or plate_already_asked:
            candidates = [
                _AS("ask_engine_photo", 3, 4, 4, 2, 1),
                _AS("ask_vin", 2, 3, 3, 2, 1),
                _AS("ask_registration", 1, 2, 2, 2, 1),
            ]
            stage, objective = "confirm_identity", "Acknowledge claim; alternate evidence"
            reason = "Verification justified; do not re-ask plate"
        else:
            soft = claim_hedged or claim_secondary
            candidates = [
                _AS("ask_engine_photo" if soft else "ask_engine_plate", 2, 5 if not soft else 4, 5 if not soft else 4, 2, 1),
                _AS("ask_engine_photo", 2, 4, 4, 2, 1),
                _AS("ask_vin", 2, 3, 3, 2, 1),
            ]
            stage, objective = "confirm_identity", "Soft-verify before wrong supply"
            reason = (
                "Customer uncertain / secondary source — soft verify"
                if soft
                else "Repairer / high mismatch cost — verify installed engine"
            )
        commercial_risk = "high"
    elif engine_claim and conf >= caution_min:
        # Working assumption: advance commercial conversation; verify later if quoting/shipping
        has_installed_evidence = bool(plate_evidence or photo_evidence)
        about_to_commit = price_intent or (has_scope and qty is not None and has_port)
        if (
            about_to_commit
            and not has_installed_evidence
            and not has_vin
            and conf < advance_min
        ):
            candidates = [
                _AS("ask_engine_photo", 3, 4, 4, 2, 1),
                _AS("ask_vin", 2, 3, 3, 2, 1),
                _AS("ask_engine_plate", 2, 3, 3, 2, 1),
            ]
            stage, objective = "confirm_identity", "Verify before quote / supply"
            reason = "Working assumption OK earlier; verify now before quote/purchase/ship"
            commercial_risk = "medium"
        elif not has_scope:
            candidates = [_AS("ask_scope", 4, 1, 1, 1, 0)]
            stage, objective = "scope", "Advance on customer_reported working assumption"
            reason = "customer_reported usable — not ignored; not yet verified"
            commercial_risk = "medium"
        elif qty is None:
            candidates = [_AS("ask_quantity", 4, 1, 1, 1, 0)]
            stage, objective = "commercial_fields", "Quantity next"
            reason = "Working assumption engine code — reduce friction"
        elif not has_port:
            candidates = [_AS("ask_destination", 4, 1, 1, 1, 0)]
            stage, objective = "commercial_fields", "Destination next"
            reason = "Working assumption engine code — reduce friction"
        elif has_installed_evidence or conf >= advance_min:
            candidates = [_AS("prepare_quote", 5, 1, 0, 0, 0), _AS("check_supplier", 5, 1, 0, 0, 1)]
            stage, objective = "quote_ready", "Quote path ready"
            reason = "Fields complete with installed-engine evidence or high confidence"
            commercial_risk = "low" if conf >= advance_min else "medium"
        else:
            candidates = [
                _AS("ask_engine_photo", 3, 4, 4, 2, 1),
                _AS("prepare_quote", 4, 1, 0, 0, 1),
            ]
            stage, objective = "confirm_identity", "Verify before quote"
            reason = "Fields complete — verify once before formal quote"
            commercial_risk = "medium"
    elif has_vin and getattr(snapshot, "ok", False):
        if conf >= advance_min or (conf >= caution_min and has_scope):
            if not has_scope:
                candidates = [_AS("ask_scope", 4, 1, 1, 1, 0)]
                stage = "scope"
            elif qty is None:
                candidates = [_AS("ask_quantity", 4, 1, 1, 1, 0)]
                stage = "commercial_fields"
            elif not has_port:
                candidates = [_AS("ask_destination", 4, 1, 1, 1, 0)]
                stage = "commercial_fields"
            else:
                candidates = [_AS("prepare_quote", 5, 1, 0, 0, 0)]
                stage = "quote_ready"
            objective = "Advance with VIN identity; no stock/price promise"
            reason = "VIN usable; VIN ≠ installed engine if later conflict"
        else:
            candidates = [
                _AS("ask_engine_plate", 3, 4, 4, 2, 1),
                _AS("ask_scope", 3, 1, 1, 1, 0),
            ]
            stage, objective = "confirm_identity", "Prefer plate when engine match matters"
            reason = "Provider-reported VIN — prefer installed-engine confirm"
    elif price_intent:
        if conf >= advance_min:
            if not has_scope:
                candidates = [_AS("ask_scope", 4, 1, 1, 1, 0)]
            elif qty is None:
                candidates = [_AS("ask_quantity", 4, 1, 1, 1, 0)]
            elif not has_port:
                candidates = [_AS("ask_destination", 4, 1, 1, 1, 0)]
            else:
                candidates = [_AS("prepare_quote", 5, 1, 0, 0, 0)]
            stage, objective = "commercial_fields", "Price intent with enough identity"
            reason = "Business First: advance, do not invent price"
        else:
            candidates = [
                _AS("ask_engine_plate", 2, 4, 4, 2, 1),
                _AS("ask_vin", 2, 3, 3, 2, 1),
                _AS("ask_engine_photo", 2, 3, 3, 2, 1),
            ]
            stage, objective = "confirm_identity", "Price intent but weak identity"
            reason = "Do not quote; do not dead-end; one identity ask"
    elif conf >= advance_min:
        if not has_scope:
            candidates = [_AS("ask_scope", 4, 1, 1, 1, 0)]
            stage, objective, reason = "scope", "Confirm purchase form", ">=90% — scope only"
        elif qty is None:
            candidates = [_AS("ask_quantity", 4, 1, 1, 1, 0)]
            stage, objective, reason = "commercial_fields", "Confirm quantity", "scope known"
        elif not has_port:
            candidates = [_AS("ask_destination", 4, 1, 1, 1, 0)]
            stage, objective, reason = "commercial_fields", "Confirm destination", "qty known"
        else:
            candidates = [_AS("prepare_quote", 5, 1, 0, 0, 0)]
            stage, objective, reason = "quote_ready", "Quote path ready", "fields complete"
    else:
        candidates = [
            _AS("ask_engine_plate", 2, 3, 3, 2, 1),
            _AS("ask_vin", 2, 3, 3, 2, 1),
            _AS("ask_scope", 2, 1, 1, 1, 0),
        ]
        stage, objective, reason = "identify", "Highest-value next fact", "Default cautious"

    if commercial_risk == "high" and conf < caution_min and engine_claim and ctype != "wholesaler" and needs_verify:
        if not any(c.action == "request_manual_review" for c in candidates):
            candidates.insert(0, _AS("request_manual_review", 1, 5, 2, 1, 1))
        if not plate_evidence and not plate_already_asked and not plate_unavailable and not clarifying_claim:
            for c in candidates:
                if c.action == "ask_engine_plate":
                    c.risk_reduction += 1
                    c.evidence_gain += 1
            human = False
            reason = "Verification justified by commercial risk — not default distrust"
        elif clarifying_claim or plate_already_asked or plate_unavailable:
            candidates = [c for c in candidates if c.action != "ask_engine_plate"]
            if not any(c.action == "ask_engine_photo" for c in candidates):
                candidates.insert(0, _AS("ask_engine_photo", 3, 4, 4, 2, 1))
            human = False
            reason = "Risk path but claim clarified — alternate evidence"
        else:
            human = True
            reason = "High risk after evidence — human review (Trust First)"

    # Dead-loop soft filter inside candidate list
    if last_action:
        candidates = [c for c in candidates if c.action != last_action] or candidates
    if plate_unavailable or image_fulfills_request or prior.get("requested_evidence_received"):
        candidates = [c for c in candidates if c.action not in {"ask_engine_plate", "ask_engine_photo"}] or [
            c for c in candidates if c.action != "ask_engine_plate"
        ] or candidates
    if scope_just_answered:
        candidates = [c for c in candidates if c.action != "ask_scope"] or candidates
        # Prefer commercial advance after scope answer — strip identity asks unless high-risk conflict
        if not conflict and commercial_risk != "high":
            stripped = [
                c
                for c in candidates
                if c.action
                in {"ask_quantity", "ask_destination", "check_supplier", "prepare_quote", "request_manual_review"}
            ]
            if stripped:
                candidates = stripped

    nba, alts = _score_pick(candidates)
    if nba == "ask_scope" and has_scope:
        nba = "ask_quantity" if qty is None else ("ask_destination" if not has_port else "prepare_quote")
    if nba == "ask_quantity" and qty is not None:
        nba = "ask_destination" if not has_port else "prepare_quote"
    if nba == "ask_destination" and has_port:
        nba = "prepare_quote"
    if nba == last_action:
        for alt in alts + ["ask_engine_photo", "ask_vin", "request_manual_review"]:
            if alt != last_action:
                nba = alt
                break

    expected_map = {
        "ask_engine_plate": "sent_engine_plate",
        "ask_engine_photo": "sent_engine_photo",
        "ask_vin": "sent_vin",
        "ask_vin_plate": "sent_vin",
        "ask_scope": "confirmed_scope",
        "ask_quantity": "confirmed_quantity",
        "ask_destination": "confirmed_destination",
        "check_supplier": "entered_supplier_check",
        "prepare_quote": "entered_quote_preparation",
        "request_manual_review": "manual_review_required",
        "decline_wrong_supply": "wrong_identity_detected",
    }
    ask_keys = [nba] if nba in _ASK_LABELS else []
    ask_list = [_ASK_LABELS[nba]] if nba in _ASK_LABELS else []

    acknowledge_claim = bool(engine_claim) and (
        clarifying_claim
        or plate_already_asked
        or (understanding or {}).get("communicative_act")
        in {"clarify_information", "answer_previous_question", "correct_information"}
        or (understanding or {}).get("is_clarification")
        or (understanding or {}).get("is_correction")
    )

    reply = _render_reply(
        nba=nba,
        snapshot=snapshot,
        engine_claim=engine_claim,
        conf=conf,
        conflict=conflict,
        price_intent=price_intent,
        acknowledge_claim=acknowledge_claim,
        image_received=image_fulfills_request,
    )
    reply = apply_channel_policy(reply, cfg)

    return CommercialDecision(
        decision_id=f"cdr-{uuid.uuid4().hex[:12]}",
        conversation_id=conversation_id or customer_hash or "",
        customer_intent=intent,
        customer_type=ctype,
        product_type=product_type,
        claimed_identity={
            "engine_code": engine_claim or snap_engine or "",
            "source": (
                "vin"
                if snap_engine and not engine_claim
                else "customer_text"
                if engine_claim
                else "none"
            ),
            "verification_status": "customer_reported" if engine_claim else "none",
        },
        evidence=evidence,
        evidence_confidence=round(conf, 3),
        commercial_risk=commercial_risk,
        risk_reasons=risk_reasons,
        known=known,
        missing=missing,
        sales_stage=stage,
        objective=objective,
        next_best_action=nba,
        expected_result=expected_map.get(nba, "customer_replied_without_progress"),
        alternative_actions=alts,
        human_review_required=human or nba == "request_manual_review",
        decision_reason=reason,
        ask_keys=ask_keys,
        ask_list=ask_list,
        reply=reply,
    )


def _render_reply(
    *,
    nba: str,
    snapshot: Any | None,
    engine_claim: str,
    conf: float,
    conflict: bool,
    price_intent: bool,
    acknowledge_claim: bool = False,
    image_received: bool = False,
) -> str:
    vin_shown = ""
    ident = ""
    if snapshot is not None:
        vin_shown = str(getattr(snapshot, "vin_masked", "") or "")
        if hasattr(snapshot, "identity_line"):
            try:
                ident = snapshot.identity_line() or ""
            except Exception:
                ident = ""

    img_ack = "Thanks — we received your photo.\n\n" if image_received else ""

    if conflict:
        return (
            "Thanks — possible mismatch between factory VIN data and the engine now installed.\n\n"
            "To avoid wrong freight, duty, and fitment loss, please send a clear engine plate photo."
        )
    if nba == "request_manual_review":
        if image_received:
            return (
                "Thanks — we received your photo.\n\n"
                "Our team will review it shortly to confirm the currently installed engine."
            )
        ack = f"Got it — you’re confirming the engine code as {engine_claim}.\n\n" if (
            acknowledge_claim and engine_claim
        ) else ""
        return (
            f"{ack}"
            "We want to double-check before moving ahead, so you don't risk ocean freight, "
            "duty, and install costs on the wrong unit. Our team will review shortly."
        )
    if nba == "decline_wrong_supply":
        return (
            "We should pause this supply path — better confirm the currently installed "
            "engine than ship the wrong one."
        )
    if nba == "ask_engine_plate":
        if acknowledge_claim and engine_claim:
            return (
                f"Got it — you’re confirming the engine code as {engine_claim}.\n\n"
                "To avoid supplying the wrong version, please send a clear engine plate photo."
            )
        claim = f" You mentioned {engine_claim}." if engine_claim else ""
        return (
            f"Got it.{claim} Before quantity/port, please confirm the engine currently installed "
            f"(VIN is factory config only).\n\n"
            f"Please send a clear engine plate photo."
        )
    if nba == "ask_engine_photo":
        if acknowledge_claim and engine_claim:
            return (
                f"Got it — you’re confirming the engine code as {engine_claim}.\n\n"
                "To avoid supplying the wrong version, please send a clear photo of the engine if available."
            )
        return "Please send a clear photo of the engine currently in the car."
    if nba == "ask_vin":
        if acknowledge_claim and engine_claim:
            return (
                f"Got it — you’re confirming the engine code as {engine_claim}.\n\n"
                "If easier, please send the VIN (or VIN plate photo)."
            )
        if price_intent:
            return "Yes — we can help with pricing once identity is solid.\n\nPlease send the VIN (or engine plate photo)."
        return "Please send the VIN so we can match the vehicle record."
    if nba == "ask_vin_plate":
        return "VIN decode needs a clearer source — please send a VIN plate photo."
    if nba == "ask_registration":
        if acknowledge_claim and engine_claim:
            return (
                f"Got it — you’re confirming the engine code as {engine_claim}.\n\n"
                "Please send a vehicle registration photo as an alternative."
            )
        return "Please send a vehicle registration photo so we can continue matching."
    if nba == "ask_oe_label":
        return "Please send a clear OE / parts label photo."
    if nba == "ask_vehicle_photo":
        return "Please send a clear vehicle photo."

    lines: list[str] = []
    if vin_shown and ident:
        lines.append(f"Got VIN {vin_shown}. Matched: {ident}.")
        vs = str(getattr(snapshot, "verification_status", "") or "")
        if vs == "provider_reported":
            lines.append("Provider-reported only — we still confirm before stock/price.")
    elif vin_shown:
        lines.append(f"Got VIN {vin_shown}. Full match still pending.")
    elif engine_claim and conf >= 0.85:
        lines.append(f"Noted {engine_claim}.")
    elif price_intent:
        lines.append("Yes — we can help with pricing.")

    if nba == "ask_scope":
        if engine_claim:
            lines.append(
                f"Noted {engine_claim} (as you reported). Do you need long block or complete engine?"
            )
        else:
            lines.append("Do you need long block or complete engine?")
    elif nba == "ask_quantity":
        lines.append("What quantity do you need?")
    elif nba == "ask_destination":
        lines.append("Which destination port?")
    elif nba in {"prepare_quote", "check_supplier"}:
        lines.append(
            "Thanks — enough to check supply and prepare quotation "
            "(no price number until confirmed)."
        )
    elif nba == "wait_customer":
        lines.append("What do you need for this vehicle?")
    body = "\n\n".join([x for x in lines if x]).strip()
    if image_received and img_ack and nba not in {"ask_engine_plate", "ask_engine_photo"}:
        return f"{img_ack}{body}".strip()
    return body


def decide_from_vin_result(
    snapshot: Any,
    customer_message: str = "",
    *,
    customer_hash: str = "",
    conversation_id: str = "",
    config: dict[str, Any] | None = None,
) -> CommercialDecision:
    return decide_commercial(
        customer_message,
        snapshot=snapshot,
        customer_hash=customer_hash,
        conversation_id=conversation_id,
        config=config,
    )
