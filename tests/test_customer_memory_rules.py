"""Tests for customer memory write rules (APLIVE-003)."""

import unittest

from customer_gateway.customer_memory_rules import evaluate_memory_write


class CustomerMemoryRulesTests(unittest.TestCase):
    def test_generic_inquiry_no_memory_write(self) -> None:
        result = evaluate_memory_write(
            "Do you have G4KJ engine?",
            contact_name="Ghana Motors",
            classification="customer_inquiry",
        )
        self.assertFalse(result["memory_write"])
        self.assertIn("draft context", result["memory_reason"])

    def test_country_and_terms_triggers_memory(self) -> None:
        result = evaluate_memory_write(
            "We need G4KJ for Accra port, FOB Tema, monthly order",
            contact_name="Ghana Motors Trading",
            classification="customer_inquiry",
        )
        self.assertTrue(result["memory_write"])


if __name__ == "__main__":
    unittest.main()
