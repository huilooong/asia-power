"""APSales task queue — inquiries, follow-ups, reminders, retries."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from apsales_runtime.logging import log_decision
from apsales_runtime import paths as runtime_paths

VALID_TYPES = frozenset({"inquiry", "follow_up", "reminder", "retry"})
VALID_STATUSES = frozenset({"pending", "processing", "completed", "failed", "dead"})


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _safe_id(task_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "", task_id)


def _task_path(task_id: str) -> Path:
    return runtime_paths.QUEUE_DIR / f"{_safe_id(task_id)}.json"


class TaskQueue:
    """File-backed task queue with retry support."""

    def __init__(self, max_retries: int = 5, retry_backoff_seconds: int = 300) -> None:
        runtime_paths.ensure_runtime_dirs()
        self.max_retries = max_retries
        self.retry_backoff_seconds = retry_backoff_seconds

    def enqueue(
        self,
        task_type: str,
        payload: dict[str, Any],
        *,
        priority: str = "medium",
        due_at: str | None = None,
        correlation_id: str = "",
    ) -> dict[str, Any]:
        if task_type not in VALID_TYPES:
            raise ValueError(f"Invalid task type: {task_type}")
        task_id = f"task-{uuid.uuid4().hex[:12]}"
        record = {
            "task_id": task_id,
            "task_type": task_type,
            "status": "pending",
            "priority": priority,
            "payload": payload,
            "attempts": 0,
            "max_retries": self.max_retries,
            "due_at": due_at,
            "correlation_id": correlation_id,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "last_error": "",
        }
        _task_path(task_id).write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
        log_decision(
            decision=f"enqueue:{task_type}",
            reason=f"task_id={task_id}",
            context={"priority": priority, "due_at": due_at},
            correlation_id=correlation_id,
        )
        return record

    def load(self, task_id: str) -> dict[str, Any] | None:
        path = _task_path(task_id)
        if not path.is_file():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def _save(self, record: dict[str, Any]) -> dict[str, Any]:
        record["updated_at"] = _now_iso()
        _task_path(record["task_id"]).write_text(
            json.dumps(record, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return record

    def claim_next(self, *, batch_size: int = 1) -> list[dict[str, Any]]:
        now = _now_iso()
        pending: list[dict[str, Any]] = []
        for path in sorted(runtime_paths.QUEUE_DIR.glob("task-*.json")):
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if record.get("status") != "pending":
                continue
            due = record.get("due_at")
            if due and due > now:
                continue
            pending.append(record)
        pending.sort(key=lambda r: (r.get("priority") != "urgent", r.get("created_at", "")))
        claimed: list[dict[str, Any]] = []
        for record in pending[:batch_size]:
            record["status"] = "processing"
            record["attempts"] = int(record.get("attempts") or 0) + 1
            claimed.append(self._save(record))
        return claimed

    def complete(self, task_id: str, *, result: dict[str, Any] | None = None) -> dict[str, Any]:
        record = self.load(task_id)
        if not record:
            raise KeyError(f"Task not found: {task_id}")
        record["status"] = "completed"
        record["result"] = result or {}
        log_decision(
            decision=f"complete:{record.get('task_type')}",
            reason=f"task_id={task_id}",
            correlation_id=record.get("correlation_id", ""),
        )
        return self._save(record)

    def fail(self, task_id: str, error: str) -> dict[str, Any]:
        record = self.load(task_id)
        if not record:
            raise KeyError(f"Task not found: {task_id}")
        record["last_error"] = error[:500]
        attempts = int(record.get("attempts") or 0)
        max_retries = int(record.get("max_retries") or self.max_retries)
        if attempts >= max_retries:
            record["status"] = "dead"
            log_decision(
                decision="task_dead",
                reason=error[:200],
                context={"task_id": task_id, "attempts": attempts},
                correlation_id=record.get("correlation_id", ""),
            )
        else:
            record["status"] = "pending"
            retry = self.enqueue(
                "retry",
                {"original_task_id": task_id, "error": error[:200]},
                priority=record.get("priority", "medium"),
                correlation_id=record.get("correlation_id", ""),
            )
            record["retry_task_id"] = retry["task_id"]
            log_decision(
                decision="task_retry",
                reason=error[:200],
                context={"task_id": task_id, "retry_task_id": retry["task_id"]},
                correlation_id=record.get("correlation_id", ""),
            )
        return self._save(record)

    def list_tasks(self, *, status: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        tasks: list[dict[str, Any]] = []
        for path in sorted(QUEUE_DIR.glob("task-*.json"), reverse=True):
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if status and record.get("status") != status:
                continue
            tasks.append(record)
            if len(tasks) >= limit:
                break
        return tasks

    def summary(self) -> dict[str, int]:
        counts = {s: 0 for s in VALID_STATUSES}
        for path in runtime_paths.QUEUE_DIR.glob("task-*.json"):
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            status = record.get("status", "pending")
            if status in counts:
                counts[status] += 1
        counts["total"] = sum(counts.values())
        return counts

    def recover_pending(self) -> int:
        """Reset processing tasks to pending after crash."""
        recovered = 0
        for path in runtime_paths.QUEUE_DIR.glob("task-*.json"):
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if record.get("status") == "processing":
                record["status"] = "pending"
                self._save(record)
                recovered += 1
        return recovered
