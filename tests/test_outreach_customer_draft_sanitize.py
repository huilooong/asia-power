"""Outreach customer drafts: Zijing LLM path + strip internal leaks."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.outreach_engine import (
    build_lead_followup_email,
    build_outreach_enquiry,
    buyer_language_for_candidate,
    draft_has_cjk,
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
        self.assertFalse(draft_has_cjk(body))

    def test_ghana_buyer_language_en(self):
        self.assertEqual(buyer_language_for_candidate({"country": "ghana"}), "en")
        self.assertEqual(buyer_language_for_candidate({"country": "senegal"}), "fr")

    def test_outreach_enquiry_forces_buyer_language(self):
        q = build_outreach_enquiry(
            {"name": "Dennis", "country": "ghana", "product": "1ZR-FE", "message": ""}
        )
        self.assertIn("[BUYER_LANGUAGE=en]", q)
        self.assertIn("NOT a fixed template", q)


class GrowthDraftPathTests(unittest.TestCase):
    def test_website_lead_email_uses_zijing_llm_path(self):
        fake_subject = "AsiaPower — your enquiry about 1ZR-FE"
        fake_body = (
            "Hi Dennis,\n\n"
            "I saw your enquiry about 1ZR-FE from Ghana. "
            "I can check supplier options with photos — "
            "could you confirm the model year?\n\n"
            "www.asia-power.com\n"
            "Best regards,\nZijing / AsiaPower"
        )
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(outreach_engine, "OUTREACH_QUEUE_DIR", Path(tmp)):
                with mock.patch.object(
                    outreach_engine,
                    "draft_zijing_outreach_email",
                    return_value=(fake_subject, fake_body, "内部：加纳 1ZR-FE 跟进"),
                ):
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
        self.assertEqual(record.get("draft_mode"), "zijing_llm")
        self.assertIn("Hi Dennis", draft)
        self.assertIn("1ZR-FE", draft)
        self.assertIn("model year", draft)
        self.assertNotIn("MEMORY_TO_SAVE", draft)
        self.assertNotIn("尊敬的", draft)
        self.assertFalse(draft_has_cjk(draft))
        # Must NOT be the old skeleton template paragraph.
        self.assertNotIn("We connect verified China suppliers with workshops", draft)

    def _whatsapp_candidate(self):
        return {
            "candidate_id": "wa-test-001",
            "source": "whatsapp_intelligence",
            "channel": "whatsapp",
            "name": "Kwame",
            "country": "ghana",
            "product": "2AZ-FE",
        }

    def test_whatsapp_followup_clean_draft_used_as_is(self):
        clean = "【内部分析】ghana follow-up\n【客户草稿】Hi Kwame, following up on the 2AZ-FE — still interested?"
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(outreach_engine, "OUTREACH_QUEUE_DIR", Path(tmp)):
                with mock.patch(
                    "sales_core.apsales_handler.process_apsales_enquiry", return_value=clean
                ) as mocked:
                    record = _draft_outreach_candidate(self._whatsapp_candidate())
        self.assertEqual(mocked.call_count, 1)  # no retry needed
        draft = record.get("customer_draft") or ""
        self.assertIn("Hi Kwame", draft)
        self.assertFalse(draft_has_cjk(draft))

    def test_whatsapp_followup_cjk_first_try_clean_retry(self):
        dirty = "【内部分析】note\n【客户草稿】您好Kwame, 关于2AZ-FE还感兴趣吗？"
        clean = "【内部分析】retry note\n【客户草稿】Hi Kwame, checking in on the 2AZ-FE — any update?"
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(outreach_engine, "OUTREACH_QUEUE_DIR", Path(tmp)):
                with mock.patch(
                    "sales_core.apsales_handler.process_apsales_enquiry",
                    side_effect=[dirty, clean],
                ) as mocked:
                    record = _draft_outreach_candidate(self._whatsapp_candidate())
        self.assertEqual(mocked.call_count, 2)  # retried once
        draft = record.get("customer_draft") or ""
        self.assertFalse(draft_has_cjk(draft))
        self.assertIn("checking in", draft)

    def test_whatsapp_followup_cjk_both_tries_falls_back_clean(self):
        dirty = "【内部分析】note\n【客户草稿】您好，关于2AZ-FE还感兴趣吗？"
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(outreach_engine, "OUTREACH_QUEUE_DIR", Path(tmp)):
                with mock.patch(
                    "sales_core.apsales_handler.process_apsales_enquiry",
                    return_value=dirty,
                ) as mocked:
                    record = _draft_outreach_candidate(self._whatsapp_candidate())
        self.assertEqual(mocked.call_count, 2)
        draft = record.get("customer_draft") or ""
        self.assertFalse(draft_has_cjk(draft))
        self.assertIn("Hi Kwame", draft)
        self.assertIn("2AZ-FE", draft)
        self.assertIn("[GATE]", record.get("internal_analysis_zh") or "")

    def test_whatsapp_followup_french_buyer_fallback_greeting(self):
        dirty = "【内部分析】note\n【客户草稿】您好，还感兴趣吗？"
        cand = self._whatsapp_candidate()
        cand["country"] = "senegal"
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(outreach_engine, "OUTREACH_QUEUE_DIR", Path(tmp)):
                with mock.patch(
                    "sales_core.apsales_handler.process_apsales_enquiry",
                    return_value=dirty,
                ):
                    record = _draft_outreach_candidate(cand)
        draft = record.get("customer_draft") or ""
        self.assertFalse(draft_has_cjk(draft))
        self.assertIn("Bonjour Kwame", draft)


if __name__ == "__main__":
    unittest.main()
