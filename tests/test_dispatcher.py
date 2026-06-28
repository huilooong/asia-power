"""Tests for COO dispatcher."""

import tempfile
import unittest
from pathlib import Path

from coo_core.dispatcher import dispatch_coo_command, dispatch_message, is_coo_command
from tools import memory_tool, task_tool


class DispatcherTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        task_tool.DATA_DIR = Path(self.tmp.name)
        task_tool.TASKS_FILE = task_tool.DATA_DIR / "tasks.json"
        memory_tool.reconfigure_paths(Path(self.tmp.name) / "memory")

    def test_coo_commands(self) -> None:
        self.assertTrue(is_coo_command("/plan Build VIN Tool"))
        self.assertFalse(is_coo_command("hello"))

    def test_dispatch_plan(self) -> None:
        out = dispatch_message("/plan Build VIN Tool", source="cli")
        self.assertIn("Goal: Build VIN Tool", out)
        self.assertIn("Tasks:", out)

    def test_dispatch_tasks(self) -> None:
        dispatch_message("/plan Test goal", source="cli")
        out = dispatch_message("/tasks", source="cli")
        self.assertIn("Task summary", out)

    def test_dispatch_review(self) -> None:
        out = dispatch_message("/review Added FastAPI and wrote memory directly", source="cli")
        self.assertIn("CHANGES_REQUIRED", out.upper())

    def test_dispatch_help_and_start(self) -> None:
        self.assertIn("/plan", dispatch_message("/help", source="cli"))
        self.assertIn("/plan", dispatch_message("/start", source="telegram", user_id="123"))

    def test_dispatch_coo_command_direct(self) -> None:
        out = dispatch_coo_command("/help")
        self.assertIn("/tasks", out)

    def test_dispatch_remember_recall(self) -> None:
        out = dispatch_message("/remember plan | APAI-005 memory engine", source="cli")
        self.assertIn("Remembered", out)
        recall = dispatch_message("/recall APAI", source="cli")
        self.assertIn("APAI", recall)

    def test_dispatch_decision_with_approval(self) -> None:
        out = dispatch_message(
            "/decision Weekly sync | Team alignment | Friday 10am standup | approved",
            source="cli",
        )
        self.assertIn("Saved decision", out)

    def test_dispatch_log(self) -> None:
        dispatch_message("/log Manual CEO check-in", source="cli")
        out = dispatch_message("/log", source="cli")
        self.assertIn("Manual CEO check-in", out)

    def test_dispatch_tools_list(self) -> None:
        out = dispatch_message("/tools", source="cli")
        self.assertIn("vin", out)
        self.assertIn("git", out)

    def test_dispatch_tool_git_status(self) -> None:
        out = dispatch_message("/tool git status", source="cli")
        self.assertIn("OK", out)

    def test_dispatch_tool_deploy_dry_run(self) -> None:
        out = dispatch_message("/tool deploy dry-run", source="cli")
        self.assertIn("DRY RUN", out.upper().replace("-", " "))

    def test_dispatch_tool_vin(self) -> None:
        out = dispatch_message("/tool vin LFMAY86C3K0406545", source="cli")
        self.assertIn("LFMAY86C3K0406545", out)


if __name__ == "__main__":
    unittest.main()
