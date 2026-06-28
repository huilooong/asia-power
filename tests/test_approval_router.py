"""Tests for approval routing."""

import tempfile
import unittest
from pathlib import Path

import audit.logger as audit_log
from agents.approval_router import (
    ApprovalLevel,
    ApprovalRequest,
    approval_route,
    can_execute,
    classify_action,
    format_ceo_approval_message,
    parse_ceo_reply,
    route_approval,
)
from audit.logger import reconfigure_audit_dir


class ApprovalRouterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_audit_dir(Path(self.tmp.name))

    def test_classify_critical(self) -> None:
        self.assertEqual(classify_action("delivery_commitment"), ApprovalLevel.CRITICAL)

    def test_classify_medium(self) -> None:
        self.assertEqual(classify_action("final_quote"), ApprovalLevel.MEDIUM)

    def test_route_medium_to_ceo(self) -> None:
        self.assertEqual(approval_route(ApprovalLevel.MEDIUM), "ceo_telegram")

    def test_route_high_to_apcoo(self) -> None:
        self.assertEqual(approval_route(ApprovalLevel.HIGH), "apcoo_then_ceo")

    def test_critical_blocked_without_approval(self) -> None:
        self.assertFalse(can_execute(ApprovalLevel.CRITICAL, approved=False))

    def test_critical_needs_apcoo_and_ceo(self) -> None:
        self.assertFalse(can_execute(ApprovalLevel.CRITICAL, approved=True, apcoo_reviewed=False))
        self.assertTrue(can_execute(ApprovalLevel.CRITICAL, approved=True, apcoo_reviewed=True))

    def test_route_approval_blocked(self) -> None:
        req = ApprovalRequest(action="final_quote", customer="ABC Ghana", product="G4KJ")
        result = route_approval(req)
        self.assertTrue(result["blocked_until_approval"])
        self.assertIn("APSales Approval Request", result["ceo_message"])

    def test_ceo_message_format(self) -> None:
        req = ApprovalRequest(
            customer="ABC Trading Ghana",
            product="Hyundai G4KJ Engine",
            recommended_quote="USD xxxx",
            reason="Buyer ready",
        )
        msg = format_ceo_approval_message(req, ApprovalLevel.MEDIUM)
        self.assertIn("ABC Trading Ghana", msg)
        self.assertIn("approved", msg)

    def test_parse_ceo_reply(self) -> None:
        self.assertEqual(parse_ceo_reply("approved")["status"], "approved")
        self.assertEqual(parse_ceo_reply("reject")["status"], "rejected")
        self.assertEqual(parse_ceo_reply("revise: lower price")["status"], "revise")


if __name__ == "__main__":
    unittest.main()
