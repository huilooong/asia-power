"""Tests for COO Reporter."""

import tempfile
import unittest
from pathlib import Path

from coo_core import reporter
from tools import memory_tool, task_tool


class ReporterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)

        task_tool.DATA_DIR = root / "data"
        task_tool.TASKS_FILE = task_tool.DATA_DIR / "tasks.json"
        memory_tool.reconfigure_paths(root / "memory")
        reporter.REPORTS_DIR = root / "reports"

        task_tool.create_task("Pending task", owner_agent="coo")
        t2 = task_tool.create_task("Done task", owner_agent="sales")
        task_tool.complete_task(t2["id"])
        memory_tool.save_decision("Test", "Because", "Use Memory Tool", owner="coo")

    def test_generates_daily_report_file(self) -> None:
        report = reporter.generate_daily_report()
        self.assertIn("COO Daily Report", report)
        self.assertIn("Pending task", report)
        self.assertIn("Done task", report)
        files = list(reporter.REPORTS_DIR.glob("daily_report_*.md"))
        self.assertEqual(len(files), 1)
        self.assertIn("Next recommended action", files[0].read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
