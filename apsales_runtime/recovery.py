"""APSales runtime recovery — persist state and recover after reboot."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from apsales_runtime.logging import log_decision
from apsales_runtime import paths as runtime_paths
from apsales_runtime.scheduler import Scheduler
from apsales_runtime.task_queue import TaskQueue


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class RecoveryManager:
    """Persist runtime checkpoints and recover queue/schedule on startup."""

    def __init__(self, config: dict[str, Any], queue: TaskQueue, scheduler: Scheduler) -> None:
        self.config = config
        self.queue = queue
        self.scheduler = scheduler
        self.recovery_cfg = config.get("recovery") or {}

    def save_state(self, state: dict[str, Any]) -> None:
        if not self.recovery_cfg.get("persist_state", True):
            return
        runtime_paths.ensure_runtime_dirs()
        payload = {
            "saved_at": _now_iso(),
            "state": state,
        }
        runtime_paths.STATE_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    def load_state(self) -> dict[str, Any] | None:
        if not runtime_paths.STATE_FILE.is_file():
            return None
        try:
            data = json.loads(runtime_paths.STATE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        return data.get("state")

    def recover_on_start(self) -> dict[str, Any]:
        report: dict[str, Any] = {
            "queue_reset": 0,
            "schedule_overdue": 0,
            "previous_state": None,
        }
        if self.recovery_cfg.get("recover_queue_on_start", True):
            report["queue_reset"] = self.queue.recover_pending()
        if self.recovery_cfg.get("recover_schedule_on_start", True):
            report["schedule_overdue"] = self.scheduler.recover_overdue()
        previous = self.load_state()
        if previous:
            report["previous_state"] = previous
        log_decision(
            decision="runtime_recovery",
            reason="startup recovery completed",
            context=report,
        )
        return report
