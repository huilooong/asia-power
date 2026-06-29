"""Tests for APLIVE-003 sales message classifier."""

import unittest

from customer_gateway.inbound_message_router import route_inbound_message
from customer_gateway.sales_message_classifier import (
    classify_inbound_message,
    should_generate_draft,
)
from customer_gateway.whatsapp_live_readonly import InboundMessage


class SalesMessageClassifierTests(unittest.TestCase):
    def test_g4kj_customer_inquiry_generates_draft(self) -> None:
        result = classify_inbound_message(
            "Do you have G4KJ engine?",
            contact_name="Ghana Motors",
        )
        self.assertEqual(result.classification, "customer_inquiry")
        self.assertEqual(result.action, "generate_draft")
        self.assertTrue(should_generate_draft(result))

    def test_wheelsky_system_notification_ignored(self) -> None:
        result = classify_inbound_message(
            "Wheelsky 14 Inch Wheels trending products needs your attention",
            contact_name="Wheelsky",
        )
        self.assertIn(result.classification, ("system_notification", "marketing_spam"))
        self.assertEqual(result.action, "ignore")
        self.assertFalse(should_generate_draft(result))

    def test_private_contact_ignored(self) -> None:
        result = classify_inbound_message("晚上回家吃饭吗", contact_name="老婆")
        self.assertEqual(result.classification, "private_message")
        self.assertEqual(result.action, "ignore")

    def test_supplier_message_no_sales_draft(self) -> None:
        result = classify_inbound_message(
            "工厂今天有 G4KJ 库存确认，可以供货",
            contact_name="Guangzhou Supplier Factory",
        )
        self.assertEqual(result.classification, "supplier_message")
        self.assertEqual(result.action, "ignore")

    def test_router_skips_ignored_messages(self) -> None:
        import tempfile
        from pathlib import Path
        from unittest import mock

        from customer_gateway.gateway_readonly import reconfigure_paths

        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        reconfigure_paths(Path(tmp.name) / "gateway")

        msg = InboundMessage(
            message_id="sys-1",
            chat_id="c1",
            contact_name="Wheelsky",
            customer_hash="h1",
            phone_number_hash="h1",
            timestamp="2024-06-28 10:00",
            message="Wheelsky trending products needs your attention",
        )
        with mock.patch("customer_gateway.approval_notification.notify_new_draft"):
            draft = route_inbound_message(msg)
        self.assertIsNone(draft)


if __name__ == "__main__":
    unittest.main()
