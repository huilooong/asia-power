"""Tests for Message Tool."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tools import message_tool


class MessageToolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        message_tool.DATA_DIR = Path(self.tmp.name)
        message_tool.MESSAGE_LOG = message_tool.DATA_DIR / "message_log.jsonl"

    def test_log_message_stores_summary(self) -> None:
        long_text = "x" * 2000
        message_tool.log_message("telegram", "inbound", "12345", long_text, status="ok")
        rows = message_tool.read_message_log(channel="telegram")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["chat_id"], "12345")
        self.assertLessEqual(len(rows[0]["text_summary"]), 500)
        self.assertNotIn("x" * 1000, rows[0]["text_summary"])

    def test_safe_text_summary(self) -> None:
        summary = message_tool.safe_text_summary("hello world", max_chars=10)
        self.assertEqual(summary, "hello w...")

    def test_split_message(self) -> None:
        long_text = "line\n" * 3000
        chunks = message_tool.split_message(long_text, limit=100)
        self.assertGreater(len(chunks), 1)
        for chunk in chunks:
            self.assertLessEqual(len(chunk), 100)

    def test_coo_token_no_fallback(self) -> None:
        with mock.patch.dict("os.environ", {
            "COO_TELEGRAM_BOT_TOKEN": "",
            "ASIAPOWER_TELEGRAM_BOT_TOKEN": "other-token",
        }, clear=False):
            self.assertEqual(message_tool.coo_telegram_token(), "")

    @mock.patch("urllib.request.urlopen")
    def test_send_telegram_message(self, mock_urlopen) -> None:
        mock_resp = mock.MagicMock()
        mock_resp.read.return_value = json.dumps({"ok": True}).encode()
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        with mock.patch.dict("os.environ", {"COO_TELEGRAM_BOT_TOKEN": "coo-only-token"}):
            result = message_tool.send_telegram_message("999", "Hello CEO")
        self.assertTrue(result["ok"])


if __name__ == "__main__":
    unittest.main()
