"""Tests for inbound message router."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.gateway_readonly import reconfigure_paths
from customer_gateway.inbound_message_router import route_inbound_message
from customer_gateway.whatsapp_live_readonly import InboundMessage


class InboundMessageRouterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")

    def test_route_creates_structured_draft(self) -> None:
        msg = InboundMessage(
            message_id="test-msg-1",
            chat_id="chat1",
            contact_name="Ghana Motors",
            customer_hash="abc123",
            phone_number_hash="abc123",
            timestamp="2024-03-15 10:00",
            message="Do you have G4KJ engine price?",
        )
        with mock.patch(
            "customer_gateway.approval_notification.notify_new_draft",
            side_effect=lambda d: d,
        ):
            draft = route_inbound_message(msg)
        self.assertIsNotNone(draft)
        assert draft is not None
        for field in (
            "draft_id",
            "customer_hash",
            "customer_name",
            "detected_language",
            "original_message",
            "internal_analysis_zh",
            "customer_reply_draft",
            "risk_level",
            "approval_required",
            "next_action",
            "created_at",
            "classification",
            "confidence",
            "action",
            "reasoning_summary",
            "memory_write",
            "memory_reason",
            "authority",
            "constitution_rule",
            "authority_check",
            "risk_score",
            "risk_reason",
            "decision_path",
        ):
            self.assertIn(field, draft)
        self.assertEqual(draft["customer_name"], "Ghana Motors")
        self.assertTrue(draft["approval_required"])


if __name__ == "__main__":
    unittest.main()
