"""Learning candidate queue — CEO review before formal memory writes."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway import conversation_paths as cp
from customer_gateway.conversation_analyzer import LEARNING_CLASSIFICATIONS, load_analysis


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _candidate_id() -> str:
    return f"lc-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"


def _memory_category(classification: str) -> str:
    if classification == "supplier_message":
        return "suppliers"
    return "customer"


def candidate_path(candidate_id: str) -> Path:
    return cp.CANDIDATES_DIR / f"{candidate_id}.json"


def candidate_exists_for_message(message_id: str) -> bool:
    cp.ensure_conversation_dirs()
    for path in cp.CANDIDATES_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if data.get("message_id") == message_id and data.get("status") == "pending":
            return True
    return False


def enqueue_from_analysis(
    analysis: dict[str, Any],
    normalized: dict[str, Any],
) -> dict[str, Any] | None:
    """Create learning candidate if analysis qualifies."""
    if not analysis.get("memory_candidate"):
        return None
    classification = str(analysis.get("classification") or "")
    if classification not in LEARNING_CLASSIFICATIONS:
        return None
    if analysis.get("private_signal"):
        return None

    message_id = str(analysis.get("message_id") or "")
    if not message_id or candidate_exists_for_message(message_id):
        return None

    cp.ensure_conversation_dirs()
    candidate = {
        "candidate_id": _candidate_id(),
        "message_id": message_id,
        "conversation_id": analysis.get("conversation_id"),
        "contact_name": analysis.get("contact_name") or normalized.get("contact_name"),
        "classification": classification,
        "confidence": analysis.get("confidence"),
        "reason": analysis.get("reason"),
        "intent": analysis.get("intent"),
        "text": normalized.get("text", "")[:500],
        "memory_category": _memory_category(classification),
        "memory_reason": analysis.get("memory_reason"),
        "business_value": analysis.get("business_value"),
        "status": "pending",
        "created_at": _now(),
    }
    path = candidate_path(candidate["candidate_id"])
    path.write_text(json.dumps(candidate, indent=2, ensure_ascii=False), encoding="utf-8")
    return candidate


def list_candidates(*, status: str = "pending", limit: int = 50) -> list[dict[str, Any]]:
    cp.ensure_conversation_dirs()
    files = sorted(cp.CANDIDATES_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    out: list[dict[str, Any]] = []
    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if status and data.get("status") != status:
            continue
        out.append(data)
        if len(out) >= limit:
            break
    return out


def load_candidate(candidate_id: str) -> dict[str, Any] | None:
    path = candidate_path(candidate_id)
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def approve_candidate(candidate_id: str) -> str:
    """CEO approve — write to formal long-term memory."""
    candidate = load_candidate(candidate_id)
    if not candidate:
        raise ValueError(f"Candidate not found: {candidate_id}")
    if candidate.get("status") != "pending":
        raise ValueError(f"Candidate not pending: {candidate_id}")

    from tools import memory_tool

    category = candidate.get("memory_category") or "customer"
    content = (
        f"[WhatsApp learning approved] {candidate.get('contact_name')}\n"
        f"Classification: {candidate.get('classification')} | "
        f"Intent: {candidate.get('intent')} | "
        f"Confidence: {candidate.get('confidence')}\n"
        f"Message: {candidate.get('text')}\n"
        f"Reason: {candidate.get('reason')}"
    )
    memory_result = memory_tool.remember(
        content,
        category=category,
        source="conversation_learning_ceo",
        project=str(candidate.get("contact_name") or "")[:64] or None,
    )

    candidate["status"] = "approved"
    candidate["approved_at"] = _now()
    candidate["memory_write_result"] = memory_result

    cp.ensure_conversation_dirs()
    approved_path = cp.APPROVED_DIR / f"{candidate_id}.json"
    approved_path.write_text(json.dumps(candidate, indent=2, ensure_ascii=False), encoding="utf-8")
    candidate_path(candidate_id).unlink(missing_ok=True)
    return memory_result


def reject_candidate(candidate_id: str, *, reason: str = "") -> dict[str, Any]:
    """CEO reject — archive only, no memory write."""
    candidate = load_candidate(candidate_id)
    if not candidate:
        raise ValueError(f"Candidate not found: {candidate_id}")
    if candidate.get("status") != "pending":
        raise ValueError(f"Candidate not pending: {candidate_id}")

    candidate["status"] = "rejected"
    candidate["rejected_at"] = _now()
    if reason:
        candidate["reject_reason"] = reason

    cp.ensure_conversation_dirs()
    rejected_path = cp.REJECTED_DIR / f"{candidate_id}.json"
    rejected_path.write_text(json.dumps(candidate, indent=2, ensure_ascii=False), encoding="utf-8")
    candidate_path(candidate_id).unlink(missing_ok=True)
    return candidate


def format_candidates_list(candidates: list[dict[str, Any]]) -> str:
    if not candidates:
        return "暂无待审 learning candidates。"
    lines = [f"Learning candidates ({len(candidates)}):", ""]
    for c in candidates:
        lines.append(
            f"- {c.get('candidate_id')} | {c.get('classification')} | "
            f"{c.get('contact_name')} | conf={c.get('confidence')} | "
            f"{str(c.get('text', ''))[:60]}"
        )
    lines.append("")
    lines.append("审批: /learning approve <candidate_id>  拒绝: /learning reject <candidate_id>")
    return "\n".join(lines)
