"""Evidence and checkpoint tests for APBD website-first enrichment."""

from __future__ import annotations

import tempfile
import threading
import time
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
    def test_rejects_placeholder_vendor_and_malformed_email_artifacts(self) -> None:
        from agents.apbd.leads.adapters.website import _emails_from_page

        page = """
        <a href="mailto:service@real-auto.ca">Contact</a>
        <input placeholder="you@email.com">
        <script>const theme = 'filler@godaddy.com';</script>
        <style>/* info@indiantypefoundry.com */</style>
        <a href="mailto:shop@gmail.com\\&quot;">Email</a>
        5@nit.qsf example@mail.com user@domain.com
        """

        self.assertEqual(
            _emails_from_page(page, "service@real-auto.ca"),
            ["service@real-auto.ca", "shop@gmail.com"],
        )

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

    def test_decision_maker_count_is_unique_across_multiple_pages(self) -> None:
        from agents.apbd.leads.adapters.website import enrich_company_from_website

        page = """
        <script type="application/ld+json">
        {"@type":"Person","name":"Jamie Owner","jobTitle":"Owner"}
        </script>
        """
        response = {
            "ok": True,
            "url": "https://example-auto.test/about",
            "html": page,
            "text": "Jamie Owner",
            "error": "",
        }
        with mock.patch(
            "agents.apbd.leads.adapters.website.fetch_url", return_value=response
        ):
            result = enrich_company_from_website(_company(), max_pages=3, timeout=3)

        self.assertEqual(len(result["contact_persons"]), 1)
        self.assertEqual(result["website_enrichment"]["decision_makers_found"], 1)


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


class EmailAuditTests(unittest.TestCase):
    def test_removes_artifacts_deduplicates_and_labels_manual_review(self) -> None:
        from scripts.apbd_leads_email_audit import audit

        company = _company()
        company["contact_channels"].extend(
            [
                {"type": "email", "value": "service@example-auto.test"},
                {"type": "email", "value": "YOU@EMAIL.COM"},
                {"type": "email", "value": "shop@gmail.com\\&quot;"},
                {"type": "email", "value": "shop@gmail.com"},
            ]
        )

        result = audit([company])

        emails = [
            channel for channel in company["contact_channels"] if channel.get("type") == "email"
        ]
        self.assertEqual([item["value"] for item in emails], ["service@example-auto.test", "shop@gmail.com"])
        self.assertEqual(emails[0]["quality_tier"], "official_domain_public")
        self.assertEqual(emails[1]["quality_tier"], "public_free_mailbox")
        self.assertEqual(emails[1]["verification_status"], "manual_review_required")
        self.assertEqual(result["removed_count"], 1)
        self.assertEqual(result["deduplicated_count"], 1)


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

    def test_concurrent_enrichment_uses_multiple_workers_and_one_persist(self) -> None:
        from agents.apbd.leads.pipeline import run_enrich
        from agents.apbd.leads.repository import upsert_company

        for idx in range(4):
            company = _company()
            company["id"] = f"lead-concurrent-{idx}"
            company["display_name"] = f"Concurrent Auto {idx}"
            company["contact_channels"][0]["value"] = f"https://auto-{idx}.test"
            upsert_company(company, source="test")

        state = {"active": 0, "max_active": 0}
        state_lock = threading.Lock()

        def fake_enrich(company: dict, **_: object) -> dict:
            with state_lock:
                state["active"] += 1
                state["max_active"] = max(state["max_active"], state["active"])
            time.sleep(0.03)
            with state_lock:
                state["active"] -= 1
            company["status"] = "enriched"
            company["website_enrichment"] = {
                "status": "complete",
                "linkedin_links_found": 0,
                "decision_makers_found": 0,
            }
            return company

        with mock.patch(
            "agents.apbd.leads.pipeline.enrich_company_from_website", side_effect=fake_enrich
        ):
            result = run_enrich(country="CA", limit=4, workers=4)

        self.assertGreater(state["max_active"], 1)
        self.assertEqual(result["workers"], 4)
        self.assertEqual(result["persistence_writes"], 1)
        self.assertEqual(result["complete"], 4)

    def test_batch_persist_preserves_human_locked_fields(self) -> None:
        from agents.apbd.leads.repository import (
            load_companies,
            upsert_companies_batch,
            upsert_company,
        )

        company = _company()
        company["priority"] = "CEO"
        company["human_locked_fields"] = ["priority"]
        upsert_company(company, source="test")
        incoming = dict(company)
        incoming["priority"] = "A"

        upsert_companies_batch([incoming], source="test_batch")

        saved = load_companies()[0]
        self.assertEqual(saved["priority"], "CEO")


if __name__ == "__main__":
    unittest.main()
