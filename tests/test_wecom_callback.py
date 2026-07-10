"""WeCom callback crypto (no network)."""

from __future__ import annotations

import unittest

from integrations.wecom_crypto import WXBizMsgCrypt, build_text_reply_xml, xml_to_dict


class WeComCryptoTests(unittest.TestCase):
    """Round-trip encrypt/decrypt matches official WeCom algorithm."""

    def setUp(self) -> None:
        self.token = "QDG6eK"
        self.aes_key = "jWmYm7qr5nMoAUwZRjGtBxmz3K1Z9Vf3"
        self.corp_id = "wx5823bf96d3bd56c7"
        self.crypt = WXBizMsgCrypt(self.token, self.aes_key, self.corp_id)

    def test_encrypt_decrypt_roundtrip(self) -> None:
        plain = "hello wecom"
        ret, encrypted = self.crypt._encrypt(plain)
        self.assertEqual(ret, 0)
        self.assertTrue(encrypted)

        ret2, decrypted = self.crypt._decrypt(encrypted)
        self.assertEqual(ret2, 0)
        self.assertEqual(decrypted, plain)

    def test_verify_url_with_encrypted_echostr(self) -> None:
        echostr_plain = "test_echostr_12345"
        ret, echostr_enc = self.crypt._encrypt(echostr_plain)
        self.assertEqual(ret, 0)

        nonce = "1234567890"
        timestamp = "1409659589"
        sig = self.crypt._signature(timestamp, nonce, echostr_enc)

        ret2, plain = self.crypt.verify_url(sig, timestamp, nonce, echostr_enc)
        self.assertEqual(ret2, 0)
        self.assertEqual(plain, echostr_plain)

    def test_decrypt_post_xml(self) -> None:
        msg_xml = (
            "<xml><ToUserName><![CDATA[toUser]]></ToUserName>"
            "<FromUserName><![CDATA[fromUser]]></FromUserName>"
            "<CreateTime>1348831860</CreateTime>"
            "<MsgType><![CDATA[text]]></MsgType>"
            "<Content><![CDATA[this is a test]]></Content>"
            "<MsgId>1234567890123456</MsgId>"
            "<AgentID>1</AgentID></xml>"
        )
        ret, encrypted = self.crypt._encrypt(msg_xml)
        self.assertEqual(ret, 0)

        nonce = "1234567890"
        timestamp = "1409659589"
        sig = self.crypt._signature(timestamp, nonce, encrypted)
        post_body = f"<xml><Encrypt><![CDATA[{encrypted}]]></Encrypt></xml>"

        ret2, plain_xml = self.crypt.decrypt_msg(post_body, sig, timestamp, nonce)
        self.assertEqual(ret2, 0)
        parsed = xml_to_dict(plain_xml)
        self.assertEqual(parsed["Content"], "this is a test")
        self.assertEqual(parsed["MsgType"], "text")

    def test_build_text_reply_xml(self) -> None:
        xml = build_text_reply_xml("user1", "corp", "1000002", "收到")
        parsed = xml_to_dict(xml)
        self.assertEqual(parsed["MsgType"], "text")
        self.assertEqual(parsed["Content"], "收到")
        self.assertEqual(parsed["AgentID"], "1000002")


if __name__ == "__main__":
    unittest.main()
