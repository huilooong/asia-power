"""Orchestrate Conversation Learning Pipeline on inbound poll."""

from __future__ import annotations

from typing import Any

from customer_gateway import conversation_paths as cp
from customer_gateway.conversation_analyzer import analyze_normalized, save_analysis
from customer_gateway.conversation_normalizer import normalize_from_payload, save_normalized
from customer_gateway.conversation_raw_archive import archive_raw_message
from customer_gateway.learning_candidate_queue import enqueue_from_analysis
from customer_gateway.whatsapp_live_adapter import NormalizedLiveMessage


def process_live_message(
    msg: NormalizedLiveMessage | dict[str, Any],
    *,
    source: str = "poll",
) -> dict[str, Any]:
    """Raw → Normalized → Analysis → Learning candidate (if eligible)."""
    cp.ensure_conversation_dirs()
    payload = msg.to_inbox_json() if isinstance(msg, NormalizedLiveMessage) else dict(msg)

    raw_path = archive_raw_message(payload, source=source)
    normalized = normalize_from_payload(payload)
    norm_path = save_normalized(normalized)

    analysis = analyze_normalized(normalized)
    analysis_path = save_analysis(analysis)

    candidate = None
    if analysis.get("memory_candidate"):
        candidate = enqueue_from_analysis(analysis, normalized)

    return {
        "message_id": normalized.get("message_id"),
        "raw_archived": raw_path is not None,
        "normalized": norm_path is not None,
        "analysis": analysis_path is not None,
        "candidate_id": (candidate or {}).get("candidate_id"),
        "classification": analysis.get("classification"),
        "private_signal": analysis.get("private_signal"),
        "memory_candidate": analysis.get("memory_candidate"),
    }


def process_live_batch(
    messages: list[NormalizedLiveMessage],
    *,
    source: str = "poll",
) -> dict[str, Any]:
    results = [process_live_message(msg, source=source) for msg in messages]
    return {
        "processed": len(results),
        "raw_archived": sum(1 for r in results if r.get("raw_archived")),
        "candidates_created": sum(1 for r in results if r.get("candidate_id")),
        "results": results,
    }
