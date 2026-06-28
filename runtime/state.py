"""Shared runtime state."""

from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass
class RuntimeState:
    agent_id: str = "apcoo"
    started_at: float = field(default_factory=time.time)
    status: str = "starting"
    last_error: str | None = None
    active_tools: list[str] = field(default_factory=list)
    telegram_restarts: int = 0

    def uptime_seconds(self) -> int:
        return int(time.time() - self.started_at)
