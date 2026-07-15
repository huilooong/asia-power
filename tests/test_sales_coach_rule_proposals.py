"""Coach rule proposals — evidence-backed patterns, no auto-written rules."""

from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from sales_coach.rule_proposals import (
    build_rule_proposal_markdown,
    run_rule_proposal_scan,
    scan_patterns,
)


def _write_turn(
    path: Path,
    *,
    evidence_id: str,
    at: str,
    next_action: str,
    message: str = "Need G4KD",
    reply: str = "Please share VIN.",
    customer_result_fact: str | None = None,
    decision_result_status: str | None = None,
) -> None:
    turn = {
        "type": "evidence_turn",
        "evidence_id": evidence_id,
        "at": at,
        "channel": "whatsapp",
        "customer": {"message": message},
        "reply": {"text": reply},
        "decision": {"next_action": next_action},
    }
    if customer_result_fact is not None:
        turn["customer_result"] = {"fact": customer_result_fact}
    if decision_result_status is not None:
        turn["decision_result"] = {"status": decision_result_status}
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(turn, ensure_ascii=False) + "\n")


class RuleProposalTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.ev_dir = self.root / "data" / "evidence" / "whatsapp"
        self.ev_dir.mkdir(parents=True)
        self.turns_path = self.ev_dir / "turns.ndjson"
        self.turns_path.write_text("", encoding="utf-8")
        (self.ev_dir / "patches.ndjson").write_text("", encoding="utf-8")
        self.now = datetime(2026, 7, 15, 12, 0, 0, tzinfo=timezone.utc)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_pattern_meets_threshold(self) -> None:
        for i in range(3):
            _write_turn(
                self.turns_path,
                evidence_id=f"ev-ask-vin-{i}",
                at=f"2026-07-14T10:0{i}:00+00:00",
                next_action="ask_vin",
                customer_result_fact="silent",
            )
        patterns = scan_patterns(root=self.root, now=self.now, min_occurrences=3, window_days=7)
        self.assertEqual(len(patterns), 1)
        self.assertEqual(patterns[0]["next_action"], "ask_vin")
        self.assertEqual(patterns[0]["occurrences"], 3)
        self.assertEqual(len(patterns[0]["evidence"]), 3)

    def test_below_threshold_omitted(self) -> None:
        for i in range(2):
            _write_turn(
                self.turns_path,
                evidence_id=f"ev-quote-{i}",
                at=f"2026-07-14T11:0{i}:00+00:00",
                next_action="quote_price",
                customer_result_fact="ended",
            )
        patterns = scan_patterns(root=self.root, now=self.now, min_occurrences=3, window_days=7)
        self.assertEqual(patterns, [])

    def test_old_turns_outside_window_ignored(self) -> None:
        for i in range(3):
            _write_turn(
                self.turns_path,
                evidence_id=f"ev-old-{i}",
                at=f"2026-06-01T10:0{i}:00+00:00",
                next_action="ask_port",
                customer_result_fact="silent",
            )
        patterns = scan_patterns(root=self.root, now=self.now, min_occurrences=3, window_days=7)
        self.assertEqual(patterns, [])

    def test_succeeded_decision_not_bad(self) -> None:
        for i in range(3):
            _write_turn(
                self.turns_path,
                evidence_id=f"ev-ok-{i}",
                at=f"2026-07-14T12:0{i}:00+00:00",
                next_action="ask_vin",
                decision_result_status="succeeded",
                customer_result_fact="continued",
            )
        patterns = scan_patterns(root=self.root, now=self.now, min_occurrences=3, window_days=7)
        self.assertEqual(patterns, [])

    def test_failed_decision_counts(self) -> None:
        for i in range(3):
            _write_turn(
                self.turns_path,
                evidence_id=f"ev-fail-{i}",
                at=f"2026-07-13T09:0{i}:00+00:00",
                next_action="match_inventory",
                decision_result_status="failed",
            )
        patterns = scan_patterns(root=self.root, now=self.now, min_occurrences=3, window_days=7)
        self.assertEqual(len(patterns), 1)
        self.assertEqual(patterns[0]["next_action"], "match_inventory")

    def test_empty_markdown_says_no_proposals(self) -> None:
        md = build_rule_proposal_markdown([], window_days=7)
        self.assertIn("暂无提案", md)
        self.assertIn("不代写规则", md)
        self.assertTrue(md.strip())

    def test_run_writes_report_with_evidence_id(self) -> None:
        for i in range(3):
            _write_turn(
                self.turns_path,
                evidence_id=f"ev-write-{i}",
                at=f"2026-07-14T08:0{i}:00+00:00",
                next_action="ask_vin",
                customer_result_fact="silent",
                message="Need gearbox",
                reply="Which year?",
            )
        result = run_rule_proposal_scan(
            root=self.root,
            write=True,
            now=self.now,
            min_occurrences=3,
            window_days=7,
        )
        self.assertTrue(result["read_only"])
        path = Path(result["report_path"])
        self.assertTrue(path.is_file())
        self.assertEqual(path.name, "2026-07-15-rule-proposals.md")
        self.assertTrue(str(path).endswith("docs/agents/apsales/coach/2026-07-15-rule-proposals.md"))
        text = path.read_text(encoding="utf-8")
        self.assertIn("ev-write-0", text)
        self.assertIn("ask_vin", text)
        self.assertIn("人工判断", text)
        self.assertNotIn("建议直接写入以下规则：", text)


if __name__ == "__main__":
    unittest.main()
