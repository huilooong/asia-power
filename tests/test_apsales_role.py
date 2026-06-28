"""Tests for APSales role and profile."""

import unittest

from agents.profile_loader import load_profile
from coo_core import constitution_loader as cl


class APSalesRoleTests(unittest.TestCase):
    def test_apsales_role_loads(self) -> None:
        role = cl.load_role("apsales")
        self.assertIn("APSALES-001", role)
        self.assertIn("APCOO", role)
        self.assertIn("GMV", role)

    def test_apsales_profile(self) -> None:
        profile = load_profile("apsales")
        self.assertEqual(profile.get("agent_id"), "apsales")
        self.assertEqual(profile.get("reports_to"), "apcoo")
        self.assertIn("en", profile.get("supported_languages", []))

    def test_constitution_context_apsales(self) -> None:
        ctx = cl.build_constitution_context_for_agent("apsales")
        self.assertIn("APSALES-001", ctx)
        self.assertIn("循环资产", ctx)

    def test_role_mapping(self) -> None:
        self.assertEqual(cl.role_id_for_agent("apsales"), "apsales")
        self.assertEqual(cl.role_id_for_agent("sales"), "apsales")


if __name__ == "__main__":
    unittest.main()
