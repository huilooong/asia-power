"""Tests for Telegram access control (no network)."""

import unittest

from integrations.telegram_access import authorize_chat, is_private_chat, parse_allowed_chat_ids


class TelegramAccessTests(unittest.TestCase):
    def test_parse_allowed_chat_ids(self) -> None:
        ids = parse_allowed_chat_ids(" 111 , 222 , ")
        self.assertEqual(ids, {"111", "222"})

    def test_private_chat_only(self) -> None:
        self.assertTrue(is_private_chat({"id": 1, "type": "private"}))
        self.assertFalse(is_private_chat({"id": 1, "type": "group"}))
        self.assertFalse(is_private_chat({"id": 1, "type": "supergroup"}))

    def test_authorized_private(self) -> None:
        chat = {"id": 12345, "type": "private"}
        ok, reason = authorize_chat(chat, {"12345"})
        self.assertTrue(ok)
        self.assertEqual(reason, "")

    def test_reject_non_private(self) -> None:
        chat = {"id": 12345, "type": "group"}
        ok, reason = authorize_chat(chat, {"12345"})
        self.assertFalse(ok)
        self.assertEqual(reason, "non_private")

    def test_reject_unauthorized(self) -> None:
        chat = {"id": 99999, "type": "private"}
        ok, reason = authorize_chat(chat, {"12345"})
        self.assertFalse(ok)
        self.assertEqual(reason, "unauthorized")

    def test_reject_empty_whitelist(self) -> None:
        chat = {"id": 12345, "type": "private"}
        ok, reason = authorize_chat(chat, set())
        self.assertFalse(ok)
        self.assertEqual(reason, "whitelist_empty")


if __name__ == "__main__":
    unittest.main()
