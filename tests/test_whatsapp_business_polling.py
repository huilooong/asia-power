"""Tests for WhatsApp Business polling → inbox → drafts."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.draft_queue import list_drafts
from customer_gateway.gateway_readonly import reconfigure_paths
from customer_gateway.whatsapp_business_polling import format_poll_result, poll_readonly
from customer_gateway.whatsapp_live_readonly import listen_readonly


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_live_inbound.json"


class WhatsAppBusinessPollingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        base = Path(self.tmp.name)
        reconfigure_paths(base / "gateway")
        from customer_gateway.conversation_paths import reconfigure_paths as reconfigure_conv_paths
        reconfigure_conv_paths(base / "memory")
        self.inbox = base / "inbox"
        self.session = base / "session"
        self.inbox.mkdir()
        self.session.mkdir()
        self.env = {
            "WHATSAPP_LIVE_INBOX": str(self.inbox),
            "WHATSAPP_SESSION_DIR": str(self.session),
            "WHATSAPP_CONNECTOR_MODE": "mock",
            "WHATSAPP_LIVE_ADAPTER": "mock",
            "WHATSAPP_MOCK_SAMPLE_FILE": str(FIXTURE),
        }

    def test_poll_writes_inbox_json(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            result = poll_readonly()
        self.assertTrue(result["ok"])
        self.assertGreaterEqual(result["new_messages"], 1)
        files = list(self.inbox.glob("*.json"))
        self.assertGreaterEqual(len(files), 1)
        data = json.loads(files[0].read_text(encoding="utf-8"))
        self.assertEqual(data["source"], "whatsapp_business_app")
        self.assertEqual(data["connector"], "business_web_readonly")

    def test_poll_then_listen_creates_draft(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            with mock.patch(
                "customer_gateway.approval_notification.notify_new_draft",
                side_effect=lambda d: d,
            ):
                poll_result = poll_readonly()
                listen_result = listen_readonly()
        self.assertTrue(poll_result["ok"])
        self.assertTrue(listen_result["ok"])
        drafts = list_drafts()
        self.assertGreaterEqual(len(drafts), 1)

    def test_format_poll_result_chinese(self) -> None:
        with mock.patch.dict("os.environ", self.env):
            result = poll_readonly()
            text = format_poll_result(result)
        self.assertIn("轮询", text)
        self.assertIn("未发送", text)


if __name__ == "__main__":
    unittest.main()
