"""Coach LLM conformance audit — synthetic violations + clean conversation."""

from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from sales_coach import llm_audit


class CoachLlmAuditTests(unittest.TestCase):
    def test_audit_marks_vin_reask_violation(self) -> None:
        turns = [
            {
                "evidence_id": "ev-vin-1",
                "at": "2026-07-16T10:00:00Z",
                "customer": {"message": "VIN is JTMBD31V586098976, need engine"},
                "reply": {"text": "Got it — 2AZ-FE. How many pins on the gearbox?"},
                "decision": {"next_action": "ask_accessory"},
            },
            {
                "evidence_id": "ev-vin-2",
                "at": "2026-07-16T10:05:00Z",
                "customer": {"message": "6 pins"},
                "reply": {
                    "text": "What do you need? Engine / gearbox / half-cut? Please share VIN."
                },
                "decision": {"next_action": "ask_vin"},
            },
        ]

        def fake_llm(compact, rules_text: str):
            self.assertTrue(rules_text)
            return {
                "violations": [
                    {
                        "evidence_id": "ev-vin-2",
                        "rule_hint": "身份与VIN",
                        "reason": "客户已确认VIN，回复又问了一遍需求类型/VIN",
                        "confidence": "high",
                    }
                ],
                "good_examples": [
                    {
                        "evidence_id": "ev-vin-1",
                        "why_good": "准确识别VIN并追问变速箱pin数",
                        "rule_hint": "5W2H",
                    }
                ],
            }

        result = llm_audit.audit_conversation(
            turns,
            "# LIVE-RULES\nDo not re-ask VIN after confirmed.\n",
            llm_call=fake_llm,
        )
        self.assertEqual(len(result["violations"]), 1)
        self.assertEqual(result["violations"][0]["evidence_id"], "ev-vin-2")
        self.assertEqual(len(result["good_examples"]), 1)

    def test_bare_hi_not_banned_opening_violation(self) -> None:
        turns = [
            {
                "evidence_id": "ev-hi-1",
                "at": "2026-07-16T11:00:00Z",
                "customer": {"message": "Hello! Can I get more info?"},
                "reply": {
                    "text": "Hi! You can check www.asia-power.com. What are you looking for?"
                },
                "decision": {"next_action": "ask_need"},
            }
        ]

        def fake_llm(compact, rules_text: str):
            return {
                "violations": [
                    {
                        "evidence_id": "ev-hi-1",
                        "rule_hint": "禁止开场：Hi there! / Great news!",
                        "reason": "Reply starts with 'Hi!' which is prohibited opening.",
                        "confidence": "high",
                    },
                    {
                        "evidence_id": "ev-hi-1",
                        "rule_hint": "禁止开场：Hi there!",
                        "reason": "Reply starts with 'Hi there.' which matches the ban.",
                        "confidence": "high",
                    },
                ],
                "good_examples": [],
            }

        # Second fake violation claims Hi there but reply is only Hi! — both should drop
        # unless reply actually contains banned phrase:
        result = llm_audit.audit_conversation(turns, "rules", llm_call=fake_llm)
        self.assertEqual(result["violations"], [])

        turns2 = [
            {
                **turns[0],
                "evidence_id": "ev-hithere-1",
                "reply": {
                    "text": "Hi there. Please call 054 913 5916 or visit www.asia-power.com."
                },
            }
        ]

        def fake_llm_real(compact, rules_text: str):
            return {
                "violations": [
                    {
                        "evidence_id": "ev-hithere-1",
                        "rule_hint": "禁止开场：Hi there!",
                        "reason": "Reply starts with Hi there.",
                        "confidence": "high",
                    }
                ],
                "good_examples": [],
            }

        kept = llm_audit.audit_conversation(turns2, "rules", llm_call=fake_llm_real)
        self.assertEqual(len(kept["violations"]), 1)

    def test_clean_conversation_no_false_positive(self) -> None:
        turns = [
            {
                "evidence_id": "ev-ok-1",
                "at": "2026-07-16T11:00:00Z",
                "customer": {"message": "Need G4KE engine"},
                "reply": {"text": "Ok G4KE — how many units?"},
                "decision": {"next_action": "ask_qty"},
            }
        ]

        def fake_llm(compact, rules_text: str):
            return {"violations": [], "good_examples": []}

        result = llm_audit.audit_conversation(turns, "rules", llm_call=fake_llm)
        self.assertEqual(result["violations"], [])
        self.assertEqual(result["good_examples"], [])

    def test_run_writes_reports_and_good_examples(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            rules = root / "docs" / "zijing-training" / "LIVE-RULES.md"
            rules.parent.mkdir(parents=True)
            rules.write_text("# rules\nDo not re-ask VIN.\n", encoding="utf-8")
            ev_dir = root / "data" / "evidence" / "whatsapp"
            ev_dir.mkdir(parents=True)
            turn = {
                "schema_version": 1,
                "type": "evidence_turn",
                "evidence_id": "ev-run-1",
                "at": "2026-07-16T12:00:00Z",
                "channel": "whatsapp",
                "customer": {
                    "message": "VIN JTMBD31V586098976 already sent",
                    "customer_id": "wa:233111",
                },
                "decision": {"next_action": "ask_vin"},
                "reply": {"text": "Please send VIN again"},
                "customer_result": {},
                "decision_result": {},
            }
            (ev_dir / "turns.ndjson").write_text(json.dumps(turn) + "\n", encoding="utf-8")
            (ev_dir / "patches.ndjson").write_text("", encoding="utf-8")

            def fake_llm(compact, rules_text: str):
                return {
                    "violations": [
                        {
                            "evidence_id": "ev-run-1",
                            "rule_hint": "VIN",
                            "reason": "re-asked VIN",
                            "confidence": "high",
                        }
                    ],
                    "good_examples": [
                        {
                            "evidence_id": "ev-run-1",
                            "why_good": "placeholder should still write file",
                            "rule_hint": "test",
                        }
                    ],
                }

            result = llm_audit.run_llm_conformance_audit(
                root=root,
                window_days=7,
                write=True,
                now=datetime(2026, 7, 16, 15, 0, tzinfo=timezone.utc),
                llm_call=fake_llm,
                skip_audited=False,
                combine_with_structured=True,
            )
            self.assertTrue(result["ok"])
            self.assertTrue(Path(result["report_path"]).is_file())
            self.assertTrue(Path(result["combined_report_path"]).is_file())
            md = Path(result["report_path"]).read_text(encoding="utf-8")
            self.assertIn("违规", md)
            self.assertIn("ev-run-1", md)
            self.assertTrue(result["good_example_paths"])
            self.assertTrue(Path(result["good_example_paths"][0]).is_file())
            combined = Path(result["combined_report_path"]).read_text(encoding="utf-8")
            self.assertIn("通道 A", combined)
            self.assertIn("通道 B", combined)


class RunCoachLlmAuditCliTests(unittest.TestCase):
    def test_force_flag_disables_skip(self) -> None:
        import importlib.util

        path = Path(__file__).resolve().parent.parent / "scripts" / "run-coach-llm-audit.py"
        spec = importlib.util.spec_from_file_location("run_coach_llm_audit_cli", path)
        assert spec and spec.loader
        cli = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cli)
        args = cli.parse_args(["--force", "--suffix", "unit"])
        self.assertTrue(args.force)
        self.assertEqual(args.suffix, "unit")


if __name__ == "__main__":
    unittest.main()
