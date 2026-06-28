"""Integration tests — APSales uses Customer Gateway sales intelligence."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from coo_core.dispatcher import dispatch_message
from customer_gateway.gateway_readonly import reconfigure_paths, run_intelligence_analysis
from customer_gateway.whatsapp_importer import import_whatsapp_txt
from sales_core.apsales_handler import build_apsales_enquiry_prompt

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_whatsapp_chat.txt"


class CustomerGatewayIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")
        import_whatsapp_txt(FIXTURE)
        run_intelligence_analysis()

    def test_apsales_prompt_includes_sales_intelligence(self) -> None:
        from agents.profile_loader import load_profile

        profile = load_profile("apsales")
        with mock.patch(
            "sales_core.apsales_handler.check_inventory_for_enquiry",
            return_value=(False, "no match"),
        ):
            prompt = build_apsales_enquiry_prompt("Do you have G4KJ engine for Ghana?", profile)
        self.assertIn("销售智能", prompt)
        self.assertIn("不盲目模仿", prompt)

    def test_sales_uses_gateway_in_fallback(self) -> None:
        with mock.patch.dict("os.environ", {}, clear=True):
            out = dispatch_message(
                "/sales customer: Do you have G4KJ engine?",
                source="cli",
                agent_id="apsales",
            )
        self.assertIn("销售智能", out)

    def test_whatsapp_analyze_cli(self) -> None:
        out = dispatch_message("/whatsapp analyze", source="cli", agent_id="apsales")
        self.assertIn("销售智能报告", out)
        self.assertIn("销售漏斗", out)

    def test_whatsapp_report_cli(self) -> None:
        out = dispatch_message("/whatsapp report", source="cli", agent_id="apsales")
        self.assertIn("销售智能报告", out)

    def test_customer_search(self) -> None:
        out = dispatch_message("/customer search G4KJ", source="cli", agent_id="apsales")
        self.assertIn("G4KJ", out)

    def test_customer_followups(self) -> None:
        out = dispatch_message("/customer followups", source="cli", agent_id="apsales")
        self.assertIn("跟进清单", out)

    def test_readonly_no_send(self) -> None:
        from customer_gateway.gateway_readonly import assert_readonly

        with self.assertRaises(PermissionError):
            assert_readonly("whatsapp_send")


if __name__ == "__main__":
    unittest.main()
