"""Paths for APBRAIN-002 Sales Intelligence Engine."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEMORY_ROOT = ROOT / "memory"
SI_ROOT = MEMORY_ROOT / "sales_intelligence"
CONVERSATIONS_DIR = SI_ROOT / "conversations"
TIMELINES_DIR = SI_ROOT / "timelines"
CUSTOMERS_DIR = SI_ROOT / "customers"
PATTERNS_DIR = SI_ROOT / "patterns"
REPLIES_DIR = SI_ROOT / "reply_evolution"
FAILURES_DIR = SI_ROOT / "failures"
DASHBOARD_DIR = SI_ROOT / "dashboard"
VEHICLE_INQUIRIES_DIR = SI_ROOT / "vehicle_inquiries"
IMPORT_STATE_PATH = SI_ROOT / "import_state.json"
CUSTOMER_TIERS_PATH = SI_ROOT / "customer_tiers.json"


def ensure_dirs() -> None:
    for d in (
        SI_ROOT,
        CONVERSATIONS_DIR,
        TIMELINES_DIR,
        CUSTOMERS_DIR,
        PATTERNS_DIR,
        REPLIES_DIR,
        FAILURES_DIR,
        DASHBOARD_DIR,
        VEHICLE_INQUIRIES_DIR,
    ):
        d.mkdir(parents=True, exist_ok=True)


def reconfigure_paths(base: Path) -> None:
    """Test helper."""
    global MEMORY_ROOT, SI_ROOT, CONVERSATIONS_DIR, TIMELINES_DIR, CUSTOMERS_DIR
    global PATTERNS_DIR, REPLIES_DIR, FAILURES_DIR, DASHBOARD_DIR, VEHICLE_INQUIRIES_DIR
    global IMPORT_STATE_PATH, CUSTOMER_TIERS_PATH
    MEMORY_ROOT = base
    SI_ROOT = base / "sales_intelligence"
    CONVERSATIONS_DIR = SI_ROOT / "conversations"
    TIMELINES_DIR = SI_ROOT / "timelines"
    CUSTOMERS_DIR = SI_ROOT / "customers"
    PATTERNS_DIR = SI_ROOT / "patterns"
    REPLIES_DIR = SI_ROOT / "reply_evolution"
    FAILURES_DIR = SI_ROOT / "failures"
    DASHBOARD_DIR = SI_ROOT / "dashboard"
    VEHICLE_INQUIRIES_DIR = SI_ROOT / "vehicle_inquiries"
    IMPORT_STATE_PATH = SI_ROOT / "import_state.json"
    CUSTOMER_TIERS_PATH = SI_ROOT / "customer_tiers.json"
    ensure_dirs()
