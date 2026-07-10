#!/usr/bin/env python3
"""WeCom callback HTTP server for 子敬 (APSales) — GET verify + POST messages."""

from __future__ import annotations

import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from integrations.wecom_config import load_wecom_config, public_callback_url
from integrations.wecom_crypto import (
    WXBizMsgCrypt,
    build_text_reply_xml,
    random_nonce,
    xml_to_dict,
)
from integrations.wecom_zijing_handler import handle_wecom_xml_message


class WeComCallbackHandler(BaseHTTPRequestHandler):
    server_version = "AsiaPowerWeCom/0.1"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[WeCom callback] {self.address_string()} - {fmt % args}", flush=True)

    @property
    def cfg(self):
        return self.server.wecom_config  # type: ignore[attr-defined]

    @property
    def crypt(self) -> WXBizMsgCrypt:
        return self.server.wecom_crypt  # type: ignore[attr-defined]

    def _query(self, name: str) -> str:
        qs = parse_qs(urlparse(self.path).query)
        vals = qs.get(name) or [""]
        return vals[0]

    def _path_ok(self) -> bool:
        path = urlparse(self.path).path
        return path == self.cfg.callback_path or path.rstrip("/") == self.cfg.callback_path.rstrip("/")

    def do_GET(self) -> None:
        if not self._path_ok():
            self.send_error(404)
            return

        msg_signature = self._query("msg_signature")
        timestamp = self._query("timestamp")
        nonce = self._query("nonce")
        echostr = self._query("echostr")

        ret, plain = self.crypt.verify_url(msg_signature, timestamp, nonce, echostr)
        if ret != 0 or not plain:
            self.send_error(403, "signature verify failed")
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(plain.encode("utf-8"))

    def do_POST(self) -> None:
        if not self._path_ok():
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        msg_signature = self._query("msg_signature")
        timestamp = self._query("timestamp")
        nonce = self._query("nonce")

        ret, plain_xml = self.crypt.decrypt_msg(body, msg_signature, timestamp, nonce)
        if ret != 0:
            self.send_error(403, "decrypt failed")
            return

        msg = xml_to_dict(plain_xml)
        reply_text = handle_wecom_xml_message(msg, cfg=self.cfg)

        if not reply_text:
            self.send_response(200)
            self.end_headers()
            return

        to_user = msg.get("FromUserName", "")
        from_user = msg.get("ToUserName", "")
        agent_id = msg.get("AgentID") or self.cfg.agent_id
        reply_xml = build_text_reply_xml(to_user, from_user, str(agent_id), reply_text)
        ret2, encrypted = self.crypt.encrypt_msg(reply_xml, random_nonce(), timestamp)
        if ret2 != 0:
            self.send_error(500, "encrypt failed")
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/xml; charset=utf-8")
        self.end_headers()
        self.wfile.write(encrypted.encode("utf-8"))


def run_server() -> int:
    load_dotenv(ROOT / ".env")
    cfg = load_wecom_config()

    if not cfg.enabled:
        print(
            "Error: WeCom not configured. Set WECOM_CORP_ID, WECOM_AGENT_ID, "
            "WECOM_AGENT_SECRET, WECOM_CALLBACK_TOKEN, WECOM_ENCODING_AES_KEY in .env",
            file=sys.stderr,
        )
        return 1

    try:
        crypt = WXBizMsgCrypt(cfg.token, cfg.encoding_aes_key, cfg.corp_id)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    httpd = HTTPServer((cfg.callback_host, cfg.callback_port), WeComCallbackHandler)
    httpd.wecom_config = cfg  # type: ignore[attr-defined]
    httpd.wecom_crypt = crypt  # type: ignore[attr-defined]

    print("AsiaPower WeCom · AsiaPower 库存 Agent callback server（内部昵称：子敬）")
    print(f"  listen: http://{cfg.callback_host}:{cfg.callback_port}{cfg.callback_path}")
    print(f"  admin URL (paste in 企业微信后台): {public_callback_url(cfg)}")
    print("  Ctrl+C to stop.")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    return 0


def main() -> int:
    return run_server()


if __name__ == "__main__":
    raise SystemExit(main())
