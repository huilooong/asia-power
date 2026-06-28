"""Tests for WhatsApp gateway safety guarantees."""

import tempfile
import unittest
from pathlib import Path

from customer_gateway.gateway_readonly import READONLY_MODE, assert_readonly, reconfigure_paths
from customer_gateway.whatsapp_connector import (
    DELETE_ENABLED,
    MODIFY_ENABLED,
    SEND_ENABLED,
    WhatsAppReadOnlyConnector,
)


class WhatsAppSafetyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")

    def test_readonly_mode_enabled(self) -> None:
        self.assertTrue(READONLY_MODE)
        self.assertFalse(SEND_ENABLED)
        self.assertFalse(MODIFY_ENABLED)
        self.assertFalse(DELETE_ENABLED)

    def test_gateway_blocks_send_operations(self) -> None:
        with self.assertRaises(PermissionError):
            assert_readonly("whatsapp_auto_send")

    def test_connector_blocks_all_writes(self) -> None:
        conn = WhatsAppReadOnlyConnector()
        for method, args in (
            ("send_message", ("hi",)),
            ("delete_message", ("id",)),
            ("modify_message", ("id", "text")),
            ("auto_reply", ("hi",)),
        ):
            with self.subTest(method=method):
                with self.assertRaises(PermissionError):
                    getattr(conn, method)(*args)


if __name__ == "__main__":
    unittest.main()
