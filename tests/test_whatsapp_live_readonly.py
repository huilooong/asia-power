"""Tests for WhatsApp live read-only listener."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.draft_queue import list_drafts
from customer_gateway.gateway_readonly import reconfigure_paths
from customer_gateway.whatsapp_live_readonly import (
    InboundMessage,
    listen_readonly,
    listen_status,
    load_processed_ids,
    poll_inbound_inbox,
)


class WhatsAppLiveReadonlyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        base = Path(self.tmp.name) / "gateway"
        reconfigure_paths(base)
        self.inbox = Path(self.tmp.name) / "inbox"
        self.inbox.mkdir()

    def _drop_message(self, contact: str, message: str) -> None:
        path = self.inbox / "msg1.json"
        path.write_text(json.dumps({
            "contact_name": contact,
            "message": message,
            "timestamp": "2024-03-15 10:00",
            "phone_hint": "8616638801930",
        }), encoding="utf-8")

    def test_poll_inbox(self) -> None:
        self._drop_message("Ghana Motors", "Do you have G4KJ engine?")
        with mock.patch.dict("os.environ", {"WHATSAPP_LIVE_INBOX": str(self.inbox)}):
            msgs = poll_inbound_inbox()
        self.assertEqual(len(msgs), 1)
        self.assertEqual(msgs[0].contact_name, "Ghana Motors")

    def test_listen_creates_draft(self) -> None:
        self._drop_message("Ghana Motors", "Do you have G4KJ engine?")
        with mock.patch.dict("os.environ", {"WHATSAPP_LIVE_INBOX": str(self.inbox)}, clear=False):
            with mock.patch(
                "customer_gateway.approval_notification.notify_new_draft",
                side_effect=lambda d: d,
            ):
                result = listen_readonly()
        self.assertTrue(result["ok"])
        self.assertEqual(result["state"]["new_messages"], 1)
        self.assertEqual(result["state"]["drafts_created"], 1)
        drafts = list_drafts()
        self.assertEqual(len(drafts), 1)
        self.assertIn("G4KJ", drafts[0]["original_message"])

    def test_dedupe_processed(self) -> None:
        self._drop_message("Ghana Motors", "Same message")
        with mock.patch.dict("os.environ", {"WHATSAPP_LIVE_INBOX": str(self.inbox)}):
            with mock.patch(
                "customer_gateway.approval_notification.notify_new_draft",
                side_effect=lambda d: d,
            ):
                listen_readonly()
                second = listen_readonly()
        self.assertEqual(second["state"]["new_messages"], 0)
        self.assertGreater(len(load_processed_ids()), 0)

    def test_listen_status(self) -> None:
        status = listen_status()
        self.assertIn("只读", status)

    def test_write_blocked(self) -> None:
        from customer_gateway.whatsapp_live_readonly import enforce_write_blocked

        with self.assertRaises(PermissionError):
            enforce_write_blocked("whatsapp_send")


if __name__ == "__main__":
    unittest.main()
