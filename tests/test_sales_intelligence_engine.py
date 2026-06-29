"""Tests for APBRAIN-002 Sales Intelligence Engine."""

import json
import tempfile
import unittest
from pathlib import Path

from customer_gateway import sales_intelligence_paths as sip
from customer_gateway.conversation_database import (
    build_timeline,
    normalize_message,
    save_conversation,
    load_all_conversations,
)
from customer_gateway.gateway_readonly import dispatch_sales_intelligence_command
from customer_gateway.history_importer import run_full_history_import
from customer_gateway.reply_evolution import (
    approve_reply,
    format_approved_context,
    list_pending_replies,
    propose_reply_versions,
)
from customer_gateway.sales_intelligence_engine import (
    analyze_customer_intelligence,
    analyze_failures,
    learn_conversation_patterns,
    optimize_talk,
    run_sales_intelligence_analysis,
)


def _sample_conversation() -> list[dict]:
    return [
        normalize_message(
            text="Hi do you have G4KJ engine?",
            timestamp="18/01/2024, 10:00",
            sender="Ghana Motors",
            is_ceo=False,
            contact="Ghana Motors",
        ),
        normalize_message(
            text="Thank you boss. Let me check supplier network for G4KJ. Please confirm quantity and Tema port.",
            timestamp="18/01/2024, 10:15",
            sender="CEO",
            is_ceo=True,
            contact="Ghana Motors",
        ),
        normalize_message(
            text="Need 2 units FOB Tema",
            timestamp="18/01/2024, 11:00",
            sender="Ghana Motors",
            is_ceo=False,
            contact="Ghana Motors",
        ),
        normalize_message(
            text="Quotation FOB Tema USD 4500 per unit subject to supplier confirmation.",
            timestamp="03/02/2024, 09:00",
            sender="CEO",
            is_ceo=True,
            contact="Ghana Motors",
        ),
        normalize_message(
            text="Payment sent TT copy attached",
            timestamp="10/02/2024, 14:00",
            sender="Ghana Motors",
            is_ceo=False,
            contact="Ghana Motors",
        ),
    ]


class SalesIntelligenceEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        sip.reconfigure_paths(Path(self.tmp.name) / "memory")

    def test_timeline_milestones(self) -> None:
        msgs = _sample_conversation()
        timeline = build_timeline(msgs)
        events = [e["event"] for e in timeline]
        self.assertIn("first_contact", events)
        self.assertIn("first_enquiry", events)
        self.assertIn("first_quote", events)
        self.assertIn("first_deal", events)

    def test_save_and_load_conversation(self) -> None:
        save_conversation("Ghana Motors", _sample_conversation(), source="test")
        convs = load_all_conversations()
        self.assertEqual(len(convs), 1)
        self.assertGreaterEqual(convs[0]["message_count"], 5)

    def test_customer_intelligence(self) -> None:
        save_conversation("Ghana Motors", _sample_conversation(), source="test")
        convs = load_all_conversations()
        intel = analyze_customer_intelligence(convs)
        ghana = intel["customers"]["Ghana Motors"]
        self.assertTrue(ghana["deal_closed"])
        self.assertTrue(ghana["prefers_fob"])

    def test_pattern_and_talk_learning(self) -> None:
        save_conversation("Ghana Motors", _sample_conversation(), source="test")
        convs = load_all_conversations()
        patterns = learn_conversation_patterns(convs)
        self.assertIn("replies_that_continue_chat", patterns)
        talk = optimize_talk(convs)
        self.assertTrue(talk.get("top_opening") or talk.get("top_price_reply"))

    def test_failure_analysis(self) -> None:
        save_conversation("Silent Buyer", [
            normalize_message(
                text="Price for 1NZ engine?",
                timestamp="01/03/2024, 10:00",
                sender="Silent Buyer",
                is_ceo=False,
                contact="Silent Buyer",
            ),
        ], source="test")
        failures = analyze_failures(load_all_conversations())
        self.assertGreaterEqual(failures["failed_threads"], 1)

    def test_full_analysis_pipeline(self) -> None:
        save_conversation("Ghana Motors", _sample_conversation(), source="test")
        result = run_sales_intelligence_analysis()
        self.assertTrue(result["ok"])
        self.assertIn("dashboard", result)
        self.assertTrue((sip.DASHBOARD_DIR / "latest.json").is_file())

    def test_reply_evolution_ceo_gate(self) -> None:
        talk = {
            "top_opening": [{"text": "Thank you for your enquiry boss", "success_rate_pct": 83, "samples": 5}],
            "top_price_reply": [],
            "top_follow_up": [],
            "top_negotiation": [],
            "top_closing": [],
            "top_recovery": [],
        }
        prop = propose_reply_versions(talk)
        self.assertGreater(prop["proposed"], 0)
        pending = list_pending_replies()
        rid = pending[0]["reply_id"]
        msg = approve_reply(rid)
        self.assertIn("approved", msg.lower())
        ctx = format_approved_context()
        self.assertIn("CEO Approved", ctx)
        self.assertNotIn("pending", ctx.lower())

    def test_cli_import_and_analyze(self) -> None:
        save_conversation("Ghana Motors", _sample_conversation(), source="test")
        text = dispatch_sales_intelligence_command("/sales-intelligence analyze")
        self.assertIn("分析完成", text)
        dash = dispatch_sales_intelligence_command("/sales-intelligence dashboard")
        self.assertIn("CEO Dashboard", dash)

    def test_history_import_from_saved_conversations(self) -> None:
        save_conversation("Test Co", _sample_conversation()[:2], source="test")
        result = run_full_history_import(include_browser=False)
        self.assertTrue(result["ok"])
        self.assertGreaterEqual(result["conversation_count"], 1)


if __name__ == "__main__":
    unittest.main()
