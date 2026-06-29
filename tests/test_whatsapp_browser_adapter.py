"""Tests for Playwright WhatsApp browser adapter (mocked — no real login)."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.whatsapp_browser_adapter import (
    BROWSER_CONNECTOR,
    WhatsAppBrowserAdapter,
    playwright_available,
)
from customer_gateway.whatsapp_live_adapter import (
    BrowserAdapterError,
    resolve_adapter,
    resolve_adapter_resolution,
)
from customer_gateway.whatsapp_safety import SafetyError


class WhatsAppBrowserAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.session = Path(self.tmp.name) / "session"
        self.env = {
            "WHATSAPP_SESSION_DIR": str(self.session),
            "WHATSAPP_LIVE_INBOX": str(Path(self.tmp.name) / "inbox"),
            "WHATSAPP_LIVE_ADAPTER": "browser",
            "WHATSAPP_BROWSER_HEADLESS": "true",
        }

    def test_adapter_class_exists(self) -> None:
        adapter = WhatsAppBrowserAdapter()
        self.assertEqual(adapter.name, "browser")

    def test_uses_session_dir(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            adapter = WhatsAppBrowserAdapter()
            self.assertEqual(adapter.session_dir(), self.session)
            profile = adapter.browser_profile_path()
        self.assertTrue(str(profile).endswith("browser_profile"))

    def test_readonly_flags_in_status(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            adapter = WhatsAppBrowserAdapter()
            status = adapter.status()
        self.assertTrue(status["readonly"])
        self.assertFalse(status["send_enabled"])
        self.assertFalse(status["mark_read_enabled"])

    def test_write_actions_blocked(self) -> None:
        adapter = WhatsAppBrowserAdapter()
        for method in (
            "send_message", "reply_message", "type_message", "click_send",
            "delete_message", "mark_read", "archive_chat", "star_message",
            "call_contact",
        ):
            with self.subTest(method=method):
                with self.assertRaises(SafetyError):
                    getattr(adapter, method)()

    def test_normalized_message_format(self) -> None:
        adapter = WhatsAppBrowserAdapter()
        raw = [{
            "contact_name": "Test Buyer",
            "chat_id_raw": "233123456789",
            "message": "Do you have G4KJ engine?",
            "timestamp": "2024-06-28 10:00",
        }]
        msgs = adapter._normalize_batch(raw)
        self.assertEqual(len(msgs), 1)
        data = msgs[0].to_inbox_json()
        self.assertEqual(data["source"], "whatsapp_business_app")
        self.assertEqual(data["connector"], BROWSER_CONNECTOR)
        self.assertEqual(data["direction"], "incoming")
        self.assertNotIn("233", data["phone_number_hash"])

    def test_browser_requested_raises_when_playwright_unavailable(self) -> None:
        with mock.patch.dict("os.environ", {**self.env, "WHATSAPP_LIVE_ADAPTER": "browser"}):
            with mock.patch(
                "customer_gateway.whatsapp_browser_adapter.playwright_available",
                return_value=False,
            ):
                with self.assertRaises(BrowserAdapterError):
                    resolve_adapter_resolution("auto")

    def test_connect_success_with_mocked_playwright(self) -> None:
        fake_page = mock.MagicMock()

        with mock.patch.dict("os.environ", self.env):
            with mock.patch(
                "customer_gateway.whatsapp_browser_adapter.playwright_available",
                return_value=True,
            ):
                with mock.patch.object(WhatsAppBrowserAdapter, "_launch", return_value=fake_page):
                    with mock.patch.object(WhatsAppBrowserAdapter, "_wait_for_login", return_value=True):
                        with mock.patch.object(WhatsAppBrowserAdapter, "close"):
                            adapter = WhatsAppBrowserAdapter()
                            result = adapter.connect()

        self.assertTrue(result["ok"])
        self.assertTrue(result["logged_in"])

    def test_fetch_messages_with_mocked_store(self) -> None:
        fake_page = mock.MagicMock()
        store_payload = [{
            "contact_name": "Ghana Motors",
            "chat_id_raw": "233540911111",
            "message": "Do you have G4KJ engine?",
            "timestamp": "2024-06-28 10:00",
            "direction": "incoming",
        }]

        with mock.patch.dict("os.environ", self.env):
            with mock.patch(
                "customer_gateway.whatsapp_browser_adapter.playwright_available",
                return_value=True,
            ):
                with mock.patch.object(WhatsAppBrowserAdapter, "_launch", return_value=fake_page):
                    with mock.patch.object(WhatsAppBrowserAdapter, "_wait_for_login", return_value=True):
                        with mock.patch.object(
                            WhatsAppBrowserAdapter, "_read_messages", return_value=store_payload,
                        ):
                            with mock.patch.object(WhatsAppBrowserAdapter, "close"):
                                adapter = WhatsAppBrowserAdapter()
                                msgs = adapter.fetch_new_messages()

        self.assertEqual(len(msgs), 1)
        self.assertEqual(msgs[0].connector, BROWSER_CONNECTOR)
        self.assertIn("G4KJ", msgs[0].message)

    def test_playwright_available_is_boolean(self) -> None:
        self.assertIsInstance(playwright_available(), bool)


if __name__ == "__main__":
    unittest.main()
