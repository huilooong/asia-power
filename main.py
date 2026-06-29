#!/usr/bin/env python3
"""AsiaPower AI OS — interactive CLI entry point (v0.6 Tool Engine)."""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

from coo_core.dispatcher import dispatch_message, is_coo_command, log_dispatch
from sales_core.apsales_handler import is_apsales_command, is_slash_command

ROOT = Path(__file__).resolve().parent


def main() -> int:
    load_dotenv(ROOT / ".env")

    print("AsiaPower AI OS v1.0 (APCOO + APSales)")
    print("CLI: python main.py  |  APSales: python main.py \"/sales customer: <enquiry>\"")
    print("Telegram APCOO: python integrations/telegram_coo_bot.py")
    print("Telegram APSales: python integrations/telegram_apsales_bot.py")
    print("Type a message and press Enter. Empty line or Ctrl+C to exit.\n")

    def process(message: str) -> None:
        stripped = message.strip()
        agent_id = "apcoo"
        if (
            is_apsales_command(message)
            or stripped.lower().startswith("/sales")
            or stripped.lower().startswith("/whatsapp")
            or stripped.lower().startswith("/drafts")
            or stripped.lower().startswith("/conversations")
            or stripped.lower().startswith("/learning")
            or stripped.lower().startswith("/sales-intelligence")
        ) and not is_coo_command(message):
            agent_id = "apsales"
            print("\n[APSales]")
        elif is_coo_command(message) or stripped in {"/help", "/start"}:
            print("\n[COO Core]")
        elif is_slash_command(message):
            agent_id = "apsales"
            print("\n[APSales]")
        reply = dispatch_message(message, source="cli", agent_id=agent_id)
        print(reply)
        log_dispatch("cli", message, reply)

    if len(sys.argv) > 1:
        process(" ".join(sys.argv[1:]))
        return 0

    try:
        while True:
            try:
                message = input("You> ").strip()
            except EOFError:
                break
            if not message:
                break
            process(message)
    except KeyboardInterrupt:
        print("\nBye.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
