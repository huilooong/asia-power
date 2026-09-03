from __future__ import annotations

from pathlib import Path

import pytest

from agents.apbd.solo_trade.crm import record_activity, transition_status
from agents.apbd.solo_trade.models import CRMStatus, CampaignBrief, ExternalApproval
from agents.apbd.solo_trade.outreach import generate_sequence, validate_sequence
from agents.apbd.solo_trade.planner import build_search_plan
from agents.apbd.solo_trade.scoring import score_candidate
from agents.apbd.solo_trade.service import SoloTradeService
from agents.apbd.solo_trade.storage import CampaignStore


@pytest.fixture()
def brief() -> CampaignBrief:
    return CampaignBrief(
        product_keywords=("diesel engines",),
        target_markets=("Accra, Ghana",),
        customer_types=("importer", "wholesaler"),
        search_depth=2,
        max_customers=12,
    )


@pytest.fixture()
def lead() -> dict:
    return {
        "company": "Tema Diesel Works",
        "country": "Ghana",
        "city": "Tema",
        "website": "https://example.test",
        "public_email": "procurement@example.test",
        "business_type": "Diesel engine importer and wholesaler",
        "description": "Distributor serving fleet workshops",
        "main_products": "diesel engines and parts",
        "employee_range": "51-200",
        "source_url": "https://example.test/about",
        "contacts": [
            {
                "type": "email",
                "value": "procurement@example.test",
                "verified": True,
                "source": "https://example.test/contact",
            }
        ],
    }


def test_brief_and_depth_plan_are_bounded(brief: CampaignBrief) -> None:
    plan = build_search_plan(brief)
    assert plan["limits"]["max_queries"] == 10
    assert len(plan["queries"]) <= 10
    assert plan["paid_enrichment_default"] is False
    with pytest.raises(ValueError):
        CampaignBrief(("engine",), ("Ghana",), ("importer",), search_depth=9)


def test_scoring_keeps_unknown_dimensions_at_zero(brief: CampaignBrief) -> None:
    score = score_candidate(
        {
            "company": "Evidence Light Co",
            "country": "Ghana",
            "description": "diesel engines importer",
            "source_url": "https://evidence.test/company",
        },
        brief,
    )
    assert score["dimensions"]["company_scale"] == 0
    assert score["dimensions"]["import_likelihood"] == 20
    assert score["label_policy"]["purchase_intent"] == "estimate_not_probability"


def test_scoring_normalizes_spanish_and_english_business_terms() -> None:
    bilingual = CampaignBrief(
        product_keywords=("Toyota engines", "motores Toyota"),
        target_markets=("Venezuela",),
        customer_types=("engine importer", "engine distributor"),
    )
    score = score_candidate(
        {
            "company": "Example C.A.",
            "country": "Venezuela",
            "business_type": "Toyota motor importador y distribuidor",
            "main_products": "repuestos de motor Toyota",
            "source_url": "https://example.test",
        },
        bilingual,
    )
    assert score["dimensions"]["customer_match"] == 75
    assert score["dimensions"]["company_scale"] == 0


def test_sequence_uses_minimal_first_reply_and_remains_draft(brief: CampaignBrief, lead: dict) -> None:
    sequence = generate_sequence(lead, brief)
    assert [row["send_after_days"] for row in sequence] == [0, 3, 7, 14]
    assert "reply Sure" in sequence[0]["body"]
    assert all(row["status"] == "draft_only" for row in sequence)
    invalid = [dict(row) for row in sequence]
    invalid[0]["body"] += " See https://example.test/catalog"
    with pytest.raises(ValueError, match="links"):
        validate_sequence(invalid)


def test_crm_requires_sequential_approval_and_open_evidence() -> None:
    row = {"status": "new"}
    with pytest.raises(ValueError, match="Invalid CRM transition"):
        transition_status(row, CRMStatus.SENT, actor="test", reason="skip")
    transition_status(row, CRMStatus.RESEARCHED, actor="test", reason="researched")
    transition_status(row, CRMStatus.DRAFT_READY, actor="test", reason="drafted")
    transition_status(row, CRMStatus.APPROVAL_PENDING, actor="test", reason="queued")
    transition_status(row, CRMStatus.APPROVED, actor="CEO", reason="approved")
    transition_status(row, CRMStatus.SENT, actor="gmail_api", reason="message-id")
    with pytest.raises(ValueError, match="cannot prove"):
        record_activity(row, "opened", source="gmail_api", evidence_ref="msg-1")
    record_activity(row, "opened", source="provider_webhook", evidence_ref="evt-1")
    assert row["status"] == "opened"


def test_service_campaign_score_draft_approval_and_dashboard(tmp_path: Path, brief: CampaignBrief, lead: dict) -> None:
    service = SoloTradeService(CampaignStore(tmp_path / "campaigns"))
    campaign = service.create_campaign(brief, name="Ghana diesel pilot")
    campaign_id = campaign["campaign_id"]
    result = service.add_leads(campaign_id, [lead], source="fixture")
    assert result["added"] == 1
    lead_id = service.load(campaign_id)["leads"][0]["lead_id"]
    service.score(campaign_id, lead_id=lead_id)
    drafted = service.draft(campaign_id, lead_id)
    assert drafted["status"] == "approval_pending"
    approved = service.approve(
        campaign_id,
        lead_id,
        ExternalApproval(True, "CEO", "approval-001"),
    )
    assert approved["status"] == "approved"
    dashboard = service.dashboard(campaign_id)
    assert dashboard["lead_count"] == 1
    assert dashboard["status_counts"]["approved"] == 1


def test_duplicate_import_preserves_workflow_status(tmp_path: Path, brief: CampaignBrief, lead: dict) -> None:
    service = SoloTradeService(CampaignStore(tmp_path / "campaigns"))
    campaign_id = service.create_campaign(brief)["campaign_id"]
    service.add_leads(campaign_id, [lead])
    lead_id = service.load(campaign_id)["leads"][0]["lead_id"]
    service.score(campaign_id, lead_id=lead_id)
    service.add_leads(campaign_id, [{**lead, "description": "Updated public description"}])
    stored = service.load(campaign_id)["leads"][0]
    assert stored["status"] == "researched"
    assert stored["description"] == "Updated public description"


def test_imported_status_and_approval_cannot_bypass_workflow(tmp_path: Path, brief: CampaignBrief, lead: dict) -> None:
    service = SoloTradeService(CampaignStore(tmp_path / "campaigns"))
    campaign_id = service.create_campaign(brief)["campaign_id"]
    service.add_leads(campaign_id, [{**lead, "status": "approved", "external_approval": {"approval_id": "forged"}}])
    stored = service.load(campaign_id)["leads"][0]
    assert stored["status"] == "new"
    assert "external_approval" not in stored


def test_enrichment_requires_campaign_level_enablement(tmp_path: Path, brief: CampaignBrief, lead: dict) -> None:
    service = SoloTradeService(CampaignStore(tmp_path / "campaigns"))
    campaign_id = service.create_campaign(brief)["campaign_id"]
    service.add_leads(campaign_id, [lead])
    lead_id = service.load(campaign_id)["leads"][0]["lead_id"]
    with pytest.raises(PermissionError, match="Campaign contact enrichment is disabled"):
        service.enrich(campaign_id, lead_id, provider="hunter", paid_opt_in=True)
