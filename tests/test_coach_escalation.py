from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class TestCoachEscalation(unittest.TestCase):
    def test_select_high_or_repeat_only(self):
        from sales_coach.escalation import normalize_rule_id, select_for_approval

        violations = [
            {"rule_hint": "bare price", "confidence": "high", "evidence_id": "e1", "reason": "900 no USD"},
            {"rule_hint": "tone", "confidence": "low", "evidence_id": "e2", "reason": "ok"},
            {"rule_hint": "wait loop", "confidence": "medium", "evidence_id": "e3", "customer_id": "a"},
            {"rule_hint": "wait loop", "confidence": "medium", "evidence_id": "e4", "customer_id": "b"},
        ]
        out = select_for_approval(violations, state={"asked": {}})
        rids = {normalize_rule_id(x) for x in out["escalate"]}
        self.assertIn("bare_price", rids)
        self.assertIn("wait_loop", rids)
        digest_rids = {normalize_rule_id(x) for x in out["digest"]}
        self.assertIn("tone", digest_rids)

    def test_cooldown_blocks_same_evidence(self):
        from sales_coach.escalation import in_cooldown, mark_asked, select_for_approval
        from datetime import datetime, timezone

        state = {"asked": {}}
        mark_asked(state, "bare_price", approval_id="AP-1", evidence_ids=["e1"], now=datetime.now(timezone.utc))
        self.assertTrue(in_cooldown("bare_price", state, evidence_id="e1"))
        self.assertFalse(in_cooldown("bare_price", state, evidence_id="e_new_event"))

        out = select_for_approval(
            [{"rule_hint": "bare_price", "confidence": "high", "evidence_id": "e1"}],
            state=state,
        )
        self.assertEqual(len(out["escalate"]), 0)

    def test_dispatch_writes_plan_with_liverules_check(self):
        from sales_coach.dispatch_to_cursor import write_coach_fix_plan

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".claude" / "plans").mkdir(parents=True)
            path = write_coach_fix_plan(
                {
                    "id": "AP-260717-abcdef",
                    "action": "agent_prompt_fix",
                    "agent": "sales_coach",
                    "why": "Coach 发现 bare_price 违规, 重复 2 次",
                    "request_text": "rule_id=bare_price | confidence=high | evidence_id=e9 | reason=no USD",
                },
                root=root,
            )
            text = path.read_text(encoding="utf-8")
            self.assertIn("AP-260717-abcdef", text)
            self.assertIn("LIVE-RULES.md", text)
            self.assertIn("bridge.mjs", text)
            self.assertIn("Cursor 实施报告", text)
            self.assertIn("给 Cursor 的交付说明", text)

    def test_format_resolution_agent_prompt_fix(self):
        from coo_core.approval_gate import format_resolution

        msg = format_resolution(
            {
                "decision": "approved",
                "record": {"action": "agent_prompt_fix", "id": "AP-1", "human_only": False},
                "cursor_plan_path": "/tmp/coach-fix-x.md",
            }
        )
        self.assertIn("Cursor 任务文件", msg)
        self.assertIn("/tmp/coach-fix-x.md", msg)


if __name__ == "__main__":
    unittest.main()
