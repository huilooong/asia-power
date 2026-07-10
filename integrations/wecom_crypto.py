"""WeCom message crypto (WXBizMsgCrypt) — based on official enterprise WeChat algorithm."""

from __future__ import annotations

import base64
import hashlib
import os
import socket
import struct
import time
import xml.etree.ElementTree as ET
from typing import Any

try:
    from Crypto.Cipher import AES
except ImportError as exc:  # pragma: no cover - optional until pip install
    AES = None  # type: ignore[misc, assignment]
    _CRYPTO_IMPORT_ERROR = exc
else:
    _CRYPTO_IMPORT_ERROR = None

# Return codes (official sample parity)
WXBizMsgCrypt_OK = 0
WXBizMsgCrypt_ValidateCorpid_Error = -40005
WXBizMsgCrypt_DecryptAES_Error = -40007
WXBizMsgCrypt_IllegalBuffer = -40008
WXBizMsgCrypt_EncryptAES_Error = -40006


def _ensure_crypto() -> None:
    if AES is None:
        raise RuntimeError(
            "pycryptodome is required for WeCom callbacks. "
            "Run: pip install pycryptodome"
        ) from _CRYPTO_IMPORT_ERROR


class WXBizMsgCrypt:
    """Encrypt/decrypt WeCom callback payloads."""

    def __init__(self, token: str, encoding_aes_key: str, receive_id: str) -> None:
        _ensure_crypto()
        self.token = token
        self.receive_id = receive_id
        key = encoding_aes_key + "="
        self.aes_key = base64.b64decode(key)

    def _signature(self, timestamp: str, nonce: str, encrypt: str) -> str:
        parts = sorted([self.token, timestamp, nonce, encrypt])
        sha = hashlib.sha1("".join(parts).encode("utf-8")).hexdigest()
        return sha

    def verify_url(self, msg_signature: str, timestamp: str, nonce: str, echostr: str) -> tuple[int, str]:
        sig = self._signature(timestamp, nonce, echostr)
        if sig != msg_signature:
            return -40001, ""
        ret, plain = self._decrypt(echostr)
        return ret, plain

    def decrypt_msg(
        self,
        post_data: bytes | str,
        msg_signature: str,
        timestamp: str,
        nonce: str,
    ) -> tuple[int, str]:
        xml_tree = ET.fromstring(post_data)
        encrypt_node = xml_tree.find("Encrypt")
        if encrypt_node is None or not encrypt_node.text:
            return -40002, ""
        encrypt = encrypt_node.text
        sig = self._signature(timestamp, nonce, encrypt)
        if sig != msg_signature:
            return -40001, ""
        return self._decrypt(encrypt)

    def encrypt_msg(self, reply_msg: str, nonce: str, timestamp: str | None = None) -> tuple[int, str]:
        ts = timestamp or str(int(time.time()))
        ret, encrypt = self._encrypt(reply_msg)
        if ret != 0:
            return ret, ""
        sig = self._signature(ts, nonce, encrypt)
        resp_xml = (
            "<xml>"
            f"<Encrypt><![CDATA[{encrypt}]]></Encrypt>"
            f"<MsgSignature><![CDATA[{sig}]]></MsgSignature>"
            f"<TimeStamp>{ts}</TimeStamp>"
            f"<Nonce><![CDATA[{nonce}]]></Nonce>"
            "</xml>"
        )
        return 0, resp_xml

    def _encrypt(self, text: str) -> tuple[int, str]:
        try:
            text_bytes = text.encode("utf-8")
            receive_id = self.receive_id.encode("utf-8")
            rand = os.urandom(16)
            msg_len = struct.pack(">I", len(text_bytes))
            plain = rand + msg_len + text_bytes + receive_id
            pad = 32 - (len(plain) % 32)
            plain += bytes([pad]) * pad
            cipher = AES.new(self.aes_key, AES.MODE_CBC, self.aes_key[:16])
            encrypted = cipher.encrypt(plain)
            return 0, base64.b64encode(encrypted).decode("utf-8")
        except Exception:
            return WXBizMsgCrypt_EncryptAES_Error, ""

    def _decrypt(self, text: str) -> tuple[int, str]:
        try:
            cipher = AES.new(self.aes_key, AES.MODE_CBC, self.aes_key[:16])
            plain = cipher.decrypt(base64.b64decode(text))
            pad = plain[-1]
            if pad < 1 or pad > 32:
                return WXBizMsgCrypt_IllegalBuffer, ""
            content = plain[:-pad]
            msg_len = struct.unpack(">I", content[16:20])[0]
            msg = content[20: 20 + msg_len].decode("utf-8")
            receive_id = content[20 + msg_len:].decode("utf-8")
            if receive_id != self.receive_id:
                return WXBizMsgCrypt_ValidateCorpid_Error, ""
            return 0, msg
        except Exception:
            return WXBizMsgCrypt_DecryptAES_Error, ""


def xml_to_dict(xml_text: str) -> dict[str, Any]:
    """Parse WeCom XML message to a flat dict."""
    root = ET.fromstring(xml_text)
    out: dict[str, Any] = {}
    for child in root:
        tag = child.tag
        out[tag] = (child.text or "").strip()
    return out


def build_text_reply_xml(to_user: str, from_user: str, agent_id: str, content: str) -> str:
    """Passive reply XML (plaintext before encryption)."""
    ts = int(time.time())
    safe = content.replace("]]>", "]]]]><![CDATA[>")
    return (
        "<xml>"
        f"<ToUserName><![CDATA[{to_user}]]></ToUserName>"
        f"<FromUserName><![CDATA[{from_user}]]></FromUserName>"
        f"<CreateTime>{ts}</CreateTime>"
        f"<MsgType><![CDATA[text]]></MsgType>"
        f"<Content><![CDATA[{safe}]]></Content>"
        f"<AgentID>{agent_id}</AgentID>"
        "</xml>"
    )


def random_nonce() -> str:
    return str(int.from_bytes(os.urandom(4), "big") ^ int(time.time()))
