import json
import tempfile
import unittest
from pathlib import Path

from customer_gateway.ai_reply_control import handle_command, load_state, change_state


class ReplyControlTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def command(self, text, **kw):
        return handle_command(text, root=self.root, **{"user_id": "123", "chat_id": "123", "chat_type": "private", "allowed_users": {"123"}, **kw})

    def test_private_owner_only_and_no_ambiguous_phone(self):
        self.assertIn("无权", self.command("暂停全部AI", user_id="456"))
        self.assertIn("无权", self.command("暂停全部AI", chat_type="group"))
        self.assertIn("国际区号", self.command("暂停AI 0541234567"))
        self.assertFalse(load_state(self.root)["global"])

    def test_pause_persists_until_explicit_resume(self):
        self.command("暂停AI +233555000111")
        self.command("暂停全部AI")
        self.command("恢复全部AI")
        state = load_state(self.root)
        self.assertFalse(state["global"]["paused"])
        self.assertTrue(state["customers"]["+233555000111"]["paused"])
        before = state["customers"]["+233555000111"]["revision"]
        self.command("恢复AI +233555000111")
        state = load_state(self.root)
        self.assertFalse(state["customers"]["+233555000111"]["paused"])
        self.assertNotEqual(before, state["customers"]["+233555000111"]["revision"])

    def test_bot_control_does_not_match_customer_prose(self):
        self.assertIsNone(self.command("The customer asked about pausing replies"))

    def test_human_echo_replay_does_not_repause_after_resume(self):
        change_state(self.root, "pause", "+233555000111", "whatsapp_human:ABC")
        self.command("恢复AI +233555000111")
        change_state(self.root, "pause", "+233555000111", "whatsapp_human:ABC")
        self.assertFalse(load_state(self.root)["customers"]["+233555000111"]["paused"])

    def test_corrupt_state_never_reset(self):
        self.command("暂停全部AI")
        dest = self.root / "memory/customer_gateway/ai_reply_control.json"
        dest.write_text("broken")
        self.assertIn("失败", self.command("恢复全部AI"))
        self.assertEqual(dest.read_text(), "broken")
