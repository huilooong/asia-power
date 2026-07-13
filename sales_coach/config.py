"""Coach paths and fixed Sales Skill catalogue."""

from __future__ import annotations

import os
from pathlib import Path

# Fixed phase-1 Sales Skills (scoring target = sales skill, not English).
SALES_SKILLS: tuple[str, ...] = (
    "VIN Confirmation",
    "Product Confirmation",
    "Accessory Confirmation",
    "Quotation Timing",
    "Inventory Risk",
    "Alternative Recommendation",
    "Follow-up",
    "Customer Trust",
    "Closing",
)

# Decision labels extracted from a turn (customer → zijing reply).
DECISION_LABELS: tuple[str, ...] = (
    "ask_clarifying",
    "ask_vin",
    "confirm_product",
    "confirm_accessory",
    "quote_now",
    "defer_quote",
    "check_inventory",
    "promise_inventory",  # anti-pattern
    "recommend_alternative",
    "follow_up",
    "build_trust",
    "close_ask",
)


def workspace_root() -> Path:
    env = (os.getenv("ASIAPOWER_ROOT") or "").strip()
    if env:
        return Path(env).expanduser().resolve()
    return Path(__file__).resolve().parents[1]


def inventory_site_root() -> Path | None:
    env = (os.getenv("INVENTORY_SITE_ROOT") or "").strip()
    if env:
        return Path(env).expanduser().resolve()
    sibling = workspace_root().parent / "inventory-site"
    return sibling if sibling.is_dir() else None


def draft_queue_dir(root: Path | None = None) -> Path:
    return (root or workspace_root()) / "memory" / "customer_gateway" / "draft_queue"


def conversations_dir(root: Path | None = None) -> Path:
    return (root or workspace_root()) / "memory" / "sales_intelligence" / "conversations"


def customer_profiles_dir(root: Path | None = None) -> Path:
    return (root or workspace_root()) / "memory" / "customer_gateway" / "customer_profiles"


def coach_memory_dir(root: Path | None = None) -> Path:
    return (root or workspace_root()) / "memory" / "sales_coach"


def progress_path(root: Path | None = None) -> Path:
    return coach_memory_dir(root) / "progress_memory.json"


def ceo_rules_path(root: Path | None = None) -> Path:
    return coach_memory_dir(root) / "ceo_permanent_rules.json"


def coach_output_dir(root: Path | None = None) -> Path:
    return (root or workspace_root()) / "docs" / "agents" / "apsales" / "coach"


# APSALES-EVIDENCE-001: Sales Coach is Read Only over production + Evidence.
COACH_READ_ONLY = True


def evidence_root(root: Path | None = None) -> Path:
    """AsiaPower-wide Evidence store (not WhatsApp-owned)."""
    return (root or workspace_root()) / "data" / "evidence"


def evidence_channel_dir(channel: str = "whatsapp", root: Path | None = None) -> Path:
    return evidence_root(root) / channel
