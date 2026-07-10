"""APBD scheduler — run once, manual start; daily schedule placeholder."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from agents.apbd.config import load_config
from agents.apbd.models import ScheduleMode


@dataclass
class SchedulePlan:
    mode: ScheduleMode
    description: str
    implemented: bool


class APBDScheduler:
    """
    MVP supports RUN_ONCE and MANUAL (same behaviour: run when invoked).
    DAILY is architecture-only — cron/launchd wiring deferred.
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config = config or load_config()
        raw = (self.config.get("schedule_mode") or "manual").lower()
        try:
            self.mode = ScheduleMode(raw)
        except ValueError:
            self.mode = ScheduleMode.MANUAL

    def plan(self) -> SchedulePlan:
        if self.mode == ScheduleMode.DAILY:
            return SchedulePlan(
                mode=ScheduleMode.DAILY,
                description=(
                    "Future: launchd/cron triggers `python main.py \"/apbd start\"` "
                    "each morning — not implemented in MVP"
                ),
                implemented=False,
            )
        if self.mode == ScheduleMode.RUN_ONCE:
            return SchedulePlan(
                mode=ScheduleMode.RUN_ONCE,
                description="Execute today's task list once, then wait for approval",
                implemented=True,
            )
        return SchedulePlan(
            mode=ScheduleMode.MANUAL,
            description="CEO runs `python main.py \"/apbd start\"` manually",
            implemented=True,
        )

    def should_run_now(self) -> bool:
        """Manual / run_once always run when start is called."""
        return self.mode in {ScheduleMode.MANUAL, ScheduleMode.RUN_ONCE, ScheduleMode.DAILY}
