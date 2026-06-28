"""Tests for read-only WhatsApp connector."""

import tempfile
import unittest
from pathlib import Path

from customer_gateway.gateway_readonly import reconfigure_paths
from customer_gateway.whatsapp_connector import (
    SEND_ENABLED,
    WhatsAppReadOnlyConnector,
    assert_send_blocked,
    hash_phone,
)
from customer_gateway.whatsapp_readonly_sync import sync_readonly

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_whatsapp_chat.txt"


class WhatsAppConnectorReadonlyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")

    def test_send_disabled(self) -> None:
        self.assertFalse(SEND_ENABLED)
        conn = WhatsAppReadOnlyConnector()
        with self.assertRaises(PermissionError):
            conn.send_message("hello")
        with self.assertRaises(PermissionError):
            conn.auto_reply("hello")

    def test_phone_hash_masked(self) -> None:
        h = hash_phone("+233540911111", "Ghana Motors")
        self.assertEqual(len(h), 16)
        self.assertNotIn("233", h)

    def test_sync_readonly_after_import(self) -> None:
        from customer_gateway.whatsapp_importer import import_whatsapp_txt

        import_whatsapp_txt(FIXTURE)
        result = sync_readonly()
        self.assertTrue(result.get("ok"))
        self.assertGreater(result.get("messages_synced", 0), 0)

    def test_assert_send_blocked(self) -> None:
        with self.assertRaises(PermissionError):
            assert_send_blocked("whatsapp_send")


if __name__ == "__main__":
    unittest.main()
