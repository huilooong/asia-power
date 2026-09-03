from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from agents.apbd import global_industry


def test_default_config_is_global_ordered_and_send_disabled() -> None:
    config = global_industry.load_config()
    codes = [row["code"] for row in config["markets"]]
    assert len(codes) >= 50
    assert codes[:4] == ["CA", "VE", "US", "MX"]
    assert "GH" not in codes
    assert config["governance"]["worker_external_send_enabled"] is False
    assert config["governance"]["allowed_auto_send_country_codes"] == []
    assert [row["id"] for row in config["industry_scopes"]] == list(global_industry.REQUIRED_SCOPE_IDS)


def test_weighted_schedule_starts_with_priority_order_and_favors_canada() -> None:
    config = global_industry.load_config()
    schedule = global_industry.build_market_schedule(config)
    assert schedule[:4] == ["CA", "VE", "US", "MX"]
    assert schedule.count("CA") == 12
    assert schedule.count("VE") == 4
    assert schedule.count("CA") > schedule.count("US")


def test_config_rejects_send_or_ghana_market() -> None:
    config = global_industry.load_config()
    config["governance"]["worker_external_send_enabled"] = True
    with pytest.raises(ValueError, match="sending must remain disabled"):
        global_industry.validate_config(config)

    config = global_industry.load_config()
    config["markets"].append(
        {
            "code": "GH",
            "country": "Ghana",
            "language": "en",
            "priority": 5,
            "weight": 1,
            "policy_mode": "research_draft_only",
            "cities": ["Accra"],
        }
    )
    with pytest.raises(ValueError, match="Excluded markets"):
        global_industry.validate_config(config)


def test_importer_only_evidence_never_becomes_export_dealer() -> None:
    company = {
        "description": "We import and distribute automotive spare parts to local workshops.",
        "description_evidence_url": "https://buyer.example/about",
        "services": [],
    }
    result = global_industry.classify_primary_activity(company)
    assert result["scope"] == "parts_wholesaler"
    assert result["scope"] != "export_dealer"

    company["description"] = "We export automotive spare parts to regional dealers."
    result = global_industry.classify_primary_activity(company)
    assert result["scope"] == "export_dealer"
    assert "Explicit export wording" in result["reason"]


def test_classification_ignores_search_query_without_official_evidence() -> None:
    result = global_industry.classify_primary_activity(
        {
            "query": "automotive exporter Toronto",
            "business_type": "Engine importer",
            "description": "",
            "services": [],
        }
    )
    assert result["scope"] == ""
    assert result["status"] == "pending_official_website_evidence"


def test_backlog_skips_recent_failures_and_do_not_contact() -> None:
    now = datetime(2026, 9, 3, tzinfo=timezone.utc)

    def row(company_id: str, status: str = "", attempted_at: str = "", do_not_contact: bool = False) -> dict:
        return {
            "id": company_id,
            "country_code": "CA",
            "created_at": company_id,
            "do_not_contact": do_not_contact,
            "contact_channels": [{"type": "website", "value": f"https://{company_id}.example"}],
            "website_enrichment": {"status": status, "attempted_at": attempted_at},
        }

    complete = row("b-complete", "complete")
    complete["global_industry_development"] = {"schema_version": "apbd-global-industry-profile-v1"}
    companies = [
        row("a-pending"),
        complete,
        row("c-recent", "failed", (now - timedelta(days=2)).isoformat()),
        row("d-old", "failed", (now - timedelta(days=30)).isoformat()),
        row("e-dnc", do_not_contact=True),
    ]
    selected = global_industry.select_backlog(
        companies,
        country_code="CA",
        limit=5,
        retry_after_days=14,
        now=now,
    )
    assert [row["id"] for row in selected] == ["a-pending", "d-old"]


def test_dry_run_validates_without_writes(tmp_path: Path) -> None:
    state = tmp_path / "state.json"
    reports = tmp_path / "reports"
    called = False

    def should_not_run(**_kwargs):
        nonlocal called
        called = True
        return [], {}

    result = global_industry.run_once(
        state_path=state,
        report_dir=reports,
        dry_run=True,
        discover=should_not_run,
    )
    assert result["dry_run"] is True
    assert result["work_item"]["country_code"] == "CA"
    assert result["safety"]["external_send_enabled"] is False
    assert called is False
    assert not state.exists()
    assert not reports.exists()


def test_runtime_environment_cannot_enable_send(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APBD_GLOBAL_EXTERNAL_SEND_ENABLED", "1")
    with pytest.raises(RuntimeError, match="no external-send mode"):
        global_industry.run_once(dry_run=True)


def test_run_merges_discovery_solo_trade_and_canonical_repository(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from agents.apbd.leads import repository
    from agents.apbd.leads.adapters import website
    from agents.apbd import leads as _leads_package  # noqa: F401
    from agents.apbd.leads import native_enrichment
    from agents.apbd.solo_trade.service import SoloTradeService
    from agents.apbd.solo_trade.storage import CampaignStore

    db_dir = tmp_path / "db"
    monkeypatch.setattr(repository, "DB_DIR", db_dir)
    monkeypatch.setattr(repository, "COMPANIES_FILE", db_dir / "companies.json")
    monkeypatch.setattr(repository, "TASKS_FILE", db_dir / "search_tasks.json")
    monkeypatch.setattr(repository, "CHANGES_FILE", db_dir / "change_history.jsonl")
    monkeypatch.setattr(repository, "RAW_DIR", db_dir / "raw_places")

    def fake_website_enrich(company: dict, **_kwargs) -> dict:
        company = dict(company)
        company["description"] = "Automotive parts wholesaler serving repair workshops."
        company["description_evidence_url"] = "https://example.test/about"
        company["website_enrichment"] = {
            "status": "complete",
            "attempted_at": "2026-09-03T00:00:00Z",
            "pages_fetched": 1,
            "evidence_urls": ["https://example.test/about"],
        }
        company.setdefault("contact_channels", []).append(
            {
                "type": "email",
                "value": "parts@example.test",
                "source": "official_website",
                "evidence_url": "https://example.test/contact",
                "evidence_text": "Parts enquiries: parts@example.test",
                "observed_at": "2026-09-03T00:00:00Z",
                "commercial_restriction_check": {
                    "status": "none_observed_on_checked_page",
                    "checked_at": "2026-09-03T00:00:00Z",
                    "evidence_url": "https://example.test/contact",
                },
            }
        )
        return company

    monkeypatch.setattr(website, "enrich_company_from_website", fake_website_enrich)
    monkeypatch.setattr(native_enrichment, "enrich_company_native", lambda company: (company, {}))

    def fake_discover(**_kwargs):
        return (
            [
                {
                    "lead_id": "global-test-1",
                    "company": "Example Parts Ltd",
                    "country": "Canada",
                    "city": "Toronto",
                    "website": "https://example.test",
                    "public_email": "Not published",
                    "public_phone": "+1 555 0100",
                    "business_type": "Auto parts dealer",
                    "source_url": "https://maps.example/place/1",
                    "company_page_url": "https://maps.example/place/1",
                    "data_source": "google_maps",
                    "query": "fixture",
                }
            ],
            {"ok": True, "duplicates_skipped": 0, "api_quota_exhausted": False},
        )

    store = CampaignStore(tmp_path / "campaigns")
    result = global_industry.run_once(
        state_path=tmp_path / "state.json",
        report_dir=tmp_path / "reports",
        force=True,
        discover=fake_discover,
        service_factory=lambda: SoloTradeService(store),
    )

    assert result["new_candidates"] == 1
    assert result["research_completed"] == 1
    assert result["qualified_official_emails"] == 1
    assert result["actual_sent"] == 0
    assert result["compliance_send_ready"] == 0
    saved = repository.load_companies()
    assert len(saved) == 1
    profile = saved[0]["global_industry_development"]
    assert profile["primary_activity_scope"] == "parts_wholesaler"
    assert profile["public_email"] == "parts@example.test"
    assert profile["auto_send_eligible"] is False
    assert profile["draft_status"] == "queued_blocked_pending_localized_country_compliance_template"
    assert profile["draft_queue"]["status"] == "blocked_no_message_generated"
    assert profile["apsales_handoff"]["commercial_source_of_truth"] == "APSales"
    assert saved[0]["global_worker_auto_send_eligible"] is False
    state = json.loads((tmp_path / "state.json").read_text(encoding="utf-8"))
    assert state["market_cursor"] == 1
    assert state["market_visits"]["CA"] == 1
