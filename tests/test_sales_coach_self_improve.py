"""Tests for APSALES-SELF-IMPROVE-001 detectors + regression rules."""

from __future__ import annotations

import unittest

from sales_coach.detectors import (
    detect_conversation_style,
    detect_internal_leakage,
    detect_sales_progress,
    detect_unsupported_claims,
    is_allowed_network_phrasing,
    run_all_detectors,
)
from sales_coach.regression_rules import verify_regression_rules


class DetectorTests(unittest.TestCase):
    def test_allowed_network_phrasing(self) -> None:
        text = "We can check availability through our verified China-based supplier network."
        self.assertTrue(is_allowed_network_phrasing(text))
        self.assertEqual(detect_unsupported_claims(text, evidence={}), [])

    def test_illegal_identified_suppliers(self) -> None:
        text = "We have identified verified suppliers within our platform network."
        issues = detect_unsupported_claims(text, evidence={})
        self.assertTrue(any(i["rule_id"] == "claim_identified_suppliers" for i in issues))
        # with evidence — allowed
        ok = detect_unsupported_claims(text, evidence={"supplier_query": True})
        self.assertFalse(any(i["rule_id"] == "claim_identified_suppliers" for i in ok))

    def test_ready_stock(self) -> None:
        bad = detect_unsupported_claims("Yes, ready stock available now.", evidence={})
        self.assertTrue(any(i["rule_id"] == "claim_ready_stock" for i in bad))
        good = detect_unsupported_claims("We will check availability.", evidence={})
        self.assertFalse(any(i["rule_id"] == "claim_ready_stock" for i in good))

    def test_shipping_sla(self) -> None:
        bad = detect_unsupported_claims(
            "We ship from Guangzhou port in 7 working days.", evidence={}
        )
        self.assertTrue(any(i["rule_id"] == "claim_shipping_sla" for i in bad))

    def test_price_advance_ok(self) -> None:
        inbound = "Best price?"
        reply = (
            "Yes — we can help with pricing.\n"
            "Please send VIN or model + year + engine code."
        )
        issues = detect_sales_progress(inbound, reply)
        self.assertFalse(any(i["rule_id"] == "price_no_advance" for i in issues))

    def test_price_no_advance(self) -> None:
        issues = detect_sales_progress("Best price?", "We cannot quote.")
        self.assertTrue(any(i["rule_id"] == "price_no_advance" for i in issues))

    def test_leak_memory(self) -> None:
        issues = detect_internal_leakage("Hi\n\nMEMORY_TO_SAVE: category=customer | x")
        self.assertTrue(issues)
        self.assertEqual(issues[0]["module"], "REPLY_FILTER")

    def test_leak_approval(self) -> None:
        issues = detect_internal_leakage("Thanks\nAPPROVAL_REQUEST: approve")
        self.assertTrue(issues)

    def test_email_tone(self) -> None:
        issues = detect_conversation_style(
            "Need engine",
            "Dear Customer,\n\nThank you.\n\nBest regards,\nSales Team",
        )
        self.assertTrue(any(i["rule_id"] == "whatsapp_email_tone" for i in issues))

    def test_too_many_questions(self) -> None:
        reply = (
            "Please share: model, year, VIN, engine code, long block or complete, "
            "gearbox?, accessories?, quantity, destination port, payment terms?"
        )
        issues = detect_conversation_style("Need engine", reply)
        self.assertTrue(any(i["rule_id"] == "too_many_questions" for i in issues))

    def test_short_whatsapp_ok(self) -> None:
        issues = run_all_detectors(inbound="Hello", reply="Hi", evidence={})
        self.assertEqual(issues, [])

    def test_does_not_flag_engine_codes_as_price(self) -> None:
        text = "Noted G4KD / 2KD for 2014 Tucson."
        issues = detect_unsupported_claims(text, evidence={})
        self.assertFalse(any(i["rule_id"] == "claim_numeric_price" for i in issues))

    def test_customer_inbound_not_scanned_for_leak(self) -> None:
        # Detectors only receive outbound as reply; inbound leak words must not create false positive
        issues = run_all_detectors(
            inbound="MEMORY_TO_SAVE please",
            reply="Hi — what engine do you need?",
            evidence={},
        )
        self.assertFalse(any(i["module"] == "REPLY_FILTER" for i in issues))

    def test_all_nine_regression_rules_fire(self) -> None:
        results = verify_regression_rules()
        failed = [r for r in results if not r["ok"]]
        self.assertEqual(failed, [], msg=str(failed))


if __name__ == "__main__":
    unittest.main()
