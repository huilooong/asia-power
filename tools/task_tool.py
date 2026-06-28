"""Task Tool — local JSON task store for COO orchestration."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TASKS_FILE = DATA_DIR / "tasks.json"

VALID_PRIORITIES = frozenset({"low", "medium", "high", "urgent"})
VALID_STATUSES = frozenset({
    "pending", "in_progress", "blocked", "completed", "cancelled",
})


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_tasks() -> list[dict[str, Any]]:
    _ensure_data_dir()
    if not TASKS_FILE.exists():
        return []
    with TASKS_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def _save_tasks(tasks: list[dict[str, Any]]) -> None:
    _ensure_data_dir()
    with TASKS_FILE.open("w", encoding="utf-8") as f:
        json.dump(tasks, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _find_task_index(tasks: list[dict[str, Any]], task_id: str) -> int:
    for i, task in enumerate(tasks):
        if task.get("id") == task_id:
            return i
    raise KeyError(f"Task not found: {task_id}")


def create_task(
    title: str,
    description: str = "",
    owner_agent: str = "coo",
    created_by: str = "coo",
    priority: str = "medium",
    status: str = "pending",
    due_date: str | None = None,
    dependencies: list[str] | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    """Create a new task and persist to data/tasks.json."""
    if priority not in VALID_PRIORITIES:
        raise ValueError(f"Invalid priority: {priority}")
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {status}")

    now = _now_iso()
    task = {
        "id": f"task-{uuid.uuid4().hex[:8]}",
        "title": title.strip(),
        "description": description.strip(),
        "owner_agent": owner_agent.strip(),
        "created_by": created_by.strip(),
        "priority": priority,
        "status": status,
        "due_date": due_date,
        "dependencies": list(dependencies or []),
        "tags": list(tags or []),
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }

    tasks = _load_tasks()
    tasks.append(task)
    _save_tasks(tasks)
    return task


def list_tasks(
    status: str | None = None,
    owner_agent: str | None = None,
) -> list[dict[str, Any]]:
    """List tasks with optional filters."""
    tasks = _load_tasks()
    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    if owner_agent:
        tasks = [t for t in tasks if t.get("owner_agent") == owner_agent]
    return tasks


def get_task(task_id: str) -> dict[str, Any]:
    """Return a single task by id."""
    for task in _load_tasks():
        if task.get("id") == task_id:
            return dict(task)
    raise KeyError(f"Task not found: {task_id}")


def update_task(task_id: str, **updates: Any) -> dict[str, Any]:
    """Update allowed task fields."""
    allowed = {
        "title", "description", "owner_agent", "priority", "status",
        "due_date", "dependencies", "tags",
    }
    tasks = _load_tasks()
    idx = _find_task_index(tasks, task_id)

    for key, value in updates.items():
        if key not in allowed:
            raise ValueError(f"Cannot update field: {key}")
        if key == "priority" and value not in VALID_PRIORITIES:
            raise ValueError(f"Invalid priority: {value}")
        if key == "status" and value not in VALID_STATUSES:
            raise ValueError(f"Invalid status: {value}")
        tasks[idx][key] = value

    tasks[idx]["updated_at"] = _now_iso()
    if updates.get("status") == "completed":
        tasks[idx]["completed_at"] = _now_iso()
    elif updates.get("status") in {"pending", "in_progress", "blocked"}:
        tasks[idx]["completed_at"] = None

    _save_tasks(tasks)
    return dict(tasks[idx])


def complete_task(task_id: str) -> dict[str, Any]:
    """Mark task as completed."""
    return update_task(task_id, status="completed")


def cancel_task(task_id: str) -> dict[str, Any]:
    """Mark task as cancelled."""
    return update_task(task_id, status="cancelled")


def search_tasks(keyword: str) -> list[dict[str, Any]]:
    """Search tasks by keyword in title, description, or tags."""
    needle = (keyword or "").strip().lower()
    if not needle:
        return []

    hits: list[dict[str, Any]] = []
    for task in _load_tasks():
        blob = " ".join([
            task.get("title", ""),
            task.get("description", ""),
            " ".join(task.get("tags") or []),
        ]).lower()
        if needle in blob:
            hits.append(task)
    return hits


def summarize_tasks() -> dict[str, Any]:
    """Return counts and highlights by status."""
    tasks = _load_tasks()
    by_status: dict[str, list[dict[str, Any]]] = {
        s: [] for s in VALID_STATUSES
    }
    for task in tasks:
        status = task.get("status", "pending")
        if status in by_status:
            by_status[status].append(task)

    urgent_pending = [
        t for t in by_status["pending"] + by_status["in_progress"]
        if t.get("priority") in {"urgent", "high"}
    ]

    return {
        "total": len(tasks),
        "by_status": {k: len(v) for k, v in by_status.items()},
        "pending": by_status["pending"],
        "in_progress": by_status["in_progress"],
        "blocked": by_status["blocked"],
        "completed": by_status["completed"],
        "cancelled": by_status["cancelled"],
        "urgent_active": urgent_pending,
    }
