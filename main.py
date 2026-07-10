#!/usr/bin/env python3
"""AsiaPower AI OS — interactive CLI entry point (v0.6 Tool Engine)."""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

from coo_core.cli_router import dispatch_cli_message, resolve_agent_id
from coo_core.dispatcher import is_coo_command, log_dispatch

ROOT = Path(__file__).resolve().parent


def main() -> int:
    load_dotenv(ROOT / ".env")

    print("AsiaPower AI OS v1.0 (APCOO + APSales + APInventory + APBD)")
    print("CLI: python main.py  |  APBD: python main.py \"/apbd start\"")
    print("  APSales: python main.py \"/sales customer: <enquiry>\"")
    print("  APInventory: python main.py \"/catalog search G4KJ\"  |  子龙: 库存里有没有 HC25")
    print("Telegram APCOO: python integrations/telegram_coo_bot.py")
    print("Telegram APSales: python integrations/telegram_apsales_bot.py")
    print("Type a message and press Enter. Empty line or Ctrl+C to exit.")
    print("Tip: after code updates, restart CLI (Ctrl+C) so agents load new code.\n")

    def process(message: str) -> None:
        stripped = message.strip()
        agent_id = resolve_agent_id(message)
        if agent_id == "apsales":
            print("\n[APSales]")
        elif agent_id == "apinventory":
            print("\n[APInventory]")
        elif agent_id == "apbd":
            print("\n[APBD]")
        elif is_coo_command(message) or stripped in {"/help", "/start", "/ping", "/health"}:
            print("\n[COO Core]")
        reply = dispatch_cli_message(message, channel="cli")
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
