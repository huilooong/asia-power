"""Tests for full WhatsApp sales intelligence report."""

import json
import tempfile
import unittest
from pathlib import Path

from customer_gateway import sales_intelligence_paths as sip
from customer_gateway.contact_role_classifier import classify_contact_role, summarize_contact_roles
from customer_gateway.conversation_database import normalize_message, save_conversation
from customer_gateway.gateway_readonly import dispatch_sales_intelligence_command
from customer_gateway.whatsapp_sales_intelligence_full_report import (
    build_full_report,
    save_full_report,
)
from customer_gateway.sales_intelligence_engine import run_sales_intelligence_analysis


def _msgs():
    return [
        normalize_message(
            text="Hi do you have G4KJ engine for Tucson?",
            timestamp="18/01/2024, 10:00",
            sender="Ghana Motors",
            is_ceo=False,
            contact="Ghana Motors",
        ),
        normalize_message(
            text="Thank you. Checking supplier network for G4KJ. Confirm qty and Tema port.",
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
    ]


class WhatsAppFullReportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        sip.reconfigure_paths(Path(self.tmp.name) / "memory")
        save_conversation("Ghana Motors", _msgs(), source="test")
        save_conversation(
            "工厂张师傅",
            [normalize_message(
                text="库存确认 G4KD 有货",
                timestamp="19/01/2024, 09:00",
                sender="工厂张师傅",
                contact="工厂张师傅",
            )],
            source="test",
        )

    def test_classify_contact_roles(self) -> None:
        role = classify_contact_role("Ghana Motors", _msgs())
        self.assertIn(role, ("潜在客户", "B级客户", "A级客户", "浅互动客户"))
        supplier = classify_contact_role(
            "工厂张师傅",
            [normalize_message(text="供货确认", sender="工厂张师傅", contact="工厂张师傅")],
        )
        self.assertEqual(supplier, "供应商")

    def test_build_and_save_full_report(self) -> None:
        analysis = run_sales_intelligence_analysis()
        self.assertTrue(analysis.get("ok"))
        saved = save_full_report(analysis)
        self.assertTrue(Path(saved["markdown_path"]).is_file())
        self.assertTrue(Path(saved["json_path"]).is_file())
        report = saved["report"]
        self.assertIn("customer_classification", report)
        self.assertIn("recommended_replies", report)
        self.assertIn("首次询盘回复", report["recommended_replies"])
        self.assertGreater(report["engine_inquiry_stats"]["g4kj_mentions"], 0)

    def test_report_markdown_sections(self) -> None:
        analysis = run_sales_intelligence_analysis()
        saved = save_full_report(analysis)
        md = Path(saved["markdown_path"]).read_text(encoding="utf-8")
        for section in (
            "客户分类",
            "热门发动机",
            "最值得跟进",
            "推荐销售话术",
            "CEO Summary",
        ):
            self.assertIn(section, md)

    def test_cli_report_command(self) -> None:
        dispatch_sales_intelligence_command("/sales-intelligence analyze")
        out = dispatch_sales_intelligence_command("/sales-intelligence report")
        self.assertIn("WhatsApp Sales Intelligence", out)
        self.assertIn("CEO Summary", out)

    def test_report_readonly_flags(self) -> None:
        analysis = run_sales_intelligence_analysis()
        report = build_full_report(analysis)
        self.assertTrue(report["readonly"])
        self.assertFalse(report["auto_send"])
        self.assertFalse(report["auto_prompt_update"])


if __name__ == "__main__":
    unittest.main()
