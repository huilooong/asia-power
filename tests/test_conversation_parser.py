"""Tests for WhatsApp conversation parser."""

import tempfile
import unittest
from pathlib import Path

from customer_gateway.conversation_parser import parse_whatsapp_txt
from customer_gateway.gateway_readonly import reconfigure_paths
from customer_gateway.message_classifier import classify_messages

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_whatsapp_chat.txt"


class ConversationParserTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")

    def test_parse_timestamps_and_senders(self) -> None:
        conv = parse_whatsapp_txt(FIXTURE)
        self.assertEqual(conv["contact"], "Ghana Motors Trading")
        self.assertGreaterEqual(conv["message_count"], 8)
        ceo_msgs = [m for m in conv["messages"] if m["is_ceo"]]
        customer_msgs = [m for m in conv["messages"] if not m["is_ceo"]]
        self.assertGreater(len(ceo_msgs), 0)
        self.assertGreater(len(customer_msgs), 0)

    def test_product_keywords_and_language(self) -> None:
        conv = parse_whatsapp_txt(FIXTURE)
        first = conv["messages"][0]
        self.assertIn("G4KJ", first["product_keywords"])
        self.assertEqual(first["language"], "en")

    def test_classify_enquiry_and_negotiation(self) -> None:
        conv = classify_messages(parse_whatsapp_txt(FIXTURE))
        categories = {m["category"] for m in conv["messages"]}
        self.assertIn("availability_check", categories)
        self.assertTrue(
            "negotiation" in categories or "price_request" in categories,
        )

    def test_countries_ports_detected(self) -> None:
        conv = parse_whatsapp_txt(FIXTURE)
        all_ports: list[str] = []
        for m in conv["messages"]:
            all_ports.extend(m.get("countries_ports", []))
        joined = " ".join(all_ports).lower()
        self.assertTrue("ghana" in joined or "tema" in joined)


if __name__ == "__main__":
    unittest.main()
