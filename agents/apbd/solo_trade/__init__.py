"""APBD solo-trade workbench.

The package coordinates pre-sales discovery, evidence-bound scoring, outreach
drafting, CRM state, and exports. It does not replace APSales as the commercial
opportunity source of truth and it never sends external messages by default.
"""

from agents.apbd.solo_trade.models import CampaignBrief, CRMStatus
from agents.apbd.solo_trade.service import SoloTradeService

__all__ = ["CampaignBrief", "CRMStatus", "SoloTradeService"]
