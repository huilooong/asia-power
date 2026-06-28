"""Tests for audit logging."""

import json
import tempfile
import unittest
from pathlib import Path

import audit.logger as audit_log
from audit.logger import log_approval_granted, log_event, log_tool_call, reconfigure_audit_dir


class AuditLoggerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        reconfigure_audit_dir(Path(self.tmp.name))

    def test_log_event(self) -> None:
        log_event("agent_start", agent_id="apcoo")
        path = audit_log.AUDIT_DIR / audit_log.EVENTS_FILE
        lines = path.read_text(encoding="utf-8").strip().splitlines()
        self.assertEqual(len(lines), 1)
        data = json.loads(lines[0])
        self.assertEqual(data["event"], "agent_start")

    def test_log_tool_call(self) -> None:
        log_tool_call("git", "status", ok=True, risk_level="low")
        tc = (audit_log.AUDIT_DIR / audit_log.TOOL_CALLS_FILE).read_text(encoding="utf-8")
        self.assertIn("git", tc)

    def test_log_approval_granted(self) -> None:
        log_approval_granted(
            action="deploy.run",
            risk_level="critical",
            command="/tool deploy run | approved",
            approved_by="CEO",
            result="granted",
        )
        path = audit_log.AUDIT_DIR / audit_log.APPROVALS_FILE
        lines = path.read_text(encoding="utf-8").strip().splitlines()
        data = json.loads(lines[0])
        self.assertEqual(data["approved_by"], "CEO")


if __name__ == "__main__":
    unittest.main()
