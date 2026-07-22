from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch


class TestCoachEscalation(unittest.TestCase):
    def test_normalize_ignores_free_text_hint(self):
        from sales_coach.escalation import normalize_rule_id
        from sales_coach.rule_catalog import unclassified_id

        # No rule_id → unclassified (hint must NOT invent identity)
        self.assertEqual(
            normalize_rule_id({"rule_hint": "严禁随意甩人工电话号码 054"}),
            unclassified_id(),
        )
        # Known catalog id wins
        self.assertEqual(
            normalize_rule_id(
                {
                    "rule_id": "no_leak_staff_phone",
                    "rule_hint": "严禁随意甩人工电话号码",
                }
            ),
            "no_leak_staff_phone",
        )

    def test_legacy_alias_maps_严禁_and_禁止_to_same_id(self):
        from sales_coach.rule_catalog import resolve_stable_rule_id

        a = resolve_stable_rule_id(
            rule_id="严禁随意甩人工电话号码_054_913_5916",
            allow_hint_alias=True,
        )
        b = resolve_stable_rule_id(
            rule_id="禁止随意甩人工电话号码_054_913_5916",
            allow_hint_alias=True,
        )
        self.assertEqual(a, "no_leak_staff_phone")
        self.assertEqual(b, "no_leak_staff_phone")

    def test_select_high_or_repeat_only(self):
        from sales_coach.escalation import normalize_rule_id, select_for_approval

        violations = [
            {
                "rule_id": "quote_with_currency_unit",
                "confidence": "high",
                "evidence_id": "e1",
                "reason": "900 no USD",
            },
            {
                "rule_id": "unclassified",
                "rule_hint": "tone",
                "confidence": "low",
                "evidence_id": "e2",
                "reason": "ok",
            },
            {
                "rule_id": "no_repeat_wait_phrases",
                "confidence": "medium",
                "evidence_id": "e3",
                "customer_id": "a",
            },
            {
                "rule_id": "no_repeat_wait_phrases",
                "confidence": "medium",
                "evidence_id": "e4",
                "customer_id": "b",
            },
        ]
        out = select_for_approval(violations, state={"asked": {}})
        rids = {normalize_rule_id(x) for x in out["escalate"]}
        self.assertIn("quote_with_currency_unit", rids)
        self.assertIn("no_repeat_wait_phrases", rids)

    def test_unclassified_no_systemic_escalate(self):
        from sales_coach.escalation import select_for_approval

        out = select_for_approval(
            [
                {"rule_id": "unclassified", "confidence": "medium", "evidence_id": "a"},
                {"rule_id": "unclassified", "confidence": "medium", "evidence_id": "b"},
            ],
            state={"asked": {}},
        )
        self.assertEqual(len(out["escalate"]), 0)

    def test_cooldown_blocks_same_evidence(self):
        from sales_coach.escalation import in_cooldown, mark_asked, select_for_approval

        state = {"asked": {}}
        mark_asked(
            state,
            "quote_with_currency_unit",
            approval_id="AP-1",
            evidence_ids=["e1"],
            now=datetime.now(timezone.utc),
            status="asked",
        )
        self.assertTrue(in_cooldown("quote_with_currency_unit", state, evidence_id="e1"))
        self.assertFalse(
            in_cooldown("quote_with_currency_unit", state, evidence_id="e_new_event")
        )

        out = select_for_approval(
            [
                {
                    "rule_id": "quote_with_currency_unit",
                    "confidence": "high",
                    "evidence_id": "e1",
                }
            ],
            state=state,
        )
        self.assertEqual(len(out["escalate"]), 0)

    def test_second_ask_auto_dispatches_not_telegram(self):
        from sales_coach.escalation import escalate_violations_to_ceo, mark_asked

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".claude" / "plans").mkdir(parents=True)
            (root / "memory" / "sales_coach").mkdir(parents=True)
            (root / "docs" / "agents" / "apsales" / "coach").mkdir(parents=True)

            state_path = root / "memory" / "sales_coach" / "escalation_state.json"
            state = {"asked": {}, "digest": []}
            mark_asked(
                state,
                "no_leak_staff_phone",
                approval_id="AP-old",
                evidence_ids=["e-old"],
                status="asked",
                recurrence=1,
            )
            state_path.write_text(
                __import__("json").dumps(state), encoding="utf-8"
            )

            with patch("coo_core.approval_gate.request_and_notify") as mock_notify:
                result = escalate_violations_to_ceo(
                    [
                        {
                            "rule_id": "no_leak_staff_phone",
                            "confidence": "high",
                            "evidence_id": "e-new",
                            "reason": "dumped 054 again",
                        }
                    ],
                    root=root,
                    notify=True,
                )
                mock_notify.assert_not_called()
                self.assertEqual(len(result["auto_plans"]), 1)
                self.assertTrue(Path(result["auto_plans"][0]).is_file())
                text = Path(result["auto_plans"][0]).read_text(encoding="utf-8")
                self.assertIn("复发自动派工", text)
                self.assertIn("LIVE-RULES.md", text)

    def test_rejected_skips_auto_and_telegram(self):
        from sales_coach.escalation import escalate_violations_to_ceo, mark_rejected

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".claude" / "plans").mkdir(parents=True)
            (root / "memory" / "sales_coach").mkdir(parents=True)
            (root / "docs" / "agents" / "apsales" / "coach").mkdir(parents=True)
            state = {"asked": {}, "digest": []}
            mark_rejected(state, "no_leak_staff_phone", approval_id="AP-x")
            (root / "memory" / "sales_coach" / "escalation_state.json").write_text(
                __import__("json").dumps(state), encoding="utf-8"
            )

            with patch("coo_core.approval_gate.request_and_notify") as mock_notify:
                result = escalate_violations_to_ceo(
                    [
                        {
                            "rule_id": "no_leak_staff_phone",
                            "confidence": "high",
                            "evidence_id": "e9",
                            "reason": "again",
                        }
                    ],
                    root=root,
                    notify=True,
                )
                mock_notify.assert_not_called()
                self.assertEqual(result["auto_plans"], [])
                self.assertEqual(result["escalate_count"], 0)

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
                    "why": "Coach 发现 quote_with_currency_unit 违规, 重复 2 次",
                    "request_text": (
                        "rule_id=quote_with_currency_unit | confidence=high | "
                        "evidence_id=e9 | reason=no USD"
                    ),
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
                "record": {
                    "action": "agent_prompt_fix",
                    "id": "AP-1",
                    "human_only": False,
                },
                "cursor_plan_path": "/tmp/coach-fix-x.md",
            }
        )
        self.assertIn("Cursor 任务文件", msg)
        self.assertIn("/tmp/coach-fix-x.md", msg)


if __name__ == "__main__":
    unittest.main()
