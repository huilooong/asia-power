"""Tests for WeCom access control (no network)."""

import unittest

from integrations.wecom_access import (
    authorize_wecom_message,
    extract_chat_id,
    is_group_message,
    parse_allowed_ids,
    strip_bot_mention,
)


class WeComAccessTests(unittest.TestCase):
    def test_parse_allowed_ids(self) -> None:
        ids = parse_allowed_ids(" wr1 , wr2 , ")
        self.assertEqual(ids, {"wr1", "wr2"})

    def test_group_detection(self) -> None:
        self.assertTrue(is_group_message({"ChatType": "group", "ChatId": "wr1"}))
        self.assertFalse(is_group_message({"FromUserName": "user1"}))

    def test_extract_chat_id(self) -> None:
        self.assertEqual(extract_chat_id({"ChatId": "wrABC"}), "wrABC")

    def test_strip_mention(self) -> None:
        self.assertEqual(strip_bot_mention("@子敬 你好"), "你好")

    def test_authorize_group_ok(self) -> None:
        msg = {"ChatType": "group", "ChatId": "wr1", "FromUserName": "u1", "Content": "@子敬 ping"}
        ok, reason = authorize_wecom_message(msg, allowed_chat_ids={"wr1"}, allowed_user_ids=set())
        self.assertTrue(ok)
        self.assertEqual(reason, "")

    def test_reject_unauthorized_chat(self) -> None:
        msg = {"ChatType": "group", "ChatId": "wr9", "FromUserName": "u1", "Content": "@子敬 hi"}
        ok, reason = authorize_wecom_message(msg, allowed_chat_ids={"wr1"}, allowed_user_ids=set())
        self.assertFalse(ok)
        self.assertEqual(reason, "unauthorized_chat")

    def test_image_in_group_no_at_required(self) -> None:
        msg = {"ChatType": "group", "ChatId": "wr1", "FromUserName": "u1", "MsgType": "image", "MediaId": "m1"}
        ok, reason = authorize_wecom_message(msg, allowed_chat_ids={"wr1"}, allowed_user_ids=set())
        self.assertTrue(ok)
        self.assertEqual(reason, "")


if __name__ == "__main__":
    unittest.main()
