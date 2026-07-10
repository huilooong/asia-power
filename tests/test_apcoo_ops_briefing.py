"""Tests for APCOO-001 CEO ops briefing and query detection."""

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from coo_core.ceo_ops_briefing import (
    _BRIEF_SECTIONS,
    build_ceo_ops_briefing,
    detect_ceo_ops_query,
    detect_website_content_query,
    format_ceo_daily_brief,
    render_ceo_daily_brief,
    user_explicitly_requests_memory,
)
from coo_core.dispatcher import dispatch_message
from customer_gateway.gateway_readonly import reconfigure_paths


class APCOOOpsBriefingTests(unittest.TestCase):
    def test_detect_ceo_ops_query_positive(self) -> None:
        self.assertTrue(detect_ceo_ops_query("今天帮我总结一下 AsiaPower"))
        self.assertTrue(detect_ceo_ops_query("当前状态怎么样"))
        self.assertTrue(detect_ceo_ops_query("项目进展和风险"))
        self.assertTrue(detect_ceo_ops_query("今天做了什么"))

    def test_detect_ceo_ops_query_negative_website(self) -> None:
        self.assertFalse(detect_ceo_ops_query("总结 asia-power.com 网站内容"))
        self.assertFalse(detect_ceo_ops_query("优化官网文案"))
        self.assertFalse(detect_ceo_ops_query("asia-power.com SEO 怎么改"))

    def test_detect_website_content_query(self) -> None:
        self.assertTrue(detect_website_content_query("总结 asia-power.com 网站内容"))
        self.assertTrue(detect_website_content_query("优化官网文案"))
        self.assertTrue(detect_website_content_query("asia-power.com SEO 建议"))
        self.assertFalse(detect_website_content_query("今天帮我总结一下 AsiaPower"))

    def test_ambiguous_domain_defaults_ops_not_website(self) -> None:
        self.assertTrue(detect_ceo_ops_query("今天帮我总结一下 asia-power.com"))
        self.assertFalse(detect_website_content_query("今天帮我总结一下 asia-power.com"))

    def test_format_ceo_daily_brief_has_fixed_sections(self) -> None:
        out = format_ceo_daily_brief({
            "generated_at": "2026-06-29 00:00 UTC",
            "tasks": {"ok": False, "error": "x"},
            "decisions": {"ok": False, "error": "x"},
            "drafts": {"ok": False, "error": "x"},
            "whatsapp": {"ok": False, "error": "x"},
            "health": {"ok": False, "error": "x"},
            "daily_log": {"ok": False, "error": "x"},
        })
        self.assertIn("CEO Daily Brief", out)
        for section in _BRIEF_SECTIONS:
            self.assertIn(f"## {section}", out)
        self.assertNotIn("AsiaPower 是一个", out)

    def test_build_ceo_ops_briefing_never_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            reconfigure_paths(Path(tmp) / "gateway")
            with mock.patch("tools.task_tool.summarize_tasks", side_effect=OSError("no tasks")):
                out = build_ceo_ops_briefing()
        self.assertIn("内部运营快照", out)
        self.assertIn("读取失败", out)

    def test_render_ceo_daily_brief_never_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            reconfigure_paths(Path(tmp) / "gateway")
            with mock.patch("tools.task_tool.summarize_tasks", side_effect=OSError("no tasks")):
                out = render_ceo_daily_brief()
        self.assertIn("CEO Daily Brief", out)
        for section in _BRIEF_SECTIONS:
            self.assertIn(f"## {section}", out)

    def test_user_explicitly_requests_memory(self) -> None:
        self.assertTrue(user_explicitly_requests_memory("请记住这个决定"))
        self.assertFalse(user_explicitly_requests_memory("今天做了什么"))

    def test_dispatcher_ops_briefing_is_deterministic_daily_brief(self) -> None:
        with mock.patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            with mock.patch("coo_core.dispatcher.call_openai") as mock_openai:
                out = dispatch_message(
                    "今天帮我总结一下 AsiaPower",
                    source="telegram",
                    agent_id="apcoo",
                )
        mock_openai.assert_not_called()
        self.assertIn("CEO Daily Brief", out)
        for section in _BRIEF_SECTIONS:
            self.assertIn(f"## {section}", out)
        self.assertNotIn("AsiaPower 是一个", out)

    def test_dispatcher_ops_briefing_no_company_intro(self) -> None:
        fake_brief = "## 今日结论\n- 测试结论"
        with mock.patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            with mock.patch(
                "coo_core.ceo_ops_briefing.render_ceo_daily_brief",
                return_value=fake_brief,
            ):
                out = dispatch_message("当前状态", source="telegram", agent_id="apcoo")
        self.assertEqual(out, fake_brief)
        self.assertNotIn("AsiaPower 是一个", out)

    def test_dispatcher_website_mode_uses_llm(self) -> None:
        captured: dict[str, str] = {}

        def fake_openai(_client, _model, system_prompt: str, _user: str, **_) -> str:
            captured["system"] = system_prompt
            return "AsiaPower 是一个全球动力总成采购平台，建议优化首页文案。"

        with mock.patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            with mock.patch("coo_core.dispatcher.call_openai", side_effect=fake_openai):
                out = dispatch_message(
                    "总结 asia-power.com 网站内容",
                    source="telegram",
                    agent_id="apcoo",
                )
        self.assertIn("AsiaPower 是一个", out)
        self.assertIn("网站/文案/SEO", captured.get("system", ""))

    def test_dispatcher_ops_query_skips_auto_memory(self) -> None:
        with mock.patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            with mock.patch("coo_core.dispatcher.apply_memory_tags") as mock_save:
                dispatch_message("当前状态", source="telegram", agent_id="apcoo")
        mock_save.assert_not_called()

    def test_dispatcher_remember_still_saves_memory(self) -> None:
        with mock.patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}):
            with mock.patch(
                "coo_core.dispatcher.call_openai",
                return_value="已记录。\nMEMORY_TO_SAVE: category=general | note",
            ):
                with mock.patch(
                    "coo_core.dispatcher.apply_memory_tags",
                    return_value=["Saved memory: note"],
                ) as mock_save:
                    out = dispatch_message("请记住这个优先级", source="telegram", agent_id="apcoo")
        mock_save.assert_called_once()
        self.assertIn("Saved memory", out)

    def test_ping_health_unchanged(self) -> None:
        ping = dispatch_message("/ping", source="telegram", agent_id="apcoo")
        health = dispatch_message("/health", source="telegram", agent_id="apcoo")
        self.assertIn("APCOO Online", ping)
        self.assertIn("APCOO Health Check", health)


if __name__ == "__main__":
    unittest.main()
