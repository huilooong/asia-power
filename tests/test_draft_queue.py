"""Tests for draft queue."""

import tempfile
import unittest
from pathlib import Path

from customer_gateway.draft_queue import (
    approve_draft,
    format_draft_detail,
    list_drafts,
    load_draft,
    reject_draft,
    revise_draft,
    save_draft,
)
from customer_gateway.gateway_readonly import reconfigure_paths


class DraftQueueTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_paths(Path(self.tmp.name) / "gateway")

    def _sample_draft(self) -> dict:
        return save_draft({
            "customer_hash": "hash123",
            "customer_name": "Test Buyer",
            "detected_language": "en",
            "original_message": "Need G4KJ",
            "internal_analysis_zh": "- 买方需求：G4KJ",
            "customer_reply_draft": "Thank you for your enquiry.",
            "risk_level": "medium",
            "approval_required": True,
            "next_action": "contact_today",
            "category": "availability_check",
        })

    def test_save_and_list(self) -> None:
        d = self._sample_draft()
        drafts = list_drafts()
        self.assertEqual(len(drafts), 1)
        self.assertEqual(drafts[0]["draft_id"], d["draft_id"])

    def test_show_detail(self) -> None:
        d = self._sample_draft()
        detail = format_draft_detail(load_draft(d["draft_id"]) or {})
        self.assertIn("中文内部分析", detail)
        self.assertIn("未发送", detail)

    def test_approve_does_not_send(self) -> None:
        d = self._sample_draft()
        approved = approve_draft(d["draft_id"])
        self.assertEqual(approved["status"], "approved")
        self.assertIn("未发送", format_draft_detail(approved))

    def test_reject_and_revise(self) -> None:
        d = self._sample_draft()
        rejected = reject_draft(d["draft_id"])
        self.assertEqual(rejected["status"], "rejected")
        d2 = self._sample_draft()
        revised = revise_draft(d2["draft_id"], "请补充港口信息")
        self.assertEqual(revised["status"], "revised")
        self.assertIn("港口", revised["revision_note"])


if __name__ == "__main__":
    unittest.main()
