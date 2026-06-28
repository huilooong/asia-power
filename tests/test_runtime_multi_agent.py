"""Tests for multi-agent runtime configuration."""

import unittest

from runtime.config_loader import DEFAULTS, get_enabled_telegram_agents, load_runtime_config


class RuntimeMultiAgentTests(unittest.TestCase):
    def test_default_agents_config(self) -> None:
        cfg = load_runtime_config()
        self.assertIn("apcoo", cfg.get("agents", {}))
        self.assertIn("apsales", cfg.get("agents", {}))

    def test_enabled_telegram_agents(self) -> None:
        enabled = get_enabled_telegram_agents()
        self.assertIn("apcoo", enabled)
        self.assertIn("apsales", enabled)

    def test_disable_apsales(self) -> None:
        cfg = dict(DEFAULTS)
        cfg["agents"] = {
            "apcoo": {"enabled": True, "telegram": True},
            "apsales": {"enabled": False, "telegram": False},
        }
        enabled = get_enabled_telegram_agents(cfg)
        self.assertEqual(enabled, ["apcoo"])


if __name__ == "__main__":
    unittest.main()
