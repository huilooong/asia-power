"""Runtime configuration loader."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "runtime_config.yaml"

DEFAULTS: dict[str, Any] = {
    "agent_id": "apcoo",
    "language": "zh",
    "default_channel": "telegram",
    "heartbeat_interval_seconds": 300,
    "auto_restart": True,
    "supervisor_restart_delay_seconds": 10,
    "healthcheck_on_start": True,
    "agents": {
        "apcoo": {"enabled": True, "telegram": True},
        "apsales": {"enabled": True, "telegram": True},
    },
}


def get_enabled_telegram_agents(config: dict[str, Any] | None = None) -> list[str]:
    """Return agent ids with telegram enabled in runtime config."""
    cfg = config or load_runtime_config()
    agents = cfg.get("agents") or {}
    enabled: list[str] = []
    for agent_id, settings in agents.items():
        if isinstance(settings, dict) and settings.get("enabled") and settings.get("telegram"):
            enabled.append(agent_id)
    if not enabled and cfg.get("default_channel") == "telegram":
        enabled.append("apcoo")
    return enabled


def load_runtime_config(path: Path | None = None) -> dict[str, Any]:
    """Load runtime_config.yaml merged with defaults."""
    cfg = dict(DEFAULTS)
    config_path = path or DEFAULT_CONFIG_PATH
    if config_path.is_file():
        data = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
        if isinstance(data, dict):
            cfg.update(data)
    return cfg
