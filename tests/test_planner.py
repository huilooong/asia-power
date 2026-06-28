"""Tests for COO Planner."""

import tempfile
import unittest
from pathlib import Path

from coo_core.planner import create_plan, materialize_plan
from tools import task_tool


class PlannerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        task_tool.DATA_DIR = Path(self.tmp.name)
        task_tool.TASKS_FILE = task_tool.DATA_DIR / "tasks.json"

    def test_vin_tool_plan(self) -> None:
        plan = create_plan("Build VIN Tool")
        self.assertEqual(plan["template"], "vin")
        self.assertGreaterEqual(len(plan["tasks"]), 4)
        self.assertIn("memory_tool", plan["required_tools"])
        self.assertTrue(plan["approval_required"])

    def test_inventory_plan(self) -> None:
        plan = create_plan("Build Inventory Tool")
        self.assertEqual(plan["template"], "inventory")
        titles = [t["title"] for t in plan["tasks"]]
        self.assertTrue(any("schema" in t.lower() for t in titles))

    def test_whatsapp_plan(self) -> None:
        plan = create_plan("WhatsApp integration")
        self.assertEqual(plan["template"], "whatsapp")
        self.assertTrue(plan["approval_required"])

    def test_default_plan(self) -> None:
        plan = create_plan("Improve COO autonomy")
        self.assertEqual(plan["template"], "default")
        self.assertEqual(len(plan["phases"]), 5)

    def test_materialize_creates_tasks(self) -> None:
        plan = create_plan("Build VIN Tool")
        created = materialize_plan(plan)
        self.assertEqual(len(created), len(plan["tasks"]))
        self.assertEqual(task_tool.summarize_tasks()["total"], len(created))


if __name__ == "__main__":
    unittest.main()
