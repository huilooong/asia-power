"""APBD runtime configuration."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent.parent
RUNTIME_ROOT = ROOT / "runtime" / "apbd"
AGENT_ID = "apbd"
DISPLAY_NAME = "APBD — AI Business Development"

DEFAULT_TASK_SPECS: list[dict[str, Any]] = [
    {
        "task_type": "lead_finder",
        "priority": "high",
        "tool_name": "LeadFinderTool",
        "payload": {"goal": "Discover qualified company leads (stub)"},
    },
    {
        "task_type": "keyword_finder",
        "priority": "high",
        "tool_name": "KeywordFinderTool",
        "payload": {"goal": "Identify SEO keyword opportunities (stub)"},
    },
    {
        "task_type": "competitor_scan",
        "priority": "medium",
        "tool_name": "CompetitorTool",
        "payload": {"goal": "Review competitor opportunities (stub)"},
    },
    {
        "task_type": "mission_planner",
        "priority": "high",
        "tool_name": "MissionPlannerTool",
        "payload": {"goal": "Generate daily executable business missions from tool outputs"},
    },
    {
        "task_type": "content_plan",
        "priority": "medium",
        "tool_name": "ContentPlannerTool",
        "payload": {"goal": "Plan content opportunities (stub)"},
    },
    {
        "task_type": "distribution",
        "priority": "medium",
        "tool_name": "DistributionTool",
        "payload": {"goal": "Recommend distribution channels (stub)"},
    },
]

DEFAULT_CONFIG: dict[str, Any] = {
    "agent_id": AGENT_ID,
    "display_name": DISPLAY_NAME,
    "schedule_mode": "manual",
    "tasks": DEFAULT_TASK_SPECS,
    "runner": {
        "interval_seconds": 6 * 60 * 60,
        "sleep_chunk_seconds": 30,
    },
    "logging": {
        "timestamp_format": "%H:%M",
    },
}


def load_config() -> dict[str, Any]:
    """Load APBD config — env overrides only in MVP."""
    cfg = dict(DEFAULT_CONFIG)
    cfg["tasks"] = [dict(t) for t in DEFAULT_TASK_SPECS]
    cfg["runner"] = dict(DEFAULT_CONFIG["runner"])
    mode = os.getenv("APBD_SCHEDULE_MODE", "").strip().lower()
    if mode in {"run_once", "manual", "daily"}:
        cfg["schedule_mode"] = mode
    interval = os.getenv("APBD_RUNNER_INTERVAL_SECONDS", "").strip()
    if interval.isdigit():
        cfg["runner"]["interval_seconds"] = max(60, int(interval))
    return cfg


def task_tool_order(specs: list[dict[str, Any]] | None = None) -> dict[str, int]:
    """Deterministic tool execution order from config spec list."""
    source = specs if specs is not None else DEFAULT_TASK_SPECS
    return {
        spec["tool_name"]: index
        for index, spec in enumerate(source)
        if spec.get("tool_name")
    }


def day_runtime_dir(date_str: str | None = None) -> Path:
    from datetime import datetime, timezone

    day = date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return RUNTIME_ROOT / day
