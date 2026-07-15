"""Tests for growth autopilot helpers."""

from __future__ import annotations

import unittest

from customer_gateway.growth_autopilot import _traffic_actions, should_draft_outreach_candidate


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

    def test_should_draft_high_any_source(self) -> None:
        self.assertTrue(
            should_draft_outreach_candidate({
                "source": "whatsapp_intelligence",
                "channel": "whatsapp",
                "priority": "high",
            })
        )
        self.assertTrue(
            should_draft_outreach_candidate({
                "source": "website_lead",
                "channel": "email",
                "priority": "high",
            })
        )

    def test_should_draft_medium_website_email_only(self) -> None:
        self.assertTrue(
            should_draft_outreach_candidate({
                "source": "website_lead",
                "channel": "email",
                "priority": "medium",
            })
        )
        # Medium WhatsApp profile follow-ups stay out (not the website backlog path).
        self.assertFalse(
            should_draft_outreach_candidate({
                "source": "whatsapp_intelligence",
                "channel": "whatsapp",
                "priority": "medium",
            })
        )

    def test_should_not_draft_website_without_email(self) -> None:
        # Even high website leads without email must not go to email outreach drafts.
        self.assertFalse(
            should_draft_outreach_candidate({
                "source": "website_lead",
                "channel": "whatsapp",
                "priority": "high",
            })
        )
        self.assertFalse(
            should_draft_outreach_candidate({
                "source": "website_lead",
                "channel": "whatsapp",
                "priority": "medium",
            })
        )

    def test_should_not_draft_unknown_or_low(self) -> None:
        self.assertFalse(
            should_draft_outreach_candidate({
                "source": "website_lead",
                "channel": "email",
                "priority": "low",
            })
        )
        self.assertFalse(should_draft_outreach_candidate({}))


if __name__ == "__main__":
    unittest.main()
