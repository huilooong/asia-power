"""Tests for CLI command routing — slash commands must not become buyer enquiries."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from coo_core.dispatcher import dispatch_message
from customer_gateway.draft_queue import is_misrouted_cli_draft, reject_misrouted_cli_drafts, save_draft
from customer_gateway.gateway_readonly import reconfigure_paths
from sales_core.apsales_handler import (
    dispatch_apsales_command,
    is_apsales_command,
    process_apsales_enquiry,
)


class CLIRoutingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")

    def test_sales_intelligence_is_apsales_command(self) -> None:
        self.assertTrue(is_apsales_command("/sales-intelligence import"))
        self.assertTrue(is_apsales_command("/sales-intelligence dashboard"))

    def test_sales_intelligence_import_not_enquiry(self) -> None:
        with mock.patch("sales_core.apsales_handler.process_apsales_enquiry") as mock_enquiry:
            out = dispatch_apsales_command("/sales-intelligence import")
        mock_enquiry.assert_not_called()
        self.assertIn("导入", out)

    def test_sales_space_intelligence_alias_not_enquiry(self) -> None:
        with mock.patch("sales_core.apsales_handler.process_apsales_enquiry") as mock_enquiry:
            out = dispatch_apsales_command("/sales intelligence import")
        mock_enquiry.assert_not_called()
        self.assertIn("导入", out)

    def test_cli_router_resolve_agent_id(self) -> None:
        from coo_core.cli_router import resolve_agent_id

        self.assertEqual(resolve_agent_id("/sales-intelligence import"), "apsales")
        self.assertEqual(resolve_agent_id("/whatsapp sync"), "apsales")
        self.assertEqual(resolve_agent_id("/plan deploy"), "apcoo")
        self.assertEqual(resolve_agent_id("/unknown"), "apsales")
        self.assertEqual(resolve_agent_id("Do you have G4KJ?"), "apcoo")

    def test_sales_intelligence_dashboard_not_enquiry(self) -> None:
        with mock.patch("sales_core.apsales_handler.process_apsales_enquiry") as mock_enquiry:
            out = dispatch_apsales_command("/sales-intelligence dashboard")
        mock_enquiry.assert_not_called()
        self.assertNotIn("【客户草稿】", out)

    def test_dispatch_message_sales_intelligence_no_draft(self) -> None:
        with mock.patch.dict("os.environ", {}, clear=True):
            with mock.patch("sales_core.apsales_handler.process_apsales_enquiry") as mock_enquiry:
                out = dispatch_message(
                    "/sales-intelligence analyze",
                    source="cli",
                    agent_id="apsales",
                )
        mock_enquiry.assert_not_called()
        self.assertNotIn("Customer Draft", out)
        self.assertNotIn("【客户草稿】", out)

    def test_unknown_slash_not_enquiry(self) -> None:
        with mock.patch("sales_core.apsales_handler.process_apsales_enquiry") as mock_enquiry:
            out = dispatch_message("/foobar", source="cli", agent_id="apsales")
        mock_enquiry.assert_not_called()
        self.assertIn("Unknown command", out)

    def test_real_enquiry_still_generates_draft(self) -> None:
        with mock.patch.dict("os.environ", {}, clear=True):
            out = process_apsales_enquiry("Do you have G4KJ engine?")
        self.assertIn("Customer Draft", out)

    def test_reject_misrouted_cli_drafts(self) -> None:
        save_draft({
            "customer_name": "inquiry-intelligence",
            "original_message": "intelligence import",
            "customer_reply_draft": "mistake",
            "internal_analysis_zh": "mistake",
        })
        save_draft({
            "customer_name": "Ghana Motors",
            "original_message": "Do you have G4KJ?",
            "customer_reply_draft": "ok",
            "internal_analysis_zh": "ok",
        })
        rejected = reject_misrouted_cli_drafts()
        self.assertEqual(len(rejected), 1)

    def test_is_misrouted_cli_draft_patterns(self) -> None:
        self.assertTrue(is_misrouted_cli_draft({
            "original_message": "intelligence analyze",
            "customer_name": "x",
        }))
        self.assertTrue(is_misrouted_cli_draft({
            "original_message": "-intelligence pending",
            "customer_name": "x",
        }))
        self.assertFalse(is_misrouted_cli_draft({
            "original_message": "Do you have G4KJ engine?",
            "customer_name": "Ghana Motors",
        }))


if __name__ == "__main__":
    unittest.main()
