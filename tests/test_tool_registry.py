"""Tests for Tool Registry and permission gates."""

import tempfile
import unittest
from pathlib import Path

from audit.logger import reconfigure_audit_dir
from tools import memory_tool
from tools.registry import ToolContext, bootstrap_registry, get_tool, list_tools, run_tool
from tools.tool_base import Permission


class ToolRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        memory_tool.reconfigure_paths(Path(self.tmp.name) / "memory")
        reconfigure_audit_dir(Path(self.tmp.name) / "audit")
        bootstrap_registry()

    def test_registry_lists_tools(self) -> None:
        out = list_tools()
        self.assertIn("vin", out)
        self.assertIn("git", out)
        self.assertIn("deploy", out)
        self.assertIn("inventory", out)

    def test_get_tool(self) -> None:
        self.assertIsNotNone(get_tool("git"))
        self.assertIsNone(get_tool("nonexistent_xyz"))

    def test_git_status(self) -> None:
        result = run_tool("git", "status", [], ctx=ToolContext())
        self.assertTrue(result.ok)
        self.assertIn("git", result.output.lower() + result.tool_name)

    def test_deploy_dry_run(self) -> None:
        result = run_tool("deploy", "dry-run", [], ctx=ToolContext())
        self.assertTrue(result.ok)
        self.assertTrue(result.dry_run)
        self.assertIn("DRY RUN", result.output.upper().replace("-", " "))

    def test_deploy_run_blocked_without_approval(self) -> None:
        result = run_tool("deploy", "run", [], ctx=ToolContext(ceo_approved=False), dry_run=False)
        self.assertFalse(result.ok)
        self.assertEqual(result.risk_level, "critical")
        self.assertTrue(
            "CRITICAL" in result.output
            or "approval" in result.output.lower()
            or "permission denied" in result.output.lower()
        )

    def test_deploy_run_with_approval_still_blocked_in_v06(self) -> None:
        result = run_tool("deploy", "run", ["approved"], ctx=ToolContext(), dry_run=False)
        self.assertFalse(result.ok)
        self.assertIn("blocked", result.output.lower())

    def test_vin_lookup_not_configured(self) -> None:
        result = run_tool("vin", "lookup", ["LFMAY86C3K0406545"], ctx=ToolContext())
        self.assertIn("LFMAY86C3K0406545", result.output)

    def test_inventory_search(self) -> None:
        result = run_tool("inventory", "search", ["HR15DE"], ctx=ToolContext())
        self.assertTrue(result.ok)

    def test_permission_deploy_requires_dry_run_or_approval(self) -> None:
        tool = get_tool("deploy")
        self.assertEqual(tool.permission, Permission.DEPLOY)

    def test_whatsapp_send_blocked(self) -> None:
        result = run_tool(
            "whatsapp", "send", ["Hello buyer"],
            ctx=ToolContext(ceo_approved=False),
            dry_run=False,
        )
        self.assertFalse(result.ok)

    def test_tool_call_logs_daily(self) -> None:
        run_tool("git", "status", [], ctx=ToolContext(channel="test"))
        log = memory_tool.list_daily_log()
        self.assertIn("tool=git", log)


if __name__ == "__main__":
    unittest.main()
