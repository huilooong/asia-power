"""APSales scheduler — timed follow-ups and reminders."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from apsales_runtime.logging import log_decision
from apsales_runtime import paths as runtime_paths
from apsales_runtime.task_queue import TaskQueue

VALID_RULES = frozenset({
    "follow_up_24h",
    "follow_up_3d",
    "quotation_reminder",
    "supplier_reminder",
})


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class Scheduler:
    """Schedule future tasks; worker enqueues due items into TaskQueue."""

    def __init__(self, config: dict[str, Any], queue: TaskQueue) -> None:
        runtime_paths.ensure_runtime_dirs()
        self.config = config
        self.queue = queue
        self.rules = (config.get("scheduler") or {}).get("rules") or {}

    def schedule(
        self,
        rule_name: str,
        payload: dict[str, Any],
        *,
        base_time: datetime | None = None,
        correlation_id: str = "",
    ) -> dict[str, Any]:
        if rule_name not in VALID_RULES:
            raise ValueError(f"Unknown schedule rule: {rule_name}")
        rule = self.rules.get(rule_name) or {}
        delay_hours = int(rule.get("delay_hours") or 24)
        task_type = rule.get("task_type") or "reminder"
        base = base_time or datetime.now(timezone.utc)
        run_at = base + timedelta(hours=delay_hours)
        record = {
            "schedule_id": f"sch-{uuid.uuid4().hex[:12]}",
            "rule_name": rule_name,
            "task_type": task_type,
            "payload": payload,
            "run_at": run_at.replace(microsecond=0).isoformat(),
            "status": "scheduled",
            "correlation_id": correlation_id,
            "created_at": _now_iso(),
        }
        with runtime_paths.SCHEDULE_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        log_decision(
            decision=f"schedule:{rule_name}",
            reason=f"run_at={record['run_at']}",
            context={"schedule_id": record["schedule_id"]},
            correlation_id=correlation_id,
        )
        return record

    def _load_scheduled(self) -> list[dict[str, Any]]:
        if not runtime_paths.SCHEDULE_FILE.is_file():
            return []
        items: list[dict[str, Any]] = []
        for line in runtime_paths.SCHEDULE_FILE.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            items.append(json.loads(line))
        return items

    def _rewrite_scheduled(self, items: list[dict[str, Any]]) -> None:
        with runtime_paths.SCHEDULE_FILE.open("w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")

    def tick(self) -> list[dict[str, Any]]:
        """Enqueue due scheduled items; return enqueued task records."""
        now = datetime.now(timezone.utc)
        items = self._load_scheduled()
        enqueued: list[dict[str, Any]] = []
        changed = False
        for item in items:
            if item.get("status") != "scheduled":
                continue
            run_at = _parse_iso(item["run_at"])
            if run_at > now:
                continue
            task = self.queue.enqueue(
                item.get("task_type") or "reminder",
                {
                    **(item.get("payload") or {}),
                    "schedule_id": item.get("schedule_id"),
                    "rule_name": item.get("rule_name"),
                },
                correlation_id=item.get("correlation_id", ""),
            )
            item["status"] = "enqueued"
            item["task_id"] = task["task_id"]
            item["enqueued_at"] = _now_iso()
            enqueued.append(task)
            changed = True
        if changed:
            self._rewrite_scheduled(items)
        return enqueued

    def recover_overdue(self) -> int:
        """Mark overdue scheduled items — tick() will enqueue on next pass."""
        now = datetime.now(timezone.utc)
        items = self._load_scheduled()
        recovered = 0
        for item in items:
            if item.get("status") != "scheduled":
                continue
            run_at = _parse_iso(item["run_at"])
            if run_at <= now:
                recovered += 1
        return recovered

    def list_upcoming(self, limit: int = 20) -> list[dict[str, Any]]:
        items = [i for i in self._load_scheduled() if i.get("status") == "scheduled"]
        items.sort(key=lambda i: i.get("run_at", ""))
        return items[:limit]
