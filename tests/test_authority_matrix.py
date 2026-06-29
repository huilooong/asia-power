"""Tests for authority matrix (APLIVE-004)."""

import unittest

from core.constitution_runtime import check_authority, load_authority_matrix


class AuthorityMatrixTests(unittest.TestCase):
    def test_sales_denied_send(self) -> None:
        self.assertFalse(check_authority("sales", "send"))

    def test_sales_allowed_draft(self) -> None:
        self.assertTrue(check_authority("sales", "draft"))

    def test_inventory_denied_modify(self) -> None:
        self.assertFalse(check_authority("inventory", "inventory_modify"))

    def test_inventory_allowed_lookup(self) -> None:
        self.assertTrue(check_authority("inventory", "inventory_lookup"))

    def test_ceo_allowed_all(self) -> None:
        self.assertTrue(check_authority("ceo", "send"))
        self.assertTrue(check_authority("ceo", "final_price_commit"))

    def test_matrix_loaded(self) -> None:
        matrix = load_authority_matrix()
        self.assertIn("sales", matrix.get("roles", {}))


if __name__ == "__main__":
    unittest.main()
