"""APSales agent lifecycle — startup, shutdown, restart, health."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any

from audit.logger import log_event, log_error
from apsales_runtime.config import ModelRouter, load_apsales_runtime_config
from apsales_runtime.logging import log_decision
from apsales_runtime.memory import MemoryStore
from apsales_runtime import paths as runtime_paths
from apsales_runtime.recovery import RecoveryManager
from apsales_runtime.scheduler import Scheduler
from apsales_runtime.task_queue import TaskQueue
from apsales_runtime.tools import ToolFramework


@dataclass
class RuntimeHealth:
    status: str = "starting"
    uptime_seconds: int = 0
    last_error: str | None = None
    queue_summary: dict[str, int] = field(default_factory=dict)
    memory_ok: bool = False
    tools_ok: bool = False
    model_router: dict[str, Any] = field(default_factory=dict)
    recovery: dict[str, Any] = field(default_factory=dict)
    restart_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "uptime_seconds": self.uptime_seconds,
            "last_error": self.last_error,
            "queue_summary": self.queue_summary,
            "memory_ok": self.memory_ok,
            "tools_ok": self.tools_ok,
            "model_router": self.model_router,
            "recovery": self.recovery,
            "restart_count": self.restart_count,
        }


class AgentLifecycle:
    """Manage APSales runtime lifecycle without business handlers."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config = config or load_apsales_runtime_config()
        self.started_at = time.time()
        self._stop_event = threading.Event()
        self._lock = threading.Lock()
        self.health = RuntimeHealth()
        self.model_router = ModelRouter(self.config)
        queue_cfg = self.config.get("task_queue") or {}
        self.queue = TaskQueue(
            max_retries=int(queue_cfg.get("max_retries") or 5),
            retry_backoff_seconds=int(queue_cfg.get("retry_backoff_seconds") or 300),
        )
        self.scheduler = Scheduler(self.config, self.queue)
        self.recovery = RecoveryManager(self.config, self.queue, self.scheduler)
        self.memory = MemoryStore()
        tools_cfg = self.config.get("tools") or {}
        self.tools = ToolFramework(enabled=list(tools_cfg.get("enabled") or []))
        self._threads: list[threading.Thread] = []

    def startup(self) -> RuntimeHealth:
        runtime_paths.ensure_runtime_dirs()
        self.health.status = "starting"
        log_event("apsales_runtime_start", agent_id=self.config.get("agent_id", "apsales"))
        log_decision(decision="startup", reason="APSales runtime bootstrap")

        try:
            from apsales_runtime.bootstrap import bootstrap_apsales_runtime
            bootstrap_apsales_runtime(self.config.get("agent_id", "apsales"))
        except Exception as exc:
            self.health.last_error = f"bootstrap: {exc}"
            self.health.status = "failed"
            log_error(str(exc), context="apsales_startup")
            return self.health

        self.tools.bootstrap()
        mem_health = self.memory.health()
        self.health.memory_ok = bool(mem_health.get("memory_index"))
        tool_health = self.tools.health()
        self.health.tools_ok = all(
            v.get("registered") for v in tool_health.get("tools", {}).values()
        )
        self.health.recovery = self.recovery.recover_on_start()
        self.health.status = "running"
        self._write_heartbeat()
        return self.health

    def shutdown(self) -> None:
        self.health.status = "stopping"
        self._stop_event.set()
        for t in self._threads:
            t.join(timeout=5)
        self.recovery.save_state(self.snapshot())
        self.health.status = "stopped"
        log_event(
            "apsales_runtime_stop",
            agent_id=self.config.get("agent_id", "apsales"),
            uptime_seconds=int(time.time() - self.started_at),
        )
        log_decision(decision="shutdown", reason="graceful stop")

    def restart(self) -> RuntimeHealth:
        with self._lock:
            self.health.restart_count += 1
            log_decision(decision="restart", reason=f"count={self.health.restart_count}")
            self.shutdown()
            self._stop_event.clear()
            self.started_at = time.time()
            self._threads.clear()
            return self.startup()

    def monitor_health(self) -> RuntimeHealth:
        self.health.uptime_seconds = int(time.time() - self.started_at)
        self.health.queue_summary = self.queue.summary()
        self.health.model_router = self.model_router.snapshot()
        mem = self.memory.health()
        self.health.memory_ok = bool(mem.get("memory_index"))
        if self._stop_event.is_set():
            self.health.status = "stopped"
        elif self.health.status not in {"failed", "stopping"}:
            self.health.status = "running"
        self.recovery.save_state(self.snapshot())
        self._write_heartbeat()
        return self.health

    def snapshot(self) -> dict[str, Any]:
        return {
            "agent_id": self.config.get("agent_id"),
            "health": self.health.to_dict(),
            "memory": self.memory.snapshot(),
            "queue": self.queue.summary(),
        }

    def _write_heartbeat(self) -> None:
        runtime_paths.ensure_runtime_dirs()
        import json
        record = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "health": self.health.to_dict(),
        }
        with runtime_paths.HEARTBEAT_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    @property
    def stop_event(self) -> threading.Event:
        return self._stop_event

    def register_thread(self, thread: threading.Thread) -> None:
        self._threads.append(thread)
