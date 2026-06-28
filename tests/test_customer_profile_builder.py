"""Tests for customer profile builder."""

import tempfile
import unittest
from pathlib import Path

from customer_gateway.conversation_parser import parse_whatsapp_txt
from customer_gateway.customer_profile_builder import (
    build_all_profiles,
    format_followups_report,
    load_profiles,
)
from customer_gateway.gateway_readonly import PROFILES_DIR, reconfigure_paths
from customer_gateway.message_classifier import classify_messages

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_whatsapp_chat.txt"


class CustomerProfileBuilderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")
        conv = classify_messages(parse_whatsapp_txt(FIXTURE))
        self.parsed = [conv]
        self.profiles = build_all_profiles(self.parsed)

    def test_profile_fields(self) -> None:
        self.assertEqual(len(self.profiles), 1)
        prof = self.profiles[0]
        self.assertEqual(prof["contact_name"], "Ghana Motors Trading")
        self.assertIn("G4KJ", prof["interested_products"])
        self.assertEqual(prof["preferred_language"], "en")
        self.assertIn(prof["potential_level"], ("low", "medium", "high"))
        self.assertIn("price_sensitivity", prof)
        self.assertIn("negotiation_style", prof)
        self.assertIn("enquiry_frequency", prof)
        self.assertIn("response_quality", prof)
        self.assertIn("next_action", prof)
        self.assertIn("country", prof)
        self.assertIn("destination_port", prof)

    def test_profile_persisted(self) -> None:
        self.assertTrue(any(PROFILES_DIR.glob("*.json")))
        loaded = load_profiles()
        self.assertEqual(len(loaded), 1)

    def test_followups_report_chinese(self) -> None:
        report = format_followups_report(self.profiles)
        self.assertIn("跟进清单", report)
        self.assertIn("Ghana Motors", report)


if __name__ == "__main__":
    unittest.main()
