"""Customer Gateway — read-only WhatsApp sales intelligence."""

from customer_gateway.gateway_readonly import (
    READONLY_MODE,
    dispatch_whatsapp_command,
    format_customer_followups,
    get_gateway_context_for_enquiry,
    run_intelligence_analysis,
    search_customers_and_history,
)

__all__ = [
    "READONLY_MODE",
    "dispatch_whatsapp_command",
    "format_customer_followups",
    "get_gateway_context_for_enquiry",
    "run_intelligence_analysis",
    "search_customers_and_history",
]
