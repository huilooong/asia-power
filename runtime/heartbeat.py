"""Runtime heartbeat — periodic status log to memory."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path

from runtime.config_loader import load_runtime_config
from runtime.state import RuntimeState
from tools import memory_tool

HEARTBEAT_FILE = "runtime-heartbeat.md"


def heartbeat_path() -> Path:
    return memory_tool._subdir("daily_logs") / HEARTBEAT_FILE


def write_heartbeat(state: RuntimeState, config: dict | None = None) -> str:
    """Append heartbeat entry to memory/daily_logs/runtime-heartbeat.md."""
    config = config or load_runtime_config()
    memory_tool._ensure_memory_dir()
    path = heartbeat_path()
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    if not path.exists():
        path.write_text(f"# Runtime Heartbeat — {config.get('agent_id', 'apcoo')}\n\n", encoding="utf-8")

    tools = ", ".join(state.active_tools) if state.active_tools else "(none)"
    err = state.last_error or "(none)"
    block = (
        f"\n## {ts}\n"
        f"- **agent_id:** {state.agent_id}\n"
        f"- **uptime:** {state.uptime_seconds()}s\n"
        f"- **status:** {state.status}\n"
        f"- **last_error:** {err}\n"
        f"- **active_tools:** {tools}\n"
        f"- **telegram_restarts:** {state.telegram_restarts}\n"
        f"- **channel:** {config.get('default_channel', 'telegram')}\n"
    )
    with path.open("a", encoding="utf-8") as f:
        f.write(block)

    return f"Heartbeat written to {path.relative_to(memory_tool.MEMORY_DIR.parent)}"


def run_heartbeat_loop(
    state: RuntimeState,
    config: dict,
    stop_event=None,
    *,
    once: bool = False,
) -> None:
    """Background heartbeat loop."""
    interval = max(30, int(config.get("heartbeat_interval_seconds", 300)))
    while True:
        try:
            write_heartbeat(state, config)
        except Exception as exc:
            state.last_error = f"heartbeat: {exc}"
        if once:
            break
        if stop_event is not None:
            for _ in range(interval):
                if stop_event.is_set():
                    return
                time.sleep(1)
        else:
            time.sleep(interval)


def main() -> int:
    from dotenv import load_dotenv
    from runtime.bootstrap import ROOT

    load_dotenv(ROOT / ".env")
    config = load_runtime_config()
    state = RuntimeState(agent_id=config.get("agent_id", "apcoo"))
    state.status = "heartbeat"
    from tools.registry import bootstrap_registry
    bootstrap_registry()
    state.active_tools = ["vin", "git", "inventory", "deploy", "telegram", "whatsapp"]
    once = "--once" in __import__("sys").argv
    if once:
        msg = write_heartbeat(state, config)
        print(msg)
    else:
        run_heartbeat_loop(state, config, once=False)
        print("Heartbeat loop running.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
