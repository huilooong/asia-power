"""APBD outreach queue must require approval_status=approved before send."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


def _load_mod():
    path = Path(__file__).resolve().parent.parent / "scripts" / "send-apbd-outreach-queue.py"
    spec = importlib.util.spec_from_file_location("send_apbd_outreach_queue", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class ApbdApprovalGateTests(unittest.TestCase):
    def test_skips_non_approved_records(self) -> None:
        mod = _load_mod()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            queue = root / "runtime" / "apbd" / "ghana" / "outreach_queue"
            queue.mkdir(parents=True)
            (queue / "a.json").write_text(
                json.dumps({
                    "company": "Skip Me",
                    "public_email": "skip@example.com",
                    "email_draft": "Subject: Hi\n\nBody",
                    "approval_status": "pending",
                }),
                encoding="utf-8",
            )
            (queue / "b.json").write_text(
                json.dumps({
                    "company": "Send Me",
                    "public_email": "ok@example.com",
                    "email_draft": "Subject: Hi\n\nBody",
                    "approval_status": "approved",
                }),
                encoding="utf-8",
            )
            mod.APBD_ROOT = root / "runtime" / "apbd"
            pending = []
            for _path, record in mod._iter_queue_records():
                if record.get("approval_status") == "sent":
                    continue
                if str(record.get("approval_status") or "").strip().lower() != "approved":
                    continue
                pending.append(record["company"])
            self.assertEqual(pending, ["Send Me"])


if __name__ == "__main__":
    unittest.main()
