"""Tests for COO Critic."""

import unittest

from coo_core.critic import review_text


class CriticTests(unittest.TestCase):
    def test_rejects_direct_memory_write(self) -> None:
        text = "Cursor wrote memory directly with open('memory/shared_memory.md', 'w')"
        result = review_text(text)
        self.assertIn(result["status"], {"rejected", "changes_required"})
        self.assertLess(result["score"], 70)
        self.assertTrue(result["issues"])

    def test_flags_fastapi(self) -> None:
        text = "Added FastAPI server for new endpoints"
        result = review_text(text)
        self.assertEqual(result["status"], "changes_required")
        self.assertTrue(result["issues"])
        self.assertTrue(any("framework" in i.lower() or "fastapi" in i.lower() for i in result["issues"]))

    def test_approves_clean_change(self) -> None:
        text = (
            "Added tools/task_tool.py with unittest tests. "
            "Uses memory_tool for notes. Small scope change."
        )
        result = review_text(text)
        self.assertEqual(result["status"], "approved")
        self.assertGreaterEqual(result["score"], 80)

    def test_flags_missing_tests_for_new_tool(self) -> None:
        text = "Created tools/inventory_tool.py with CRUD functions."
        result = review_text(text)
        self.assertEqual(result["status"], "changes_required")
        self.assertTrue(any("tests" in c.lower() for c in result["required_changes"]))


if __name__ == "__main__":
    unittest.main()
