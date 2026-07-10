"""Tests for APInventory agent (赵云/子龙)."""

from __future__ import annotations

import unittest
from unittest import mock

from agents.agent_registry import (
    is_supported_agent,
    normalize_agent_id,
    profile_id_for_agent,
    role_id_for_agent,
)
from agents.router import route_message
from coo_core.cli_router import resolve_agent_id
from coo_core.constitution_loader import build_constitution_context_for_agent
from inventory_core.apinventory_handler import (
    dispatch_apinventory_command,
    is_apinventory_command,
    is_inventory_natural_language,
)


class APInventoryRegistryTests(unittest.TestCase):
    def test_supported_agent(self) -> None:
        self.assertTrue(is_supported_agent("apinventory"))
        self.assertEqual(normalize_agent_id("inventory"), "apinventory")
        self.assertEqual(normalize_agent_id("子龙"), "apinventory")
        self.assertEqual(profile_id_for_agent("apinventory"), "apinventory")
        self.assertEqual(role_id_for_agent("apinventory"), "apinventory")

    def test_constitution_role_loads(self) -> None:
        ctx = build_constitution_context_for_agent("apinventory")
        self.assertIn("APINVENTORY-001", ctx)
        self.assertIn("Inventory", ctx)


class APInventoryRoutingTests(unittest.TestCase):
    def test_catalog_command_routes_to_apinventory(self) -> None:
        self.assertEqual(resolve_agent_id("/catalog search G4KJ"), "apinventory")

    def test_inventory_natural_language(self) -> None:
        self.assertTrue(is_inventory_natural_language("库存里有没有 G4KJ"))
        self.assertEqual(resolve_agent_id("库存里有没有 G4KJ"), "apinventory")

    def test_router_keyword_apinventory(self) -> None:
        self.assertEqual(route_message("赵云 查一下 HC25 库存"), "apinventory")

    def test_sales_still_apsales(self) -> None:
        self.assertEqual(resolve_agent_id("/sales-intelligence import"), "apsales")


class APInventoryHandlerTests(unittest.TestCase):
    def test_help_command(self) -> None:
        out = dispatch_apinventory_command("/help")
        self.assertIn("APInventory", out)
        self.assertIn("/catalog search", out)

    def test_catalog_search_deterministic(self) -> None:
        with mock.patch(
            "inventory_core.apinventory_handler.run_tool",
        ) as mock_tool:
            mock_tool.return_value.output = "Inventory search «G4KJ»: ok"
            out = dispatch_apinventory_command("/catalog search G4KJ")
        self.assertIn("G4KJ", out)
        mock_tool.assert_called_once()

    def test_zilong_row_upload_approval_routes(self) -> None:
        from coo_core.cli_router import resolve_agent_id

        msg = "子龙003 我已经确认没有问题可以上传了"
        self.assertEqual(resolve_agent_id(msg), "apinventory")

    def test_parse_qxb_row(self) -> None:
        from inventory_core.apinventory_handler import parse_qxb_row, is_qxb_upload_approval

        self.assertEqual(parse_qxb_row("子龙003 确认可以上传"), 3)
        self.assertEqual(parse_qxb_row("QXB0002 没问题"), 2)
        self.assertTrue(is_qxb_upload_approval("子龙003 我已经确认没有问题可以上传了"))

    def test_upload_approval_dispatches_process(self) -> None:
        from inventory_core.apinventory_handler import process_inventory_query

        with mock.patch(
            "inventory_core.apinventory_handler._dispatch_qxb_command",
        ) as mock_qxb:
            mock_qxb.return_value = "Uploaded row 3 → QXB0003"
            out = process_inventory_query("子龙003 我已经确认没有问题可以上传了")
        self.assertIn("QXB0003", out)
        mock_qxb.assert_called_once_with("process 3 --live approved", "cli")

    def test_is_apinventory_command(self) -> None:
        self.assertTrue(is_apinventory_command("/catalog search x"))
        self.assertFalse(is_apinventory_command("库存问题"))


class APInventoryDispatchTests(unittest.TestCase):
    def test_dispatch_catalog_via_cli(self) -> None:
        from coo_core.dispatcher import dispatch_message

        with mock.patch(
            "inventory_core.apinventory_handler.run_tool",
        ) as mock_tool:
            mock_tool.return_value.output = "hit"
            out = dispatch_message("/catalog search G4KD", agent_id="apinventory")
        self.assertIn("hit", out)


if __name__ == "__main__":
    unittest.main()
