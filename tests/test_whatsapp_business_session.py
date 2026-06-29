"""Tests for WhatsApp Business session state."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.whatsapp_business_session import (
    CONNECTOR_MODE,
    is_connected,
    load_session,
    mark_connected,
    qr_connect_instructions,
    session_exists,
    start_connect,
)


class WhatsAppBusinessSessionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.session_root = Path(self.tmp.name) / "session"

    def test_start_connect_creates_session(self) -> None:
        with mock.patch.dict("os.environ", {"WHATSAPP_SESSION_DIR": str(self.session_root)}):
            start_connect(adapter="mock")
            self.assertTrue(session_exists())
            state = load_session()
            self.assertEqual(state["connector_mode"], CONNECTOR_MODE)
            self.assertFalse(state["send_enabled"])

    def test_mark_connected(self) -> None:
        with mock.patch.dict("os.environ", {"WHATSAPP_SESSION_DIR": str(self.session_root)}):
            start_connect(adapter="mock")
            mark_connected(adapter="mock", linked_device=True)
            self.assertTrue(is_connected())

    def test_qr_instructions_chinese(self) -> None:
        text = qr_connect_instructions()
        self.assertIn("关联设备", text)
        self.assertIn("只读", text)


if __name__ == "__main__":
    unittest.main()
