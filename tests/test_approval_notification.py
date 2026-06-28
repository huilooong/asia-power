"""Tests for approval notification formatting."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.approval_notification import (
    format_draft_telegram_notification,
    notify_new_draft,
)
from customer_gateway.gateway_readonly import reconfigure_paths


class ApprovalNotificationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")

    def test_format_chinese_notification(self) -> None:
        draft = {
            "draft_id": "draft-test-001",
            "customer_name": "Ghana Motors",
            "category": "availability_check",
            "risk_level": "medium",
            "detected_language": "en",
            "approval_required": True,
            "next_action": "contact_today",
            "original_message": "Do you have G4KJ?",
            "internal_analysis_zh": "- 买方需求：G4KJ 发动机",
            "customer_reply_draft": "Thank you for your enquiry.",
        }
        text = format_draft_telegram_notification(draft)
        self.assertIn("只读", text)
        self.assertIn("未发送", text)
        self.assertIn("Ghana Motors", text)
        self.assertIn("/drafts approve", text)

    def test_notify_without_telegram_token(self) -> None:
        draft = {"draft_id": "d1", "customer_name": "X", "original_message": "hi"}
        with mock.patch.dict("os.environ", {}, clear=True):
            body = notify_new_draft(draft)
        self.assertIn("d1", body)
        self.assertIn("未发送", body)


if __name__ == "__main__":
    unittest.main()
