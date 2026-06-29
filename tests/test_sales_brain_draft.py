"""Tests for Sales Brain draft generator (APLIVE-003)."""

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from customer_gateway.gateway_readonly import reconfigure_paths
from customer_gateway.sales_message_classifier import classify_inbound_message
from sales_core.sales_brain_draft import build_sales_brain_draft


class SalesBrainDraftTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")

    def test_g4kj_draft_includes_asiapower_positioning(self) -> None:
        msg = "Do you have G4KJ engine?"
        clf = classify_inbound_message(msg, contact_name="Ghana Motors")
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OPENAI_API_KEY", None)
            draft = build_sales_brain_draft(
                msg,
                customer_name="Ghana Motors",
                customer_hash="abc",
                detected_language="en",
                communication_language="en",
                classification=clf,
            )
        combined = (
            draft["internal_analysis_zh"] + draft["customer_reply_draft"]
        ).lower()
        self.assertEqual(draft["classification"], "customer_inquiry")
        self.assertIn("g4kj", combined)
        self.assertTrue(
            "hyundai" in combined or "kia" in combined or "china" in combined
        )
        self.assertTrue(
            "model" in combined or "year" in combined or "port" in combined
        )
        self.assertTrue(
            "photo" in combined or "video" in combined or "compression" in combined
        )

    def test_audit_fields_present(self) -> None:
        msg = "Do you have G4KJ engine?"
        clf = classify_inbound_message(msg, contact_name="Test")
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OPENAI_API_KEY", None)
            draft = build_sales_brain_draft(
                msg,
                customer_name="Test",
                customer_hash="x",
                detected_language="en",
                communication_language="en",
                classification=clf,
            )
        for field in (
            "classification", "confidence", "action", "reasoning_summary",
            "memory_write", "memory_reason",
        ):
            self.assertIn(field, draft)
        self.assertFalse(draft["memory_write"])


if __name__ == "__main__":
    unittest.main()
