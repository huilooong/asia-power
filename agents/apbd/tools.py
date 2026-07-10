"""APBD tool interfaces — stubs only, no business logic."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class BaseTool(ABC):
    """Interface: run(), status(), result()."""

    name: str = "BaseTool"

    def __init__(self) -> None:
        self._status = "idle"
        self._result: dict[str, Any] = {}
        self._started_at = ""
        self._finished_at = ""

    @abstractmethod
    def run(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute tool work and populate result."""

    def status(self) -> str:
        return self._status

    def result(self) -> dict[str, Any]:
        return dict(self._result)

    def _complete(self, result: dict[str, Any]) -> dict[str, Any]:
        self._status = "completed"
        self._finished_at = _now_iso()
        self._result = result
        return result

    def _stub_run(self, payload: dict[str, Any] | None, *, artifact_type: str) -> dict[str, Any]:
        self._status = "running"
        self._started_at = _now_iso()
        goal = (payload or {}).get("goal", "")
        return self._complete({
            "tool": self.name,
            "mode": "stub",
            "goal": goal,
            "message": f"{self.name} stub completed — no external APIs in MVP",
            "artifact_type": artifact_type,
            "items": [],
            "started_at": self._started_at,
            "finished_at": self._finished_at,
        })


class LeadFinderTool(BaseTool):
    name = "LeadFinderTool"

    def run(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        self._status = "running"
        self._started_at = _now_iso()
        payload = payload or {}
        from agents.apbd.safety import assert_apbd_no_browser_ui

        assert_apbd_no_browser_ui("LeadFinderTool.run")
        max_per_query = int(payload.get("max_results_per_query") or 5)
        max_total = int(payload.get("max_total") or 80)
        from agents.apbd.lead_finder import run_lead_finder

        outcome = run_lead_finder(max_results_per_query=max_per_query, max_total=max_total)
        if not outcome.get("ok"):
            self._status = "failed"
            self._result = outcome
            return outcome
        return self._complete({
            "tool": self.name,
            "mode": "live",
            "artifact_type": "leads",
            "lead_count": outcome.get("lead_count", 0),
            "outputs": outcome.get("outputs", {}),
            "stats": outcome.get("stats", {}),
            "started_at": self._started_at,
            "finished_at": _now_iso(),
        })


class KeywordFinderTool(BaseTool):
    name = "KeywordFinderTool"

    def run(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        self._status = "running"
        self._started_at = _now_iso()
        payload = payload or {}
        from agents.apbd.safety import assert_apbd_no_browser_ui

        assert_apbd_no_browser_ui("KeywordFinderTool.run")
        max_keywords = int(payload.get("max_keywords") or 400)
        from agents.apbd.keyword_finder import run_keyword_finder

        outcome = run_keyword_finder(max_keywords=max_keywords)
        if not outcome.get("ok"):
            self._status = "failed"
            self._result = outcome
            return outcome
        return self._complete({
            "tool": self.name,
            "mode": "live",
            "artifact_type": "keywords",
            "keyword_count": outcome.get("keyword_count", 0),
            "outputs": outcome.get("outputs", {}),
            "stats": outcome.get("stats", {}),
            "started_at": self._started_at,
            "finished_at": _now_iso(),
        })


class CompetitorTool(BaseTool):
    name = "CompetitorTool"

    def run(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        self._status = "running"
        self._started_at = _now_iso()
        payload = payload or {}
        from agents.apbd.safety import assert_apbd_no_browser_ui

        assert_apbd_no_browser_ui("CompetitorTool.run")
        max_opportunities = int(payload.get("max_opportunities") or 120)
        from agents.apbd.competitor_finder import run_competitor_finder

        outcome = run_competitor_finder(max_opportunities=max_opportunities)
        if not outcome.get("ok"):
            self._status = "failed"
            self._result = outcome
            return outcome
        return self._complete({
            "tool": self.name,
            "mode": "live",
            "artifact_type": "competitors",
            "opportunity_count": outcome.get("opportunity_count", 0),
            "outputs": outcome.get("outputs", {}),
            "stats": outcome.get("stats", {}),
            "started_at": self._started_at,
            "finished_at": _now_iso(),
        })


class MissionPlannerTool(BaseTool):
    name = "MissionPlannerTool"

    def run(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        self._status = "running"
        self._started_at = _now_iso()
        payload = payload or {}
        from agents.apbd.safety import assert_apbd_no_browser_ui

        assert_apbd_no_browser_ui("MissionPlannerTool.run")
        day = (payload.get("day") or "").strip() or None
        from agents.apbd.mission_planner import run_mission_planner

        outcome = run_mission_planner(day=day)
        if not outcome.get("ok"):
            self._status = "failed"
            self._result = outcome
            return outcome
        return self._complete({
            "tool": self.name,
            "mode": "live",
            "artifact_type": "missions",
            "mission_count": outcome.get("mission_count", 0),
            "outputs": outcome.get("outputs", {}),
            "stats": outcome.get("stats", {}),
            "started_at": self._started_at,
            "finished_at": _now_iso(),
        })


class ContentPlannerTool(BaseTool):
    name = "ContentPlannerTool"

    def run(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._stub_run(payload, artifact_type="content_plan")


class DistributionTool(BaseTool):
    name = "DistributionTool"

    def run(self, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        return self._stub_run(payload, artifact_type="distribution")


TOOL_REGISTRY: dict[str, type[BaseTool]] = {
    "LeadFinderTool": LeadFinderTool,
    "KeywordFinderTool": KeywordFinderTool,
    "CompetitorTool": CompetitorTool,
    "MissionPlannerTool": MissionPlannerTool,
    "ContentPlannerTool": ContentPlannerTool,
    "DistributionTool": DistributionTool,
}


def get_tool(tool_name: str) -> BaseTool:
    cls = TOOL_REGISTRY.get(tool_name)
    if not cls:
        raise ValueError(f"Unknown APBD tool: {tool_name}")
    return cls()


def save_tool_result(result_dir: Path, task_id: str, tool: BaseTool) -> Path:
    result_dir.mkdir(parents=True, exist_ok=True)
    path = result_dir / f"{task_id}.json"
    payload = {
        "task_id": task_id,
        "tool": tool.name,
        "status": tool.status(),
        "result": tool.result(),
        "saved_at": _now_iso(),
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return path
