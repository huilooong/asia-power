"""Tests for APTRUTH-001 verified sales intelligence guard."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from truth.answer_auditor import audit_answer
from truth.truth_guard import (
    is_business_intelligence_query,
    reject_unsourced_numbers,
    requires_verified_data,
)
from truth.verified_sales_intelligence import (
    REPORT_JSON,
    SI_ROOT,
    build_verified_ceo_report,
    load_verified_sales_data,
)


class TruthGuardTests(unittest.TestCase):
    def test_chat_history_question_is_bi(self) -> None:
        self.assertTrue(
            is_business_intelligence_query("看了9000条聊天记录有什么收获")
        )

    def test_g4kd_share_is_bi(self) -> None:
        self.assertTrue(is_business_intelligence_query("G4KD占比多少"))

    def test_website_summary_not_bi(self) -> None:
        self.assertFalse(
            is_business_intelligence_query("今天帮我总结一下AsiaPower官网文案")
        )

    def test_customer_enquiry_not_bi(self) -> None:
        self.assertFalse(is_business_intelligence_query("Do you have G4KJ engine?"))

    def test_reject_unsourced_percent(self) -> None:
        rejected, reason = reject_unsourced_numbers("G4KD占84%，Nigeria有1100个会话")
        self.assertTrue(rejected)
        self.assertIn("unsourced", reason)

    def test_allow_sourced_answer(self) -> None:
        rejected, _ = reject_unsourced_numbers(
            "messages_imported: 9064 (source: import_state.json)"
        )
        self.assertFalse(rejected)

    def test_audit_blocks_fake_stats(self) -> None:
        result = audit_answer("G4KD占84%，报价流失52%，回复率提升30%")
        self.assertFalse(result["passed"])
        self.assertTrue(result["unsafe_numbers"])


class VerifiedSalesIntelligenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.reports = self.root / "reports"
        self.si = self.root / "memory" / "sales_intelligence"
        self.si.mkdir(parents=True)
        self.reports.mkdir(parents=True)
        (self.si / "dashboard").mkdir()
        (self.si / "patterns").mkdir()
        (self.si / "failures").mkdir()
        (self.si / "reply_evolution").mkdir()

        import_state = {
            "conversation_count": 524,
            "message_count": 12724,
            "browser_import": {
                "loaded_chats": 506,
                "processed_chats": 505,
                "messages_imported": 9064,
                "failed_chats": 0,
                "data_coverage": "partial",
                "limitation_reason": "partial web limit",
            },
            "role_summary": {
                "effective_customers": 483,
                "customer_tiers": {"潜在客户": 473, "A级客户": 10},
                "other_roles": {"供应商": 1},
            },
        }
        (self.si / "import_state.json").write_text(
            json.dumps(import_state, ensure_ascii=False), encoding="utf-8",
        )
        report = {
            "data_coverage": "partial",
            "engine_inquiry_stats": {
                "engine_enquiry_threads": 509,
                "g4kj_mentions": 8,
                "g4kd_mentions": 1,
            },
            "failed_talk": {"failure_reasons": {"slow_reply": 254}},
            "top_followup_customers": [{"contact": "Ghana Motors", "tier": "潜在客户"}],
            "recommended_replies": {"首次询盘回复": "Hi, checking supplier network."},
        }
        (self.reports / "whatsapp_sales_intelligence_full.json").write_text(
            json.dumps(report, ensure_ascii=False), encoding="utf-8",
        )

    def test_build_report_no_fake_numbers(self) -> None:
        with mock.patch("truth.verified_sales_intelligence.ROOT", self.root), \
             mock.patch("truth.verified_sales_intelligence.REPORT_JSON", self.reports / "whatsapp_sales_intelligence_full.json"), \
             mock.patch("truth.verified_sales_intelligence.SI_ROOT", self.si), \
             mock.patch("truth.verified_sales_intelligence.IMPORT_STATE", self.si / "import_state.json"), \
             mock.patch("truth.verified_sales_intelligence.DASHBOARD_JSON", self.si / "dashboard" / "latest.json"), \
             mock.patch("truth.verified_sales_intelligence.PATTERNS_JSON", self.si / "patterns" / "sales_patterns.json"), \
             mock.patch("truth.verified_sales_intelligence.TALK_JSON", self.si / "patterns" / "talk_optimization.json"), \
             mock.patch("truth.verified_sales_intelligence.FAILURES_JSON", self.si / "failures" / "failure_report.json"), \
             mock.patch("truth.verified_sales_intelligence.PENDING_JSON", self.si / "reply_evolution" / "pending.json"), \
             mock.patch("truth.verified_sales_intelligence.LATEST_ANALYSIS", self.si / "latest_analysis.json"):
            text = build_verified_ceo_report("看了9000条聊天记录有什么收获")
        self.assertIn("AsiaPower Verified Sales Intelligence Report", text)
        self.assertIn("9064", text)
        self.assertIn("Not Available", text)
        self.assertNotIn("84%", text)
        self.assertNotIn("1100", text)
        self.assertNotIn("52%", text)
        self.assertNotIn("提升30%", text)

    def test_missing_fields_say_unavailable(self) -> None:
        with mock.patch("truth.verified_sales_intelligence.ROOT", self.root), \
             mock.patch("truth.verified_sales_intelligence.REPORT_JSON", self.reports / "whatsapp_sales_intelligence_full.json"), \
             mock.patch("truth.verified_sales_intelligence.SI_ROOT", self.si), \
             mock.patch("truth.verified_sales_intelligence.IMPORT_STATE", self.si / "import_state.json"), \
             mock.patch("truth.verified_sales_intelligence.DASHBOARD_JSON", self.si / "dashboard" / "latest.json"), \
             mock.patch("truth.verified_sales_intelligence.PATTERNS_JSON", self.si / "patterns" / "sales_patterns.json"), \
             mock.patch("truth.verified_sales_intelligence.TALK_JSON", self.si / "patterns" / "talk_optimization.json"), \
             mock.patch("truth.verified_sales_intelligence.FAILURES_JSON", self.si / "failures" / "failure_report.json"), \
             mock.patch("truth.verified_sales_intelligence.PENDING_JSON", self.si / "reply_evolution" / "pending.json"), \
             mock.patch("truth.verified_sales_intelligence.LATEST_ANALYSIS", self.si / "latest_analysis.json"):
            data = load_verified_sales_data()
        self.assertTrue(data["available"])
        self.assertEqual(data["data_coverage"], "partial")


class DispatcherTruthIntegrationTests(unittest.TestCase):
    def test_bi_question_skips_openai(self) -> None:
        from coo_core.dispatcher import dispatch_message
        with mock.patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test"}):
            with mock.patch("coo_core.dispatcher.call_openai") as mock_llm:
                with mock.patch(
                    "truth.verified_sales_intelligence.build_verified_ceo_report",
                    return_value="AsiaPower Verified Sales Intelligence Report\n9064",
                ):
                    reply = dispatch_message(
                        "看了9000条聊天记录，现在有什么收获？",
                        source="telegram",
                    )
        mock_llm.assert_not_called()
        self.assertIn("Verified Sales Intelligence", reply)

    def test_greeting_still_calls_openai(self) -> None:
        from coo_core.dispatcher import dispatch_message
        with mock.patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test"}):
            with mock.patch("coo_core.dispatcher.call_openai", return_value="Hello CEO") as mock_llm:
                with mock.patch("coo_core.dispatcher.strip_memory_tags", side_effect=lambda x: x):
                    with mock.patch("coo_core.dispatcher.apply_memory_tags", return_value=[]):
                        reply = dispatch_message("你好", source="cli")
        mock_llm.assert_called_once()
        self.assertEqual(reply, "Hello CEO")


class SalesIntelligenceCliTruthTests(unittest.TestCase):
    def test_verified_report_command(self) -> None:
        from customer_gateway.gateway_readonly import dispatch_sales_intelligence_command
        with mock.patch(
            "truth.verified_sales_intelligence.build_verified_ceo_report",
            return_value="AsiaPower Verified Sales Intelligence Report",
        ):
            out = dispatch_sales_intelligence_command("/sales-intelligence verified-report")
        self.assertIn("Verified Sales Intelligence", out)

    def test_truth_audit_command(self) -> None:
        from customer_gateway.gateway_readonly import dispatch_sales_intelligence_command
        out = dispatch_sales_intelligence_command(
            "/sales-intelligence truth-audit G4KD占84%"
        )
        self.assertIn("passed: False", out)


if __name__ == "__main__":
    unittest.main()
