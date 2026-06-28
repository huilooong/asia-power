"""Tests for APSales platform GMV alignment (APAG-001A)."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from agents.profile_loader import load_profile
from coo_core import constitution_loader as cl
from coo_core.dispatcher import dispatch_message
from sales_core.apsales_handler import (
    build_apsales_enquiry_prompt,
    enforce_supply_language,
    parse_sales_message,
    process_apsales_enquiry,
)
from sales_core.platform_supply import extract_product_keywords, supply_phrase
from tools import memory_tool


class APSalesPlatformTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        memory_tool.reconfigure_paths(Path(self.tmp.name) / "memory")

    def test_role_platform_gmv(self) -> None:
        role = cl.load_role("apsales")
        self.assertIn("Platform GMV", role)
        self.assertIn("Do not assume", role)

    def test_profile_kpi(self) -> None:
        profile = load_profile("apsales")
        kpis = profile.get("kpi", [])
        self.assertIn("platform_gmv_growth", kpis)
        self.assertIn("matched_supplier_inventory", kpis)

    def test_enquiry_prompt_internal_sections(self) -> None:
        profile = load_profile("apsales")
        with mock.patch(
            "sales_core.apsales_handler.check_inventory_for_enquiry",
            return_value=(False, "no match"),
        ):
            prompt = build_apsales_enquiry_prompt("Do you have G4KJ?", profile)
        self.assertIn("买方需求", prompt)
        self.assertIn("潜在供应商匹配", prompt)
        self.assertIn("库存归属状态", prompt)
        self.assertIn("平台机会", prompt)
        self.assertIn("verified China-based supplier network", prompt)

    def test_fallback_no_stock_claim(self) -> None:
        with mock.patch.dict("os.environ", {}, clear=True):
            out = process_apsales_enquiry("Do you have G4KJ engine in stock?")
        self.assertIn("买方需求", out)
        self.assertIn("平台机会", out)
        self.assertIn("库存归属状态", out)
        self.assertIn("verified", out.lower())
        self.assertNotIn("we have stock", out.lower())

    def test_enforce_supply_language(self) -> None:
        bad = "【客户草稿】\nYes, we have stock ready to ship."
        fixed = enforce_supply_language(bad, inventory_hit=False, lang="en")
        self.assertNotIn("we have stock", fixed.lower())
        self.assertIn("supplier network", fixed.lower())

    def test_sales_cli_routing(self) -> None:
        with mock.patch.dict("os.environ", {}, clear=True):
            out = dispatch_message(
                "/sales customer: Do you have G4KJ engine?",
                source="cli",
                agent_id="apsales",
            )
        self.assertIn("平台机会", out)
        self.assertIn("supplier network", out.lower())

    def test_parse_sales_message(self) -> None:
        self.assertEqual(
            parse_sales_message("/sales customer: Need G4KD"),
            "Need G4KD",
        )

    def test_crm_platform_fields(self) -> None:
        import tools.crm_tool as crm
        crm.CUSTOMERS_DIR = Path(self.tmp.name) / "customers"
        crm.PIPELINE_FILE = Path(self.tmp.name) / "pipeline.md"
        crm.save_customer_record(
            "Test Buyer",
            buyer_or_supplier="buyer",
            demand_type="engine",
            matched_inventory_status="unchecked",
            platform_value="gmv_lead",
        )
        text = crm.get_customer_summary("Test Buyer")
        self.assertIn("Buyer or Supplier", text)
        self.assertIn("Platform Value", text)

    def test_extract_g4kj(self) -> None:
        self.assertIn("G4KJ", extract_product_keywords("Do you have G4KJ engine?"))


if __name__ == "__main__":
    unittest.main()
