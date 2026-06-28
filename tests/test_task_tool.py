"""Tests for Task Tool."""

import json
import tempfile
import unittest
from pathlib import Path

from tools import task_tool


class TaskToolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.data_dir = Path(self.tmp.name) / "data"
        self.tasks_file = self.data_dir / "tasks.json"

        task_tool.DATA_DIR = self.data_dir
        task_tool.TASKS_FILE = self.tasks_file

    def test_create_and_get_task(self) -> None:
        task = task_tool.create_task(
            title="Build VIN Tool",
            description="API research",
            owner_agent="inventory",
            priority="high",
            tags=["vin-tool"],
        )
        self.assertTrue(task["id"].startswith("task-"))
        fetched = task_tool.get_task(task["id"])
        self.assertEqual(fetched["title"], "Build VIN Tool")

    def test_list_and_complete(self) -> None:
        t1 = task_tool.create_task("Task A", owner_agent="coo")
        task_tool.create_task("Task B", owner_agent="sales")
        pending = task_tool.list_tasks(status="pending")
        self.assertEqual(len(pending), 2)

        done = task_tool.complete_task(t1["id"])
        self.assertEqual(done["status"], "completed")
        self.assertIsNotNone(done["completed_at"])

    def test_update_and_cancel(self) -> None:
        task = task_tool.create_task("Cancel me")
        updated = task_tool.update_task(task["id"], priority="urgent", status="in_progress")
        self.assertEqual(updated["priority"], "urgent")
        cancelled = task_tool.cancel_task(task["id"])
        self.assertEqual(cancelled["status"], "cancelled")

    def test_search_and_summarize(self) -> None:
        task_tool.create_task("VIN API research", tags=["vin"])
        hits = task_tool.search_tasks("vin")
        self.assertEqual(len(hits), 1)
        summary = task_tool.summarize_tasks()
        self.assertEqual(summary["total"], 1)
        self.assertEqual(summary["by_status"]["pending"], 1)

    def test_persists_json(self) -> None:
        task_tool.create_task("Persisted")
        self.assertTrue(self.tasks_file.exists())
        data = json.loads(self.tasks_file.read_text(encoding="utf-8"))
        self.assertEqual(len(data), 1)


if __name__ == "__main__":
    unittest.main()
