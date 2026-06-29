"""Tests for WhatsApp Business connector write safety."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.whatsapp_business_web_connector import WhatsAppBusinessWebConnector
from customer_gateway.whatsapp_live_adapter import MockLiveAdapter


class WhatsAppBusinessSafetyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.env = {
            "WHATSAPP_SESSION_DIR": str(Path(self.tmp.name) / "session"),
            "WHATSAPP_LIVE_INBOX": str(Path(self.tmp.name) / "inbox"),
            "WHATSAPP_SEND_ENABLED": "true",
            "WHATSAPP_MARK_READ_ENABLED": "true",
        }

    def test_connector_blocks_writes(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            conn = WhatsAppBusinessWebConnector(adapter_mode="mock")
        for method, args in (
            ("send_message", ("hi",)),
            ("reply_message", ("hi",)),
            ("delete_message", ("id",)),
            ("mark_read", ("id",)),
            ("archive_chat", ("chat",)),
            ("modify_message", ("id", "text")),
        ):
            with self.subTest(method=method):
                with self.assertRaises(PermissionError):
                    getattr(conn, method)(*args)

    def test_adapter_blocks_writes(self) -> None:
        adapter = MockLiveAdapter()
        for method, args in (
            ("send_message", ("hi",)),
            ("reply_message", ("hi",)),
            ("delete_message", ("id",)),
            ("mark_read", ("id",)),
            ("archive_chat", ("chat",)),
            ("modify_message", ("id", "text")),
        ):
            with self.subTest(method=method):
                with self.assertRaises(PermissionError):
                    getattr(adapter, method)(*args)

    def test_send_enabled_stays_false_despite_env(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            conn = WhatsAppBusinessWebConnector(adapter_mode="mock")
            status = conn.status()
        self.assertFalse(status["send_enabled"])
        self.assertFalse(status["mark_read_enabled"])


if __name__ == "__main__":
    unittest.main()
