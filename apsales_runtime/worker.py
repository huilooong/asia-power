"""APSales background workers — scheduler tick, queue drain, health loop."""

from __future__ import annotations

import logging
import threading
import time
from typing import TYPE_CHECKING

from apsales_runtime.logging import log_decision

if TYPE_CHECKING:
    from apsales_runtime.lifecycle import AgentLifecycle

logger = logging.getLogger("apsales_runtime.worker")


def _sleep(stop_event: threading.Event, seconds: int) -> None:
    for _ in range(max(1, seconds)):
        if stop_event.is_set():
            return
        time.sleep(1)


def run_health_loop(lifecycle: AgentLifecycle, interval_seconds: int) -> None:
    while not lifecycle.stop_event.is_set():
        try:
            health = lifecycle.monitor_health()
            logger.info(
                "health status=%s uptime=%ss queue=%s",
                health.status,
                health.uptime_seconds,
                health.queue_summary,
            )
        except Exception as exc:
            lifecycle.health.last_error = str(exc)
            logger.exception("Health loop error")
        _sleep(lifecycle.stop_event, interval_seconds)


def run_scheduler_loop(lifecycle: AgentLifecycle, interval_seconds: int) -> None:
    batch = int((lifecycle.config.get("task_queue") or {}).get("worker_batch_size") or 10)
    while not lifecycle.stop_event.is_set():
        try:
            enqueued = lifecycle.scheduler.tick()
            if enqueued:
                log_decision(
                    decision="scheduler_tick",
                    reason=f"enqueued={len(enqueued)}",
                )
            claimed = lifecycle.queue.claim_next(batch_size=batch)
            for task in claimed:
                # Runtime foundation only — mark complete; business handlers wire later.
                lifecycle.queue.complete(
                    task["task_id"],
                    result={"handled_by": "runtime_foundation", "note": "no business handler"},
                )
                log_decision(
                    decision=f"process:{task.get('task_type')}",
                    reason=f"task_id={task['task_id']}",
                    correlation_id=task.get("correlation_id", ""),
                )
        except Exception as exc:
            lifecycle.health.last_error = str(exc)
            logger.exception("Scheduler loop error")
        _sleep(lifecycle.stop_event, interval_seconds)


def start_workers(lifecycle: AgentLifecycle) -> list[threading.Thread]:
    lifecycle_cfg = lifecycle.config.get("lifecycle") or {}
    sched_cfg = lifecycle.config.get("scheduler") or {}
    health_interval = int(lifecycle_cfg.get("health_interval_seconds") or 60)
    sched_interval = int(sched_cfg.get("tick_interval_seconds") or 30)

    threads = [
        threading.Thread(
            target=run_health_loop,
            args=(lifecycle, health_interval),
            name="apsales-health",
            daemon=True,
        ),
        threading.Thread(
            target=run_scheduler_loop,
            args=(lifecycle, sched_interval),
            name="apsales-scheduler",
            daemon=True,
        ),
    ]
    for t in threads:
        t.start()
        lifecycle.register_thread(t)
    return threads
