"""APLIVE-004 — Constitution Runtime Engine for all agent decisions."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CONSTITUTION_DIR = ROOT / "memory" / "constitution"

AVAILABLE_CLAIM_RE = re.compile(
    r"\b(available|in stock|we have it|have stock|ready to ship)\b",
    re.I,
)
PRICE_COMMIT_RE = re.compile(
    r"\b(final price|confirm price|usd\s*\d|price is \$|total cost is)\b",
    re.I,
)
PAYMENT_RE = re.compile(
    r"\b(payment received|wire transfer|tt payment|lc opened|refund)\b",
    re.I,
)


@dataclass
class ConstitutionVerdict:
    allowed: bool
    reason: str
    risk_level: str
    authority: str
    confidence: float
    constitution_rule: str
    authority_check: str
    risk_score: float
    risk_reason: str
    decision_path: str

    def to_audit_dict(self) -> dict[str, Any]:
        return asdict(self)


def constitution_dir() -> Path:
    return CONSTITUTION_DIR


def reconfigure_constitution_dir(path: Path) -> None:
    """Test helper — redirect constitution policy storage."""
    global CONSTITUTION_DIR
    CONSTITUTION_DIR = path
    _load_constitution.cache_clear()
    _load_authority_matrix.cache_clear()
    _load_decision_policy.cache_clear()
    _load_risk_policy.cache_clear()


@lru_cache(maxsize=1)
def _load_constitution() -> dict[str, Any]:
    return _read_json(CONSTITUTION_DIR / "constitution.json")


@lru_cache(maxsize=1)
def _load_authority_matrix() -> dict[str, Any]:
    return _read_json(CONSTITUTION_DIR / "authority_matrix.json")


@lru_cache(maxsize=1)
def _load_decision_policy() -> dict[str, Any]:
    return _read_json(CONSTITUTION_DIR / "decision_policy.json")


@lru_cache(maxsize=1)
def _load_risk_policy() -> dict[str, Any]:
    return _read_json(CONSTITUTION_DIR / "risk_policy.json")


def _read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def load_authority_matrix() -> dict[str, Any]:
    return _load_authority_matrix()


def load_decision_policy() -> dict[str, Any]:
    return _load_decision_policy()


def load_risk_policy() -> dict[str, Any]:
    return _load_risk_policy()


def check_authority(role: str, action: str) -> bool:
    """Return True if role may perform action under authority matrix."""
    matrix = _load_authority_matrix()
    roles = matrix.get("roles", {})
    role_def = roles.get((role or "sales").lower(), roles.get("sales", {}))
    action_key = (action or "").lower().replace("-", "_")

    allow = role_def.get("allow", [])
    deny = role_def.get("deny", [])

    if "all" in allow:
        return action_key not in {d.lower().replace("-", "_") for d in deny}

    if action_key in {d.lower().replace("-", "_") for d in deny}:
        return False
    return action_key in {a.lower().replace("-", "_") for a in allow}


def evaluate_inventory_policy(confidence: float) -> dict[str, Any]:
    policy = _load_decision_policy()
    conf = max(0.0, min(1.0, float(confidence)))
    for band in policy.get("inventory_confidence", []):
        if band.get("min", 0) <= conf <= band.get("max", 1):
            return dict(band)
    return {
        "rule": "inventory_unknown",
        "action": "never_promise_inventory",
        "guidance": "Never promise inventory.",
    }


def evaluate_pricing_policy(confidence: float) -> dict[str, Any]:
    policy = _load_decision_policy()
    conf = max(0.0, min(1.0, float(confidence)))
    for band in policy.get("pricing_confidence", []):
        if band.get("min", 0) <= conf <= band.get("max", 1):
            return dict(band)
    return {
        "rule": "pricing_low_confidence",
        "action": "request_approval",
        "guidance": "Request CEO approval.",
    }


def score_risk(
    *,
    intent: str = "unknown",
    classification: str = "customer_inquiry",
    inventory_confidence: float = 0.5,
    pricing_confidence: float = 0.5,
    message: str = "",
    draft_text: str = "",
) -> dict[str, Any]:
    """Unified risk scoring → level + numeric score + reason."""
    policy = _load_risk_policy()
    weights = policy.get("intent_weights", {})
    score = float(weights.get(intent, 0))

    if classification == "customer_followup":
        score += 0.5

    if inventory_confidence < 0.6:
        score += 1.0
    if pricing_confidence < 0.75:
        score += 1.0

    body = f"{message}\n{draft_text}".lower()
    if PRICE_COMMIT_RE.search(body):
        score += 2.5
    if PAYMENT_RE.search(body):
        score += 3.0
    if re.search(r"\b(delivery date|lead time guaranteed|ship tomorrow)\b", body):
        score += 2.0

    if score >= 4.5:
        level = "critical"
        reason = "Critical commitment detected (payment/delivery/final price)."
    elif score >= 3.0:
        level = "high"
        reason = "High-risk intent or pricing/inventory uncertainty."
    elif score >= 1.5:
        level = "medium"
        reason = "Standard sales draft — CEO review recommended."
    else:
        level = "low"
        reason = "Low-risk enquiry draft."

    level_def = policy.get("levels", {}).get(level, {})
    return {
        "risk_level": level,
        "risk_score": round(min(score / 5.0, 1.0), 2),
        "risk_reason": reason,
        "approval_required": bool(level_def.get("approval_required", level != "low")),
        "allowed": bool(level_def.get("allowed", level != "critical")),
        "risk_action": level_def.get("action", "ceo_review"),
    }


def build_decision_path(*, include_inventory: bool = True) -> str:
    constitution = _load_constitution()
    steps = list(constitution.get("pipeline", [
        "Classifier", "Sales Brain", "Inventory", "Constitution", "Draft",
    ]))
    if not include_inventory:
        steps = [s for s in steps if s.lower() != "inventory"]
    return "\n".join(steps)


def _sanitize_inventory_claims(text: str, inventory_policy: dict[str, Any]) -> str:
    action = inventory_policy.get("action", "")
    if action == "allow_available":
        return text
    cleaned = AVAILABLE_CLAIM_RE.sub("subject to supplier confirmation", text)
    cleaned = re.sub(r"\b(guaranteed available)\b", "subject to supplier confirmation", cleaned, flags=re.I)
    return cleaned


def evaluate_draft(
    draft: dict[str, Any],
    *,
    context: dict[str, Any] | None = None,
) -> ConstitutionVerdict:
    """Run Constitution Runtime on a Sales Brain draft payload."""
    ctx = context or {}
    role = str(ctx.get("role") or _load_constitution().get("default_role", "sales"))
    intent = str(draft.get("category") or ctx.get("intent") or "unknown")
    classification = str(draft.get("classification") or ctx.get("classification") or "customer_inquiry")
    message = str(ctx.get("message") or draft.get("original_message") or "")
    draft_text = str(draft.get("customer_reply_draft") or "")

    inventory_confidence = float(ctx.get("inventory_confidence", 0.45))
    pricing_confidence = float(ctx.get("pricing_confidence", 0.5))
    if intent in ("price_request", "negotiation"):
        pricing_confidence = min(pricing_confidence, 0.6)

    inventory_policy = evaluate_inventory_policy(inventory_confidence)
    pricing_policy = evaluate_pricing_policy(pricing_confidence)
    risk = score_risk(
        intent=intent,
        classification=classification,
        inventory_confidence=inventory_confidence,
        pricing_confidence=pricing_confidence,
        message=message,
        draft_text=draft_text,
    )

    if pricing_policy.get("action") == "request_approval" and risk["risk_level"] == "low":
        risk = dict(risk)
        risk["risk_level"] = "medium"
        risk["risk_reason"] = (
            pricing_policy.get("guidance", "Request CEO approval.")
            + " "
            + risk["risk_reason"]
        )
        risk["approval_required"] = True
        risk["risk_action"] = "ceo_review"
        risk["risk_score"] = max(float(risk["risk_score"]), 0.3)

    authority_checks: list[str] = []
    for action in ("draft", "send", "inventory_modify", "final_price_commit"):
        ok = check_authority(role, action)
        authority_checks.append(f"{action}:{'allow' if ok else 'deny'}")

    send_allowed = check_authority(role, "send")
    modify_allowed = check_authority("inventory", "inventory_modify")
    price_commit_allowed = check_authority(role, "final_price_commit")

    allowed = bool(risk["allowed"])
    reasons: list[str] = [risk["risk_reason"]]

    if not send_allowed and re.search(r"\b(send|sent to customer)\b", draft_text, re.I):
        allowed = False
        reasons.append("Sales role denied: send.")

    if not modify_allowed and re.search(r"\b(update inventory|modify stock)\b", draft_text, re.I):
        allowed = False
        reasons.append("Inventory role denied: inventory_modify.")

    if not price_commit_allowed and PRICE_COMMIT_RE.search(draft_text):
        allowed = False
        reasons.append("Pricing authority denied: final_price_commit.")

    if inventory_policy.get("action") == "never_promise_inventory" and AVAILABLE_CLAIM_RE.search(draft_text):
        reasons.append(inventory_policy.get("guidance", "Never promise inventory."))

    constitution_rule = " | ".join(filter(None, [
        inventory_policy.get("rule"),
        pricing_policy.get("rule"),
        risk.get("risk_action"),
    ]))

    combined_confidence = round(
        (float(draft.get("confidence", 0.5)) + inventory_confidence + pricing_confidence) / 3,
        2,
    )

    return ConstitutionVerdict(
        allowed=allowed,
        reason=" ".join(reasons),
        risk_level=risk["risk_level"],
        authority=role,
        confidence=combined_confidence,
        constitution_rule=constitution_rule,
        authority_check="; ".join(authority_checks),
        risk_score=float(risk["risk_score"]),
        risk_reason=risk["risk_reason"],
        decision_path=build_decision_path(include_inventory=True),
    )


def apply_constitution_runtime(
    draft: dict[str, Any],
    *,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Apply Constitution Runtime and merge audit fields into draft."""
    ctx = dict(context or {})
    inventory_confidence = float(ctx.get("inventory_confidence", 0.45))
    inventory_policy = evaluate_inventory_policy(inventory_confidence)

    verdict = evaluate_draft(draft, context=ctx)
    updated = dict(draft)

    if inventory_policy.get("action") != "allow_available":
        updated["customer_reply_draft"] = _sanitize_inventory_claims(
            str(updated.get("customer_reply_draft", "")),
            inventory_policy,
        )

    updated["risk_level"] = verdict.risk_level
    updated["approval_required"] = verdict.risk_level in ("medium", "high", "critical")
    updated["authority"] = verdict.authority
    updated["constitution_allowed"] = verdict.allowed
    updated["constitution_reason"] = verdict.reason
    updated["constitution_rule"] = verdict.constitution_rule
    updated["authority_check"] = verdict.authority_check
    updated["risk_score"] = verdict.risk_score
    updated["risk_reason"] = verdict.risk_reason
    updated["decision_path"] = verdict.decision_path
    updated["inventory_confidence"] = inventory_confidence
    updated["inventory_policy"] = inventory_policy.get("action", "")

    if not verdict.allowed:
        updated["internal_analysis_zh"] = (
            str(updated.get("internal_analysis_zh", "")).rstrip()
            + "\n- 宪章阻断: " + verdict.reason
        )

    return updated


def estimate_inventory_confidence(*, inventory_hit: bool, message: str = "") -> float:
    """Heuristic inventory confidence for runtime policy."""
    if not inventory_hit:
        return 0.45
    keywords = re.findall(r"\b(G4KJ|G4KD|1NZ|2KD|1KD|2AZ)\b", message, re.I)
    if keywords:
        return 0.92
    return 0.72
