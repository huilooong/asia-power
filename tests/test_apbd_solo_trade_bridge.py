from __future__ import annotations

from agents.apbd.solo_trade import apbd_bridge


def test_lead_to_apbd_company_keeps_campaign_link_and_verified_hunter_contact() -> None:
    lead = {
        "lead_id": "lead-ve-1",
        "company": "Motores Valencia C.A.",
        "country": "Venezuela",
        "city": "Valencia",
        "website": "https://www.example.test/parts",
        "public_email": "buyer@example.test",
        "public_email_source": "hunter_verified",
        "public_phone": "+58 212 555 0101",
        "business_type": "Toyota parts importer",
        "status": "researched",
        "source_url": "https://example.test/about",
        "contacts": [
            {
                "type": "email",
                "value": "owner@example.test",
                "verified": True,
                "provider": "hunter",
                "source": "https://example.test",
            }
        ],
    }

    company = apbd_bridge.lead_to_apbd_company(lead, campaign_id="solo-ve-test")

    assert company["country_code"] == "VE"
    assert company["location"]["website_domain"] == "example.test"
    assert company["status"] == "enriched"
    assert company["apbd_campaign_refs"][0]["campaign_id"] == "solo-ve-test"
    emails = [row for row in company["contact_channels"] if row["type"] == "email"]
    assert {row["value"] for row in emails} == {"buyer@example.test", "owner@example.test"}
    assert next(row for row in emails if row["value"] == "buyer@example.test")["verified"] is True


def test_sync_campaign_reuses_existing_domain_and_sets_apbd_id(monkeypatch) -> None:
    existing = {
        "id": "lead-existing",
        "display_name": "Existing",
        "legal_name": "Existing",
        "normalized_name": "existing",
        "country_code": "VE",
        "location": {"website_domain": "example.test"},
        "contact_channels": [
            {"type": "website", "value": "https://example.test", "source": "google_places"},
            {"type": "email", "value": "sales@example.test", "source": "website"},
        ],
        "source_urls": ["https://example.test"],
        "apbd_campaign_refs": [],
        "status": "verified",
    }
    saved: list[dict] = []
    monkeypatch.setattr(apbd_bridge, "load_companies", lambda: [existing])
    monkeypatch.setattr(
        apbd_bridge,
        "upsert_company",
        lambda company, source="": saved.append(company) or company,
    )
    campaign = {
        "campaign_id": "solo-ve-test",
        "leads": [
            {
                "lead_id": "lead-campaign",
                "company": "Existing Toyota Parts",
                "country": "Venezuela",
                "website": "https://www.example.test/catalog",
                "status": "researched",
                "contacts": [
                    {
                        "type": "email",
                        "value": "sales@example.test",
                        "provider": "hunter",
                        "verified": True,
                        "verification_status": "valid",
                        "verification_provider": "hunter",
                    }
                ],
            }
        ],
    }

    result = apbd_bridge.sync_campaign_to_apbd(campaign)

    assert result == {
        "linked": 1,
        "created": 0,
        "updated": 1,
        "links": [{"lead_id": "lead-campaign", "apbd_company_id": "lead-existing"}],
    }
    assert campaign["leads"][0]["apbd_company_id"] == "lead-existing"
    assert saved[0]["status"] == "verified"
    saved_email = next(row for row in saved[0]["contact_channels"] if row["type"] == "email")
    assert saved_email["verified"] is True
    assert saved_email["verification_status"] == "valid"
    assert saved_email["source"] == "website"
