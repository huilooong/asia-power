"""APSales internal event bus — typed domain events."""

from __future__ import annotations

import json
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from apsales_runtime import paths as runtime_paths


def _events_file() -> Path:
    return runtime_paths.EVENTS_FILE

EventHandler = Callable[["DomainEvent"], None]

# Canonical event names (requirement §6)
EVENT_CUSTOMER_CREATED = "CustomerCreated"
EVENT_INQUIRY_RECEIVED = "InquiryReceived"
EVENT_QUOTE_CREATED = "QuoteCreated"
EVENT_QUOTE_APPROVED = "QuoteApproved"
EVENT_SUPPLIER_MATCHED = "SupplierMatched"
EVENT_VIN_DECODED = "VINDecoded"
EVENT_INVENTORY_UPDATED = "InventoryUpdated"
EVENT_PAYMENT_RECEIVED = "PaymentReceived"
EVENT_SHIPMENT_CREATED = "ShipmentCreated"
EVENT_OPPORTUNITY_CREATED = "OpportunityCreated"
EVENT_OPPORTUNITY_UPDATED = "OpportunityUpdated"

ALL_EVENT_TYPES = frozenset({
    EVENT_CUSTOMER_CREATED,
    EVENT_INQUIRY_RECEIVED,
    EVENT_QUOTE_CREATED,
    EVENT_QUOTE_APPROVED,
    EVENT_SUPPLIER_MATCHED,
    EVENT_VIN_DECODED,
    EVENT_INVENTORY_UPDATED,
    EVENT_PAYMENT_RECEIVED,
    EVENT_SHIPMENT_CREATED,
    EVENT_OPPORTUNITY_CREATED,
    EVENT_OPPORTUNITY_UPDATED,
})


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


@dataclass
class DomainEvent:
    event_type: str
    payload: dict[str, Any] = field(default_factory=dict)
    event_id: str = field(default_factory=lambda: f"evt-{uuid.uuid4().hex[:12]}")
    timestamp: str = field(default_factory=_now_iso)
    source: str = "apsales_runtime"
    correlation_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class EventBus:
    """Append-only event log + in-process handler dispatch."""

    def __init__(self, events_file: Path | None = None) -> None:
        self._events_file_override = events_file
        self._handlers: dict[str, list[EventHandler]] = {}
        self._global_handlers: list[EventHandler] = []
        self._lock = threading.Lock()

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        with self._lock:
            self._handlers.setdefault(event_type, []).append(handler)

    def subscribe_all(self, handler: EventHandler) -> None:
        with self._lock:
            self._global_handlers.append(handler)

    def publish(
        self,
        event_type: str,
        payload: dict[str, Any] | None = None,
        *,
        source: str = "apsales_runtime",
        correlation_id: str = "",
    ) -> DomainEvent:
        if event_type not in ALL_EVENT_TYPES:
            raise ValueError(f"Unknown event type: {event_type}")
        event = DomainEvent(
            event_type=event_type,
            payload=dict(payload or {}),
            source=source,
            correlation_id=correlation_id,
        )
        self._persist(event)
        self._dispatch(event)
        return event

    def _persist(self, event: DomainEvent) -> None:
        runtime_paths.ensure_runtime_dirs()
        target = self._events_file_override or _events_file()
        with target.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event.to_dict(), ensure_ascii=False) + "\n")

    def _dispatch(self, event: DomainEvent) -> None:
        with self._lock:
            handlers = list(self._global_handlers)
            handlers.extend(self._handlers.get(event.event_type, []))
        for handler in handlers:
            try:
                handler(event)
            except Exception:
                # Handlers must not crash the bus; errors logged by caller layers.
                continue

    def replay(self, limit: int = 100) -> list[DomainEvent]:
        target = self._events_file_override or _events_file()
        if not target.is_file():
            return []
        lines = target.read_text(encoding="utf-8").splitlines()
        events: list[DomainEvent] = []
        for line in lines[-limit:]:
            if not line.strip():
                continue
            data = json.loads(line)
            events.append(DomainEvent(**data))
        return events
