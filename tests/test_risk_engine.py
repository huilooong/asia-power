"""Tests for Constitution risk engine (APLIVE-004)."""

import unittest

from core.constitution_runtime import score_risk


class RiskEngineTests(unittest.TestCase):
    def test_low_risk_enquiry(self) -> None:
        risk = score_risk(
            intent="enquiry",
            classification="customer_inquiry",
            inventory_confidence=0.92,
            pricing_confidence=0.8,
            message="Do you have G4KJ engine?",
        )
        self.assertEqual(risk["risk_level"], "low")

    def test_high_risk_price_request(self) -> None:
        risk = score_risk(
            intent="price_request",
            classification="customer_inquiry",
            inventory_confidence=0.45,
            pricing_confidence=0.4,
            message="Confirm final price USD 5000",
            draft_text="Final price is $5000",
        )
        self.assertIn(risk["risk_level"], ("high", "critical"))
        self.assertTrue(risk["approval_required"])

    def test_critical_payment_block(self) -> None:
        risk = score_risk(
            intent="payment",
            classification="customer_inquiry",
            inventory_confidence=0.5,
            pricing_confidence=0.5,
            message="TT payment received please ship",
        )
        self.assertEqual(risk["risk_level"], "critical")
        self.assertFalse(risk["allowed"])


if __name__ == "__main__":
    unittest.main()
