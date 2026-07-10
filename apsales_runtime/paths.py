"""APSales runtime storage paths."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUNTIME_DATA_DIR = ROOT / "data" / "apsales_runtime"
QUEUE_DIR = RUNTIME_DATA_DIR / "queue"
SCHEDULE_FILE = RUNTIME_DATA_DIR / "schedule.jsonl"
EVENTS_FILE = RUNTIME_DATA_DIR / "events.jsonl"
DECISIONS_FILE = RUNTIME_DATA_DIR / "decisions.jsonl"
STATE_FILE = RUNTIME_DATA_DIR / "state.json"
HEARTBEAT_FILE = RUNTIME_DATA_DIR / "heartbeat.jsonl"

MEMORY_ROOT = ROOT / "memory"
MEMORY_SCOPES = {
    "customer": MEMORY_ROOT / "customers",
    "conversation": MEMORY_ROOT / "customer_gateway",
    "supplier": MEMORY_ROOT / "suppliers",
    "learning": MEMORY_ROOT / "learning",
}


def reconfigure_paths(base: Path) -> None:
    """Test helper — redirect runtime data directory."""
    global RUNTIME_DATA_DIR, QUEUE_DIR, SCHEDULE_FILE, EVENTS_FILE
    global DECISIONS_FILE, STATE_FILE, HEARTBEAT_FILE
    RUNTIME_DATA_DIR = base
    QUEUE_DIR = base / "queue"
    SCHEDULE_FILE = base / "schedule.jsonl"
    EVENTS_FILE = base / "events.jsonl"
    DECISIONS_FILE = base / "decisions.jsonl"
    STATE_FILE = base / "state.json"
    HEARTBEAT_FILE = base / "heartbeat.jsonl"


def ensure_runtime_dirs() -> None:
    RUNTIME_DATA_DIR.mkdir(parents=True, exist_ok=True)
    QUEUE_DIR.mkdir(parents=True, exist_ok=True)
    for scope_path in MEMORY_SCOPES.values():
        scope_path.mkdir(parents=True, exist_ok=True)
