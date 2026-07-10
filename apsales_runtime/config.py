"""APSales runtime configuration — models, failover, multi-agent."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = ROOT / "config" / "apsales_runtime.yaml"

DEFAULTS: dict[str, Any] = {
    "agent_id": "apsales",
    "display_name": "APSales",
    "language": "zh",
    "default_channel": "telegram",
    "lifecycle": {
        "health_interval_seconds": 60,
        "heartbeat_interval_seconds": 300,
        "auto_restart": True,
        "supervisor_restart_delay_seconds": 15,
        "healthcheck_on_start": True,
    },
    "models": {
        "primary": "gpt-4.1-mini",
        "fallback": "gpt-4.1",
        "failover_on_errors": 3,
        "agents": {
            "apsales": {"primary": "gpt-4.1-mini", "fallback": "gpt-4.1"},
        },
    },
    "multi_agent": {
        "enabled": True,
        "collaborators": ["apcoo", "apinventory"],
        "event_routing": True,
    },
    "scheduler": {
        "tick_interval_seconds": 30,
        "rules": {
            "follow_up_24h": {"delay_hours": 24, "task_type": "follow_up"},
            "follow_up_3d": {"delay_hours": 72, "task_type": "follow_up"},
            "quotation_reminder": {"delay_hours": 48, "task_type": "reminder"},
            "supplier_reminder": {"delay_hours": 24, "task_type": "reminder"},
        },
    },
    "task_queue": {
        "max_retries": 5,
        "retry_backoff_seconds": 300,
        "worker_batch_size": 10,
    },
    "tools": {
        "enabled": [
            "vin", "inventory", "whatsapp", "email", "browser",
            "search", "pricing", "translation", "telegram", "memory",
        ],
    },
    "recovery": {
        "persist_state": True,
        "recover_queue_on_start": True,
        "recover_schedule_on_start": True,
    },
    "telegram": {"enabled": True, "bot": "apsales"},
}


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def load_apsales_runtime_config(path: Path | None = None) -> dict[str, Any]:
    cfg = dict(DEFAULTS)
    config_path = path or DEFAULT_CONFIG_PATH
    if config_path.is_file():
        data = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
        if isinstance(data, dict):
            cfg = _deep_merge(cfg, data)
    return cfg


class ModelRouter:
    """Select model with failover counters (no LLM calls — routing only)."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config = config or load_apsales_runtime_config()
        self._error_counts: dict[str, int] = {}

    def resolve(self, agent_key: str = "apsales") -> str:
        models = self.config.get("models") or {}
        agents = models.get("agents") or {}
        agent_cfg = agents.get(agent_key) or {}
        primary = agent_cfg.get("primary") or models.get("primary") or "gpt-4.1-mini"
        fallback = agent_cfg.get("fallback") or models.get("fallback") or primary
        threshold = int(models.get("failover_on_errors") or 3)
        if self._error_counts.get(agent_key, 0) >= threshold:
            return fallback
        return primary

    def record_error(self, agent_key: str = "apsales") -> str:
        self._error_counts[agent_key] = self._error_counts.get(agent_key, 0) + 1
        return self.resolve(agent_key)

    def record_success(self, agent_key: str = "apsales") -> None:
        self._error_counts[agent_key] = 0

    def snapshot(self) -> dict[str, Any]:
        return {
            "error_counts": dict(self._error_counts),
            "resolved_models": {
                key: self.resolve(key)
                for key in set(self._error_counts) | {"apsales"}
            },
        }
