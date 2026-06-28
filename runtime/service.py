"""AsiaPower APCOO Runtime Service — unified 24h agent runner."""

from __future__ import annotations

import argparse
import logging
import signal
import sys
import threading
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("runtime.service")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AsiaPower APCOO Runtime Service")
    parser.add_argument("--once", action="store_true", help="Bootstrap + healthcheck + one heartbeat, then exit")
    parser.add_argument("--no-telegram", action="store_true", help="Skip Telegram supervisor (tests/local)")
    parser.add_argument("--config", type=Path, default=None, help="Path to runtime_config.yaml")
    return parser.parse_args()


def main() -> int:
    load_dotenv(ROOT / ".env")
    sys.path.insert(0, str(ROOT))

    args = _parse_args()

    from runtime.bootstrap import bootstrap_runtime
    from runtime.config_loader import load_runtime_config
    from runtime.healthcheck import format_healthcheck_report, run_healthcheck
    from runtime.heartbeat import run_heartbeat_loop, write_heartbeat
    from runtime.state import RuntimeState
    from runtime.supervisor import supervised_telegram_loop

    config = load_runtime_config(args.config)
    agent_id = config.get("agent_id", "apcoo")
    state = RuntimeState(agent_id=agent_id)

    logger.info("APCOO Runtime starting (agent_id=%s)", agent_id)

    from audit.logger import log_event
    log_event("agent_start", agent_id=agent_id, channel=config.get("default_channel"))

    # 1–4: Load Constitution, Identity, Memory, Tools
    try:
        summary = bootstrap_runtime(agent_id)
        logger.info(
            "Bootstrap OK: constitution %s, memory_index=%s, tools=%s",
            summary["constitution_version"],
            summary["memory_index"],
            summary["tools_registered"],
        )
    except Exception as exc:
        logger.error("Bootstrap failed: %s", exc)
        state.status = "failed"
        state.last_error = str(exc)
        from audit.logger import log_error
        log_error(str(exc), context="bootstrap")
        return 1

    # 5: Healthcheck on start
    if config.get("healthcheck_on_start", True):
        ok, checks = run_healthcheck()
        report = format_healthcheck_report(checks)
        for line in report.splitlines():
            logger.info(line)
        if not ok:
            state.status = "failed"
            state.last_error = "Healthcheck failed"
            return 1

    state.status = "running"
    stop_event = threading.Event()

    def _shutdown(signum, frame):
        logger.info("Shutdown signal received")
        stop_event.set()
        state.status = "stopping"

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    # 6: Heartbeat thread
    heartbeat_thread = threading.Thread(
        target=run_heartbeat_loop,
        args=(state, config, stop_event),
        kwargs={"once": args.once},
        name="heartbeat",
        daemon=True,
    )
    heartbeat_thread.start()

    if args.once:
        write_heartbeat(state, config)
        logger.info("Runtime --once complete (no Telegram loop)")
        return 0

    # 7: Telegram supervisor thread
    telegram_thread = None
    if not args.no_telegram:
        telegram_thread = threading.Thread(
            target=supervised_telegram_loop,
            args=(state, config, stop_event),
            name="telegram-supervisor",
            daemon=True,
        )
        telegram_thread.start()
    else:
        logger.info("Telegram supervisor skipped (--no-telegram)")

    logger.info(
        "APCOO Runtime running. channel=%s heartbeat=%ss auto_restart=%s",
        config.get("default_channel"),
        config.get("heartbeat_interval_seconds"),
        config.get("auto_restart"),
    )
    logger.info("Press Ctrl+C to stop.")

    try:
        while not stop_event.is_set():
            stop_event.wait(timeout=5)
    except KeyboardInterrupt:
        stop_event.set()

    state.status = "stopped"
    write_heartbeat(state, config)
    from audit.logger import log_event
    log_event("agent_stop", agent_id=agent_id, uptime_seconds=state.uptime_seconds())
    logger.info("APCOO Runtime stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
