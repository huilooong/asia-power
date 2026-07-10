#!/usr/bin/env python3
"""Telegram COO Bot — long polling MVP (private chat + whitelist only)."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from integrations.telegram_access import parse_allowed_chat_ids
from integrations.telegram_coo_handler import handle_telegram_update
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
    handle_telegram_update(message, allowed=allowed)


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
            try:
                result = _api("getUpdates", {"timeout": POLL_TIMEOUT, "offset": offset})
            except urllib.error.HTTPError as exc:
                if exc.code == 409:
                    print(
                        "getUpdates 409 Conflict — another bot instance is polling. "
                        "Retrying in 5s…",
                        file=sys.stderr,
                    )
                    time.sleep(5)
                    continue
                print(f"getUpdates HTTP error: {exc}", file=sys.stderr)
                time.sleep(3)
                continue
            except urllib.error.URLError as exc:
                print(f"getUpdates network error: {exc}", file=sys.stderr)
                time.sleep(3)
                continue

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
