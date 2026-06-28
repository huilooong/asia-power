"""Tests for CEO reply style learner."""

import tempfile
import unittest
from pathlib import Path

from customer_gateway.conversation_parser import parse_whatsapp_txt
from customer_gateway.customer_profile_builder import build_all_profiles
from customer_gateway.gateway_readonly import STYLE_DIR, reconfigure_paths
from customer_gateway.message_classifier import classify_messages
from customer_gateway.reply_style_learner import learn_ceo_style, load_ceo_style

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_whatsapp_chat.txt"


class ReplyStyleLearnerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")
        conv = classify_messages(parse_whatsapp_txt(FIXTURE))
        self.parsed = [conv]

    def test_learns_greeting_and_salutation(self) -> None:
        style = learn_ceo_style(self.parsed)
        self.assertGreater(style["ceo_message_count"], 0)
        greetings = " ".join(style.get("greeting_patterns", [])).lower()
        self.assertTrue("hi" in greetings or "thanks" in greetings)
        salutations = " ".join(style.get("salutation_habits", [])).lower()
        self.assertTrue("my friend" in salutations or "boss" in salutations)

    def test_uncertain_stock_and_info_request(self) -> None:
        style = learn_ceo_style(self.parsed)
        uncertain = " ".join(style.get("uncertain_stock_phrases", [])).lower()
        info = " ".join(style.get("info_request_patterns", [])).lower()
        self.assertTrue("check" in uncertain or "supplier" in uncertain)
        self.assertTrue("port" in info or "model" in info or "year" in info)

    def test_style_persisted(self) -> None:
        learn_ceo_style(self.parsed)
        self.assertTrue((STYLE_DIR / "ceo_style.json").is_file())
        self.assertTrue((STYLE_DIR / "ceo_style.md").is_file())
        loaded = load_ceo_style()
        self.assertIn("improvement_suggestions", loaded)

    def test_improvement_suggestions_present(self) -> None:
        build_all_profiles(self.parsed)
        style = learn_ceo_style(self.parsed)
        self.assertGreater(len(style.get("improvement_suggestions", [])), 0)


if __name__ == "__main__":
    unittest.main()
