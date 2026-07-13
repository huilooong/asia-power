"""Sales Coach — decision training tests (not BI)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sales_coach.decisions import extract_decisions_for_turn
from sales_coach.runtime import run_evening_training
from sales_coach.skills import score_skills


class CoachDecisionTests(unittest.TestCase):
    def test_vin_decision(self) -> None:
        turn = extract_decisions_for_turn(
            customer_text="Need G4KD half cut",
            reply_text="Please share the VIN and destination port.",
        )
        self.assertTrue(turn["context"]["should_ask_vin"])
        self.assertTrue(turn["decisions"]["ask_vin"])
        self.assertFalse(turn["context"]["quoted_before_vin"])

    def test_quote_before_vin_flagged(self) -> None:
        turn = extract_decisions_for_turn(
            customer_text="Need G4KD",
            reply_text="FOB price is USD 1200.",
        )
        self.assertTrue(turn["context"]["quoted_before_vin"])

    def test_evening_training_writes_three_lessons_max(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            dq = root / "memory" / "customer_gateway" / "draft_queue"
            dq.mkdir(parents=True)
            (dq / "draft-2026-07-13T1000TUTC-a.json").write_text(
                """{
                  "draft_id": "draft-2026-07-13T1000TUTC-a",
                  "customer_name": "Buyer A",
                  "original_message": "Need G4KD engine",
                  "customer_reply_draft": "FOB USD 1500 ready to ship now.",
                  "status": "revised",
                  "revision_note": "禁止承诺库存，先问 VIN",
                  "created_at": "2026-07-13 10:00 UTC",
                  "updated_at": "2026-07-13 10:00 UTC"
                }""",
                encoding="utf-8",
            )
            result = run_evening_training("2026-07-13", root=root, write=True)
            self.assertLessEqual(len(result["lessons"]), 3)
            self.assertGreaterEqual(len(result["lessons"]), 1)
            path = Path(result["report_path"])
            text = path.read_text(encoding="utf-8")
            self.assertIn("Today's Progress", text)
            self.assertIn("Today's Three Lessons", text)
            self.assertIn("Tomorrow Focus", text)
            self.assertNotIn("Hot Topics", text)
            self.assertNotIn("Message Count", text)

    def test_skill_scores_keys(self) -> None:
        turns = [
            extract_decisions_for_turn(
                customer_text="Need G4KD",
                reply_text="Please share VIN.",
            )
        ]
        scores = score_skills(turns)
        self.assertIn("VIN Confirmation", scores)


if __name__ == "__main__":
    unittest.main()
