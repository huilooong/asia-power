"""APSales decision logging — every runtime decision is traceable."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from audit.logger import log_event
from apsales_runtime import paths as runtime_paths


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def log_decision(
    *,
    decision: str,
    reason: str,
    context: dict[str, Any] | None = None,
    actor: str = "apsales_runtime",
    correlation_id: str = "",
) -> dict[str, Any]:
    """Append decision record to JSONL + audit events."""
    runtime_paths.ensure_runtime_dirs()
    record = {
        "decision_id": f"dec-{uuid.uuid4().hex[:12]}",
        "timestamp": _now_iso(),
        "actor": actor,
        "decision": decision,
        "reason": reason,
        "context": context or {},
        "correlation_id": correlation_id,
    }
    with runtime_paths.DECISIONS_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    log_event(
        "apsales_decision",
        decision_id=record["decision_id"],
        decision=decision[:200],
        reason=reason[:200],
        actor=actor,
        correlation_id=correlation_id,
    )
    return record


def list_recent_decisions(limit: int = 50) -> list[dict[str, Any]]:
    if not runtime_paths.DECISIONS_FILE.is_file():
        return []
    lines = runtime_paths.DECISIONS_FILE.read_text(encoding="utf-8").splitlines()
    out: list[dict[str, Any]] = []
    for line in lines[-limit:]:
        if line.strip():
            out.append(json.loads(line))
    return out
