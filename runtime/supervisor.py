"""Telegram bot supervisor — auto-restart on crash without stopping runtime."""

from __future__ import annotations

import logging
import threading
import time
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from runtime.state import RuntimeState

logger = logging.getLogger("runtime.supervisor")

_BOT_RUNNERS: dict[str, Callable[[], int]] = {}


def _register_runners() -> None:
    if _BOT_RUNNERS:
        return
    from integrations.telegram_apsales_bot import run_bot as run_apsales
    from integrations.telegram_coo_bot import run_bot as run_coo
    _BOT_RUNNERS["apcoo"] = lambda: run_coo(once=False)
    _BOT_RUNNERS["apsales"] = lambda: run_apsales(once=False)


def _supervise_single_bot(
    agent_id: str,
    run_fn: Callable[[], int],
    state: RuntimeState,
    config: dict,
    stop_event: threading.Event,
) -> None:
    delay = max(3, int(config.get("supervisor_restart_delay_seconds", 10)))
    auto_restart = bool(config.get("auto_restart", True))
    restarts = 0

    while not stop_event.is_set():
        try:
            state.status = "running"
            logger.info("Starting Telegram bot: %s", agent_id)
            code = run_fn()
            if stop_event.is_set():
                break
            if code != 0:
                logger.warning("%s bot exited with code %s", agent_id, code)
        except KeyboardInterrupt:
            break
        except Exception as exc:
            state.last_error = f"{agent_id} crash: {exc}"
            logger.exception("Supervisor caught error for %s", agent_id)

        restarts += 1
        try:
            from tools import memory_tool
            memory_tool.log_daily(
                f"Telegram {agent_id} restart #{restarts}: {state.last_error}",
                source=agent_id,
                channel="runtime",
            )
        except Exception:
            pass

        if not auto_restart or stop_event.is_set():
            break

        logger.info("Restarting %s in %ss...", agent_id, delay)
        for _ in range(delay):
            if stop_event.is_set():
                return
            time.sleep(1)


def supervised_telegram_loop(
    state: RuntimeState,
    config: dict,
    stop_event: threading.Event,
) -> None:
    """Run all enabled Telegram bots with independent supervisors."""
    from runtime.config_loader import get_enabled_telegram_agents
    from tools.registry import bootstrap_registry

    bootstrap_registry()
    state.active_tools = sorted([
        "vin", "inventory", "git", "deploy", "whatsapp", "telegram",
    ])
    _register_runners()

    enabled = get_enabled_telegram_agents(config)
    threads: list[threading.Thread] = []

    for agent_id in enabled:
        run_fn = _BOT_RUNNERS.get(agent_id)
        if not run_fn:
            logger.warning("No Telegram runner for agent %s", agent_id)
            continue
        t = threading.Thread(
            target=_supervise_single_bot,
            args=(agent_id, run_fn, state, config, stop_event),
            name=f"telegram-{agent_id}",
            daemon=True,
        )
        t.start()
        threads.append(t)

    if not threads:
        logger.info("No Telegram agents enabled; supervisor idle.")
        while not stop_event.is_set():
            stop_event.wait(5)
        return

    logger.info("Supervising Telegram bots: %s", ", ".join(enabled))
    while not stop_event.is_set():
        stop_event.wait(5)

    state.status = "stopped"
