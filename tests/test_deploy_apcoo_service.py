"""Tests for APCOO production deployment files (no real systemctl)."""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEPLOY = ROOT / "deploy"

SERVICE_FILE = DEPLOY / "apcoo.service"
INSTALL_SCRIPT = DEPLOY / "install_service.sh"
RESTART_SCRIPT = DEPLOY / "restart_service.sh"
STATUS_SCRIPT = DEPLOY / "status_service.sh"
TAIL_SCRIPT = DEPLOY / "tail_logs.sh"
UNINSTALL_SCRIPT = DEPLOY / "uninstall_service.sh"

SECRET_PATTERNS = (
    re.compile(r"sk-[a-zA-Z0-9]{10,}"),
    re.compile(r"OPENAI_API_KEY\s*=\s*[^\s@]"),
    re.compile(r"COO_TELEGRAM_BOT_TOKEN\s*=\s*\d+:"),
    re.compile(r"QXB_SECRET\s*="),
)


class DeployApcooServiceTests(unittest.TestCase):
    def test_service_file_exists(self) -> None:
        self.assertTrue(SERVICE_FILE.is_file(), f"missing {SERVICE_FILE}")

    def test_all_management_scripts_exist(self) -> None:
        for path in (
            INSTALL_SCRIPT, UNINSTALL_SCRIPT, RESTART_SCRIPT,
            STATUS_SCRIPT, TAIL_SCRIPT,
        ):
            self.assertTrue(path.is_file(), f"missing {path}")

    def test_service_has_restart_always(self) -> None:
        text = SERVICE_FILE.read_text(encoding="utf-8")
        self.assertIn("Restart=always", text)
        self.assertIn("RestartSec=10", text)

    def test_service_uses_runtime_module(self) -> None:
        text = SERVICE_FILE.read_text(encoding="utf-8")
        self.assertIn("runtime.service", text)
        self.assertIn("WorkingDirectory=@@APCOO_ROOT@@", text)

    def test_service_loads_env_file_not_inline_keys(self) -> None:
        text = SERVICE_FILE.read_text(encoding="utf-8")
        self.assertIn("EnvironmentFile=-@@APCOO_ROOT@@/.env", text)
        for pat in SECRET_PATTERNS:
            self.assertIsNone(pat.search(text), f"service file must not contain secrets: {pat.pattern}")

    def test_service_logs_to_journal(self) -> None:
        text = SERVICE_FILE.read_text(encoding="utf-8")
        self.assertIn("StandardOutput=journal", text)
        self.assertIn("StandardError=journal", text)
        self.assertIn("SyslogIdentifier=apcoo", text)

    def test_install_script_runs_healthcheck(self) -> None:
        text = INSTALL_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("runtime.healthcheck", text)
        self.assertIn("healthcheck failed", text.lower())

    def test_install_script_substitutes_paths(self) -> None:
        text = INSTALL_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("@@APCOO_ROOT@@", text)
        self.assertIn("@@PYTHON@@", text)
        self.assertIn("systemctl enable", text)
        self.assertIn("systemctl start", text)

    def test_status_script_references_apcoo(self) -> None:
        text = STATUS_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("apcoo", text)

    def test_tail_script_references_journalctl(self) -> None:
        text = TAIL_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("journalctl", text)
        self.assertIn("apcoo", text)


if __name__ == "__main__":
    unittest.main()
