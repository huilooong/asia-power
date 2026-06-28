"""Tests for Memory Tool (no API calls)."""

import tempfile
import unittest
from pathlib import Path

from tools import memory_tool


class MemoryToolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        memory_tool.reconfigure_paths(Path(self.tmp.name))

    def test_save_and_read_memory(self) -> None:
        memory_tool.save_memory("plan", "Deploy COO and Sales agents", "coo")
        data = memory_tool.read_all_memory()
        self.assertIn("Deploy COO and Sales agents", data["shared_memory.md"])

    def test_save_decision(self) -> None:
        memory_tool.save_decision(
            title="Memory via Tool",
            reason="Architecture rule",
            decision="All agents use Memory Tool",
            owner="coo",
        )
        self.assertIn("Memory via Tool", memory_tool.DECISIONS_FILE.read_text(encoding="utf-8"))
        decisions_dir = memory_tool._subdir("decisions")
        self.assertTrue(any(decisions_dir.glob("*.md")))

    def test_search_memory(self) -> None:
        memory_tool.save_memory("general", "G4KD engine inquiry", "sales")
        hits = memory_tool.search_memory("g4kd")
        self.assertTrue(hits)

    def test_save_customer_note(self) -> None:
        memory_tool.save_customer_note("Ghana buyer", "Asked G4KD price", "sales")
        self.assertIn("Ghana buyer", memory_tool.CUSTOMERS_FILE.read_text(encoding="utf-8"))

    def test_remember_and_recall(self) -> None:
        memory_tool.remember("VIN tool phase 1 complete", category="project", project="vin-tool", source="coo")
        out = memory_tool.recall("vin")
        self.assertIn("vin", out.lower())

    def test_record_decision_requires_approval_for_important(self) -> None:
        with self.assertRaises(ValueError):
            memory_tool.record_decision(
                "Deploy to production",
                "Ready",
                "Push tonight",
                ceo_approval="not_required",
            )
        msg = memory_tool.record_decision(
            "Deploy to production",
            "Ready",
            "Push tonight",
            ceo_approval="pending",
        )
        self.assertIn("pending", msg)

    def test_daily_log(self) -> None:
        memory_tool.log_daily("CEO reviewed task list", source="coo", channel="cli")
        log = memory_tool.list_daily_log()
        self.assertIn("CEO reviewed task list", log)

    def test_load_context_for_message(self) -> None:
        memory_tool.remember("Inventory catalog sync priority", category="operations", source="coo")
        ctx = memory_tool.load_context_for_message("inventory catalog status")
        self.assertIn("Inventory", ctx)

    def test_index_created(self) -> None:
        memory_tool.remember("Test note", category="company", source="coo")
        self.assertTrue(memory_tool.INDEX_FILE.is_file())
        data = memory_tool._load_index()
        self.assertTrue(data["entries"])


if __name__ == "__main__":
    unittest.main()
