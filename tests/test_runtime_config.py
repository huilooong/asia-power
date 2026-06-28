"""Tests for runtime config loader."""

import tempfile
import unittest
from pathlib import Path

from runtime.config_loader import DEFAULTS, load_runtime_config


class RuntimeConfigTests(unittest.TestCase):
    def test_load_default_config(self) -> None:
        cfg = load_runtime_config()
        self.assertEqual(cfg["agent_id"], "apcoo")
        self.assertEqual(cfg["language"], "zh")
        self.assertEqual(cfg["default_channel"], "telegram")
        self.assertEqual(cfg["heartbeat_interval_seconds"], 300)
        self.assertTrue(cfg["auto_restart"])

    def test_load_custom_config(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "runtime_config.yaml"
            path.write_text(
                "agent_id: test-agent\nheartbeat_interval_seconds: 60\nauto_restart: false\n",
                encoding="utf-8",
            )
            cfg = load_runtime_config(path)
            self.assertEqual(cfg["agent_id"], "test-agent")
            self.assertEqual(cfg["heartbeat_interval_seconds"], 60)
            self.assertFalse(cfg["auto_restart"])
            self.assertEqual(cfg["language"], DEFAULTS["language"])

    def test_missing_config_uses_defaults(self) -> None:
        cfg = load_runtime_config(Path("/nonexistent/runtime_config.yaml"))
        self.assertEqual(cfg["agent_id"], "apcoo")


if __name__ == "__main__":
    unittest.main()
