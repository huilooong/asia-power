"""Tests for APSales Telegram integration (no network)."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from coo_core.dispatcher import dispatch_message
from integrations.telegram_access import authorize_chat, parse_allowed_chat_ids
from tools import memory_tool


class TelegramAPSalesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        memory_tool.reconfigure_paths(Path(self.tmp.name) / "memory")

    def test_apsales_help_via_dispatcher(self) -> None:
        out = dispatch_message("/help", source="cli", agent_id="apsales")
        self.assertIn("APSales", out)
        self.assertIn("/pipeline", out)

    def test_apsales_pipeline_command(self) -> None:
        import tools.crm_tool as crm
        orig = crm.PIPELINE_FILE
        crm.PIPELINE_FILE = Path(self.tmp.name) / "pipeline.md"
        crm.CUSTOMERS_DIR = Path(self.tmp.name) / "customers"
        try:
            out = dispatch_message("/pipeline", source="cli", agent_id="apsales")
            self.assertIn("pipeline", out.lower())
        finally:
            crm.PIPELINE_FILE = orig

    def test_apsales_token_no_coo_fallback(self) -> None:
        from tools.message_tool import apsales_telegram_token, coo_telegram_token
        with mock.patch.dict("os.environ", {"COO_TELEGRAM_BOT_TOKEN": "coo:token"}, clear=True):
            self.assertEqual(coo_telegram_token(), "coo:token")
            self.assertEqual(apsales_telegram_token(), "")

    def test_authorize_private_whitelist(self) -> None:
        allowed = parse_allowed_chat_ids("123,456")
        ok, _ = authorize_chat({"id": 123, "type": "private"}, allowed)
        self.assertTrue(ok)

    def test_apcoo_default_unchanged(self) -> None:
        out = dispatch_message("/help", source="cli")
        self.assertIn("AsiaPower COO", out)

    def test_telegram_whatsapp_analyze_chinese(self) -> None:
        import tempfile
        from customer_gateway.gateway_readonly import reconfigure_paths
        from customer_gateway.whatsapp_importer import import_whatsapp_txt

        fixture = Path(__file__).resolve().parent / "fixtures" / "sample_whatsapp_chat.txt"
        gw = Path(self.tmp.name) / "gateway"
        reconfigure_paths(gw)
        import_whatsapp_txt(fixture)
        out = dispatch_message(
            "/whatsapp analyze",
            source="telegram_apsales",
            agent_id="apsales",
        )
        self.assertIn("销售智能报告", out)

    def test_telegram_customer_followups(self) -> None:
        out = dispatch_message(
            "/customer followups",
            source="telegram_apsales",
            agent_id="apsales",
        )
        self.assertIn("跟进", out)

    def test_telegram_whatsapp_intel_banner(self) -> None:
        from integrations.telegram_apsales_bot import WHATSAPP_INTEL_COMMANDS_ZH

        self.assertIn("/whatsapp sync --readonly", WHATSAPP_INTEL_COMMANDS_ZH)
        self.assertIn("只读", WHATSAPP_INTEL_COMMANDS_ZH)


if __name__ == "__main__":
    unittest.main()
