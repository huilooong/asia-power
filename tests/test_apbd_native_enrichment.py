"""Tests for APBD first-party enrichment safety and evidence boundaries."""

from __future__ import annotations

import unittest
from unittest import mock


def _company() -> dict:
    return {
        "id": "lead-native-1",
        "display_name": "Motores Valencia",
        "country_code": "VE",
        "location": {"city": "Valencia", "website_domain": "motores.example.ve"},
        "status": "enriched",
        "contact_channels": [
            {"type": "website", "value": "https://motores.example.ve/"},
            {
                "type": "email",
                "value": "Ventas@Motores.Example.Ve",
                "verification_status": "valid",
                "verification_provider": "hunter",
            },
            {"type": "email", "value": "motor.valencia@gmail.com"},
        ],
        "contact_persons": [
            {
                "name": "Maria Perez",
                "title": "Gerente de Compras",
                "source": "official_website_visible_text",
                "evidence_url": "https://motores.example.ve/equipo",
                "evidence_text": "Maria Perez — Gerente de Compras",
            }
        ],
    }


class NativeEnrichmentTests(unittest.TestCase):
    def test_classifies_public_contacts_without_overwriting_hunter_truth(self) -> None:
        from agents.apbd.leads.native_enrichment import enrich_company_native

        company, summary = enrich_company_native(_company(), resolver=lambda domain: "resolves")
        emails = [row for row in company["contact_channels"] if row.get("type") == "email"]

        self.assertEqual(emails[0]["verification_status"], "valid")
        self.assertEqual(emails[0]["verification_provider"], "hunter")
        self.assertTrue(emails[0]["native_validation"]["official_domain_match"])
        self.assertEqual(emails[0]["native_validation"]["mailbox_kind"], "role_mailbox")
        self.assertEqual(emails[1]["native_validation"]["domain_relationship"], "public_free_mailbox")
        self.assertEqual(summary["public_emails_checked"], 2)
        self.assertEqual(summary["named_people_with_evidence"], 1)
        self.assertEqual(summary["send_eligible"], 0)
        self.assertFalse(company["native_enrichment"]["guessed_emails_generated"])
        self.assertNotIn("maria.perez@", str(company).lower())

    def test_person_without_public_role_evidence_produces_no_pattern(self) -> None:
        from agents.apbd.leads.native_enrichment import enrich_company_native

        company = _company()
        company["contact_persons"][0].pop("evidence_text")
        company["contact_persons"][0]["source"] = "manual_guess"
        enriched, summary = enrich_company_native(company, resolver=lambda domain: "resolves")
        self.assertEqual(summary["email_pattern_hypotheses"], 0)
        self.assertEqual(enriched["native_enrichment"]["pattern_hypotheses"], [])

    def test_pipeline_dry_run_does_not_persist(self) -> None:
        from agents.apbd.leads.pipeline import run_native_enrich

        with mock.patch("agents.apbd.leads.pipeline.list_companies", return_value=[_company()]), mock.patch(
            "agents.apbd.leads.pipeline.upsert_companies_batch"
        ) as save, mock.patch(
            "agents.apbd.leads.native_enrichment.resolve_public_domain", return_value="resolves"
        ):
            result = run_native_enrich(country="VE", limit=1, workers=1, persist=False)
        save.assert_not_called()
        self.assertEqual(result["completed"], 1)
        self.assertFalse(result["persisted"])
        self.assertFalse(result["outreach_sent"])


if __name__ == "__main__":
    unittest.main()
