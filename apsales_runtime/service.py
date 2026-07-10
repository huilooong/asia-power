"""APSales production runtime service — 24/7 daemon entry point."""

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
logger = logging.getLogger("apsales_runtime.service")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="APSales Production Runtime (APSALES-001)")
    parser.add_argument("--once", action="store_true", help="Bootstrap + healthcheck, then exit")
    parser.add_argument("--no-telegram", action="store_true", help="Skip Telegram supervisor")
    parser.add_argument("--no-workers", action="store_true", help="Skip background workers")
    parser.add_argument("--config", type=Path, default=None, help="Path to apsales_runtime.yaml")
    return parser.parse_args()


def _wire_event_bus(lifecycle) -> None:
    """Infrastructure routing only — no business handlers."""
    from apsales_runtime.events import (
        EVENT_CUSTOMER_CREATED,
        EVENT_INQUIRY_RECEIVED,
        EVENT_QUOTE_CREATED,
        EVENT_SUPPLIER_MATCHED,
        EventBus,
    )
    from apsales_runtime.logging import log_decision

    bus = EventBus()

    def on_inquiry(event) -> None:
        lifecycle.queue.enqueue(
            "inquiry",
            event.payload,
            correlation_id=event.event_id,
        )
        try:
            from domain.opportunity.integration import handle_inquiry_received

            def _publish_opportunity(evt_type, payload, corr_id):
                bus.publish(
                    evt_type,
                    payload,
                    correlation_id=corr_id or event.event_id,
                )

            handle_inquiry_received(
                event.payload,
                event_id=event.event_id,
                publish=_publish_opportunity,
            )
        except Exception as exc:
            logger.warning("Opportunity integration failed (runtime continues): %s", exc)

    def on_customer(event) -> None:
        lifecycle.scheduler.schedule(
            "follow_up_24h",
            event.payload,
            correlation_id=event.event_id,
        )

    def on_quote(event) -> None:
        lifecycle.scheduler.schedule(
            "quotation_reminder",
            event.payload,
            correlation_id=event.event_id,
        )

    def on_supplier(event) -> None:
        lifecycle.scheduler.schedule(
            "supplier_reminder",
            event.payload,
            correlation_id=event.event_id,
        )

    def on_audit(event) -> None:
        log_decision(
            decision=f"event:{event.event_type}",
            reason="event_bus",
            context=event.payload,
            correlation_id=event.event_id,
        )

    bus.subscribe(EVENT_INQUIRY_RECEIVED, on_inquiry)
    bus.subscribe(EVENT_CUSTOMER_CREATED, on_customer)
    bus.subscribe(EVENT_QUOTE_CREATED, on_quote)
    bus.subscribe(EVENT_SUPPLIER_MATCHED, on_supplier)
    for evt in (
        EVENT_CUSTOMER_CREATED,
        EVENT_INQUIRY_RECEIVED,
        EVENT_QUOTE_CREATED,
        EVENT_SUPPLIER_MATCHED,
    ):
        bus.subscribe(evt, on_audit)

    lifecycle.event_bus = bus  # type: ignore[attr-defined]


def _start_telegram_supervisor(lifecycle, stop_event: threading.Event) -> threading.Thread | None:
    cfg = lifecycle.config.get("telegram") or {}
    if not cfg.get("enabled", True):
        return None
    from runtime.state import RuntimeState
    from runtime.supervisor import supervised_telegram_loop

    runtime_cfg = {
        "auto_restart": (lifecycle.config.get("lifecycle") or {}).get("auto_restart", True),
        "supervisor_restart_delay_seconds": (lifecycle.config.get("lifecycle") or {}).get(
            "supervisor_restart_delay_seconds", 15
        ),
        "agents": {"apsales": {"enabled": True, "telegram": True}, "apcoo": {"enabled": False, "telegram": False}},
    }
    state = RuntimeState(agent_id="apsales")
    t = threading.Thread(
        target=supervised_telegram_loop,
        args=(state, runtime_cfg, stop_event),
        name="apsales-telegram-supervisor",
        daemon=True,
    )
    t.start()
    return t


class APSalesRuntimeService:
    """Orchestrates lifecycle, workers, event bus, and optional Telegram supervisor."""

    def __init__(self, config_path: Path | None = None) -> None:
        from apsales_runtime.config import load_apsales_runtime_config
        from apsales_runtime.lifecycle import AgentLifecycle

        self.config = load_apsales_runtime_config(config_path)
        self.lifecycle = AgentLifecycle(self.config)
        self._stop_event = threading.Event()

    def run(
        self,
        *,
        once: bool = False,
        no_telegram: bool = False,
        no_workers: bool = False,
    ) -> int:
        health = self.lifecycle.startup()
        if health.status == "failed":
            logger.error("Startup failed: %s", health.last_error)
            return 1

        if self.config.get("lifecycle", {}).get("healthcheck_on_start", True):
            from apsales_runtime.healthcheck import format_healthcheck_report, run_healthcheck
            ok, checks = run_healthcheck(self.config)
            for line in format_healthcheck_report(checks).splitlines():
                logger.info(line)
            if not ok:
                logger.error("Healthcheck failed on start")
                return 1

        _wire_event_bus(self.lifecycle)

        if once:
            self.lifecycle.monitor_health()
            logger.info("APSales runtime --once complete")
            return 0

        if not no_workers:
            from apsales_runtime.worker import start_workers
            start_workers(self.lifecycle)

        telegram_thread = None
        if not no_telegram:
            telegram_thread = _start_telegram_supervisor(self.lifecycle, self._stop_event)

        def _shutdown(signum, frame) -> None:
            logger.info("Shutdown signal received")
            self._stop_event.set()
            self.lifecycle.shutdown()

        signal.signal(signal.SIGINT, _shutdown)
        signal.signal(signal.SIGTERM, _shutdown)

        logger.info(
            "APSales runtime running agent=%s health=%ss scheduler=%ss",
            self.config.get("agent_id"),
            (self.config.get("lifecycle") or {}).get("health_interval_seconds"),
            (self.config.get("scheduler") or {}).get("tick_interval_seconds"),
        )

        try:
            while not self._stop_event.is_set():
                self._stop_event.wait(timeout=5)
        except KeyboardInterrupt:
            self._stop_event.set()
            self.lifecycle.shutdown()

        if telegram_thread:
            telegram_thread.join(timeout=5)

        return 0


def main() -> int:
    load_dotenv(ROOT / ".env")
    sys.path.insert(0, str(ROOT))
    args = _parse_args()
    service = APSalesRuntimeService(args.config)
    return service.run(
        once=args.once,
        no_telegram=args.no_telegram,
        no_workers=args.no_workers,
    )


if __name__ == "__main__":
    raise SystemExit(main())
