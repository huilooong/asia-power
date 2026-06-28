#!/usr/bin/env python3
"""Telegram COO Bot — long polling MVP (private chat + whitelist only)."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from coo_core.dispatcher import dispatch_message
from integrations.telegram_access import authorize_chat, parse_allowed_chat_ids
from tools import message_tool

POLL_TIMEOUT = 30


def _token() -> str:
    return message_tool.coo_telegram_token()


def _allowed_chat_ids() -> set[str]:
    return parse_allowed_chat_ids(os.getenv("COO_TELEGRAM_ALLOWED_CHAT_IDS"))


def _api(method: str, params: dict | None = None) -> dict:
    token = _token()
    query = urllib.parse.urlencode(params or {})
    url = f"https://api.telegram.org/bot{token}/{method}"
    if query:
        url = f"{url}?{query}"
    with urllib.request.urlopen(url, timeout=POLL_TIMEOUT + 10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _handle_update(update: dict, allowed: set[str]) -> None:
    message = update.get("message") or update.get("edited_message")
    if not message:
        return

    chat = message.get("chat") or {}
    chat_id = str(chat.get("id", ""))
    text = (message.get("text") or "").strip()
    if not text:
        return

    ok, reason = authorize_chat(chat, allowed)
    if not ok:
        message_tool.log_message(
            "telegram", "inbound", chat_id, text, status=f"rejected:{reason}",
        )
        return

    message_tool.log_message("telegram", "inbound", chat_id, text, status="ok")

    user = message.get("from") or {}
    user_id = str(user.get("id", chat_id))

    try:
        reply = dispatch_message(text, source="telegram", user_id=user_id)
        message_tool.send_telegram_message(chat_id, reply)
        message_tool.log_message("telegram", "outbound", chat_id, reply, status="ok")
    except Exception as exc:
        err = f"COO error: {exc}"
        message_tool.log_message("telegram", "outbound", chat_id, err, status="error")
        try:
            message_tool.send_telegram_message(chat_id, "Sorry, something went wrong. Check server logs.")
        except Exception:
            pass


def run_bot(once: bool = False) -> int:
    load_dotenv(ROOT / ".env")

    if not _token():
        print("Error: COO_TELEGRAM_BOT_TOKEN is required", file=sys.stderr)
        return 1

    allowed = _allowed_chat_ids()
    if not allowed:
        print("Error: COO_TELEGRAM_ALLOWED_CHAT_IDS is required (comma-separated)", file=sys.stderr)
        return 1

    offset = 0
    print("AsiaPower COO Telegram bot (private + whitelist only). Ctrl+C to stop.")

    try:
        while True:
            result = _api("getUpdates", {"timeout": POLL_TIMEOUT, "offset": offset})
            if not result.get("ok"):
                print(f"getUpdates failed: {result}", file=sys.stderr)
                time.sleep(3)
                continue

            for update in result.get("result", []):
                offset = max(offset, int(update.get("update_id", 0)) + 1)
                try:
                    _handle_update(update, allowed)
                except Exception as exc:
                    print(f"handle update error: {exc}", file=sys.stderr)

            if once:
                break
    except KeyboardInterrupt:
        print("\nStopped.")

    return 0


def main() -> int:
    once = "--once" in sys.argv
    return run_bot(once=once)


if __name__ == "__main__":
    raise SystemExit(main())
