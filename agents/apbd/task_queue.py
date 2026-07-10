"""APBD task queue — filesystem-backed daily tasks."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from agents.apbd.config import task_tool_order
from agents.apbd.models import Task, TaskStatus, utc_now_iso


class APBDTaskQueue:
    """Daily task list stored under runtime/apbd/YYYY-MM-DD/tasks/."""

    def __init__(self, day_dir: Path) -> None:
        self.day_dir = day_dir
        self.tasks_dir = day_dir / "tasks"
        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = day_dir / "tasks.jsonl"
        self._specs: list[dict[str, Any]] = []

    def _task_path(self, task_id: str) -> Path:
        safe = "".join(c for c in task_id if c.isalnum() or c in "-_")
        return self.tasks_dir / f"{safe}.json"

    def _sort_tasks(self, tasks: list[Task], *, order: dict[str, int] | None = None) -> list[Task]:
        tool_order = order or task_tool_order(self._specs or None)
        return sorted(tasks, key=lambda t: (tool_order.get(t.tool_name, 999), t.task_id))

    def _load_raw(self) -> list[Task]:
        tasks: list[Task] = []
        for path in self.tasks_dir.glob("apbd-*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                tasks.append(Task.from_dict(data))
            except (json.JSONDecodeError, OSError, KeyError):
                continue
        return tasks

    def bootstrap_from_specs(self, specs: list[dict[str, Any]]) -> list[Task]:
        synced, _ = self.sync_with_specs(specs)
        return synced

    def sync_with_specs(self, specs: list[dict[str, Any]]) -> tuple[list[Task], int]:
        """Ensure queue matches config — add missing tools, preserve existing task state."""
        self._specs = list(specs)
        order = task_tool_order(specs)
        by_tool: dict[str, Task] = {}
        for task in self._load_raw():
            if task.tool_name and task.tool_name not in by_tool:
                by_tool[task.tool_name] = task

        synced: list[Task] = []
        added = 0
        for spec in specs:
            tool_name = spec.get("tool_name") or ""
            if not tool_name:
                continue
            if tool_name in by_tool:
                synced.append(by_tool[tool_name])
                continue
            task = Task(
                task_id=f"apbd-{uuid.uuid4().hex[:10]}",
                task_type=spec["task_type"],
                priority=spec.get("priority", "medium"),
                tool_name=tool_name,
                payload=dict(spec.get("payload") or {}),
            )
            self._save(task)
            self.append_index(task)
            synced.append(task)
            added += 1
        return self._sort_tasks(synced, order=order), added

    def load_all(self) -> list[Task]:
        return self._sort_tasks(self._load_raw())

    def next_pending(self) -> Task | None:
        for task in self.load_all():
            if task.status == TaskStatus.PENDING.value:
                return task
        return None

    def get(self, task_id: str) -> Task | None:
        path = self._task_path(task_id)
        if not path.is_file():
            return None
        return Task.from_dict(json.loads(path.read_text(encoding="utf-8")))

    def _save(self, task: Task) -> Task:
        path = self._task_path(task.task_id)
        path.write_text(json.dumps(task.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
        return task

    def mark_running(self, task_id: str) -> Task:
        task = self.get(task_id)
        if not task:
            raise KeyError(f"Task not found: {task_id}")
        task.status = TaskStatus.RUNNING.value
        return self._save(task)

    def mark_completed(self, task_id: str, *, result_path: str) -> Task:
        task = self.get(task_id)
        if not task:
            raise KeyError(f"Task not found: {task_id}")
        task.status = TaskStatus.COMPLETED.value
        task.finished_at = utc_now_iso()
        task.result_path = result_path
        return self._save(task)

    def mark_failed(self, task_id: str, *, error: str) -> Task:
        task = self.get(task_id)
        if not task:
            raise KeyError(f"Task not found: {task_id}")
        task.status = TaskStatus.FAILED.value
        task.finished_at = utc_now_iso()
        task.error = error
        return self._save(task)

    def append_index(self, task: Task) -> None:
        with self.index_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(task.to_dict(), ensure_ascii=False) + "\n")
