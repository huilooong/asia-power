"""Tests for sales performance analyzer."""

import tempfile
import unittest
from pathlib import Path

from customer_gateway.conversation_parser import parse_whatsapp_txt
from customer_gateway.customer_profile_builder import build_all_profiles
from customer_gateway.gateway_readonly import reconfigure_paths
from customer_gateway.message_classifier import classify_messages
from customer_gateway.sales_performance_analyzer import analyze_sales_performance

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_whatsapp_chat.txt"


class SalesPerformanceAnalyzerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")
        conv = classify_messages(parse_whatsapp_txt(FIXTURE))
        self.parsed = [conv]
        self.profiles = build_all_profiles(self.parsed)
        self.analysis = analyze_sales_performance(self.parsed, self.profiles)

    def test_overview_metrics(self) -> None:
        ov = self.analysis["overview"]
        self.assertGreaterEqual(ov["total_customers"], 1)
        self.assertIn("silent_customers", ov)

    def test_funnel_stages(self) -> None:
        stages = self.analysis["funnel"]["stages"]
        self.assertGreater(stages.get("enquiry", 0), 0)

    def test_ten_questions_issues(self) -> None:
        issues = self.analysis["issues"]
        for key in (
            "missed_followup_opportunities",
            "silent_after_enquiry",
            "price_churn_customers",
            "incomplete_info_collection",
            "worth_reactivation",
        ):
            self.assertIn(key, issues)

    def test_improvements_not_blind_copy(self) -> None:
        imp = self.analysis["improvements"]
        self.assertIn("new_sales_sop", imp)
        self.assertIn("不盲目复制", imp["apsales_priority"])

    def test_product_intelligence(self) -> None:
        products = self.analysis["products"]
        self.assertTrue(products.get("top_engines"))


if __name__ == "__main__":
    unittest.main()
