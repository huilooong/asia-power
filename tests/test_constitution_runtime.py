"""Tests for Constitution Runtime (APLIVE-004)."""

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from core.constitution_runtime import (
    apply_constitution_runtime,
    build_decision_path,
    check_authority,
    evaluate_draft,
    evaluate_inventory_policy,
    reconfigure_constitution_dir,
)


class ConstitutionRuntimeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        src = Path(__file__).resolve().parent.parent / "memory" / "constitution"
        dest = Path(self.tmp.name) / "constitution"
        shutil.copytree(src, dest)
        reconfigure_constitution_dir(dest)

    def test_low_inventory_confidence_never_promise(self) -> None:
        policy = evaluate_inventory_policy(0.45)
        self.assertEqual(policy["action"], "never_promise_inventory")
        draft = {
            "customer_reply_draft": "Yes, G4KJ is available in stock now.",
            "internal_analysis_zh": "test",
            "category": "availability_check",
            "classification": "customer_inquiry",
            "confidence": 0.9,
        }
        result = apply_constitution_runtime(
            draft,
            context={"inventory_confidence": 0.45, "message": "Do you have G4KJ?"},
        )
        self.assertNotIn("available in stock", result["customer_reply_draft"].lower())
        self.assertIn("supplier confirmation", result["customer_reply_draft"].lower())

    def test_high_risk_requires_ceo_approval(self) -> None:
        draft = {
            "customer_reply_draft": "Final price is $5000 FOB.",
            "internal_analysis_zh": "test",
            "category": "price_request",
            "classification": "customer_inquiry",
            "confidence": 0.85,
            "original_message": "What is final price?",
        }
        verdict = evaluate_draft(
            draft,
            context={
                "inventory_confidence": 0.4,
                "pricing_confidence": 0.4,
                "message": "What is final price?",
            },
        )
        self.assertIn(verdict.risk_level, ("high", "critical"))
        applied = apply_constitution_runtime(draft, context={
            "inventory_confidence": 0.4,
            "pricing_confidence": 0.4,
            "message": "What is final price?",
        })
        self.assertTrue(applied["approval_required"])

    def test_decision_path_generated(self) -> None:
        path = build_decision_path()
        self.assertIn("Classifier", path)
        self.assertIn("Sales Brain", path)
        self.assertIn("Constitution", path)
        self.assertIn("Draft", path)

    def test_apply_adds_audit_fields(self) -> None:
        draft = {
            "customer_reply_draft": "Thank you for your enquiry about G4KJ.",
            "internal_analysis_zh": "分析",
            "category": "enquiry",
            "classification": "customer_inquiry",
            "confidence": 0.92,
            "original_message": "Do you have G4KJ engine?",
        }
        result = apply_constitution_runtime(
            draft,
            context={"inventory_confidence": 0.92, "message": draft["original_message"]},
        )
        for field in (
            "constitution_rule",
            "authority_check",
            "risk_score",
            "risk_reason",
            "decision_path",
            "authority",
        ):
            self.assertIn(field, result)
            self.assertTrue(result[field] or result[field] == 0)

    def test_sales_send_denied_in_authority_check(self) -> None:
        self.assertFalse(check_authority("sales", "send"))


if __name__ == "__main__":
    unittest.main()
