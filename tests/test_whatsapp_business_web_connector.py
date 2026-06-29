"""Tests for WhatsApp Business web connector."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.whatsapp_business_web_connector import (
    WhatsAppBusinessWebConnector,
    business_connect,
    business_status,
    send_enabled_effective,
)


class WhatsAppBusinessWebConnectorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.env = {
            "WHATSAPP_SESSION_DIR": str(Path(self.tmp.name) / "session"),
            "WHATSAPP_LIVE_INBOX": str(Path(self.tmp.name) / "inbox"),
            "WHATSAPP_LIVE_ADAPTER": "mock",
        }

    def test_connect_returns_qr_instructions(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            text = business_connect()
        self.assertIn("关联设备", text)
        self.assertIn("Mock", text)

    def test_status_readonly_and_send_disabled(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            text = business_status()
        self.assertIn("只读", text)
        self.assertIn("send_enabled: false", text)
        self.assertIn("requested_adapter: mock", text)
        self.assertIn("active_adapter: mock", text)
        self.assertIn("mock_session: true", text)
        self.assertIn("logged_in: false", text)
        self.assertFalse(send_enabled_effective())

    def test_mock_connect_does_not_fake_logged_in(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            conn = WhatsAppBusinessWebConnector(adapter_mode="mock")
            result = conn.connect()
            status = conn.status()
        self.assertFalse(result["adapter_result"]["logged_in"])
        self.assertTrue(result["adapter_result"]["mock_session"])
        self.assertFalse(status["logged_in"])
        self.assertTrue(status["mock_session"])

    def test_status_shows_inbox_path(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            text = business_status()
        self.assertIn(self.env["WHATSAPP_LIVE_INBOX"], text)

    def test_connector_connect_ok(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            conn = WhatsAppBusinessWebConnector(adapter_mode="mock")
            result = conn.connect()
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
