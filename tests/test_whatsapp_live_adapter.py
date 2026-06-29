"""Tests for WhatsApp live adapter interface."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.whatsapp_live_adapter import (
    MockLiveAdapter,
    BrowserLiveAdapter,
    normalize_incoming,
    resolve_adapter,
)


class WhatsAppLiveAdapterTests(unittest.TestCase):
    def test_normalize_incoming_fields(self) -> None:
        msg = normalize_incoming(
            contact_name="Test Buyer",
            message="Need G4KJ engine",
            timestamp="2024-06-28 10:00",
            phone_hint="233123456789",
        )
        self.assertEqual(msg.source, "whatsapp_business_app")
        self.assertEqual(msg.connector, "business_web_readonly")
        self.assertEqual(msg.direction, "incoming")
        self.assertTrue(msg.phone_number_hash)
        self.assertNotIn("233", msg.phone_number_hash)

    def test_mock_adapter_sample_file(self) -> None:
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
        tmp.write(json.dumps([{
            "contact_name": "Fixture Co",
            "message": "Price for G4KJ?",
            "timestamp": "2024-06-28 11:00",
            "direction": "incoming",
        }]))
        tmp.close()
        self.addCleanup(lambda: Path(tmp.name).unlink(missing_ok=True))

        adapter = MockLiveAdapter(sample_path=Path(tmp.name))
        adapter.connect()
        msgs = adapter.fetch_new_messages()
        self.assertEqual(len(msgs), 1)
        self.assertEqual(msgs[0].contact_name, "Fixture Co")

    def test_resolve_adapter_mock_mode(self) -> None:
        with mock.patch.dict("os.environ", {"WHATSAPP_CONNECTOR_MODE": "mock"}):
            adapter = resolve_adapter("mock")
        self.assertEqual(adapter.name, "mock")

    def test_browser_adapter_unavailable_without_deps(self) -> None:
        adapter = BrowserLiveAdapter()
        if not adapter.is_available():
            result = adapter.connect()
            self.assertFalse(result.get("ok"))

    def test_inbox_json_format(self) -> None:
        msg = normalize_incoming(
            contact_name="Buyer",
            message="Hello",
            timestamp="2024-01-01 12:00",
        )
        data = msg.to_inbox_json()
        required = {
            "source", "connector", "chat_id", "contact_name",
            "phone_number_hash", "message", "timestamp", "direction",
            "detected_language", "sync_time",
        }
        self.assertTrue(required.issubset(data.keys()))


if __name__ == "__main__":
    unittest.main()
