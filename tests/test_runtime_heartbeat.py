"""Tests for runtime heartbeat."""

import tempfile
import unittest
from pathlib import Path

from runtime.heartbeat import heartbeat_path, write_heartbeat
from runtime.state import RuntimeState
from tools import memory_tool


class RuntimeHeartbeatTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        memory_tool.reconfigure_paths(Path(self.tmp.name) / "memory")

    def test_write_heartbeat_creates_file(self) -> None:
        state = RuntimeState(agent_id="apcoo", status="running")
        state.active_tools = ["git", "vin"]
        msg = write_heartbeat(state, {"agent_id": "apcoo", "default_channel": "telegram"})
        self.assertTrue(heartbeat_path().is_file())
        text = heartbeat_path().read_text(encoding="utf-8")
        self.assertIn("apcoo", text)
        self.assertIn("running", text)
        self.assertIn("git", text)
        self.assertIn("uptime", text)

    def test_write_heartbeat_appends(self) -> None:
        state = RuntimeState(agent_id="apcoo")
        write_heartbeat(state, {"agent_id": "apcoo"})
        write_heartbeat(state, {"agent_id": "apcoo"})
        text = heartbeat_path().read_text(encoding="utf-8")
        self.assertEqual(text.count("## "), 2)

    def test_last_error_recorded(self) -> None:
        state = RuntimeState(agent_id="apcoo", status="degraded")
        state.last_error = "Telegram crash: timeout"
        write_heartbeat(state, {"agent_id": "apcoo"})
        self.assertIn("Telegram crash", heartbeat_path().read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
