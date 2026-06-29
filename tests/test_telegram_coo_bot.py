"""Tests for Telegram COO bot — guaranteed replies and /ping."""

import unittest
from unittest import mock

from coo_core.dispatcher import dispatch_message
from coo_core.health_check import ping_response
from integrations.telegram_coo_handler import (
    EMPTY_REPLY_FALLBACK,
    FALLBACK_REPLY_ZH,
    dispatch_telegram_message,
    handle_telegram_update,
)


class TelegramCOOBotTests(unittest.TestCase):
    def test_ping_response(self) -> None:
        out = ping_response()
        self.assertIn("APCOO Online", out)
        self.assertIn("Telegram", out)
        self.assertIn("Version", out)

    def test_dispatch_ping_command(self) -> None:
        out = dispatch_message("/ping", source="telegram", agent_id="apcoo")
        self.assertIn("APCOO Online", out)

    def test_dispatch_health_command(self) -> None:
        out = dispatch_message("/health", source="telegram", agent_id="apcoo")
        self.assertIn("APCOO Health Check", out)
        self.assertIn("Sales Brain", out)

    def test_plain_message_replies_via_dispatch(self) -> None:
        with mock.patch("coo_core.dispatcher.call_openai", return_value="Hello CEO"):
            out = dispatch_message("What is our GMV strategy?", source="telegram", agent_id="apcoo")
        self.assertIn("Hello CEO", out)

    def test_dispatch_exception_returns_zh_fallback(self) -> None:
        with mock.patch("coo_core.dispatcher.call_openai", side_effect=RuntimeError("boom")):
            out = dispatch_message("plain text", source="telegram", agent_id="apcoo")
        self.assertIn("APCOO 已收到你的消息", out)
        self.assertIn("异常", out)

    def test_empty_reply_gets_fallback(self) -> None:
        with mock.patch(
            "integrations.telegram_coo_handler.dispatch_message",
            return_value="",
        ):
            out = dispatch_telegram_message("hello", chat_id="1", user_id="1")
        self.assertEqual(out, EMPTY_REPLY_FALLBACK)

    def test_handle_update_sends_reply(self) -> None:
        message = {
            "chat": {"id": 123, "type": "private"},
            "from": {"id": 456},
            "text": "hello",
        }
        with mock.patch(
            "integrations.telegram_coo_handler.dispatch_telegram_message",
            return_value="reply text",
        ) as mock_dispatch:
            with mock.patch("tools.message_tool.send_telegram_message") as mock_send:
                with mock.patch(
                    "integrations.telegram_access.authorize_chat",
                    return_value=(True, "ok"),
                ):
                    handle_telegram_update(message, allowed={"123"})
        mock_dispatch.assert_called_once()
        mock_send.assert_called_once_with("123", "reply text")

    def test_handle_update_exception_sends_fallback(self) -> None:
        message = {
            "chat": {"id": 123, "type": "private"},
            "from": {"id": 456},
            "text": "hello",
        }
        with mock.patch(
            "integrations.telegram_coo_handler.dispatch_telegram_message",
            side_effect=RuntimeError("fail"),
        ):
            with mock.patch("tools.message_tool.send_telegram_message") as mock_send:
                with mock.patch(
                    "integrations.telegram_access.authorize_chat",
                    return_value=(True, "ok"),
                ):
                    handle_telegram_update(message, allowed={"123"})
        mock_send.assert_called_once_with("123", FALLBACK_REPLY_ZH)


if __name__ == "__main__":
    unittest.main()
