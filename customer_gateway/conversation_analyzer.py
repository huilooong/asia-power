"""Per-message conversation analysis for learning pipeline."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from customer_gateway import conversation_paths as cp
from customer_gateway.customer_memory_rules import evaluate_memory_write
from customer_gateway.sales_message_classifier import classify_inbound_message

LEARNING_CLASSIFICATIONS = frozenset({
    "customer_inquiry",
    "customer_followup",
    "supplier_message",
})


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def analysis_path(message_id: str) -> Path:
    return cp.ANALYSIS_DIR / f"{message_id[:32]}.json"


def analysis_exists(message_id: str) -> bool:
    return analysis_path(message_id).is_file()


def _business_value(classification: str, text: str) -> str:
    if classification in ("customer_inquiry", "customer_followup"):
        return "high" if len(text) > 40 else "medium"
    if classification == "supplier_message":
        return "medium"
    if classification == "private_message":
        return "none"
    if classification == "system_notification":
        return "low"
    return "low"


def analyze_normalized(normalized: dict[str, Any]) -> dict[str, Any]:
    text = str(normalized.get("text") or "")
    contact = str(normalized.get("contact_name") or "")
    result = classify_inbound_message(text, contact_name=contact)
    memory_eval = evaluate_memory_write(
        text,
        contact_name=contact,
        classification=result.classification,
    )

    private_signal = result.classification == "private_message"
    supplier_signal = result.classification == "supplier_message"
    customer_signal = result.classification in ("customer_inquiry", "customer_followup")
    learning_eligible = (
        result.classification in LEARNING_CLASSIFICATIONS and not private_signal
    )

    return {
        "message_id": normalized.get("message_id"),
        "conversation_id": normalized.get("conversation_id"),
        "contact_name": contact,
        "classification": result.classification,
        "confidence": result.confidence,
        "reason": result.reasoning_summary,
        "intent": result.intent_category,
        "customer_signal": customer_signal,
        "supplier_signal": supplier_signal,
        "private_signal": private_signal,
        "business_value": _business_value(result.classification, text),
        "suggested_action": result.action,
        "memory_candidate": learning_eligible,
        "memory_reason": memory_eval.get("memory_reason", ""),
        "analyzed_at": _now(),
    }


def save_analysis(record: dict[str, Any]) -> Path | None:
    cp.ensure_conversation_dirs()
    message_id = str(record.get("message_id") or "").strip()
    if not message_id:
        return None
    path = analysis_path(message_id)
    if path.is_file():
        return path
    path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def list_analysis(*, limit: int = 20) -> list[dict[str, Any]]:
    cp.ensure_conversation_dirs()
    files = sorted(cp.ANALYSIS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    out: list[dict[str, Any]] = []
    for path in files[:limit]:
        try:
            out.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return out


def load_analysis(message_id: str) -> dict[str, Any] | None:
    path = analysis_path(message_id)
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
