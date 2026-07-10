"""APBD Continuous Runner — 24/7 business development loop."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from agents.apbd.competitor_finder import run_competitor_finder
from agents.apbd.config import day_runtime_dir, load_config
from agents.apbd.keyword_finder import run_keyword_finder
from agents.apbd.lead_finder import run_lead_finder
from agents.apbd.mission_planner import run_mission_planner
from agents.apbd.models import RuntimePhase
from agents.apbd.safety import assert_apbd_no_browser_ui
from agents.apbd.state import APBDStateStore

logger = logging.getLogger("agents.apbd.runner")


class APBDRunner:
    """Continuous APBD loop: discover → analyze → queue content → sleep → repeat."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config = config or load_config()
        self.state_store = APBDStateStore()
        runner_cfg = self.config.get("runner") or {}
        self.interval_seconds = int(runner_cfg.get("interval_seconds") or 6 * 60 * 60)
        self.sleep_chunk_seconds = int(runner_cfg.get("sleep_chunk_seconds") or 30)
        self._day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.day_dir = day_runtime_dir(self._day)
        self.logs_dir = self.day_dir / "logs"
        self._file_logger: logging.Logger | None = None

    def _setup_logging(self) -> None:
        self.day_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        log_path = self.logs_dir / "runner.log"
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", datefmt="%H:%M"))
        runner_logger = logging.getLogger("agents.apbd.runner")
        runner_logger.handlers = [file_handler]
        runner_logger.setLevel(logging.INFO)
        runner_logger.propagate = False
        self._file_logger = runner_logger

    def _log(self, message: str) -> None:
        if self._file_logger:
            self._file_logger.info(message)
        else:
            logger.info(message)

    def _refresh_day(self) -> None:
        self._day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.day_dir = day_runtime_dir(self._day)

    def run_cycle(self) -> dict[str, Any]:
        """Single loop: Lead → Keyword → Competitor → Mission → content queue."""
        assert_apbd_no_browser_ui("APBDRunner.run_cycle")
        self._refresh_day()
        self._setup_logging()

        cycle_id = f"cycle-{uuid.uuid4().hex[:10]}"
        state = self.state_store.load()
        cycle_num = int(state.get("runner_cycle") or 0) + 1
        self.state_store.save({
            "phase": RuntimePhase.RUNNING.value,
            "runner_mode": state.get("runner_mode") or "once",
            "runner_cycle": cycle_num,
            "run_id": cycle_id,
            "error": "",
            "next_run_at": "",
        })

        steps = [
            ("LeadFinder", run_lead_finder),
            ("KeywordFinder", run_keyword_finder),
            ("CompetitorFinder", run_competitor_finder),
            ("MissionPlanner", run_mission_planner),
        ]
        results: dict[str, Any] = {"cycle_id": cycle_id, "cycle": cycle_num, "steps": {}}

        try:
            for name, fn in steps:
                if self.state_store.is_stop_requested():
                    self._log("Stop requested — halting cycle")
                    self.state_store.set_phase(RuntimePhase.IDLE)
                    return {"ok": False, "stopped": True, "phase": RuntimePhase.IDLE.value, **results}

                self._log(f"Running {name}")
                outcome = fn()
                results["steps"][name] = outcome
                if not outcome.get("ok"):
                    err = outcome.get("error") or f"{name} failed"
                    self._log(f"Failed {name}: {err}")
                    self.state_store.set_phase(RuntimePhase.ERROR, error=err)
                    return {"ok": False, "phase": RuntimePhase.ERROR.value, "error": err, **results}
                self._log(f"Completed {name}")
                if name == "LeadFinder":
                    outreach = outcome.get("outreach_queue") or {}
                    self._log(
                        f"Outreach queue: {outcome.get('outreach_queue_count', 0)} companies → "
                        f"{outreach.get('outreach_queue_dir', '')}"
                    )

            mission_out = results["steps"]["MissionPlanner"]
            outputs = mission_out.get("outputs") or {}
            content = mission_out.get("content_queue") or {}
            self._log("Generate Executive Plan")
            self._log(f"Executive plan: {outputs.get('executive_plan_path', '')}")
            self._log("Generate Content Queue")
            self._log(
                f"Content queue: {content.get('task_count', 0)} tasks → "
                f"{content.get('content_queue_dir', '')}"
            )
            draft = mission_out.get("draft_assets") or {}
            self._log("Generate Draft Assets")
            self._log(
                f"Draft assets: {mission_out.get('draft_asset_count', 0)} pending approval → "
                f"{draft.get('draft_assets_dir', '')}"
            )

            self.state_store.save({
                "phase": RuntimePhase.WAITING_APPROVAL.value,
                "last_summary_path": f"apbd/{self._day}/missions/summary.json",
            })
            self._log("Cycle complete — waiting approval")

            return {
                "ok": True,
                "phase": RuntimePhase.WAITING_APPROVAL.value,
                "day": self._day,
                "cycle": cycle_num,
                "cycle_id": cycle_id,
                "lead_count": results["steps"]["LeadFinder"].get("lead_count", 0),
                "outreach_queue_count": results["steps"]["LeadFinder"].get("outreach_queue_count", 0),
                "outreach_queue_path": (results["steps"]["LeadFinder"].get("outreach_queue") or {}).get("json_path", ""),
                "keyword_count": results["steps"]["KeywordFinder"].get("keyword_count", 0),
                "opportunity_count": results["steps"]["CompetitorFinder"].get("opportunity_count", 0),
                "mission_count": mission_out.get("mission_count", 0),
                "content_queue_count": mission_out.get("content_queue_count", 0),
                "draft_asset_count": mission_out.get("draft_asset_count", 0),
                "pending_approval": mission_out.get("pending_approval", 0),
                "executive_plan_path": outputs.get("executive_plan_path", ""),
                "content_queue_path": content.get("json_path", ""),
                "draft_assets_path": draft.get("approval_queue_path", ""),
                "steps": results["steps"],
            }
        except Exception as exc:
            self._log(f"Runner error: {exc}")
            self.state_store.set_phase(RuntimePhase.ERROR, error=str(exc))
            return {"ok": False, "phase": RuntimePhase.ERROR.value, "error": str(exc), **results}

    def run_once(self) -> dict[str, Any]:
        self.state_store.clear_stop()
        self.state_store.save({"runner_mode": "once"})
        return self.run_cycle()

    def run_continuous(self) -> dict[str, Any]:
        self.state_store.clear_stop()
        self.state_store.save({"runner_mode": "continuous"})
        self._setup_logging()
        self._log(f"Continuous runner started — interval {self.interval_seconds}s")

        last_result: dict[str, Any] = {}
        while not self.state_store.is_stop_requested():
            last_result = self.run_cycle()
            if not last_result.get("ok") and not last_result.get("stopped"):
                return last_result
            if self.state_store.is_stop_requested():
                break

            next_run = datetime.now(timezone.utc) + timedelta(seconds=self.interval_seconds)
            next_run_iso = next_run.replace(microsecond=0).isoformat()
            self.state_store.save({
                "phase": RuntimePhase.SLEEPING.value,
                "next_run_at": next_run_iso,
            })
            self._log(f"Sleeping until {next_run_iso}")

            slept = 0
            while slept < self.interval_seconds:
                if self.state_store.is_stop_requested():
                    self._log("Stop requested during sleep")
                    self.state_store.set_phase(RuntimePhase.IDLE)
                    return {
                        "ok": True,
                        "stopped": True,
                        "phase": RuntimePhase.IDLE.value,
                        "last_cycle": last_result,
                    }
                chunk = min(self.sleep_chunk_seconds, self.interval_seconds - slept)
                time.sleep(chunk)
                slept += chunk

        self.state_store.set_phase(RuntimePhase.IDLE)
        return {
            "ok": True,
            "stopped": True,
            "phase": RuntimePhase.IDLE.value,
            "last_cycle": last_result,
        }

    def stop(self) -> dict[str, Any]:
        state = self.state_store.request_stop()
        return {
            "ok": True,
            "message": "Stop requested — runner halts between steps or during sleep",
            "phase": state.get("phase"),
            "runner_mode": state.get("runner_mode"),
        }
