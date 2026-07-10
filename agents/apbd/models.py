"""APBD runtime data models."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class RuntimePhase(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    SLEEPING = "sleeping"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    ERROR = "error"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ScheduleMode(str, Enum):
    RUN_ONCE = "run_once"
    MANUAL = "manual"
    DAILY = "daily"  # architecture placeholder — not implemented in MVP


@dataclass
class Task:
    task_id: str
    task_type: str
    priority: str
    status: str = TaskStatus.PENDING.value
    tool_name: str = ""
    created_at: str = field(default_factory=utc_now_iso)
    finished_at: str = ""
    result_path: str = ""
    error: str = ""
    payload: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Task:
        return cls(
            task_id=data["task_id"],
            task_type=data["task_type"],
            priority=data.get("priority", "medium"),
            status=data.get("status", TaskStatus.PENDING.value),
            tool_name=data.get("tool_name", ""),
            created_at=data.get("created_at", utc_now_iso()),
            finished_at=data.get("finished_at", ""),
            result_path=data.get("result_path", ""),
            error=data.get("error", ""),
            payload=dict(data.get("payload") or {}),
        )


@dataclass
class DailySummary:
    date: str
    phase: str
    tasks_total: int
    tasks_completed: int
    tasks_failed: int
    result_files: list[str] = field(default_factory=list)
    highlights: list[str] = field(default_factory=list)
    waiting_approval: bool = True
    generated_at: str = field(default_factory=utc_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
