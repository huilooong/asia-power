"""Evidence and checkpoint tests for APBD website-first enrichment."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock


def _company() -> dict:
    return {
        "id": "lead-enrich-1",
        "display_name": "Example Auto",
        "legal_name": "Example Auto Inc",
        "country_code": "CA",
        "location": {"city": "Toronto"},
        "contact_channels": [
            {"type": "website", "value": "https://example-auto.test", "source": "google_places"}
        ],
        "contact_persons": [],
        "external_profiles": [],
        "services": [],
        "brands": [],
        "classification_flags": [],
        "chinese_relevance": {"status": "unknown"},
        "status": "discovered",
        "business_status": "OPERATIONAL",
        "score": None,
        "priority": "",
    }


class WebsiteEvidenceTests(unittest.TestCase):
    def test_extracts_public_email_linkedin_and_structured_decision_maker(self) -> None:
        from agents.apbd.leads.adapters.website import enrich_company_from_website

        page = """
        <html><body>
          <a href="mailto:sales@example-auto.test">Email us</a>
          <a href="https://www.linkedin.com/company/example-auto/">LinkedIn</a>
          <form><input type="email"></form>
          <script type="application/ld+json">
          {"@type":"Person","name":"Alex Owner","jobTitle":"Owner",
           "email":"alex@example-auto.test",
           "sameAs":["https://www.linkedin.com/in/alex-owner"]}
          </script>
        </body></html>
        """
        response = {
            "ok": True,
            "url": "https://example-auto.test/contact",
            "html": page,
            "text": "Alex Owner Owner sales@example-auto.test",
            "error": "",
        }
        with mock.patch("agents.apbd.leads.adapters.website.fetch_url", return_value=response):
            result = enrich_company_from_website(_company(), max_pages=1, timeout=3)

        emails = [
            channel
            for channel in result["contact_channels"]
            if channel.get("type") == "email"
        ]
        self.assertEqual(
            {item["value"] for item in emails},
            {"sales@example-auto.test", "alex@example-auto.test"},
        )
        self.assertTrue(all(item.get("evidence_url") for item in emails))
        linkedin = [
            item for item in result["external_profiles"] if item.get("source") == "linkedin_public_link"
        ]
        self.assertEqual(len(linkedin), 2)
        self.assertEqual(result["contact_persons"][0]["name"], "Alex Owner")
        self.assertEqual(result["contact_persons"][0]["title"], "Owner")
        self.assertEqual(result["website_enrichment"]["status"], "complete")
        self.assertEqual(result["website_enrichment"]["decision_makers_found"], 1)

    def test_failed_fetch_is_retryable_and_does_not_mark_enriched(self) -> None:
        from agents.apbd.leads.adapters.website import enrich_company_from_website

        response = {"ok": False, "url": "", "html": "", "text": "", "error": "timed out"}
        with mock.patch("agents.apbd.leads.adapters.website.fetch_url", return_value=response):
            result = enrich_company_from_website(_company(), max_pages=5, timeout=3)

        self.assertEqual(result["status"], "discovered")
        self.assertEqual(result["website_enrichment"]["status"], "failed")
        self.assertTrue(result["website_enrichment"]["retryable"])
        self.assertEqual(result["website_enrichment"]["pages_attempted"], 2)


class PlacesFallbackTests(unittest.TestCase):
    def test_places_refresh_adds_missing_website_but_never_email(self) -> None:
        from agents.apbd.leads.adapters.places import refresh_company_contact_fields

        company = _company()
        company["contact_channels"] = [{"type": "phone", "value": "555-0100"}]
        company["location"]["google_place_id"] = "place-123"
        details = {
            "id": "place-123",
            "websiteUri": "https://example-auto.test",
            "nationalPhoneNumber": "555-0100",
            "googleMapsUri": "https://maps.google.com/?q=place-123",
        }
        with (
            mock.patch("agents.apbd.leads.adapters.places.require_places_key", return_value="key"),
            mock.patch("customer_gateway.maps_prospect._place_details_api", return_value=details),
        ):
            result = refresh_company_contact_fields(company)

        channels = result["contact_channels"]
        self.assertTrue(any(c.get("type") == "website" for c in channels))
        self.assertFalse(any(c.get("type") == "email" for c in channels))
        self.assertFalse(result["places_contact_refresh"]["email_field_available"])
        self.assertTrue(result["places_contact_refresh"]["website_added"])


class EnrichmentCheckpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name)
        self.patches = [
            mock.patch("agents.apbd.leads.repository.DB_DIR", self.db),
            mock.patch("agents.apbd.leads.repository.COMPANIES_FILE", self.db / "companies.json"),
            mock.patch("agents.apbd.leads.repository.TASKS_FILE", self.db / "search_tasks.json"),
            mock.patch("agents.apbd.leads.repository.CHANGES_FILE", self.db / "change_history.jsonl"),
            mock.patch("agents.apbd.leads.repository.RAW_DIR", self.db / "raw_places"),
        ]
        for patch in self.patches:
            patch.start()

    def tearDown(self) -> None:
        for patch in self.patches:
            patch.stop()
        self.tmp.cleanup()

    def test_completed_company_is_not_reprocessed(self) -> None:
        from agents.apbd.leads.pipeline import run_enrich
        from agents.apbd.leads.repository import upsert_company

        upsert_company(_company(), source="test")

        def fake_enrich(company: dict, **_: object) -> dict:
            company["status"] = "enriched"
            company["website_enrichment"] = {
                "status": "complete",
                "linkedin_links_found": 0,
                "decision_makers_found": 0,
            }
            return company

        with mock.patch("agents.apbd.leads.pipeline.enrich_company_from_website", side_effect=fake_enrich):
            first = run_enrich(country="CA", limit=10)
            second = run_enrich(country="CA", limit=10)

        self.assertEqual(first["attempted"], 1)
        self.assertEqual(first["complete"], 1)
        self.assertEqual(second["selected"], 0)
        self.assertEqual(second["skipped_attempted"], 1)


if __name__ == "__main__":
    unittest.main()
