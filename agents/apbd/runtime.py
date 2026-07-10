"""APBD runtime loop — load config, run tasks, save results, wait for approval."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agents.apbd.config import day_runtime_dir, load_config
from agents.apbd.models import DailySummary, RuntimePhase, TaskStatus
from agents.apbd.scheduler import APBDScheduler
from agents.apbd.state import APBDStateStore
from agents.apbd.task_queue import APBDTaskQueue
from agents.apbd.tools import get_tool, save_tool_result

logger = logging.getLogger("agents.apbd.runtime")


class APBDRuntime:
    """Filesystem-backed APBD execution engine."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config = config or load_config()
        self.state_store = APBDStateStore()
        self.scheduler = APBDScheduler(self.config)
        self._day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.day_dir = day_runtime_dir(self._day)
        self.logs_dir = self.day_dir / "logs"
        self.results_dir = self.day_dir / "results"
        self.queue = APBDTaskQueue(self.day_dir)
        self._file_logger: logging.Logger | None = None

    def _setup_day_dirs(self) -> None:
        self.day_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)

    def _setup_logging(self) -> None:
        self._setup_day_dirs()
        log_path = self.logs_dir / "runtime.log"
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", datefmt="%H:%M"))
        runtime_logger = logging.getLogger("agents.apbd.runtime")
        runtime_logger.handlers = [file_handler]
        runtime_logger.setLevel(logging.INFO)
        runtime_logger.propagate = False
        self._file_logger = runtime_logger

    def _log(self, message: str) -> None:
        if self._file_logger:
            self._file_logger.info(message)
        else:
            logger.info(message)

    def start(self) -> dict[str, Any]:
        """Run full daily loop synchronously."""
        self.state_store.clear_stop()
        self._setup_logging()
        run_id = f"run-{uuid.uuid4().hex[:10]}"
        self.state_store.save({
            "phase": RuntimePhase.RUNNING.value,
            "run_id": run_id,
            "started_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "finished_at": "",
            "error": "",
            "current_task_id": "",
        })

        plan = self.scheduler.plan()
        self._log(f"Runtime Started (mode={plan.mode.value})")
        self._log(f"Schedule: {plan.description}")

        try:
            specs = self.config.get("tasks") or []
            tasks, added = self.queue.sync_with_specs(specs)
            if added:
                self._log(f"Task sync: added {added} task(s) from config")
            self._log(f"Task list ready ({len(tasks)} tasks)")

            completed = 0
            failed = 0
            result_files: list[str] = []

            while True:
                if self.state_store.is_stop_requested():
                    self._log("Stop requested — halting after current task")
                    self.state_store.set_phase(RuntimePhase.IDLE)
                    return self.status_dict(message="Stopped by user")

                task = self.queue.next_pending()
                if not task:
                    break

                self.state_store.save({"current_task_id": task.task_id})
                self._log(f"Running {task.tool_name or task.task_type}")
                self.queue.mark_running(task.task_id)

                try:
                    tool = get_tool(task.tool_name)
                    tool.run(task.payload)
                    result_path = save_tool_result(self.results_dir, task.task_id, tool)
                    self.queue.mark_completed(task.task_id, result_path=str(result_path.relative_to(self.day_dir)))
                    result_files.append(str(result_path.relative_to(self.day_dir)))
                    completed += 1
                    self._log(f"Completed {task.tool_name or task.task_type}")
                    self._log("Saving Results")
                except Exception as exc:
                    self.queue.mark_failed(task.task_id, error=str(exc))
                    failed += 1
                    self._log(f"Failed {task.task_type}: {exc}")

            summary = self._write_summary(tasks_total=len(tasks), completed=completed, failed=failed, result_files=result_files)
            summary_path = self.day_dir / "summary.json"
            self.state_store.save({
                "phase": RuntimePhase.WAITING_APPROVAL.value,
                "current_task_id": "",
                "last_summary_path": str(summary_path.relative_to(day_runtime_dir().parent.parent)),
            })
            self._log("Generate daily summary")
            self._log("Waiting for approval")

            return {
                "ok": True,
                "phase": RuntimePhase.WAITING_APPROVAL.value,
                "run_id": run_id,
                "day": self._day,
                "summary_path": str(summary_path),
                "tasks_completed": completed,
                "tasks_failed": failed,
                "summary": summary.to_dict(),
            }
        except Exception as exc:
            self.state_store.set_phase(RuntimePhase.ERROR, error=str(exc))
            self._log(f"Runtime error: {exc}")
            return {"ok": False, "phase": RuntimePhase.ERROR.value, "error": str(exc)}

    def stop(self) -> dict[str, Any]:
        state = self.state_store.request_stop()
        return {
            "ok": True,
            "message": "Stop requested — will halt between tasks if runtime is running",
            "phase": state.get("phase"),
        }

    def status_dict(self, *, message: str = "") -> dict[str, Any]:
        state = self.state_store.load()
        tasks = []
        if self.day_dir.is_dir():
            tasks = [t.to_dict() for t in self.queue.load_all()]
        summary_path = self.day_dir / "summary.json"
        summary = None
        if summary_path.is_file():
            try:
                summary = json.loads(summary_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                summary = None
        return {
            "ok": True,
            "agent_id": "apbd",
            "phase": state.get("phase", RuntimePhase.IDLE.value),
            "run_id": state.get("run_id", ""),
            "current_task_id": state.get("current_task_id", ""),
            "stop_requested": state.get("stop_requested", False),
            "error": state.get("error", ""),
            "day": self._day,
            "day_dir": str(self.day_dir),
            "tasks": tasks,
            "summary": summary,
            "schedule": self.scheduler.plan().__dict__,
            "message": message,
        }

    def status_text(self) -> str:
        data = self.status_dict()
        lines = [
            f"APBD Runtime — {data['phase']}",
            f"Day: {data['day']}",
            f"Run: {data['run_id'] or '—'}",
            f"Directory: {data['day_dir']}",
        ]
        if data.get("current_task_id"):
            lines.append(f"Current task: {data['current_task_id']}")
        if data.get("error"):
            lines.append(f"Error: {data['error']}")
        tasks = data.get("tasks") or []
        if tasks:
            lines.append("")
            lines.append("Tasks:")
            for t in tasks:
                lines.append(f"  - {t['task_id']} | {t['task_type']} | {t['status']} | {t.get('tool_name', '')}")
        if data.get("summary"):
            s = data["summary"]
            lines.append("")
            lines.append(f"Summary: {s.get('tasks_completed', 0)}/{s.get('tasks_total', 0)} completed — waiting approval={s.get('waiting_approval')}")
        plan = data.get("schedule") or {}
        lines.append("")
        lines.append(f"Schedule mode: {plan.get('mode', 'manual')} ({'implemented' if plan.get('implemented') else 'future'})")
        if data.get("message"):
            lines.append(data["message"])
        return "\n".join(lines)

    def _write_summary(
        self,
        *,
        tasks_total: int,
        completed: int,
        failed: int,
        result_files: list[str],
    ) -> DailySummary:
        summary = DailySummary(
            date=self._day,
            phase=RuntimePhase.WAITING_APPROVAL.value,
            tasks_total=tasks_total,
            tasks_completed=completed,
            tasks_failed=failed,
            result_files=result_files,
            highlights=[
                "APBD MVP runtime completed daily task loop (stub tools).",
                "Review results/ and approve before next run.",
            ],
            waiting_approval=True,
        )
        path = self.day_dir / "summary.json"
        path.write_text(json.dumps(summary.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
        return summary


def dispatch_apbd_cli(message: str) -> str:
    """Handle `/apbd start|status|stop` commands."""
    text = (message or "").strip()
    lower = text.lower()
    if not lower.startswith("/apbd"):
        return "Unknown APBD command. Use: /apbd start | /apbd status | /apbd stop"

    parts = text.split()
    action = parts[1].lower() if len(parts) > 1 else "help"
    runtime = APBDRuntime()

    if action == "start":
        result = runtime.start()
        if not result.get("ok"):
            return f"APBD start failed: {result.get('error', 'unknown')}"
        return (
            f"APBD run complete — phase={result['phase']}\n"
            f"Day: {result['day']}\n"
            f"Summary: {result['summary_path']}\n"
            f"Tasks: {result['tasks_completed']} completed, {result['tasks_failed']} failed\n"
            f"Status: waiting for CEO approval"
        )

    if action == "run":
        from agents.apbd.runner import APBDRunner

        runner = APBDRunner()
        result = runner.run_continuous()
        if not result.get("ok") and not result.get("stopped"):
            return f"APBD runner failed: {result.get('error', 'unknown')}"
        phase = result.get("phase", "idle")
        if result.get("stopped"):
            return f"APBD runner stopped — phase={phase}"
        return (
            f"APBD runner complete — phase={phase}\n"
            f"Content queue: {result.get('content_queue_count', 0)} tasks"
        )

    if action == "once":
        from agents.apbd.runner import APBDRunner

        runner = APBDRunner()
        result = runner.run_once()
        if not result.get("ok"):
            err = result.get("error") or "unknown error"
            return f"APBD once failed: {err}"
        return (
            f"APBD cycle complete — phase={result.get('phase')}\n"
            f"Day: {result.get('day')}\n"
            f"Leads: {result.get('lead_count', 0)} | Keywords: {result.get('keyword_count', 0)} | "
            f"Competitors: {result.get('opportunity_count', 0)} | Missions: {result.get('mission_count', 0)}\n"
            f"Executive plan: {result.get('executive_plan_path', '')}\n"
            f"Content queue: {result.get('content_queue_count', 0)} tasks\n"
            f"Draft assets: {result.get('draft_asset_count', 0)} (pending: {result.get('pending_approval', 0)})\n"
            f"Approval queue: {result.get('draft_assets_path', '')}"
        )

    if action == "leadfinder":
        from agents.apbd.lead_finder import run_lead_finder

        result = run_lead_finder()
        if not result.get("ok"):
            err = result.get("error") or "unknown error"
            return f"LeadFinder failed: {err}"
        outputs = result.get("outputs") or {}
        stats = result.get("stats") or {}
        outreach = result.get("outreach_queue") or {}
        return (
            f"LeadFinder complete — {result.get('lead_count', 0)} real companies\n"
            f"Outreach queue: {result.get('outreach_queue_count', 0)} drafts (pending CEO approval)\n"
            f"Leads JSON: {outputs.get('json_path', '')}\n"
            f"Outreach queue: {outreach.get('json_path', '')}\n"
            f"Sources: {', '.join(stats.get('sources_used') or [])}\n"
            f"Queries: {stats.get('queries_run', 0)} | Duplicates skipped: {stats.get('duplicates_skipped', 0)}"
        )

    if action == "keywordfinder":
        from agents.apbd.keyword_finder import run_keyword_finder

        result = run_keyword_finder()
        if not result.get("ok"):
            err = result.get("error") or "unknown error"
            return f"KeywordFinder failed: {err}"
        outputs = result.get("outputs") or {}
        stats = result.get("stats") or {}
        summary = outputs.get("summary") or {}
        by_pri = summary.get("by_priority") or {}
        return (
            f"KeywordFinder complete — {result.get('keyword_count', 0)} keywords\n"
            f"JSON: {outputs.get('json_path', '')}\n"
            f"CSV: {outputs.get('csv_path', '')}\n"
            f"Summary: {outputs.get('summary_path', '')}\n"
            f"Priority S/A/B: {by_pri.get('S', 0)}/{by_pri.get('A', 0)}/{by_pri.get('B', 0)} | "
            f"Engines: {stats.get('engine_codes_used', 0)} | Dedup skipped: {stats.get('duplicates_skipped', 0)}"
        )

    if action == "competitorfinder":
        from agents.apbd.competitor_finder import run_competitor_finder

        result = run_competitor_finder()
        if not result.get("ok"):
            err = result.get("error") or "unknown error"
            return f"CompetitorFinder failed: {err}"
        outputs = result.get("outputs") or {}
        stats = result.get("stats") or {}
        summary = outputs.get("summary") or {}
        by_pri = summary.get("by_priority") or {}
        return (
            f"CompetitorFinder complete — {result.get('opportunity_count', 0)} opportunities\n"
            f"JSON: {outputs.get('json_path', '')}\n"
            f"CSV: {outputs.get('csv_path', '')}\n"
            f"Summary: {outputs.get('summary_path', '')}\n"
            f"Priority S/A/B: {by_pri.get('S', 0)}/{by_pri.get('A', 0)}/{by_pri.get('B', 0)} | "
            f"Competitors: {stats.get('competitors_analyzed', 0)} | "
            f"HTTP fetch OK: {stats.get('fetch_success', 0)}"
        )

    if action == "missionplanner":
        from agents.apbd.mission_planner import run_mission_planner

        result = run_mission_planner()
        if not result.get("ok"):
            err = result.get("error") or "unknown error"
            return f"MissionPlanner failed: {err}"
        outputs = result.get("outputs") or {}
        stats = result.get("stats") or {}
        summary = outputs.get("summary") or {}
        by_pri = summary.get("by_priority") or {}
        return (
            f"MissionPlanner complete — {result.get('mission_count', 0)} missions\n"
            f"JSON: {outputs.get('json_path', '')}\n"
            f"CSV: {outputs.get('csv_path', '')}\n"
            f"Executive plan: {outputs.get('executive_plan_path', '')}\n"
            f"Summary: {outputs.get('summary_path', '')}\n"
            f"Content queue: {result.get('content_queue_count', 0)} tasks\n"
            f"Draft assets: {result.get('draft_asset_count', 0)} (pending approval: {result.get('pending_approval', 0)})\n"
            f"Approval queue: {(result.get('draft_assets') or {}).get('approval_queue_path', '')}\n"
            f"Priority S/A/B: {by_pri.get('S', 0)}/{by_pri.get('A', 0)}/{by_pri.get('B', 0)} | "
            f"Inputs: leads={stats.get('leads_loaded', 0)} kw={stats.get('keywords_loaded', 0)} "
            f"comp={stats.get('competitors_loaded', 0)}"
        )

    if action == "status":
        return runtime.status_text()

    if action == "stop":
        from agents.apbd.runner import APBDRunner

        runner = APBDRunner()
        runner.stop()
        runtime.stop()
        return runtime.status_text()

    return (
        "APBD commands:\n"
        "  /apbd run           — continuous loop (default every 6 hours)\n"
        "  /apbd once          — single discovery cycle\n"
        "  /apbd start         — run today's task list\n"
        "  /apbd leadfinder    — discover public business leads (Phase 1 markets)\n"
        "  /apbd keywordfinder   — discover SEO keyword opportunities (local catalog)\n"
        "  /apbd competitorfinder — competitor gap intelligence (public HTTP only)\n"
        "  /apbd missionplanner  — daily business missions from tool outputs\n"
        "  /apbd status      — show runtime state\n"
        "  /apbd stop        — stop runner or runtime between steps"
    )
