"""Tests for runtime healthcheck."""

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from runtime.healthcheck import format_healthcheck_report, run_healthcheck
from tools import memory_tool


class RuntimeHealthcheckTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        memory_tool.reconfigure_paths(Path(self.tmp.name) / "memory")

    def test_healthcheck_critical_passes(self) -> None:
        env = {
            "OPENAI_API_KEY": "sk-test",
            "COO_TELEGRAM_BOT_TOKEN": "123:abc",
            "COO_TELEGRAM_ALLOWED_CHAT_IDS": "999",
        }
        with mock.patch.dict(os.environ, env, clear=False):
            ok, checks = run_healthcheck()
        names = {c["name"] for c in checks}
        self.assertIn("constitution", names)
        self.assertIn("memory_index", names)
        self.assertIn("tool_registry", names)
        self.assertIn("git_repo", names)
        self.assertTrue(ok)

    def test_healthcheck_report_shows_ok(self) -> None:
        ok, checks = run_healthcheck()
        report = format_healthcheck_report(checks)
        self.assertIn("AsiaPower Runtime Healthcheck", report)
        if ok:
            self.assertIn("Overall: OK", report)

    def test_memory_index_created_on_check(self) -> None:
        run_healthcheck()
        self.assertTrue(memory_tool.INDEX_FILE.is_file())

    def test_telegram_optional_warn(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            _, checks = run_healthcheck()
        tg = next(c for c in checks if c["name"] == "telegram_config")
        self.assertFalse(tg["required"])


if __name__ == "__main__":
    unittest.main()
