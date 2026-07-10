"""Central CLI command router — slash commands before buyer enquiry fallback."""

from __future__ import annotations

from inventory_core.apinventory_handler import (
    APINVENTORY_ROUTE_PREFIXES,
    is_apinventory_command,
    is_inventory_natural_language,
)
from sales_core.apsales_handler import (
    APSALES_ROUTE_PREFIXES,
    is_apsales_command,
    is_slash_command,
)

APBD_COMMANDS = ("/apbd",)


def is_apbd_command(message: str) -> bool:
    text = (message or "").strip().lower()
    return text.startswith("/apbd")


def resolve_agent_id(message: str) -> str:
    """Return apcoo, apsales, apinventory, or apbd for CLI/Telegram dispatch."""
    from coo_core.dispatcher import is_coo_command

    text = (message or "").strip()
    lower = text.lower()

    if is_apbd_command(text):
        return "apbd"

    if is_coo_command(text) or lower in ("/help", "/start", "/ping", "/health"):
        return "apcoo"

    if is_apinventory_command(text):
        return "apinventory"

    for prefix in APINVENTORY_ROUTE_PREFIXES:
        if lower.startswith(prefix.lower()):
            return "apinventory"

    if is_inventory_natural_language(text):
        return "apinventory"

    if is_apsales_command(text):
        return "apsales"

    for prefix in APSALES_ROUTE_PREFIXES:
        if lower.startswith(prefix.lower()):
            return "apsales"

    if is_slash_command(text):
        return "apsales"

    return "apcoo"


def normalize_apsales_command(message: str) -> str:
    """Rewrite common mis-typed CLI paths e.g. `/sales intelligence import`."""
    text = (message or "").strip()
    lower = text.lower()
    if lower.startswith("/sales ") and not lower.startswith("/sales-intelligence"):
        rest = text[7:].strip()
        if rest.lower().startswith("intelligence"):
            suffix = rest[len("intelligence"):].strip()
            return f"/sales-intelligence {suffix}".strip()
    return text


def dispatch_cli_message(message: str, *, channel: str = "cli") -> str:
    """Route CLI input through agent dispatch with command normalization."""
    if is_apbd_command(message):
        from agents.apbd.runtime import dispatch_apbd_cli

        return dispatch_apbd_cli(message)

    from coo_core.dispatcher import dispatch_message

    normalized = normalize_apsales_command(message)
    agent_id = resolve_agent_id(normalized)
    return dispatch_message(normalized, source=channel, agent_id=agent_id)
