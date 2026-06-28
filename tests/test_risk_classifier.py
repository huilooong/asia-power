"""Tests for risk classifier and approval gate."""

import unittest

from safety.approval_gate import check_approval
from safety.risk_classifier import classify_tool_risk
from tools.tool_base import Permission


class RiskClassifierTests(unittest.TestCase):
    def test_read_only_low(self) -> None:
        self.assertEqual(
            classify_tool_risk("git", "status", Permission.READ_ONLY, dry_run=False),
            "low",
        )

    def test_deploy_run_critical(self) -> None:
        self.assertEqual(
            classify_tool_risk("deploy", "run", Permission.DEPLOY, dry_run=False),
            "critical",
        )

    def test_deploy_dry_run_medium(self) -> None:
        self.assertEqual(
            classify_tool_risk("deploy", "dry-run", Permission.DEPLOY, dry_run=True),
            "medium",
        )

    def test_critical_blocked_without_approval(self) -> None:
        ok, reason = check_approval("deploy", "run", "critical", ceo_approved=False)
        self.assertFalse(ok)
        self.assertIn("CRITICAL", reason)

    def test_critical_allowed_with_approval(self) -> None:
        ok, _ = check_approval("deploy", "run", "critical", ceo_approved=True)
        self.assertTrue(ok)

    def test_low_allowed(self) -> None:
        ok, _ = check_approval("git", "status", "low", ceo_approved=False)
        self.assertTrue(ok)


if __name__ == "__main__":
    unittest.main()
