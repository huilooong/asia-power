"""APBD runtime state persistence."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agents.apbd.config import RUNTIME_ROOT
from agents.apbd.models import RuntimePhase, utc_now_iso


class APBDStateStore:
    """Filesystem-backed runtime state."""

    def __init__(self, state_file: Path | None = None) -> None:
        self.state_file = state_file or (RUNTIME_ROOT / "state.json")
        self.state_file.parent.mkdir(parents=True, exist_ok=True)

    def load(self) -> dict[str, Any]:
        if not self.state_file.is_file():
            return self._default_state()
        try:
            data = json.loads(self.state_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return self._default_state()
        return {**self._default_state(), **data}

    def save(self, state: dict[str, Any]) -> dict[str, Any]:
        merged = {**self.load(), **state}
        merged["updated_at"] = utc_now_iso()
        self.state_file.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")
        return merged

    def set_phase(self, phase: RuntimePhase, *, error: str = "") -> dict[str, Any]:
        state = self.load()
        state["phase"] = phase.value
        state["error"] = error
        if phase == RuntimePhase.RUNNING:
            state["started_at"] = state.get("started_at") or utc_now_iso()
        if phase in {RuntimePhase.COMPLETED, RuntimePhase.WAITING_APPROVAL, RuntimePhase.ERROR}:
            state["finished_at"] = utc_now_iso()
        return self.save(state)

    def request_stop(self) -> dict[str, Any]:
        state = self.load()
        state["stop_requested"] = True
        return self.save(state)

    def clear_stop(self) -> dict[str, Any]:
        state = self.load()
        state["stop_requested"] = False
        return self.save(state)

    def is_stop_requested(self) -> bool:
        return bool(self.load().get("stop_requested"))

    @staticmethod
    def _default_state() -> dict[str, Any]:
        return {
            "agent_id": "apbd",
            "phase": RuntimePhase.IDLE.value,
            "current_task_id": "",
            "run_id": "",
            "started_at": "",
            "finished_at": "",
            "updated_at": "",
            "error": "",
            "stop_requested": False,
            "last_summary_path": "",
            "runner_mode": "",
            "runner_cycle": 0,
            "next_run_at": "",
        }
