"""Opportunity domain — commercial object for APSales (APSALES-101)."""

from domain.opportunity.integration import handle_inquiry_received
from domain.opportunity.service import (
    append_event,
    create,
    find,
    list_closed,
    list_open,
    merge,
    update,
)

__all__ = [
    "append_event",
    "create",
    "find",
    "handle_inquiry_received",
    "list_closed",
    "list_open",
    "merge",
    "update",
]
