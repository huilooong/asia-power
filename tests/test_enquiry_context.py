"""Tests for contextual enquiry parsing."""

import unittest

from sales_core.enquiry_context import (
    build_contextual_draft_zh,
    parse_enquiry_facts,
    port_hint_for_country,
)


class EnquiryContextTests(unittest.TestCase):
    def test_nigeria_ports_not_ghana(self) -> None:
        hints = port_hint_for_country("尼日利亚")
        self.assertIn("Lagos", hints)
        self.assertNotIn("Tema", hints)

    def test_nigeria_three_units(self) -> None:
        msg = "你好我需要3台丰田2az发动机,发货到尼日利亚\n2230540911111,请联系我"
        facts = parse_enquiry_facts(msg)
        self.assertEqual(facts.quantity, "3")
        self.assertIn("尼日利亚", facts.destination)
        self.assertNotIn("具体数量", "、".join(facts.missing))
        self.assertNotIn("期望", "、".join(facts.missing))
        self.assertNotIn("再生", "、".join(facts.missing))

    def test_draft_engine_accessories_and_timeline_process(self) -> None:
        msg = "你好我需要3台丰田2az发动机,发货到尼日利亚"
        facts = parse_enquiry_facts(msg)
        draft = build_contextual_draft_zh(facts, "供货说明。")
        self.assertIn("变速箱", draft)
        self.assertIn("7 个工作日", draft)
        self.assertIn("定制拆解", draft)
        self.assertNotIn("Tema", draft)
        self.assertNotIn("期望交货", draft)
        self.assertNotIn("再生", draft)


if __name__ == "__main__":
    unittest.main()
