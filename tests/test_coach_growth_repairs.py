import json
import tempfile
import unittest
from datetime import date
from pathlib import Path

from sales_coach.self_improve import load_sandbox_turns_for_day, run_self_improve
from sales_coach.llm_audit import audit_conversation
from sales_coach.dispatch_to_cursor import write_coach_fix_plan
from sales_coach.task_status import advance_task


class CoachGrowthTests(unittest.TestCase):
    def test_canonical_only_and_occurrences_deduplicated(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with self.assertRaises(FileNotFoundError):
                load_sandbox_turns_for_day(date(2026, 9, 9), root)
            dest = root / "data/evidence/whatsapp/turns.ndjson"
            dest.parent.mkdir(parents=True)
            turn = {"type": "evidence_turn", "evidence_id": "real-1", "at": "2026-09-09T10:00:00Z", "customer": {"message": "Need engine"}, "reply": {"text": "We ship from Guangzhou port in 7 working days."}}
            dest.write_text((json.dumps(turn) + "\n") * 2)
            self.assertEqual(len(load_sandbox_turns_for_day(date(2026, 9, 9), root)), 1)
            for _ in range(3):
                result = run_self_improve("2026-09-09", root=root)
            self.assertEqual(result["turns"], 1)
            state = json.loads((root / "memory/sales_coach/self_improve_lessons.json").read_text())
            self.assertTrue(state["lessons"])
            self.assertTrue(all(x["hit_count"] == 1 for x in state["lessons"]))

    def test_conflicting_judgments_quarantined_before_examples_or_dispatch(self):
        turn = {"evidence_id": "e1", "customer": {"message": "[video]"}, "reply": {"text": "Please type the engine code from the plate, or send the VIN."}}
        judge = {"violations": [{"evidence_id": "e1", "rule_id": "ask_plate_not_generic_photo", "reason": "which is correct and matches the rule", "confidence": "high"}], "good_examples": [{"evidence_id": "e1", "rule_id": "ask_plate_not_generic_photo", "why_good": "Correctly asks for a plate."}]}
        result = audit_conversation([turn], "rules", llm_call=lambda *args: judge)
        self.assertEqual(result["violations"], [])
        self.assertEqual(result["good_examples"], [])
        self.assertTrue(result["quarantined"])

    def test_unknown_evidence_and_not_applicable_not_dispatched(self):
        judge = {"violations": [{"evidence_id": "e2", "rule_id": "qualify_before_price", "reason": "bad", "confidence": "high"}, {"evidence_id": "e1", "rule_id": "qualify_before_price", "reason": "not sales", "confidence": "high", "applicable": False}]}
        result = audit_conversation([{"evidence_id": "e1", "customer": {"message": "school notice"}, "reply": {"text": "Thanks"}}], "rules", llm_call=lambda *args: judge)
        self.assertEqual(result["violations"], [])
        self.assertEqual(len(result["quarantined"]), 2)

    def test_repeat_findings_reuse_one_task_and_require_receipts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            record = {"id": "AP-1", "request_text": "rule_id=no_reask_known_part_or_vin | evidence_id=e1"}
            first = write_coach_fix_plan(record, root=root)
            second = write_coach_fix_plan({**record, "id": "AP-2"}, root=root)
            self.assertEqual(first, second)
            task = next((root / "memory/sales_coach/tasks").glob("*.json"))
            self.assertEqual(json.loads(task.read_text())["status"], "detected")
            self.assertEqual(len(json.loads(task.read_text())["findings"]), 2)
            with self.assertRaises(ValueError):
                advance_task(task, "verified", verification_report="made up")
            with self.assertRaises(ValueError):
                advance_task(task, "triaged")
            self.assertEqual(advance_task(task, "triaged", triage_note="confirmed with transcript")["status"], "triaged")

    def test_school_context_excludes_sales_pressure_without_hiding_safety(self):
        turns = [{"evidence_id": "video", "customer": {"message": "[video]"}, "reply": {"text": "What do you need checked?"}}, {"evidence_id": "school", "customer": {"message": "Just letting you know what your child did at school today."}, "reply": {"text": "Thanks"}}]
        result = audit_conversation(turns, "rules", llm_call=lambda *args: {"violations": [{"evidence_id": "video", "rule_id": "enquiry_no_next_step", "reason": "Does not advance the sale", "confidence": "high"}]})
        self.assertEqual(result["violations"], [])
        self.assertEqual(result["quarantined"][0]["quarantine_reason"], "sales_rule_not_applicable_to_current_intent")
