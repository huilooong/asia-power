"""Tests for growth autopilot helpers."""

from __future__ import annotations

import unittest

from customer_gateway.growth_autopilot import _traffic_actions


class GrowthAutopilotTests(unittest.TestCase):
    def test_traffic_actions_low_pv(self) -> None:
        actions = _traffic_actions(
            {"available": True, "pageviews": 5, "whatsapp_clicks": 0, "top_countries": []},
            open_leads=2,
        )
        self.assertTrue(any("访问量偏低" in a for a in actions))
        self.assertTrue(any("2 条" in a for a in actions))

    def test_traffic_actions_normal(self) -> None:
        actions = _traffic_actions(
            {
                "available": True,
                "pageviews": 120,
                "whatsapp_clicks": 3,
                "top_countries": [("Ghana", 10)],
                "top_paths": [("/half-cuts/", 20)],
            },
            open_leads=0,
        )
        self.assertTrue(any("WhatsApp" in a for a in actions))
        self.assertTrue(any("Ghana" in a for a in actions))


if __name__ == "__main__":
    unittest.main()
