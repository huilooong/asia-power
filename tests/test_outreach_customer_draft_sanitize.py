"""Outreach customer drafts: English website follow-up + strip internal leaks."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.outreach_engine import (
    build_lead_followup_email,
    sanitize_customer_draft,
)
from customer_gateway import outreach_engine
from customer_gateway.growth_autopilot import _draft_outreach_candidate


class SanitizeCustomerDraftTests(unittest.TestCase):
    def test_strips_memory_and_approval_lines(self):
        raw = (
            "Hi there,\n\nThanks for your enquiry.\n\n"
            "MEMORY_TO_SAVE: category=customer | outreach note\n"
            "APPROVAL_REQUEST: action=external_message | risk=low\n"
            "Best regards"
        )
        out = sanitize_customer_draft(raw)
        self.assertIn("Thanks for your enquiry", out)
        self.assertNotIn("MEMORY_TO_SAVE", out)
        self.assertNotIn("APPROVAL_REQUEST", out)
        self.assertIn("Best regards", out)

    def test_english_template_has_no_chinese(self):
        subject, body = build_lead_followup_email(
            {
                "name": "ANSAH ISHMAEL OKO",
                "country": "ghana",
                "product": "2ZR-FE",
                "email": "a@example.com",
            }
        )
        self.assertIn("AsiaPower", subject)
        self.assertIn("2ZR-FE", body)
        self.assertIn("Hi ANSAH", body)
        self.assertFalse(any("\u4e00" <= ch <= "\u9fff" for ch in body))


class GrowthDraftPathTests(unittest.TestCase):
    def test_website_lead_email_uses_english_template(self):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(outreach_engine, "OUTREACH_QUEUE_DIR", Path(tmp)):
                record = _draft_outreach_candidate(
                    {
                        "candidate_id": "lead-test-sanitize-001",
                        "source": "website_lead",
                        "channel": "email",
                        "name": "Dennis Test",
                        "email": "dennis.test@example.com",
                        "country": "ghana",
                        "product": "1ZR-FE",
                        "priority": "medium",
                    }
                )
        draft = record.get("customer_draft") or ""
        self.assertEqual(record.get("channel"), "email")
        self.assertIn("Hi Dennis", draft)
        self.assertIn("1ZR-FE", draft)
        self.assertNotIn("MEMORY_TO_SAVE", draft)
        self.assertNotIn("尊敬的", draft)
        self.assertFalse(any("\u4e00" <= ch <= "\u9fff" for ch in draft))


if __name__ == "__main__":
    unittest.main()
